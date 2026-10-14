// @vitest-environment node
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Client as PgClient } from "pg";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

/**
 * F56.2b2a (B2.1 / Plano 05) — provas REAIS, no Postgres isolado descartável, das
 * RPCs de recuperação de copy do Produto 1:1 (migrations `20261013000001/2/3`).
 *
 * Provider SIMULADO (nenhuma chamada paga); instância LOCAL real. A lógica de
 * aquisição/persistência é REAL contra o Postgres; apenas `auth`/`ownership`/
 * `getCampaign`/não-ativação e o PROVIDER são dublês CONTROLADOS (rota real).
 *
 * O BACKFILL (0003) é provado à PARTE pelo `-MigrationProof` do harness; aqui a
 * suíte RODA contra o schema JÁ MIGRADO (as 3 versões registradas).
 */

// ---------------------------------------------------------------------------
// Dublês CONTROLADOS da rota — a LÓGICA de aquisição/persistência é REAL.
// ---------------------------------------------------------------------------
const routeHarness = vi.hoisted(() => ({
  providerCalls: 0,
  authUser: { userId: "user-1" } as unknown,
  ownershipResult: {
    name: "Loja Teste",
    segment: "outros",
    tone_of_voice: null,
    positioning: null,
    short_description: null,
    slogan: null,
    is_test_store: true,
  } as unknown,
  campaign: null as unknown,
  flow: "new_flow",
  authDecision: { allowed: true } as unknown,
  operation: null as unknown,
}));

// `supabaseAdmin` = cliente REAL da instância isolada (rota REAL contra o banco).
vi.mock("@/lib/supabase/server", async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.F562A_ISOLATED_SUPABASE_URL as string;
  const key = process.env.F562A_ISOLATED_SERVICE_ROLE_KEY as string;
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { supabaseAdmin: client, createServerClient: () => client };
});

vi.mock("@/lib/ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai")>();
  return {
    ...actual,
    defaultAiGateway: {
      async invoke() {
        routeHarness.providerCalls += 1;
        return {
          content: JSON.stringify({
            title: "Oferta Especial",
            caption: "Legenda simulada",
            hashtags: ["#promo"],
            cta_post: "Aproveite!",
          }),
          model: "gpt-4o",
        };
      },
      async hasFallback() {
        return false;
      },
    },
  };
});

vi.mock("@/lib/auth/csrf", () => ({ requireSameOrigin: (): void => {} }));
vi.mock("@/lib/auth/require-user", () => ({
  requireApiUser: async (): Promise<unknown> => routeHarness.authUser,
  requireUser: async (): Promise<unknown> => routeHarness.authUser,
}));
vi.mock("@/lib/auth/store-ownership", () => ({
  requireOwnership: async (): Promise<unknown> => routeHarness.ownershipResult,
}));
vi.mock("@/lib/campaign/persistence", () => ({
  getCampaign: async (): Promise<unknown> => routeHarness.campaign,
  listArtVersions: async (): Promise<unknown[]> => [],
}));
vi.mock("@/lib/campaign/new-flow-marker", () => ({
  classifyCampaignFlow: (): string => routeHarness.flow,
}));
vi.mock("@/lib/product-1-1/authorization/authorization-service", () => ({
  resolveProductFlowAuthorization: async (): Promise<unknown> => routeHarness.authDecision,
}));
vi.mock("@/lib/product-1-1/submission/eligibility-context", () => ({
  resolveEligibilityContext: (): unknown => ({}),
}));
vi.mock("@/lib/product-1-1/orchestration/attempt-start-client", () => ({
  ProductOneToOneAttemptStartClient: class {
    async getCampaignOperation(): Promise<unknown> {
      return routeHarness.operation;
    }
  },
}));
vi.mock("@/lib/launch-config/config", () => ({
  getLaunchConfig: (): { copyDirectorEnabled: boolean } => ({ copyDirectorEnabled: true }),
}));

import {
  closeIsolatedContext,
  createCampaign,
  createIsolatedContext,
  createTestStore,
  deliverCredit,
  markArtUploaded,
  pgCallJson,
  pgRows,
  reserveCredit,
  setCredits,
  type IsolatedContext,
} from "./integration-harness";
import { GET as copyRecoveryGet, POST as copyRecoveryPost } from "@/app/api/campaign/[id]/copy-recovery/route";
import { ProductOneToOneCopyRecoveryClient } from "../copy/copy-recovery";

