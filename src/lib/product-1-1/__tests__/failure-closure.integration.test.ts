// @vitest-environment node
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import type { SupabaseClient } from "@supabase/supabase-js";

import type { AiInvoker } from "@/lib/ai/gateway";
import type { AiInvocationResult, AiTelemetryContext } from "@/lib/ai/types";
import { ProductOneToOneArtifactStore } from "../artifact/artifact-store";
import { ProductOneToOneAttemptStartClient } from "../orchestration/attempt-start-client";
import { ProductOneToOneCreditOperationClient } from "../credit-operation/credit-operation-client";
import { resolvePendingOperation } from "../pending/resolve-pending-operation";
import { SupabasePendingOperationsRepository } from "../pending/pending-operations-repository";
import { readProductOneToOneBackgroundDirection } from "../snapshot/persist-snapshot";
import { mapRestoredForm } from "@/lib/campaign/display";
import {
  closeIsolatedContext,
  createCampaign,
  createIsolatedContext,
  createTestStore,
  creditOperationRow,
  markArtUploaded,
  deliverCredit,
  refundCredit,
  reserveCredit,
  setCredits,
  type IsolatedContext,
} from "./integration-harness";

/**
 * F56.2b2b — Plano 06 / Task 3: CAMADA 2 — efeitos REAIS (Postgres/Storage LOCAIS)
 * dos 10 efeitos (a)-(j) do B2B-D8, mais o SEAM (b): o ORQUESTRADOR REAL
 * (`runProductOneToOneGeneration`) → marcador `outcome='failed'` gravado →
 * encerramento PF (`product_1_1_close_failed_operation`).
 *
 * Provider SEMPRE simulado (zero chamada paga). Nenhum `db push`/reset/deploy.
 * Fixtures append-only por UUID; nenhum cleanup destrutivo.
 */

let ctx: IsolatedContext;
let storeId: string;
let actorId: string;

const credit = () => new ProductOneToOneCreditOperationClient(ctx.supabase);
const attempts = () => new ProductOneToOneAttemptStartClient(ctx.supabase);
const artifactStore = () => new ProductOneToOneArtifactStore(ctx.supabase);
const repo = () => new SupabasePendingOperationsRepository(ctx.supabase);
const resolve = (input: Record<string, unknown>) =>
  resolvePendingOperation(input as never, { client: ctx.supabase, repository: repo() });

async function recordFailed(campaign: string, operation: string, reference?: string): Promise<void> {
  const { rows } = await ctx.pg.query<{ r: { success: boolean } }>(
    "SELECT public.product_1_1_record_generation_outcome($1, $2, 'failed', $3) AS r",
    [campaign, operation, reference ?? null],
  );
  if (!rows[0]?.r?.success) throw new Error("fixture_record_failed_failed");
}

async function claimRows(
  campaign: string,
  operation: string,
): Promise<Array<{ attempt_number: number; target: string; status: string }>> {
  const { rows } = await ctx.pg.query<{ attempt_number: number; target: string; status: string }>(
    "SELECT attempt_number, target, status FROM public.product_1_1_generation_attempt_claims WHERE campaign_id = $1 AND operation_id = $2 ORDER BY attempt_number",
    [campaign, operation],
  );
  return rows;
}

async function outcomeRow(
  campaign: string,
  operation: string,
): Promise<{ outcome: string; support_reference: string | null } | null> {
  const { rows } = await ctx.pg.query<{ outcome: string; support_reference: string | null }>(
    "SELECT outcome, support_reference FROM public.product_1_1_generation_outcomes WHERE campaign_id = $1 AND operation_id = $2",
    [campaign, operation],
  );
  return rows[0] ?? null;
}

async function auditRows(
  resolutionOperationId: string,
): Promise<Array<{ action: string; metadata: Record<string, unknown> }>> {
  const { rows } = await ctx.pg.query<{ action: string; metadata: Record<string, unknown> }>(
    "SELECT action, metadata FROM public.admin_audit_log WHERE operation_id = $1",
    [resolutionOperationId],
  );
  return rows;
}

async function refundLedgerCount(store: string): Promise<number> {
  const { rows } = await ctx.pg.query<{ n: number }>(
    "SELECT count(*)::int AS n FROM public.credit_transactions WHERE store_id = $1 AND type = 'refund'",
    [store],
  );
  return rows[0].n;
}

