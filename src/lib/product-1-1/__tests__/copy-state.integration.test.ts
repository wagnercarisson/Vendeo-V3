// @vitest-environment node
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Client as PgClient } from "pg";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import {
  closeIsolatedContext,
  createCampaign,
  createIsolatedContext,
  createTestStore,
  pgCallJson,
  pgRows,
  type IsolatedContext,
} from "./integration-harness";

/**
 * F56.2b1b — Plano 09 (complemento C1): provas REAIS, no Postgres isolado, das
 * RPCs de estado da copy do Produto 1:1 (`product_1_1_apply_copy_state` /
 * `product_1_1_cancel_copy`, migration `20261009000005`).
 *
 * Provider SIMULADO (nenhuma chamada paga; nenhuma RPC chama provider). Storage
 * não é exercitado aqui — apenas Postgres real. Fixtures append-only por UUID
 * (O3): nenhuma linha de outras fases é apagada/sobrescrita para "limpar".
 */

let ctx: IsolatedContext;
let storeId: string;

interface ApplyEnvelope {
  applied: boolean;
  outcome: string;
  state: string | null;
}
interface CancelEnvelope {
  applied: boolean;
  state: string | null;
  canceled: boolean;
}

async function applyCopy(
  client: PgClient,
  campaignId: string,
  operationId: string,
  state: string,
  copyText: string | null = null,
  copyPayload: Record<string, unknown> | null = null,
): Promise<ApplyEnvelope> {
  const payloadParam = copyPayload === null ? null : JSON.stringify(copyPayload);
  return pgCallJson<ApplyEnvelope>(
    client,
    "SELECT public.product_1_1_apply_copy_state($1, $2, $3, $4, $5::jsonb) AS r",
    [campaignId, operationId, state, copyText, payloadParam],
  );
}

async function cancelCopy(
  client: PgClient,
  campaignId: string,
  operationId: string,
  reason: string,
): Promise<CancelEnvelope> {
  return pgCallJson<CancelEnvelope>(
    client,
    "SELECT public.product_1_1_cancel_copy($1, $2, $3) AS r",
    [campaignId, operationId, reason],
  );
}

async function copyStateRows(
  client: PgClient,
  campaignId: string,
  operationId: string,
): Promise<Array<{ state: string; copy_text: string | null; copy_payload: unknown }>> {
  return pgRows<{ state: string; copy_text: string | null; copy_payload: unknown }>(
    client,
    "SELECT state, copy_text, copy_payload FROM public.product_1_1_copy_state WHERE campaign_id = $1 AND operation_id = $2",
    [campaignId, operationId],
  );
}

async function cancellationRows(
  client: PgClient,
  campaignId: string,
  operationId: string,
): Promise<Array<{ reason: string }>> {
  return pgRows<{ reason: string }>(
    client,
    "SELECT reason FROM public.product_1_1_copy_cancellations WHERE campaign_id = $1 AND operation_id = $2",
    [campaignId, operationId],
  );
}

/** Executa `sql` sob `role` e devolve o erro (ou `null` se NÃO foi negado). */
async function deniedUnderRole(
  client: PgClient,
  role: string,
  sql: string,
  params: unknown[] = [],
): Promise<unknown | null> {
  await client.query("BEGIN");
  try {
    await client.query(`SET LOCAL ROLE ${role}`);
    await client.query("SAVEPOINT probe");
    let caught: unknown = null;
    try {
      await client.query(sql, params as never[]);
    } catch (error) {
      caught = error;
    }
    await client.query("ROLLBACK TO SAVEPOINT probe");
    return caught;
  } finally {
    await client.query("ROLLBACK");
  }
}

/** Executa `sql` sob `role` e devolve `true` quando NÃO houve erro. */
async function allowedUnderRole(
  client: PgClient,
  role: string,
  sql: string,
  params: unknown[] = [],
): Promise<boolean> {
  await client.query("BEGIN");
  try {
    await client.query(`SET LOCAL ROLE ${role}`);
    await client.query(sql, params as never[]);
    return true;
  } catch {
    return false;
  } finally {
    await client.query("ROLLBACK");
  }
}