// ---------------------------------------------------------------------------
// Tipos + helpers de RPC (Postgres real)
// ---------------------------------------------------------------------------
interface ApplyEnvelope {
  applied: boolean;
  outcome: string;
  state: string | null;
}
interface CancelEnvelope {
  applied: boolean;
  state: string | null;
  canceled: boolean;
  outcome?: string;
}
interface AcquireEnvelope {
  acquired: boolean;
  reason?: string | null;
  attempt_seq?: number;
  attempt_token?: string;
  mode?: string;
  expired_closed?: boolean;
  wait_remaining_ms?: number;
}
interface AttemptRow {
  attempt_seq: number;
  attempt_token: string;
  state: string;
  copy_payload: Record<string, unknown> | null;
  lease_at: string | null;
  request_token: string | null;
}

function applyCopy(
  client: PgClient,
  campaignId: string,
  operationId: string,
  state: string,
  attemptSeq: number,
  attemptToken: string,
  copyText: string | null = null,
  copyPayload: Record<string, unknown> | null = null,
): Promise<ApplyEnvelope> {
  return pgCallJson<ApplyEnvelope>(
    client,
    "SELECT public.product_1_1_apply_copy_state($1::uuid, $2::uuid, $3::text, $4::int, $5::uuid, $6::text, $7::jsonb) AS r",
    [campaignId, operationId, state, attemptSeq, attemptToken, copyText, copyPayload === null ? null : JSON.stringify(copyPayload)],
  );
}

function cancelCopy(
  client: PgClient,
  campaignId: string,
  operationId: string,
  reason: string,
  attemptSeq: number,
  attemptToken: string,
  copyPayload: Record<string, unknown> | null = null,
): Promise<CancelEnvelope> {
  return pgCallJson<CancelEnvelope>(
    client,
    "SELECT public.product_1_1_cancel_copy($1::uuid, $2::uuid, $3::text, $4::int, $5::uuid, $6::jsonb) AS r",
    [campaignId, operationId, reason, attemptSeq, attemptToken, copyPayload === null ? null : JSON.stringify(copyPayload)],
  );
}

function acquireCopy(
  client: PgClient,
  campaignId: string,
  operationId: string,
  mode: "auto" | "manual",
  requestToken: string | null = null,
): Promise<AcquireEnvelope> {
  return pgCallJson<AcquireEnvelope>(
    client,
    "SELECT public.product_1_1_acquire_copy_attempt($1::uuid, $2::uuid, $3::text, $4::uuid) AS r",
    [campaignId, operationId, mode, requestToken],
  );
}

function readAttempts(
  client: PgClient,
  campaignId: string,
  operationId: string,
): Promise<AttemptRow[]> {
  return pgRows<AttemptRow>(
    client,
    "SELECT attempt_seq, attempt_token, state, copy_payload, lease_at, request_token FROM public.product_1_1_copy_state WHERE campaign_id = $1 AND operation_id = $2 ORDER BY attempt_seq",
    [campaignId, operationId],
  );
}

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

function transientPayload(kind: "auto" | "manual", nextWaitMs: number | null): Record<string, unknown> {
  return { recovery: { kind, failureClass: "transient", nextWaitMs } };
}

let ctx: IsolatedContext;
let storeId: string;

beforeAll(async () => {
  ctx = await createIsolatedContext();
  const store = await createTestStore(ctx.supabase);
  storeId = store.storeId;
  // Crédito suficiente para o fixture da operação C4 (imagem `delivered`).
  await setCredits(ctx.pg, storeId, 10);
}, 60_000);

afterAll(async () => {
  await closeIsolatedContext(ctx);
});

async function newOp(): Promise<string> {
  const campaign = await createCampaign(ctx.supabase, storeId);
  return `${campaign}|${randomUUID()}`;
}