/** Insere evidência congelada (frozen evidence) com a direção de fundo dada. */
async function insertFrozenEvidence(
  campaign: string,
  operation: string,
  backgroundDirection: "studio" | "original" | "ambient",
): Promise<void> {
  const { data, error } = await ctx.supabase.rpc("product_1_1_persist_snapshot_with_binding", {
    p_campaign_id: campaign,
    p_primary_model: "gpt-image-2.5-sunburst",
    p_primary_quality: "medium",
    p_fallback_model: "gpt-image-2",
    p_fallback_quality: "medium",
    p_config_version_id: randomUUID(),
    p_origin: "human_decision",
    p_operation_id: operation,
    p_content_fingerprint: `fp-${randomUUID()}`,
  });
  if (error) throw new Error(`fixture_snapshot_failed:${error.message}`);
  const snapshotOriginalId = (data as Array<{ snapshot_original_id: string }>)[0]?.snapshot_original_id;
  if (!snapshotOriginalId) throw new Error("fixture_snapshot_missing_id");
  const { error: evError } = await ctx.supabase.from("product_1_1_snapshot_frozen_evidence").insert({
    snapshot_original_id: snapshotOriginalId,
    campaign_id: campaign,
    operation_id: operation,
    campaign_intent: "offer",
    background_direction: backgroundDirection,
    briefing: "briefing congelado",
    reference_selections: [],
    base_version: "v1",
    composer_version: "c1",
    policy_versions: {},
  });
  if (evError) throw new Error(`fixture_evidence_failed:${evError.message}`);
}

