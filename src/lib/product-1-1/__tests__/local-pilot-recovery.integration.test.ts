// @vitest-environment node
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import {
  closeIsolatedContext,
  createCampaign,
  createIsolatedContext,
  createTestStore,
  creditOperationRow,
  LOCAL_API_URL,
  LOCAL_DB_PORT,
  pgCallJson,
  requireIsolatedEnv,
  reserveCredit,
  setCredits,
  type IsolatedContext,
} from "./integration-harness";
import { createSimulatedProvider } from "./fixtures/simulated-provider";
import { ProductOneToOneAttemptStartClient } from "../orchestration/attempt-start-client";
import { ProductOneToOneCreditOperationClient } from "../credit-operation/credit-operation-client";

/**
 * F56.2.6 — Plano 04 (Task 2) — P1 / REUSO LOCAL.
 *
 * PROVA LOCAL REUTILIZADA — evidência de contrato; NÃO é prova hospedada;
 * roda SÓ com runner dedicado; NUNCA `db push`/reset/deploy; NUNCA chamada
 * paga; provider SEMPRE simulado local.
 *
 * Camada 2 (Postgres/Storage LOCAIS da instância isolada `127.0.0.1:56321`,
 * DB `56322`). Os casos provam SEMÂNTICA já existente (não ampliam RPC):
 * - kill/abort simulado ⇒ claim `in_progress` residual, SEM presumir ausência
 *   e SEM estorno;
 * - `absent` + predicado PF completo ⇒ `refunded` UMA única vez;
 * - arte `integral` ⇒ `delivered`;
 * - `invalid`/`indeterminate` ⇒ PERMANECEM inconclusivos, RPC recusa com
 *   `insufficient_evidence` (nenhuma evidência é fabricada);
 * - publicação ativa/in-flight/desconhecida ⇒ inconclusiva, salvo as
 *   precondições JÁ existentes (frescor de epoch / fechamento autorizado).
 */

let ctx: IsolatedContext;
let storeId: string;
let actorId: string;

const attempts = () => new ProductOneToOneAttemptStartClient(ctx.supabase);
const credit = () => new ProductOneToOneCreditOperationClient(ctx.supabase);

async function currentEpoch(campaign: string, operation: string): Promise<number> {
  const { rows } = await ctx.pg.query<{ state_epoch: number }>(
    "SELECT state_epoch FROM public.product_1_1_campaign_credit_operations WHERE campaign_id=$1 AND operation_id=$2",
    [campaign, operation],
  );
  return rows[0]?.state_epoch ?? 0;
}

async function refundLedgerCount(): Promise<number> {
  const { rows } = await ctx.pg.query<{ n: number }>(
    "SELECT count(*)::int AS n FROM public.credit_transactions WHERE store_id = $1 AND type = 'refund'",
    [storeId],
  );
  return rows[0].n;
}

async function claimStatuses(
  campaign: string,
  operation: string,
): Promise<Array<{ attempt_number: number; target: string; status: string }>> {
  const { rows } = await ctx.pg.query<{
    attempt_number: number;
    target: string;
    status: string;
  }>(
    "SELECT attempt_number, target, status FROM public.product_1_1_generation_attempt_claims WHERE campaign_id=$1 AND operation_id=$2 ORDER BY attempt_number",
    [campaign, operation],
  );
  return rows;
}

async function recordFailed(campaign: string, operation: string): Promise<void> {
  await pgCallJson(
    ctx.pg,
    "SELECT public.product_1_1_record_generation_outcome($1,$2,'failed',$3) AS r",
    [campaign, operation, `IMG-P1-${campaign.slice(0, 8)}`],
  );
}

async function beginPublication(campaign: string, operation: string) {
  return pgCallJson<{ acquired: boolean; token: string | null; publication_state: string }>(
    ctx.pg,
    "SELECT public.product_1_1_begin_publication($1::uuid,$2::uuid) AS r",
    [campaign, operation],
  );
}