// ===========================================================================
// 1) Identidade/terminal/stale/histórico
// ===========================================================================
describe("B2.1 — identidade/terminal/stale/histórico (Postgres real)", () => {
  it("(lacuna 2) `stale_attempt` — conclusão ATRASADA da seq 1 NÃO altera a corrente (seq 2)", async () => {
    const [campaign, operation] = (await newOp()).split("|");
    await applyCopy(ctx.pg, campaign, operation, "pending", 1, randomUUID());
    await applyCopy(ctx.pg, campaign, operation, "pending", 2, randomUUID());
    await applyCopy(ctx.pg, campaign, operation, "completed", 2, (await readAttempts(ctx.pg, campaign, operation))[1].attempt_token, "final", { caption: "final" });

    const stale = await applyCopy(ctx.pg, campaign, operation, "completed", 1, (await readAttempts(ctx.pg, campaign, operation))[0].attempt_token, "atrasada");
    expect(stale).toMatchObject({ applied: false, outcome: "stale_attempt" });

    const rows = await readAttempts(ctx.pg, campaign, operation);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({ state: "completed" });
    expect(rows[1].copy_payload).toMatchObject({ caption: "final" });
  }, 60_000);

  it("terminal PROTEGIDO por tentativa: equivalente⇒idempotent / divergente⇒conflict / não-terminal⇒rejected; completed nunca sobrescrito", async () => {
    const [campaign, operation] = (await newOp()).split("|");
    const token = randomUUID();
    await applyCopy(ctx.pg, campaign, operation, "pending", 1, token);
    const first = await applyCopy(ctx.pg, campaign, operation, "completed", 1, token, "texto", { k: 1 });
    expect(first).toMatchObject({ applied: true, outcome: "applied", state: "completed" });
    expect(await applyCopy(ctx.pg, campaign, operation, "completed", 1, token, "texto", { k: 1 })).toMatchObject({ outcome: "idempotent" });
    expect(await applyCopy(ctx.pg, campaign, operation, "completed", 1, token, "outro", { k: 1 })).toMatchObject({ outcome: "conflict" });
    expect(await applyCopy(ctx.pg, campaign, operation, "failed", 1, token)).toMatchObject({ applied: false, outcome: "rejected", state: "completed" });
    expect(await applyCopy(ctx.pg, campaign, operation, "pending", 1, token)).toMatchObject({ applied: false, outcome: "rejected", state: "completed" });
    const rows = await readAttempts(ctx.pg, campaign, operation);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ state: "completed" });
    expect(rows[0].copy_payload).toMatchObject({ k: 1 });
  }, 60_000);

  it("histórico preservado: duas tentativas ⇒ 2 linhas reconstruíveis na ordem de attempt_seq", async () => {
    const [campaign, operation] = (await newOp()).split("|");
    const t1 = randomUUID();
    const t2 = randomUUID();
    await applyCopy(ctx.pg, campaign, operation, "pending", 1, t1);
    await applyCopy(ctx.pg, campaign, operation, "failed", 1, t1);
    await applyCopy(ctx.pg, campaign, operation, "pending", 2, t2);
    const rows = await readAttempts(ctx.pg, campaign, operation);
    expect(rows.map((r) => r.attempt_seq)).toEqual([1, 2]);
    expect(rows[0].attempt_token).toBe(t1);
    expect(rows[1].attempt_token).toBe(t2);
  }, 60_000);

  it("identidade OBRIGATÓRIA: ausente⇒missing_attempt_identity; fora de 1..6⇒invalid_attempt_seq; token divergente⇒conflict", async () => {
    const [campaign, operation] = (await newOp()).split("|");
    const token = randomUUID();
    await applyCopy(ctx.pg, campaign, operation, "pending", 1, token);

    await expect(
      pgCallJson(ctx.pg, "SELECT public.product_1_1_apply_copy_state($1::uuid, $2::uuid, 'pending', NULL::int, $3::uuid) AS r", [campaign, operation, token]),
    ).rejects.toThrow(/missing_attempt_identity/);
    await expect(
      pgCallJson(ctx.pg, "SELECT public.product_1_1_apply_copy_state($1::uuid, $2::uuid, 'pending', 9, $3::uuid) AS r", [campaign, operation, token]),
    ).rejects.toThrow(/invalid_attempt_seq/);

    const divergent = await applyCopy(ctx.pg, campaign, operation, "failed", 1, randomUUID());
    expect(divergent).toMatchObject({ applied: false, outcome: "conflict", state: "pending" });
  }, 60_000);

  it("cancel ATÔMICO: failed + motivo na MESMA transação; RECUSA sobre completed; RECUSA tentativa SUPERADA; imutabilidade", async () => {
    // (a) cancel aplica failed + registra o motivo.
    const [campaignA, opA] = (await newOp()).split("|");
    const tokenA = randomUUID();
    const canceled = await cancelCopy(ctx.pg, campaignA, opA, "copy_budget_exceeded", 1, tokenA);
    expect(canceled).toMatchObject({ state: "failed", canceled: true });
    const cancelRows = await pgRows<{ reason: string }>(ctx.pg, "SELECT reason FROM public.product_1_1_copy_cancellations WHERE campaign_id=$1 AND operation_id=$2", [campaignA, opA]);
    expect(cancelRows).toHaveLength(1);
    expect(cancelRows[0].reason).toBe("copy_budget_exceeded");

    // (b) RECUSA cancelar sobre completed persistido.
    const [campaignB, opB] = (await newOp()).split("|");
    const tokenB = randomUUID();
    await applyCopy(ctx.pg, campaignB, opB, "completed", 1, tokenB, "texto", { k: 1 });
    expect(await cancelCopy(ctx.pg, campaignB, opB, "copy_budget_exceeded", 1, tokenB)).toMatchObject({ state: "completed", canceled: false });

    // (c) RECUSA cancelar tentativa SUPERADA (seq 1 < corrente seq 2).
    const [campaignC, opC] = (await newOp()).split("|");
    const t1 = randomUUID();
    await applyCopy(ctx.pg, campaignC, opC, "pending", 1, t1);
    await applyCopy(ctx.pg, campaignC, opC, "pending", 2, randomUUID());
    expect(await cancelCopy(ctx.pg, campaignC, opC, "copy_budget_exceeded", 1, t1)).toMatchObject({ canceled: false, outcome: "stale_attempt" });

    // (d) imutabilidade: UPDATE direto no cancelamento NEGADO.
    const immErr = await deniedUnderRole(
      ctx.pg,
      "service_role",
      "UPDATE public.product_1_1_copy_cancellations SET reason='x' WHERE campaign_id=$1 AND operation_id=$2",
      [campaignA, opA],
    );
    expect(immErr).toBeInstanceOf(Error);
  }, 60_000);
});