describe("F56.2b2b — Camada 2: efeitos reais (a)-(d) do B2B-D8 (Postgres/Storage isolados)", () => {
  beforeAll(async () => {
    ctx = await createIsolatedContext();
    const store = await createTestStore(ctx.supabase);
    storeId = store.storeId;
    await setCredits(ctx.pg, storeId, 60);
    actorId = store.userId;
  }, 60_000);

  it("(a) corrida entrega×estorno: `delivered` vence; estorno só na ausência; no máximo UM efeito de ledger", async () => {
    // Arte presente + entrega vence: o encerramento PF recusa `delivered`.
    const campaign = await createCampaign(ctx.supabase, storeId);
    const operation = randomUUID();
    await reserveCredit(ctx.pg, storeId, campaign, operation);
    await markArtUploaded(ctx.pg, campaign, operation);
    await deliverCredit(ctx.pg, campaign, operation);
    await expect(
      credit().closeFailedOperation({ campaignId: campaign, operationId: operation, artKind: "absent" }),
    ).rejects.toMatchObject({ code: "delivered_not_refundable" });
    const delivered = await creditOperationRow(ctx.pg, campaign, operation);
    expect(delivered?.status).toBe("delivered");
    expect(delivered?.refund_tx_id).toBeNull();

    // Corrida REAL entrega×estorno: exatamente UM dos dois vence; nunca ambos.
    const raceCampaign = await createCampaign(ctx.supabase, storeId);
    const raceOp = randomUUID();
    await reserveCredit(ctx.pg, storeId, raceCampaign, raceOp);
    await markArtUploaded(ctx.pg, raceCampaign, raceOp);
    const settled = await Promise.allSettled([
      deliverCredit(ctx.pg, raceCampaign, raceOp),
      refundCredit(ctx.pg, raceCampaign, raceOp, "race"),
    ]);
    expect(settled.filter((s) => s.status === "fulfilled").length).toBeGreaterThanOrEqual(1);
    const final = await creditOperationRow(ctx.pg, raceCampaign, raceOp);
    expect(["delivered", "refunded"]).toContain(final?.status);
    // Terminais são mutuamente exclusivos: `refunded` tem refund_tx; `delivered` não.
    if (final?.status === "refunded") expect(final.refund_tx_id).not.toBeNull();
    else expect(final?.refund_tx_id).toBeNull();
  }, 90_000);

  it("(b) estorno idempotente: 2ª chamada `idempotent:true`, sem segundo efeito de ledger", async () => {
    const campaign = await createCampaign(ctx.supabase, storeId);
    const operation = randomUUID();
    await reserveCredit(ctx.pg, storeId, campaign, operation);
    await recordFailed(campaign, operation, "IMG-REF-B");

    const before = await refundLedgerCount(storeId);
    const first = await credit().closeFailedOperation({
      campaignId: campaign,
      operationId: operation,
      artKind: "absent",
      reason: "generation_failed",
    });
    expect(first).toMatchObject({ status: "refunded", idempotent: false });
    const afterFirst = await refundLedgerCount(storeId);
    expect(afterFirst).toBe(before + 1);

    const second = await credit().closeFailedOperation({
      campaignId: campaign,
      operationId: operation,
      artKind: "absent",
      reason: "generation_failed",
    });
    expect(second).toMatchObject({ status: "refunded", idempotent: true });
    // Nenhum segundo efeito de ledger.
    expect(await refundLedgerCount(storeId)).toBe(afterFirst);
  }, 60_000);

  it("(c) resultado atrasado sobre `refunded`: `recordOperationOutcome` ⇒ operation_terminal; `deliver` recusado; estado NÃO sobrescrito", async () => {
    const campaign = await createCampaign(ctx.supabase, storeId);
    const operation = randomUUID();
    await reserveCredit(ctx.pg, storeId, campaign, operation);
    await recordFailed(campaign, operation, "IMG-REF-C");
    await credit().closeFailedOperation({
      campaignId: campaign,
      operationId: operation,
      artKind: "absent",
      reason: "generation_failed",
    });

    // Resultado atrasado (`unknown`) num terminal ⇒ recusado (operation_terminal).
    await expect(
      attempts().recordOperationOutcome({ campaignId: campaign, operationId: operation, outcome: "unknown" }),
    ).rejects.toMatchObject({ code: "operation_terminal" });

    // `deliver` recusado a partir de `refunded`.
    await expect(deliverCredit(ctx.pg, campaign, operation)).rejects.toThrow();

    // Estado terminal NÃO sobrescrito; marcador histórico preservado.
    const state = await creditOperationRow(ctx.pg, campaign, operation);
    expect(state?.status).toBe("refunded");
    expect((await outcomeRow(campaign, operation))?.outcome).toBe("failed");
    const read = await attempts().getCampaignOperation(campaign);
    expect(read).toMatchObject({ status: "refunded", terminal: true });
  }, 60_000);

  it("(d) falha de Storage/banco NUNCA colapsa com ausência: sonda indeterminate/erro ⇒ nenhum estorno", async () => {
    // Sonda TIPADA contra Storage indisponível ⇒ `indeterminate` (nunca `absent`).
    const throwingClient = {
      from: () => ({
        select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
      }),
      storage: {
        from: () => ({
          download: async () => {
            throw new Error("storage_unavailable");
          },
        }),
      },
    } as unknown as SupabaseClient;
    const probe = await new ProductOneToOneArtifactStore(throwingClient).probeArtifact({
      storeId,
      campaignId: randomUUID(),
      operationId: randomUUID(),
    });
    expect(probe.kind).toBe("indeterminate");

    // Efeito REAL no banco: RPC de resolução recusa `indeterminate` (sem estorno).
    const campaign = await createCampaign(ctx.supabase, storeId);
    const operation = randomUUID();
    await reserveCredit(ctx.pg, storeId, campaign, operation);
    const resolveResult = await ctx.supabase.rpc("admin_resolve_product_1_1_pending", {
      p_actor_id: actorId,
      p_campaign_id: campaign,
      p_operation_id: operation,
      p_action: "refund_once",
      p_reason: "sonda indeterminada",
      p_resolution_operation_id: randomUUID(),
      p_evidence: { origin: "server-derived", art_kind: "indeterminate", execution_ended: true },
    });
    expect(resolveResult.error?.message ?? "").toContain("insufficient_evidence");
    // RPC de encerramento PF recusa `indeterminate` como ausência não confirmada.
    await expect(
      credit().closeFailedOperation({ campaignId: campaign, operationId: operation, artKind: "indeterminate" }),
    ).rejects.toMatchObject({ code: "absent_not_confirmed" });
    expect((await creditOperationRow(ctx.pg, campaign, operation))?.status).toBe("reserved");
  }, 60_000);
});