async function markResultUnknown(campaign: string, operation: string, token: string) {
  return pgCallJson<{ success: boolean }>(
    ctx.pg,
    "SELECT public.product_1_1_mark_result_unknown($1::uuid,$2::uuid,$3::uuid) AS r",
    [campaign, operation, token],
  );
}

function evidence(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    origin: "server-derived",
    art_kind: "absent",
    execution_ended: true,
    state_epoch: 0,
    publication_state: "none",
    ...over,
  };
}

function adminResolve(params: {
  campaignId: string;
  operationId: string;
  action?: "refund_once" | "deliver_existing_art";
  evidence: Record<string, unknown>;
  resolutionOperationId?: string;
}) {
  return ctx.supabase.rpc("admin_resolve_product_1_1_pending", {
    p_actor_id: actorId,
    p_campaign_id: params.campaignId,
    p_operation_id: params.operationId,
    p_action: params.action ?? "refund_once",
    p_reason: "P1 local",
    p_resolution_operation_id: params.resolutionOperationId ?? randomUUID(),
    p_evidence: params.evidence,
  });
}

async function auditCountFor(resolutionOperationId: string): Promise<number> {
  const { rows } = await ctx.pg.query<{ n: number }>(
    "SELECT count(*)::int AS n FROM public.admin_audit_log WHERE operation_id = $1",
    [resolutionOperationId],
  );
  return rows[0].n;
}