// ===========================================================================
// 2) Aquisição atômica
// ===========================================================================
describe("B2.1 — aquisição atômica (Postgres real)", () => {
  it("1ª aquisição ⇒ {acquired:true, attempt_seq:1, expired_closed:false}; 2ª quando pending vigente ⇒ attempt_in_progress", async () => {
    const [campaign, operation] = (await newOp()).split("|");
    const first = await acquireCopy(ctx.pg, campaign, operation, "auto", randomUUID());
    expect(first).toMatchObject({ acquired: true, attempt_seq: 1, mode: "auto", expired_closed: false });
    expect(typeof first.attempt_token).toBe("string");

    const second = await acquireCopy(ctx.pg, campaign, operation, "auto", randomUUID());
    expect(second).toMatchObject({ acquired: false, reason: "attempt_in_progress" });
  }, 60_000);

  it("(lacuna 7) aquisição CONCORRENTE (duas conexões) ⇒ EXATAMENTE uma vencedora; a perdedora apenas acompanha", async () => {
    const [campaign, operation] = (await newOp()).split("|");
    const [a, b] = await Promise.all([
      acquireCopy(ctx.pg, campaign, operation, "auto", randomUUID()),
      acquireCopy(ctx.pg2, campaign, operation, "auto", randomUUID()),
    ]);
    const winners = [a, b].filter((r) => r.acquired);
    const losers = [a, b].filter((r) => !r.acquired);
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);
    expect(losers[0].reason).toBe("attempt_in_progress");
    expect(winners[0].attempt_seq).toBe(1);
    const rows = await readAttempts(ctx.pg, campaign, operation);
    expect(rows).toHaveLength(1);
  }, 60_000);

  it("entrega `completed` ⇒ attempt_already_completed (NENHUMA nova tentativa)", async () => {
    const [campaign, operation] = (await newOp()).split("|");
    const token = randomUUID();
    await applyCopy(ctx.pg, campaign, operation, "completed", 1, token, "texto", { k: 1 });
    expect(await acquireCopy(ctx.pg, campaign, operation, "auto", randomUUID())).toMatchObject({
      acquired: false,
      reason: "attempt_already_completed",
    });
  }, 60_000);

  it("ESPERA server-side: failed transitório com nextWaitMs ⇒ wait_not_elapsed (wait_remaining_ms > 0)", async () => {
    const [campaign, operation] = (await newOp()).split("|");
    const token = randomUUID();
    await applyCopy(ctx.pg, campaign, operation, "failed", 1, token, null, transientPayload("auto", 5000));
    const res = await acquireCopy(ctx.pg, campaign, operation, "auto", randomUUID());
    expect(res).toMatchObject({ acquired: false, reason: "wait_not_elapsed" });
    expect(res.wait_remaining_ms).toBeGreaterThan(0);
  }, 60_000);

  it("LIMITES SEPARADOS (3 auto + 3 manual = 6): a 7ª ⇒ attempt_limit_reached", async () => {
    const [campaign, operation] = (await newOp()).split("|");
    // 3 automáticas efetivas (falha transitória sem espera entre elas).
    for (let n = 1; n <= 3; n += 1) {
      const acq = await acquireCopy(ctx.pg, campaign, operation, "auto", randomUUID());
      expect(acq).toMatchObject({ acquired: true, attempt_seq: n });
      await applyCopy(ctx.pg, campaign, operation, "failed", n, acq.attempt_token as string, null, transientPayload("auto", null));
    }
    expect(await acquireCopy(ctx.pg, campaign, operation, "auto", randomUUID())).toMatchObject({ acquired: false, reason: "attempt_limit_reached" });

    // 3 manuais efetivas.
    for (let n = 4; n <= 6; n += 1) {
      const acq = await acquireCopy(ctx.pg, campaign, operation, "manual", randomUUID());
      expect(acq).toMatchObject({ acquired: true, attempt_seq: n, mode: "manual" });
      await applyCopy(ctx.pg, campaign, operation, "failed", n, acq.attempt_token as string, null, transientPayload("manual", null));
    }
    expect(await acquireCopy(ctx.pg, campaign, operation, "manual", randomUUID())).toMatchObject({ acquired: false, reason: "attempt_limit_reached" });
    const rows = await readAttempts(ctx.pg, campaign, operation);
    expect(rows.length).toBe(6);
  }, 60_000);

  it("(iii) REENVIO ATRASADO do MESMO request_token ⇒ already_acquired, SEM nova tentativa/slot", async () => {
    const [campaign, operation] = (await newOp()).split("|");
    const requestToken = randomUUID();
    const first = await acquireCopy(ctx.pg, campaign, operation, "auto", requestToken);
    expect(first.acquired).toBe(true);
    // Torna a corrente terminal (failed) para que uma nova aquisição seria possível.
    await applyCopy(ctx.pg, campaign, operation, "failed", 1, first.attempt_token as string, null, transientPayload("auto", null));
    const resend = await acquireCopy(ctx.pg, campaign, operation, "auto", requestToken);
    expect(resend).toMatchObject({ acquired: false, reason: "already_acquired", attempt_seq: 1 });
    const rows = await readAttempts(ctx.pg, campaign, operation);
    expect(rows).toHaveLength(1);
  }, 60_000);

  it("(ii) TENTATIVA EXPIRADA encerrada ATOMICAMENTE (staleAttempt + próxima, expired_closed) + conclusão atrasada rejeitada", async () => {
    const [campaign, operation] = (await newOp()).split("|");
    const first = await acquireCopy(ctx.pg, campaign, operation, "auto", randomUUID());
    // Força o lease VENCIDO da corrente `pending` (> 45s no passado).
    await ctx.pg.query(
      "UPDATE public.product_1_1_copy_state SET lease_at = now() - interval '60 seconds' WHERE campaign_id=$1 AND operation_id=$2 AND attempt_seq=1",
      [campaign, operation],
    );
    const next = await acquireCopy(ctx.pg, campaign, operation, "auto", randomUUID());
    expect(next).toMatchObject({ acquired: true, attempt_seq: 2, expired_closed: true });

    const rows = await readAttempts(ctx.pg, campaign, operation);
    expect(rows).toHaveLength(2);
    expect(rows[0].state).toBe("failed");
    expect((rows[0].copy_payload as { recovery?: { staleAttempt?: boolean } }).recovery?.staleAttempt).toBe(true);
    expect(rows[1].state).toBe("pending");

    // Conclusão ATRASADA da expirada ⇒ stale_attempt e NÃO altera o persistido.
    const late = await applyCopy(ctx.pg, campaign, operation, "completed", 1, first.attempt_token as string, "atrasada");
    expect(late).toMatchObject({ applied: false, outcome: "stale_attempt" });
    expect((await readAttempts(ctx.pg, campaign, operation))[1]).toMatchObject({ state: "pending" });
  }, 60_000);

  it("(iv) TRANSIÇÕES de `mode`: auto após DEFINITIVA ⇒ automatic_closed; auto após MANUAL ⇒ automatic_closed; manual permanece", async () => {
    // (a) falha definitiva ⇒ auto fechado; manual admitido.
    const [cA, oA] = (await newOp()).split("|");
    const tokenA = randomUUID();
    await applyCopy(ctx.pg, cA, oA, "failed", 1, tokenA, null, { recovery: { kind: "auto", failureClass: "definitive", nextWaitMs: null } });
    expect(await acquireCopy(ctx.pg, cA, oA, "auto", randomUUID())).toMatchObject({ acquired: false, reason: "automatic_closed" });
    expect(await acquireCopy(ctx.pg, cA, oA, "manual", randomUUID())).toMatchObject({ acquired: true, attempt_seq: 2, mode: "manual" });

    // (b) após início MANUAL ⇒ auto fechado.
    const [cB, oB] = (await newOp()).split("|");
    const tokenB = randomUUID();
    await applyCopy(ctx.pg, cB, oB, "failed", 1, tokenB, null, { recovery: { kind: "manual", failureClass: "transient", nextWaitMs: null } });
    expect(await acquireCopy(ctx.pg, cB, oB, "auto", randomUUID())).toMatchObject({ acquired: false, reason: "automatic_closed" });
  }, 60_000);

  it("(i) imagem `delivered` NÃO bloqueia: aquisição ADMITIDA (nunca operation_terminal); arte/economia intactas", async () => {
    const campaign = await createCampaign(ctx.supabase, storeId);
    const operation = randomUUID();
    await reserveCredit(ctx.pg, storeId, campaign, operation);
    await markArtUploaded(ctx.pg, campaign, operation);
    await deliverCredit(ctx.pg, campaign, operation);

    const acq = await acquireCopy(ctx.pg, campaign, operation, "manual", randomUUID());
    expect(acq.acquired).toBe(true);
    expect(acq.reason ?? null).toBeNull();
    expect(JSON.stringify(acq)).not.toContain("operation_terminal");

    const credit = await pgRows<{ status: string }>(ctx.pg, "SELECT status FROM public.product_1_1_campaign_credit_operations WHERE campaign_id=$1 AND operation_id=$2", [campaign, operation]);
    expect(credit[0].status).toBe("delivered");
  }, 60_000);

  it("FALLBACK = TENTATIVA SEGUINTE: espera cumprida ⇒ seq 2 adquirida com identidade DISTINTA", async () => {
    const [campaign, operation] = (await newOp()).split("|");
    const first = await acquireCopy(ctx.pg, campaign, operation, "auto", randomUUID());
    await applyCopy(ctx.pg, campaign, operation, "failed", 1, first.attempt_token as string, null, transientPayload("auto", 5000));
    // Antes de vencer a espera ⇒ wait_not_elapsed.
    expect(await acquireCopy(ctx.pg, campaign, operation, "auto", randomUUID())).toMatchObject({ acquired: false, reason: "wait_not_elapsed" });
    // Cumprida a espera (updated_at no passado) ⇒ a TENTATIVA SEGUINTE é adquirida.
    await ctx.pg.query(
      "UPDATE public.product_1_1_copy_state SET updated_at = now() - interval '60 seconds' WHERE campaign_id=$1 AND operation_id=$2 AND attempt_seq=1",
      [campaign, operation],
    );
    const second = await acquireCopy(ctx.pg, campaign, operation, "auto", randomUUID());
    expect(second).toMatchObject({ acquired: true, attempt_seq: 2 });
    expect(second.attempt_token).not.toBe(first.attempt_token);
  }, 60_000);

  it("(27-28) CICLO de 3 automáticas com token PRÓPRIO (T1≠T2≠T3) e reenvio do MESMO acionamento sem duplicação", async () => {
    const [campaign, operation] = (await newOp()).split("|");
    const tokens: Array<string | undefined> = [];
    for (let n = 1; n <= 3; n += 1) {
      const acq = await acquireCopy(ctx.pg, campaign, operation, "auto", randomUUID());
      expect(acq).toMatchObject({ acquired: true, attempt_seq: n });
      tokens.push(acq.attempt_token);
      await applyCopy(ctx.pg, campaign, operation, "failed", n, acq.attempt_token as string, null, transientPayload("auto", null));
    }
    expect(new Set(tokens).size).toBe(3);
    const rows = await readAttempts(ctx.pg, campaign, operation);
    expect(rows).toHaveLength(3);
  }, 60_000);
});