describe("F56.2b1b — copy state (Postgres real)", () => {
  beforeAll(async () => {
    ctx = await createIsolatedContext();
    const store = await createTestStore(ctx.supabase);
    storeId = store.storeId;
  }, 60_000);

  afterAll(async () => {
    await closeIsolatedContext(ctx);
  });

  it("C1 — primeira escrita CONCORRENTE (conteúdo EQUIVALENTE) ⇒ UMA linha; perdedora re-lê (idempotent)", async () => {
    const campaign = await createCampaign(ctx.supabase, storeId);
    const operation = randomUUID();
    const payload = { title: "Título", caption: "Legenda", hashtags: ["#a"] };

    const [a, b] = await Promise.all([
      applyCopy(ctx.pg, campaign, operation, "completed", "texto entregue", payload),
      applyCopy(ctx.pg2, campaign, operation, "completed", "texto entregue", payload),
    ]);

    // NUNCA `unique_violation` / `rejected` com state null: um cria, o outro reusa.
    const outcomes = [a.outcome, b.outcome].sort();
    expect(outcomes).toEqual(["applied", "idempotent"]);

    const rows = await copyStateRows(ctx.pg, campaign, operation);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ state: "completed", copy_text: "texto entregue" });
    expect(rows[0].copy_payload).toEqual(payload);
  }, 60_000);

  it("C1 — primeira escrita CONCORRENTE (conteúdo DIVERGENTE) ⇒ UMA linha e `conflict`; persistido INALTERADO", async () => {
    const campaign = await createCampaign(ctx.supabase, storeId);
    const operation = randomUUID();

    const [a, b] = await Promise.all([
      applyCopy(ctx.pg, campaign, operation, "completed", "texto A", { k: "A" }),
      applyCopy(ctx.pg2, campaign, operation, "completed", "texto B", { k: "B" }),
    ]);

    expect([a.outcome, b.outcome].sort()).toEqual(["applied", "conflict"]);

    const rows = await copyStateRows(ctx.pg, campaign, operation);
    expect(rows).toHaveLength(1);
    // O persistido é o do VENCEDOR (nunca sobrescrito pelo perdedor).
    const expectedText = a.outcome === "applied" ? "texto A" : "texto B";
    expect(rows[0].copy_text).toBe(expectedText);

    // Replay do VENCEDOR ⇒ idempotent; replay do PERDEDOR ⇒ conflict (nada gravado).
    const winnerText = expectedText;
    const winnerPayload = winnerText === "texto A" ? { k: "A" } : { k: "B" };
    const replay = await applyCopy(ctx.pg, campaign, operation, "completed", winnerText, winnerPayload);
    expect(replay.outcome).toBe("idempotent");
    const loserText = winnerText === "texto A" ? "texto B" : "texto A";
    const loserPayload = winnerText === "texto A" ? { k: "B" } : { k: "A" };
    const divergentReplay = await applyCopy(ctx.pg, campaign, operation, "completed", loserText, loserPayload);
    expect(divergentReplay.outcome).toBe("conflict");
    expect((await copyStateRows(ctx.pg, campaign, operation))[0].copy_text).toBe(winnerText);
  }, 60_000);

  it("terminal PROTEGIDO — completed↔failed cruzados ⇒ `rejected`; escrita `pending` tardia ⇒ `rejected`", async () => {
    // (a) completed persistido; `failed` posterior ⇒ rejected (persistido INALTERADO).
    const campaignA = await createCampaign(ctx.supabase, storeId);
    const opA = randomUUID();
    const firstA = await applyCopy(ctx.pg, campaignA, opA, "completed", "texto", { k: 1 });
    expect(firstA).toMatchObject({ applied: true, outcome: "applied", state: "completed" });
    const failedOverCompleted = await applyCopy(ctx.pg, campaignA, opA, "failed");
    expect(failedOverCompleted).toMatchObject({ applied: false, outcome: "rejected", state: "completed" });
    // Escrita `pending` TARDIA após terminal ⇒ rejected.
    const pendingOverCompleted = await applyCopy(ctx.pg, campaignA, opA, "pending");
    expect(pendingOverCompleted).toMatchObject({ applied: false, outcome: "rejected", state: "completed" });
    const rowsA = await copyStateRows(ctx.pg, campaignA, opA);
    expect(rowsA).toHaveLength(1);
    expect(rowsA[0]).toMatchObject({ state: "completed", copy_text: "texto" });

    // (b) failed persistido; `completed` posterior ⇒ rejected (persistido INALTERADO).
    const campaignB = await createCampaign(ctx.supabase, storeId);
    const opB = randomUUID();
    const firstB = await applyCopy(ctx.pg, campaignB, opB, "failed");
    expect(firstB).toMatchObject({ applied: true, outcome: "applied", state: "failed" });
    const completedOverFailed = await applyCopy(ctx.pg, campaignB, opB, "completed", "texto");
    expect(completedOverFailed).toMatchObject({ applied: false, outcome: "rejected", state: "failed" });
    const pendingOverFailed = await applyCopy(ctx.pg, campaignB, opB, "pending");
    expect(pendingOverFailed).toMatchObject({ applied: false, outcome: "rejected", state: "failed" });
    const rowsB = await copyStateRows(ctx.pg, campaignB, opB);
    expect(rowsB).toHaveLength(1);
    expect(rowsB[0]).toMatchObject({ state: "failed", copy_text: null });
  }, 60_000);

  it("replay vinculado a CONTEÚDO — equivalente ⇒ `idempotent` (UMA linha); `copy_text`/`copy_payload` divergentes ⇒ `conflict`", async () => {
    const campaign = await createCampaign(ctx.supabase, storeId);
    const operation = randomUUID();
    const payload = { title: "T", caption: "C" };
    const seeded = await applyCopy(ctx.pg, campaign, operation, "completed", "texto", payload);
    expect(seeded.outcome).toBe("applied");

    // Replay EQUIVALENTE ⇒ idempotent (nada gravado).
    const equivalent = await applyCopy(ctx.pg, campaign, operation, "completed", "texto", payload);
    expect(equivalent).toMatchObject({ applied: false, outcome: "idempotent", state: "completed" });
    expect(await copyStateRows(ctx.pg, campaign, operation)).toHaveLength(1);

    // `copy_text` DIVERGENTE ⇒ conflict (persistido INALTERADO).
    const divergentText = await applyCopy(ctx.pg, campaign, operation, "completed", "outro texto", payload);
    expect(divergentText).toMatchObject({ applied: false, outcome: "conflict", state: "completed" });
    expect((await copyStateRows(ctx.pg, campaign, operation))[0].copy_text).toBe("texto");

    // `copy_payload` DIVERGENTE ⇒ conflict (persistido INALTERADO).
    const divergentPayload = await applyCopy(ctx.pg, campaign, operation, "completed", "texto", { title: "T2" });
    expect(divergentPayload).toMatchObject({ applied: false, outcome: "conflict", state: "completed" });
    expect((await copyStateRows(ctx.pg, campaign, operation))[0].copy_payload).toEqual(payload);
  }, 60_000);

  it("C2 — `completed` SEM texto entregável ⇒ `invalid_content` (NENHUMA linha persistida)", async () => {
    const campaign = await createCampaign(ctx.supabase, storeId);
    const operation = randomUUID();
    const result = await applyCopy(ctx.pg, campaign, operation, "completed", null);
    expect(result).toMatchObject({ applied: false, outcome: "invalid_content", state: null });
    expect(await copyStateRows(ctx.pg, campaign, operation)).toHaveLength(0);

    const blank = await applyCopy(ctx.pg, campaign, operation, "completed", "   ");
    expect(blank).toMatchObject({ applied: false, outcome: "invalid_content", state: null });
    expect(await copyStateRows(ctx.pg, campaign, operation)).toHaveLength(0);
  }, 60_000);

  it("cancelamento ATÔMICO — `failed` + motivo numa transação; RECUSA sobre `completed`; `failed` comum SEM cancelamento", async () => {
    // (a) cancel aplica o terminal `failed` E registra o motivo (mesma transação).
    const campaignA = await createCampaign(ctx.supabase, storeId);
    const opA = randomUUID();
    const canceled = await cancelCopy(ctx.pg, campaignA, opA, "copy_budget_exceeded");
    expect(canceled).toMatchObject({ state: "failed", canceled: true });
    const rowsA = await copyStateRows(ctx.pg, campaignA, opA);
    expect(rowsA).toHaveLength(1);
    expect(rowsA[0].state).toBe("failed");
    const cancelRowsA = await cancellationRows(ctx.pg, campaignA, opA);
    expect(cancelRowsA).toHaveLength(1);
    expect(cancelRowsA[0].reason).toBe("copy_budget_exceeded");

    // (b) RECUSA cancelar sobre um `completed` PERSISTIDO (sem linha de cancelamento).
    const campaignB = await createCampaign(ctx.supabase, storeId);
    const opB = randomUUID();
    await applyCopy(ctx.pg, campaignB, opB, "completed", "texto", { k: 1 });
    const refused = await cancelCopy(ctx.pg, campaignB, opB, "copy_budget_exceeded");
    expect(refused).toMatchObject({ state: "completed", canceled: false });
    const rowsB = await copyStateRows(ctx.pg, campaignB, opB);
    expect(rowsB).toHaveLength(1);
    expect(rowsB[0].state).toBe("completed");
    expect(await cancellationRows(ctx.pg, campaignB, opB)).toHaveLength(0);

    // (c) `failed` COMUM (sem cancelamento) existe e NÃO é um cancelamento.
    const campaignC = await createCampaign(ctx.supabase, storeId);
    const opC = randomUUID();
    const commonFailed = await applyCopy(ctx.pg, campaignC, opC, "failed");
    expect(commonFailed).toMatchObject({ applied: true, outcome: "applied", state: "failed" });
    expect((await copyStateRows(ctx.pg, campaignC, opC))[0].state).toBe("failed");
    expect(await cancellationRows(ctx.pg, campaignC, opC)).toHaveLength(0);
  }, 60_000);

  it("RPC-only — `service_role` NÃO escreve direto (INSERT/UPDATE/DELETE negados); mutações só pelas RPCs", async () => {
    const campaign = await createCampaign(ctx.supabase, storeId);
    const operation = randomUUID();

    // Escrita DIRETA de `service_role` NEGADA (só as RPCs mutam).
    const insertErr = await deniedUnderRole(
      ctx.pg,
      "service_role",
      "INSERT INTO public.product_1_1_copy_state (campaign_id, operation_id, state) VALUES ($1, $2, 'failed')",
      [campaign, operation],
    );
    expect(insertErr).toBeInstanceOf(Error);

    const cancelInsertErr = await deniedUnderRole(
      ctx.pg,
      "service_role",
      "INSERT INTO public.product_1_1_copy_cancellations (campaign_id, operation_id, reason) VALUES ($1, $2, 'x')",
      [campaign, operation],
    );
    expect(cancelInsertErr).toBeInstanceOf(Error);

    // SELECT de `service_role` PERMITIDO (leitura é necessária).
    expect(
      await allowedUnderRole(ctx.pg, "service_role", "SELECT 1 FROM public.product_1_1_copy_state LIMIT 1"),
    ).toBe(true);
    expect(
      await allowedUnderRole(ctx.pg, "service_role", "SELECT 1 FROM public.product_1_1_copy_cancellations LIMIT 1"),
    ).toBe(true);

    // A MESMA mutação SUCEDE pela RPC (EXECUTE do `service_role`).
    const viaRpcAsService = await (async () => {
      await ctx.pg.query("BEGIN");
      try {
        await ctx.pg.query("SET LOCAL ROLE service_role");
        const envelope = (await ctx.pg.query(
          "SELECT public.product_1_1_apply_copy_state($1, $2, 'failed', NULL, NULL) AS r",
          [campaign, operation],
        )) as { rows: Array<{ r: ApplyEnvelope }> };
        return envelope.rows[0].r;
      } finally {
        await ctx.pg.query("ROLLBACK");
      }
    })();
    expect(viaRpcAsService).toMatchObject({ applied: true, outcome: "applied", state: "failed" });

    // UPDATE/DELETE diretos NEGADOS (com uma linha existente pela RPC).
    const updateErr = await deniedUnderRole(
      ctx.pg,
      "service_role",
      "UPDATE public.product_1_1_copy_state SET state = 'completed' WHERE campaign_id = $1 AND operation_id = $2",
      [campaign, operation],
    );
    expect(updateErr).toBeInstanceOf(Error);
    const deleteErr = await deniedUnderRole(
      ctx.pg,
      "service_role",
      "DELETE FROM public.product_1_1_copy_state WHERE campaign_id = $1 AND operation_id = $2",
      [campaign, operation],
    );
    expect(deleteErr).toBeInstanceOf(Error);
  }, 60_000);

  it("RPC-only — `anon`/`authenticated` SEM acesso (leitura e escrita negadas; RPC negada)", async () => {
    const campaign = await createCampaign(ctx.supabase, storeId);
    const operation = randomUUID();

    for (const role of ["anon", "authenticated"] as const) {
      const insertErr = await deniedUnderRole(
        ctx.pg,
        role,
        "INSERT INTO public.product_1_1_copy_state (campaign_id, operation_id, state) VALUES ($1, $2, 'failed')",
        [campaign, operation],
      );
      expect(insertErr).toBeInstanceOf(Error);

      const selectErr = await deniedUnderRole(
        ctx.pg,
        role,
        "SELECT 1 FROM public.product_1_1_copy_state LIMIT 1",
      );
      expect(selectErr).toBeInstanceOf(Error);

      // A RPC também é NEGADA para `anon`/`authenticated`.
      const rpcErr = await deniedUnderRole(
        ctx.pg,
        role,
        "SELECT public.product_1_1_apply_copy_state($1, $2, 'failed', NULL, NULL)",
        [campaign, operation],
      );
      expect(rpcErr).toBeInstanceOf(Error);
    }
  }, 60_000);
});