describe("F56.2b2b — Camada 2: efeito (e) — formulário restaurado (evidência congelada + direção de fundo)", () => {
  it("(e) snapshot server-side + direção de fundo LIDA da EVIDÊNCIA CONGELADA ⇒ preservado", async () => {
    const { data: campaignRow, error } = await ctx.supabase
      .from("campaigns")
      .insert({
        store_id: storeId,
        status: "ready",
        product_name: "Produto restaurado",
        storage_path: `${storeId}/restored.jpg`,
        input_snapshot: {
          product: { name: "Produto restaurado", description: "desc" },
          commercial: { intent: "offer", originalPriceCents: 29990, discountedPriceCents: 19990, badge: "Promoção" },
        },
      })
      .select("id")
      .single<{ id: string }>();
    if (error || !campaignRow) throw new Error(`fixture_campaign_failed:${error?.message}`);
    const campaign = campaignRow.id;
    const operation = randomUUID();
    await reserveCredit(ctx.pg, storeId, campaign, operation);
    await insertFrozenEvidence(campaign, operation, "original");

    // Direção lida da EVIDÊNCIA CONGELADA (operationId resolvido server-side).
    const direction = await readProductOneToOneBackgroundDirection(ctx.supabase, {
      campaignId: campaign,
      operationId: operation,
    });
    expect(direction).toBe("original");

    const restored = mapRestoredForm({
      campaignId: campaign,
      inputSnapshot: { product: { name: "Produto restaurado" }, commercial: { intent: "offer", originalPriceCents: 29990, discountedPriceCents: 19990, badge: "Promoção" } },
      backgroundDirection: direction,
    });
    expect(restored).toMatchObject({ campaignId: campaign, productName: "Produto restaurado", backgroundDirection: "original" });
    expect(restored?.backgroundDirectionUnresolved).toBeUndefined();

    // Fonte ausente ⇒ escolha obrigatória (NUNCA `studio` silencioso).
    const unresolved = mapRestoredForm({
      campaignId: campaign,
      inputSnapshot: { product: { name: "Produto restaurado" }, commercial: { intent: "offer" } },
      backgroundDirection: null,
    });
    expect(unresolved?.backgroundDirection).toBeUndefined();
    expect(unresolved?.backgroundDirectionUnresolved).toBe(true);
  }, 60_000);
});