// ===========================================================================
// 3) Concorrência sob a MESMA trava (conclusão atrasada × expiração/next)
// ===========================================================================
describe("B2.1 — trava compartilhada: apply (conclusão atrasada) × acquire (expiração)", () => {
  it("DUAS sessões ⇒ exatamente UM resultado de serialização; linha corrente nunca lacerada", async () => {
    const [campaign, operation] = (await newOp()).split("|");
    const first = await acquireCopy(ctx.pg, campaign, operation, "auto", randomUUID());
    await ctx.pg.query(
      "UPDATE public.product_1_1_copy_state SET lease_at = now() - interval '60 seconds' WHERE campaign_id=$1 AND operation_id=$2 AND attempt_seq=1",
      [campaign, operation],
    );

    const [applyRes, acquireRes] = await Promise.all([
      applyCopy(ctx.pg, campaign, operation, "completed", 1, first.attempt_token as string, "atrasada"),
      acquireCopy(ctx.pg2, campaign, operation, "auto", randomUUID()),
    ]);

    // Serializações válidas: (A perdeu) apply stale_attempt / (B perdeu) attempt_already_completed.
    const aLost = applyRes.outcome === "stale_attempt";
    const bLost = acquireRes.acquired === false && acquireRes.reason === "attempt_already_completed";
    expect(aLost || bLost).toBe(true);

    const rows = await readAttempts(ctx.pg, campaign, operation);
    // Nenhuma linha LACERADA: cada linha é um estado terminal/válido persistido.
    for (const row of rows) {
      expect(["pending", "completed", "failed"]).toContain(row.state);
    }
    if (aLost) {
      // B venceu: seq 2 pendente; o persistido da corrente NÃO foi tocado por A.
      const current = rows[rows.length - 1];
      expect(current.attempt_seq).toBe(2);
      expect(current.state).toBe("pending");
    } else {
      const current = rows[rows.length - 1];
      expect(current.attempt_seq).toBe(1);
      expect(current.state).toBe("completed");
    }
  }, 60_000);
});