describe("F56.2.6 — P1 REUSO LOCAL: recuperação e segurança (provider simulado)", () => {
  beforeAll(async () => {
    // Fail-closed: só roda contra a instância isolada de loopback.
    const env = requireIsolatedEnv();
    expect(env.url).toBe(LOCAL_API_URL);
    expect(new URL(env.databaseUrl).port).toBe(String(LOCAL_DB_PORT));

    ctx = await createIsolatedContext();
    const store = await createTestStore(ctx.supabase, "F56.2.6 P1 local");
    storeId = store.storeId;
    actorId = store.userId;
    await setCredits(ctx.pg, storeId, 80);
  }, 60_000);

  afterAll(async () => {
    if (ctx) await closeIsolatedContext(ctx);
  });

  it("kill/abort simulado com provider SIMULADO ⇒ claim `in_progress` residual, sem presumir ausência e sem estorno", async () => {
    const campaign = await createCampaign(ctx.supabase, storeId);
    const operation = randomUUID();
    await reserveCredit(ctx.pg, storeId, campaign, operation);

    // A tentativa é adquirida ANTES da chamada ao provider (como no orquestrador).
    await attempts().acquire({
      campaignId: campaign,
      operationId: operation,
      target: "primary",
      attemptNumber: 1,
    });

    // "Kill" local: a chamada simulada morre no abort cooperativo.
    const provider = createSimulatedProvider();
    const controller = new AbortController();
    const inFlight = provider.generateUntilAborted(controller.signal);
    controller.abort();
    await expect(inFlight).rejects.toMatchObject({ name: "AbortError" });

    // O kill NÃO fecha a tentativa nem a operação.
    expect(await claimStatuses(campaign, operation)).toEqual([
      { attempt_number: 1, target: "primary", status: "in_progress" },
    ]);
    expect((await creditOperationRow(ctx.pg, campaign, operation))?.status).toBe("reserved");

    const refundBefore = await refundLedgerCount();

    // Nem o encerramento PF nem o admin NÃO-autorizado aceitam evidência `absent`.
    await expect(
      credit().closeFailedOperation({
        campaignId: campaign,
        operationId: operation,
        artKind: "absent",
        observedEpoch: await currentEpoch(campaign, operation),
        reason: "kill simulado",
      }),
    ).rejects.toMatchObject({ code: "operation_in_progress" });

    const refused = await adminResolve({
      campaignId: campaign,
      operationId: operation,
      evidence: evidence({ state_epoch: await currentEpoch(campaign, operation) }),
    });
    expect(refused.error?.message ?? "").toContain("operation_in_progress");

    // KILL SOZINHO ⇒ ZERO VIA: nada estornado, nada terminal.
    expect(await refundLedgerCount()).toBe(refundBefore);
    expect((await creditOperationRow(ctx.pg, campaign, operation))?.status).toBe("reserved");
  }, 60_000);

  it("`absent` + predicado PF completo (claim failed + marcador failed + epoch fresco) ⇒ `refunded` UMA única vez", async () => {
    const campaign = await createCampaign(ctx.supabase, storeId);
    const operation = randomUUID();
    await reserveCredit(ctx.pg, storeId, campaign, operation);
    await attempts().acquire({
      campaignId: campaign,
      operationId: operation,
      target: "primary",
      attemptNumber: 1,
    });
    await attempts().finish({
      campaignId: campaign,
      operationId: operation,
      attemptNumber: 1,
      status: "failed",
    });
    await recordFailed(campaign, operation);

    const refundBefore = await refundLedgerCount();
    const first = await credit().closeFailedOperation({
      campaignId: campaign,
      operationId: operation,
      artKind: "absent",
      observedEpoch: await currentEpoch(campaign, operation),
      reason: "generation_failed",
    });
    expect(first).toMatchObject({ status: "refunded", idempotent: false });
    expect(await refundLedgerCount()).toBe(refundBefore + 1);

    // Replay idempotente: NENHUM segundo efeito de ledger.
    const second = await credit().closeFailedOperation({
      campaignId: campaign,
      operationId: operation,
      artKind: "absent",
      observedEpoch: await currentEpoch(campaign, operation),
      reason: "generation_failed",
    });
    expect(second).toMatchObject({ status: "refunded", idempotent: true });
    expect(await refundLedgerCount()).toBe(refundBefore + 1);
    expect((await creditOperationRow(ctx.pg, campaign, operation))?.refund_tx_id).not.toBeNull();
  }, 60_000);

  it("arte `integral` ⇒ `delivered` (arte existente vence; NUNCA estorna)", async () => {
    const campaign = await createCampaign(ctx.supabase, storeId);
    const operation = randomUUID();
    await reserveCredit(ctx.pg, storeId, campaign, operation);

    const refundBefore = await refundLedgerCount();
    const resolved = await adminResolve({
      campaignId: campaign,
      operationId: operation,
      action: "deliver_existing_art",
      evidence: evidence({ art_kind: "integral" }),
    });
    expect(resolved.error).toBeNull();
    expect(resolved.data).toMatchObject({ success: true, status: "delivered" });

    // `refund_once` sobre uma operação `delivered` ⇒ terminal (não reabre, não estorna).
    const refused = await adminResolve({
      campaignId: campaign,
      operationId: operation,
      evidence: evidence({ art_kind: "absent" }),
    });
    expect(refused.error).toBeNull();
    expect(refused.data).toMatchObject({ success: false, reason: "operation_terminal" });
    expect(await refundLedgerCount()).toBe(refundBefore);
    expect((await creditOperationRow(ctx.pg, campaign, operation))?.status).toBe("delivered");
  }, 60_000);

  it.each(["invalid", "indeterminate"] as const)(
    "art_kind `%s` ⇒ INCONCLUSIVO: RPC recusa `insufficient_evidence`, sem estorno e sem auditoria fabricada",
    async (artKind) => {
      const campaign = await createCampaign(ctx.supabase, storeId);
      const operation = randomUUID();
      await reserveCredit(ctx.pg, storeId, campaign, operation);

      const refundBefore = await refundLedgerCount();
      const resolutionOperationId = randomUUID();
      const resolved = await adminResolve({
        campaignId: campaign,
        operationId: operation,
        evidence: evidence({ art_kind: artKind }),
        resolutionOperationId,
      });
      expect(resolved.error?.message ?? "").toContain("insufficient_evidence");
      expect(await auditCountFor(resolutionOperationId)).toBe(0);

      // O encerramento PF também recusa qualquer coisa diferente de `absent` confirmado.
      await expect(
        credit().closeFailedOperation({
          campaignId: campaign,
          operationId: operation,
          artKind,
          observedEpoch: await currentEpoch(campaign, operation),
          reason: "inconclusivo",
        }),
      ).rejects.toMatchObject({ code: "absent_not_confirmed" });

      expect(await refundLedgerCount()).toBe(refundBefore);
      expect((await creditOperationRow(ctx.pg, campaign, operation))?.status).toBe("reserved");
    },
    60_000,
  );

  it("publicação `in_flight`/`result_unknown` ⇒ INCONCLUSIVA; só a precondição JÁ existente (fechamento autorizado) encerra", async () => {
    const campaign = await createCampaign(ctx.supabase, storeId);
    const operation = randomUUID();
    await reserveCredit(ctx.pg, storeId, campaign, operation);
    const token = (await beginPublication(campaign, operation)).token as string;

    const refundBefore = await refundLedgerCount();

    // in_flight: `refund_once` não autorizado ⇒ recusado.
    const inFlight = await adminResolve({
      campaignId: campaign,
      operationId: operation,
      evidence: evidence({ state_epoch: await currentEpoch(campaign, operation) }),
    });
    expect(inFlight.error?.message ?? "").toContain("publication_in_progress");

    // result_unknown: mesmo resultado; a incerteza NÃO vira ausência.
    expect((await markResultUnknown(campaign, operation, token)).success).toBe(true);
    const unknown = await adminResolve({
      campaignId: campaign,
      operationId: operation,
      evidence: evidence({ state_epoch: await currentEpoch(campaign, operation) }),
    });
    expect(unknown.error?.message ?? "").toContain("publication_in_progress");
    expect(await refundLedgerCount()).toBe(refundBefore);
    expect((await creditOperationRow(ctx.pg, campaign, operation))?.status).toBe("reserved");

    // Precondição EXISTENTE: fechamento autorizado/auditado do inconclusivo.
    const authorized = await adminResolve({
      campaignId: campaign,
      operationId: operation,
      evidence: evidence({ authorized_publication_closure: true }),
    });
    expect(authorized.error).toBeNull();
    expect(authorized.data).toMatchObject({ success: true, status: "refunded" });
    expect(await refundLedgerCount()).toBe(refundBefore + 1);
  }, 60_000);

  it("kill simulado + deadline cooperativo NÃO autorizam via: apenas o predicado PF completo encerra", async () => {
    const campaign = await createCampaign(ctx.supabase, storeId);
    const operation = randomUUID();
    await reserveCredit(ctx.pg, storeId, campaign, operation);
    await attempts().acquire({
      campaignId: campaign,
      operationId: operation,
      target: "primary",
      attemptNumber: 1,
    });

    // Provider simulado abortado (deadline cooperativo) — nenhuma escrita.
    const provider = createSimulatedProvider();
    const controller = new AbortController();
    const pending = provider.generateUntilAborted(controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });

    const refundBefore = await refundLedgerCount();
    await expect(
      credit().closeFailedOperation({
        campaignId: campaign,
        operationId: operation,
        artKind: "absent",
        observedEpoch: await currentEpoch(campaign, operation),
        reason: "deadline cooperativo",
      }),
    ).rejects.toMatchObject({ code: "operation_in_progress" });
    expect(await refundLedgerCount()).toBe(refundBefore);

    // Só o predicado PF COMPLETO (claim encerrado + marcador failed) encerra.
    await attempts().finish({
      campaignId: campaign,
      operationId: operation,
      attemptNumber: 1,
      status: "failed",
    });
    await recordFailed(campaign, operation);
    const closed = await credit().closeFailedOperation({
      campaignId: campaign,
      operationId: operation,
      artKind: "absent",
      observedEpoch: await currentEpoch(campaign, operation),
      reason: "generation_failed",
    });
    expect(closed).toMatchObject({ status: "refunded" });
    expect(await refundLedgerCount()).toBe(refundBefore + 1);
  }, 60_000);
});