describe("F56.2b2b — Camada 2: efeitos (f)-(j) e encerramento sob a trava (C4)", () => {
  it("(f) geração normal sem arte com claim `in_progress` ⇒ consulta/reload NÃO estorna", async () => {
    const campaign = await createCampaign(ctx.supabase, storeId);
    const operation = randomUUID();
    await reserveCredit(ctx.pg, storeId, campaign, operation);
    await attempts().acquire({ campaignId: campaign, operationId: operation, target: "primary", attemptNumber: 1 });

    const read = await attempts().getCampaignOperation(campaign);
    expect(read).toMatchObject({ status: "reserved", terminal: false });

    // Resolução NÃO-autorizada bloqueia (execução ativa) — sem estorno.
    await expect(
      resolve({
        actorId,
        campaignId: campaign,
        operationId: operation,
        action: "refund_once",
        reason: "sem sinal",
        resolutionOperationId: randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "operation_in_progress" });
    expect((await creditOperationRow(ctx.pg, campaign, operation))?.status).toBe("reserved");
  }, 60_000);

  it("(g) principal falhou (claim `failed`), fallback ainda será iniciado ⇒ NÃO estorna (janela principal→fallback)", async () => {
    const campaign = await createCampaign(ctx.supabase, storeId);
    const operation = randomUUID();
    await reserveCredit(ctx.pg, storeId, campaign, operation);
    await attempts().acquire({ campaignId: campaign, operationId: operation, target: "primary", attemptNumber: 1 });
    await attempts().finish({ campaignId: campaign, operationId: operation, attemptNumber: 1, status: "failed" });

    // Sem marcador `failed` persistido ⇒ PF incompleto ⇒ nenhum estorno.
    await expect(
      credit().closeFailedOperation({ campaignId: campaign, operationId: operation, artKind: "absent" }),
    ).rejects.toMatchObject({ code: "finality_not_recorded" });
    expect((await creditOperationRow(ctx.pg, campaign, operation))?.status).toBe("reserved");
    expect(await outcomeRow(campaign, operation)).toBeNull();
  }, 60_000);

  it("(h) falha final (PF completo, 4a) ⇒ encerra e estorna UMA vez (decisão server-side)", async () => {
    const campaign = await createCampaign(ctx.supabase, storeId);
    const operation = randomUUID();
    await reserveCredit(ctx.pg, storeId, campaign, operation);
    // Caminho terminal completo: marcador `failed` + claim `failed` + ausência.
    await attempts().acquire({ campaignId: campaign, operationId: operation, target: "primary", attemptNumber: 1 });
    await attempts().finish({ campaignId: campaign, operationId: operation, attemptNumber: 1, status: "failed" });
    await recordFailed(campaign, operation, "IMG-REF-H");

    const state = await credit().closeFailedOperation({
      campaignId: campaign,
      operationId: operation,
      artKind: "absent",
      reason: "generation_failed",
    });
    expect(state).toMatchObject({ status: "refunded", idempotent: false });
    expect((await creditOperationRow(ctx.pg, campaign, operation))?.refund_tx_id).not.toBeNull();
  }, 60_000);

  it("(i) sem sinal de finalidade ⇒ exige encerramento AUTORIZADO+auditado (abandono do residual)", async () => {
    const campaign = await createCampaign(ctx.supabase, storeId);
    const operation = randomUUID();
    await reserveCredit(ctx.pg, storeId, campaign, operation);
    // Residual `in_progress` (sem encerramento comprovado) + ausência de arte.
    await attempts().acquire({ campaignId: campaign, operationId: operation, target: "primary", attemptNumber: 1 });

    // SEM autorização ⇒ BLOQUEADO (RPC não é chamada; nada estornado).
    await expect(
      resolve({
        actorId,
        campaignId: campaign,
        operationId: operation,
        action: "refund_once",
        reason: "tentativa automática",
        resolutionOperationId: randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "operation_in_progress" });
    expect((await creditOperationRow(ctx.pg, campaign, operation))?.status).toBe("reserved");

    // COM a marca AUTORIZADA (caminho admin) ⇒ abandona + estorna (auditado).
    const resolutionOperationId = randomUUID();
    const authorized = await resolve({
      actorId,
      campaignId: campaign,
      operationId: operation,
      action: "refund_once",
      reason: "encerramento autorizado",
      resolutionOperationId,
      authorizeAbandon: true,
    });
    expect(authorized).toMatchObject({ status: "refunded" });
    expect((await creditOperationRow(ctx.pg, campaign, operation))?.status).toBe("refunded");
    const claims = await claimRows(campaign, operation);
    expect(claims.some((claim) => claim.status === "abandoned")).toBe(true);
    const audits = await auditRows(resolutionOperationId);
    expect(audits).toHaveLength(1);
    expect(audits[0].action).toBe("product_1_1_pending_resolution");
  }, 60_000);

  it("(j) encerramento (automático ou autorizado) impede atomicamente tentativa posterior (operation_terminal, sob C4)", async () => {
    // Automático: PF completo ⇒ refunded ⇒ acquire recusado.
    const autoCampaign = await createCampaign(ctx.supabase, storeId);
    const autoOp = randomUUID();
    await reserveCredit(ctx.pg, storeId, autoCampaign, autoOp);
    await attempts().acquire({ campaignId: autoCampaign, operationId: autoOp, target: "primary", attemptNumber: 1 });
    await attempts().finish({ campaignId: autoCampaign, operationId: autoOp, attemptNumber: 1, status: "failed" });
    await recordFailed(autoCampaign, autoOp, "IMG-REF-J");
    await credit().closeFailedOperation({ campaignId: autoCampaign, operationId: autoOp, artKind: "absent" });
    const refusedAuto = await attempts().acquire({ campaignId: autoCampaign, operationId: autoOp, target: "primary", attemptNumber: 2 });
    expect(refusedAuto).toMatchObject({ acquired: false, reason: "operation_terminal" });

    // Autorizado: residual abandonado ⇒ refunded ⇒ acquire recusado.
    const authCampaign = await createCampaign(ctx.supabase, storeId);
    const authOp = randomUUID();
    await reserveCredit(ctx.pg, storeId, authCampaign, authOp);
    await attempts().acquire({ campaignId: authCampaign, operationId: authOp, target: "primary", attemptNumber: 1 });
    await resolve({
      actorId,
      campaignId: authCampaign,
      operationId: authOp,
      action: "refund_once",
      reason: "autorizado",
      resolutionOperationId: randomUUID(),
      authorizeAbandon: true,
    });
    const refusedAuth = await attempts().acquire({ campaignId: authCampaign, operationId: authOp, target: "primary", attemptNumber: 2 });
    expect(refusedAuth).toMatchObject({ acquired: false, reason: "operation_terminal" });
  }, 90_000);
});

describe("F56.2b2b — Camada 2 / SEAM (b): ORQUESTRADOR REAL → marcador `failed` → encerramento (PF)", () => {
  function config() {
    return {
      primary: { model: "gpt-image-2.5-sunburst", quality: "medium" },
      fallback: { model: "gpt-image-2", quality: "medium" },
      origin: "human_decision" as const,
      configVersionId: randomUUID(),
    };
  }

  it("falha final REAL do orquestrador grava `failed` e encerra via `product_1_1_close_failed_operation` (estorno UMA vez)", async () => {
    const campaign = await createCampaign(ctx.supabase, storeId);
    const operation = randomUUID();
    const cfg = config();
    const snapshot = Object.freeze({
      campaignId: campaign,
      primaryModel: cfg.primary.model,
      primaryQuality: cfg.primary.quality,
      fallbackModel: cfg.fallback.model,
      fallbackQuality: cfg.fallback.quality,
      configVersionId: cfg.configVersionId,
      origin: cfg.origin,
      createdAt: new Date().toISOString(),
    });

    // Gateway SIMULADO: falha TERMINAL (content policy) ⇒ sem arte.
    const createGateway = (() => {
      return {
        async invoke(): Promise<AiInvocationResult> {
          throw Object.assign(new Error("content policy violation"), { code: "content_policy" });
        },
        async hasFallback() {
          return true;
        },
      } as AiInvoker;
    });

    const { runProductOneToOneGeneration } = await import("../orchestration/generation-orchestrator");

    const response = await runProductOneToOneGeneration(
      {
        campaignId: campaign,
        operationId: operation,
        storeId,
        briefing: {
          backgroundDirection: "studio",
          product: { name: "Produto seam b", description: null },
          commercial: { intent: "offer", originalPriceText: null, discountedPriceText: "R$ 19,90", badge: null, validity: null },
          constraints: { mandatoryArtworkText: null },
        },
        briefingText: "briefing congelado",
        campaignIntent: "offer",
        backgroundDirection: "studio",
        runId: "run-seam-b",
        traceId: "trace-seam-b",
      },
      {
        runPreflight: async () =>
          ({
            config: cfg,
            pricing: { primary: {} as never, fallback: {} as never, missingComponents: [], pricingCoverage: "complete" },
          }) as never,
        buildSnapshot: () => snapshot as never,
        persistSnapshot: async () => ({ snapshotOriginalId: randomUUID(), reused: false }),
        credit: credit() as never,
        attempts: attempts() as never,
        artifact: artifactStore() as never,
        createGateway,
        createTelemetry: (): AiTelemetryContext => ({
          operationRunId: "run-seam-b",
          operationRunType: "campaign_delivery",
          traceId: "trace-seam-b",
          storeId,
          campaignId: campaign,
          attemptNumber: 1,
          sink: { emit: async () => {} },
        }),
        recordAttempt: async () => ({ id: "row-1", operationId: operation }),
        recordDiagnosis: async () => ({ reference: "IMG-SEAM-B" }),
        generateSupportReference: () => "IMG-SEAM-B",
      },
    );

    const events = (await response.text())
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    const terminal = events[events.length - 1];
    expect(terminal).toMatchObject({ type: "error", code: "IMG-001" });
    expect(String(terminal.message)).toContain("estornado");

    // EFEITOS reais no Postgres isolado.
    expect((await outcomeRow(campaign, operation))?.outcome).toBe("failed");
    const state = await creditOperationRow(ctx.pg, campaign, operation);
    expect(state?.status).toBe("refunded");
    expect(state?.refund_tx_id).not.toBeNull();
    const claims = await claimRows(campaign, operation);
    expect(claims.some((claim) => claim.status === "failed")).toBe(true);
  }, 90_000);
});

// Teardown em NÍVEL DE ARQUIVO — o cliente pg é compartilhado por TODOS os
// describes (um `afterAll` escopado a um describe fecharia o cliente cedo).
afterAll(async () => {
  if (ctx) await closeIsolatedContext(ctx);
});