// ===========================================================================
// 4) Rota REAL — concorrência + recusa sem request_token + GET query-only
// ===========================================================================
describe("B2.1 — rota REAL (auth/ownership mockados; provider SIMULADO)", () => {
  function postBody(operationId: string, requestToken: string | undefined, mode = "auto_retry") {
    const body: Record<string, unknown> = { operationId, mode, attemptSeq: 1, attemptToken: "x" };
    if (requestToken !== undefined) body.requestToken = requestToken;
    return body;
  }

  async function post(campaignId: string, body: Record<string, unknown>) {
    const request = new NextRequest(
      `http://127.0.0.1:56321/api/campaign/${campaignId}/copy-recovery`,
      { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } },
    );
    return copyRecoveryPost(request, { params: Promise.resolve({ id: campaignId }) });
  }

  beforeEach(() => {
    routeHarness.providerCalls = 0;
    routeHarness.flow = "new_flow";
    routeHarness.authDecision = { allowed: true };
  });

  it("(lacuna 7) duas chamadas POST SIMULTÂNEAS ⇒ EXATAMENTE uma inicia a tentativa (UMA chamada ao provider)", async () => {
    const campaign = await createCampaign(ctx.supabase, storeId);
    const operation = randomUUID();
    routeHarness.campaign = {
      id: campaign,
      store_id: storeId,
      product_name: "Produto",
      input_snapshot: null,
    };
    routeHarness.operation = { operationId: operation };

    const [r1, r2] = await Promise.all([
      post(campaign, postBody(operation, randomUUID())),
      post(campaign, postBody(operation, randomUUID())),
    ]);
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);

    expect(routeHarness.providerCalls).toBe(1);
    const rows = await readAttempts(ctx.pg, campaign, operation);
    expect(rows).toHaveLength(1);
  }, 60_000);

  it("(1) acionamento SEM `request_token` ⇒ 400 e ZERO chamadas ao provider (nenhuma aquisição)", async () => {
    const campaign = await createCampaign(ctx.supabase, storeId);
    const operation = randomUUID();
    routeHarness.campaign = { id: campaign, store_id: storeId, product_name: "Produto", input_snapshot: null };
    routeHarness.operation = { operationId: operation };

    const res = await post(campaign, postBody(operation, undefined));
    expect(res.status).toBe(400);
    expect(routeHarness.providerCalls).toBe(0);
    expect(await readAttempts(ctx.pg, campaign, operation)).toHaveLength(0);
  }, 60_000);

  it("(24) SERVIÇO recusa request_token ausente com `missing_request_token` (antes de qualquer IA)", async () => {
    const client = new ProductOneToOneCopyRecoveryClient();
    await expect(
      client.recoverCopyAttempt({
        campaignId: randomUUID(),
        operationId: randomUUID(),
        mode: "auto",
        requestToken: undefined,
        runner: {
          campaignId: "c",
          operationId: "o",
          storeId: "s",
          briefing: { product: { name: "P" }, commercial: { intent: "offer" } },
          copyContext: { storeName: "L", segment: "outros" },
          copyDirectorEnabled: true,
        },
      }),
    ).rejects.toMatchObject({ code: "missing_request_token" });
  }, 60_000);

  it("(vi) GET query-only NÃO cria nem retoma tentativa (contador inalterado; ZERO provider)", async () => {
    const campaign = await createCampaign(ctx.supabase, storeId);
    const operation = randomUUID();
    routeHarness.campaign = { id: campaign, store_id: storeId, product_name: "Produto", input_snapshot: null };
    routeHarness.operation = { operationId: operation };
    // Uma tentativa terminal pré-existente.
    await acquireCopy(ctx.pg, campaign, operation, "auto", randomUUID());

    const request = new NextRequest(
      `http://127.0.0.1:56321/api/campaign/${campaign}/copy-recovery`,
    );
    const res = await copyRecoveryGet(request, { params: Promise.resolve({ id: campaign }) });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { recovery: { attemptSeq: number } };
    expect(json.recovery.attemptSeq).toBe(1);
    expect(routeHarness.providerCalls).toBe(0);
    expect(await readAttempts(ctx.pg, campaign, operation)).toHaveLength(1);
  }, 60_000);
});

// ===========================================================================
// 5) RPC-only (A2)
// ===========================================================================
describe("B2.1 — RPC-only: service_role não escreve direto; anon/authenticated negados", () => {
  it("service_role: INSERT/UPDATE/DELETE diretos NEGADOS; SELECT permitido; mutação só pela RPC", async () => {
    const [campaign, operation] = (await newOp()).split("|");
    expect(
      await deniedUnderRole(ctx.pg, "service_role", "INSERT INTO public.product_1_1_copy_state (campaign_id, operation_id, state, attempt_seq, attempt_token) VALUES ($1,$2,'failed',1,$3)", [campaign, operation, randomUUID()]),
    ).toBeInstanceOf(Error);
    expect(await allowedUnderRole(ctx.pg, "service_role", "SELECT 1 FROM public.product_1_1_copy_state LIMIT 1")).toBe(true);
    const token = randomUUID();
    await applyCopy(ctx.pg, campaign, operation, "pending", 1, token);
    expect(
      await deniedUnderRole(ctx.pg, "service_role", "UPDATE public.product_1_1_copy_state SET state='completed' WHERE campaign_id=$1 AND operation_id=$2", [campaign, operation]),
    ).toBeInstanceOf(Error);
    expect(
      await deniedUnderRole(ctx.pg, "service_role", "DELETE FROM public.product_1_1_copy_state WHERE campaign_id=$1 AND operation_id=$2", [campaign, operation]),
    ).toBeInstanceOf(Error);
  }, 60_000);

  it("anon/authenticated: leitura/escrita/RPC NEGADAS", async () => {
    const [campaign, operation] = (await newOp()).split("|");
    for (const role of ["anon", "authenticated"] as const) {
      expect(
        await deniedUnderRole(ctx.pg, role, "SELECT 1 FROM public.product_1_1_copy_state LIMIT 1"),
      ).toBeInstanceOf(Error);
      expect(
        await deniedUnderRole(ctx.pg, role, "INSERT INTO public.product_1_1_copy_state (campaign_id, operation_id, state, attempt_seq, attempt_token) VALUES ($1,$2,'failed',1,$3)", [campaign, operation, randomUUID()]),
      ).toBeInstanceOf(Error);
      expect(
        await deniedUnderRole(ctx.pg, role, "SELECT public.product_1_1_acquire_copy_attempt($1::uuid,$2::uuid,'auto',$3::uuid)", [campaign, operation, randomUUID()]),
      ).toBeInstanceOf(Error);
    }
  }, 60_000);
});
