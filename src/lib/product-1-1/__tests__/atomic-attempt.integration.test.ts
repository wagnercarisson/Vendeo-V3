// @vitest-environment node
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import type { ImageGenerationConfigSnapshot } from "@/lib/ai/image-generation-config-snapshot";
import type { AttemptCostResolver } from "../orchestration/instrumentation";
import type { AiInvoker } from "@/lib/ai/gateway";
import type { NewFlowPreflightResult } from "../orchestration/preflight";
import { AttemptStartError } from "../orchestration/attempt-start-types";
import { ProductOneToOneAttemptStartClient } from "../orchestration/attempt-start-client";
import { ProductOneToOneCreditOperationClient } from "../credit-operation/credit-operation-client";
import { ProductOneToOneArtifactStore } from "../artifact/artifact-store";
import {
  runProductOneToOneGeneration,
  type ProductOneToOneGenerationDeps,
} from "../orchestration/generation-orchestrator";
import {
  attemptClaimRows,
  closeIsolatedContext,
  createCampaign,
  createIsolatedContext,
  createTestStore,
  creditOperationRow,
  jpeg1024DataUrl,
  markArtUploaded,
  readNdjson,
  reserveCredit,
  setCredits,
  terminalEvent,
  type IsolatedContext,
} from "./integration-harness";

/**
 * F56.2b1b — Plano 09 / Task 2: concorrência → UMA chamada ao provider, guardas
 * de sequência/estado prévio (F1), C1 (unknown persistido), F2 (replay do
 * outcome) e I1/I2 (reenvio-consulta / fail-closed). Postgres real; provider
 * SIMULADO (zero chamada paga).
 */

const PRIMARY = { model: "gpt-image-2.5-sunburst", quality: "medium" } as const;
const FALLBACK = { model: "gpt-image-2", quality: "medium" } as const;

let ctx: IsolatedContext;
let storeId: string;
let campaignId: string;

const briefings = {
  backgroundDirection: "studio" as const,
  product: { name: "Produto 1:1", description: "Descrição" },
  commercial: {
    intent: "offer" as const,
    originalPriceText: "R$ 100",
    discountedPriceText: "R$ 80",
    badge: null,
    validity: null,
  },
  constraints: { mandatoryArtworkText: null },
};

function fakeSnapshot(campaign: string): ImageGenerationConfigSnapshot {
  return {
    campaignId: campaign,
    primaryModel: PRIMARY.model,
    primaryQuality: PRIMARY.quality,
    fallbackModel: FALLBACK.model,
    fallbackQuality: FALLBACK.quality,
    configVersionId: randomUUID(),
    origin: "selection",
    runId: randomUUID(),
    traceId: `trace-${randomUUID()}`,
    createdAt: new Date().toISOString(),
  } as unknown as ImageGenerationConfigSnapshot;
}

function baseDeps(
  overrides: Partial<ProductOneToOneGenerationDeps> = {},
): ProductOneToOneGenerationDeps {
  const supabase = ctx.supabase;
  return {
    client: supabase,
    runPreflight: async () =>
      ({
        config: {
          primary: PRIMARY,
          fallback: FALLBACK,
          origin: "selection",
          configVersionId: randomUUID(),
        },
        pricing: { status: "complete" },
      }) as unknown as NewFlowPreflightResult,
    buildSnapshot: (_config, context) => fakeSnapshot(context.campaignId),
    credit: new ProductOneToOneCreditOperationClient(supabase),
    attempts: new ProductOneToOneAttemptStartClient(supabase),
    artifact: new ProductOneToOneArtifactStore(supabase),
    recordAttempt: async () => ({}),
    resolveAttemptCost: (async () => {
      throw new Error("pricing_stub");
    }) as unknown as AttemptCostResolver,
    generateSupportReference: () => "IMG-001-test",
    recordDiagnosis: async () => ({ reference: "IMG-001-test" }),
    ...overrides,
  };
}

async function freshOperation(store: string, campaign: string): Promise<string> {
  const operationId = randomUUID();
  await reserveCredit(ctx.pg, store, campaign, operationId);
  return operationId;
}

describe("F56.2b1b — atomic attempt start (Postgres real / provider simulado)", () => {
  beforeAll(async () => {
    ctx = await createIsolatedContext();
    const store = await createTestStore(ctx.supabase);
    storeId = store.storeId;
    await setCredits(ctx.pg, storeId, 20);
    campaignId = await createCampaign(ctx.supabase, storeId);
  }, 60_000);

  afterAll(async () => {
    await closeIsolatedContext(ctx);
  });

  it("duas requisições concorrentes ⇒ exatamente um vencedor e UMA chamada ao provider", async () => {
    const campaign = await createCampaign(ctx.supabase, storeId);
    const operationId = randomUUID();
    const provider = { calls: 0 };
    const image = await jpeg1024DataUrl();
    const gateway = {
      invoke: async () => {
        provider.calls += 1;
        return { imageBase64: image.split(",")[1], mimeType: "image/jpeg" };
      },
    } as unknown as AiInvoker;

    const deps = baseDeps({ createGateway: () => gateway });
    const input = {
      campaignId: campaign,
      operationId,
      storeId,
      briefing: briefings,
      briefingText: "briefing",
      campaignIntent: "offer" as const,
      backgroundDirection: "studio" as const,
    };

    const [r1, r2] = await Promise.all([
      runProductOneToOneGeneration(input, deps),
      runProductOneToOneGeneration(input, deps),
    ]);
    const [events1, events2] = await Promise.all([
      readNdjson(r1),
      readNdjson(r2),
    ]);

    const terminals = [terminalEvent(events1), terminalEvent(events2)];
    expect(provider.calls).toBe(1);
    const delivered = terminals.filter((event) => event.type === "result");
    expect(delivered).toHaveLength(1);

    const claims = await attemptClaimRows(ctx.pg, campaign, operationId);
    expect(claims.filter((claim) => claim.status !== "failed")).toHaveLength(1);
  }, 90_000);

  it("F1 — fallback na 2ª chamada por indisponibilidade explícita (teto por contadores por alvo)", async () => {
    const campaign = await createCampaign(ctx.supabase, storeId);
    const operationId = await freshOperation(storeId, campaign);
    const client = new ProductOneToOneAttemptStartClient(ctx.supabase);

    const first = await client.acquire({
      campaignId: campaign,
      operationId,
      target: "primary",
      attemptNumber: 1,
    });
    expect(first).toMatchObject({ acquired: true, target: "primary", attemptNumber: 1 });
    await client.finish({ campaignId: campaign, operationId, attemptNumber: 1, status: "failed" });

    // A indisponibilidade explícita no primary permite fallback JÁ na 2ª chamada.
    const second = await client.acquire({
      campaignId: campaign,
      operationId,
      target: "fallback",
      attemptNumber: 2,
    });
    expect(second).toMatchObject({ acquired: true, target: "fallback", attemptNumber: 2 });
    await client.finish({ campaignId: campaign, operationId, attemptNumber: 2, status: "failed" });

    // Um novo `primary` após o `fallback` é recusado (nunca por posição fixa).
    const third = await client.acquire({
      campaignId: campaign,
      operationId,
      target: "primary",
      attemptNumber: 3,
    });
    expect(third).toMatchObject({ acquired: false, reason: "primary_after_fallback" });

    const claims = await attemptClaimRows(ctx.pg, campaign, operationId);
    expect(claims.filter((claim) => claim.target === "primary")).toHaveLength(1);
    expect(claims.filter((claim) => claim.target === "fallback")).toHaveLength(1);
  });

  it("F1 — guardas de sequência/estado prévio (Postgres real)", async () => {
    const client = new ProductOneToOneAttemptStartClient(ctx.supabase);

    // fallback como 1ª chamada ⇒ fallback_before_primary
    const cFallback = await createCampaign(ctx.supabase, storeId);
    const oFallback = await freshOperation(storeId, cFallback);
    const fallbackFirst = await client.acquire({
      campaignId: cFallback,
      operationId: oFallback,
      target: "fallback",
      attemptNumber: 1,
    });
    expect(fallbackFirst).toMatchObject({ acquired: false, reason: "fallback_before_primary" });

    // attempt_number não sequencial ⇒ out_of_sequence
    const cSeq = await createCampaign(ctx.supabase, storeId);
    const oSeq = await freshOperation(storeId, cSeq);
    const outOfSeq = await client.acquire({
      campaignId: cSeq,
      operationId: oSeq,
      target: "primary",
      attemptNumber: 2,
    });
    expect(outOfSeq).toMatchObject({ acquired: false, reason: "out_of_sequence" });

    // nova tentativa após claim `done` ⇒ attempt_already_completed
    const cDone = await createCampaign(ctx.supabase, storeId);
    const oDone = await freshOperation(storeId, cDone);
    const won = await client.acquire({
      campaignId: cDone,
      operationId: oDone,
      target: "primary",
      attemptNumber: 1,
    });
    expect(won.acquired).toBe(true);
    await client.finish({ campaignId: cDone, operationId: oDone, attemptNumber: 1, status: "done" });
    const afterDone = await client.acquire({
      campaignId: cDone,
      operationId: oDone,
      target: "primary",
      attemptNumber: 2,
    });
    expect(afterDone).toMatchObject({ acquired: false, reason: "attempt_already_completed" });

    // operação de crédito `art_uploaded` ⇒ operation_art_uploaded
    const cArt = await createCampaign(ctx.supabase, storeId);
    const oArt = await freshOperation(storeId, cArt);
    await markArtUploaded(ctx.pg, cArt, oArt);
    const afterArt = await client.acquire({
      campaignId: cArt,
      operationId: oArt,
      target: "primary",
      attemptNumber: 1,
    });
    expect(afterArt).toMatchObject({ acquired: false, reason: "operation_art_uploaded" });
  });

  it("C1 — timeout ⇒ `unknown` PERSISTIDO ⇒ nova tentativa recusada (zero 2ª chamada)", async () => {
    const campaign = await createCampaign(ctx.supabase, storeId);
    const operationId = await freshOperation(storeId, campaign);
    const client = new ProductOneToOneAttemptStartClient(ctx.supabase);

    const acquired = await client.acquire({
      campaignId: campaign,
      operationId,
      target: "primary",
      attemptNumber: 1,
    });
    expect(acquired.acquired).toBe(true);

    // Simula o timeout/abort persistindo o resultado DESCONHECIDO.
    const recorded = await client.recordOperationOutcome({
      campaignId: campaign,
      operationId,
      outcome: "unknown",
      supportReference: "IMG-001-timeout",
    });
    expect(recorded).toMatchObject({ outcome: "unknown", supportReference: "IMG-001-timeout" });

    const state = await client.getCampaignOperation(campaign);
    expect(state).not.toBeNull();
    expect(state).toMatchObject({ unknown: true, terminal: false, outcome: "unknown" });

    const retry = await client.acquire({
      campaignId: campaign,
      operationId,
      target: "primary",
      attemptNumber: 2,
    });
    expect(retry).toMatchObject({ acquired: false, reason: "operation_unknown" });

    const outcomes = await ctx.pg.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM public.product_1_1_generation_outcomes WHERE campaign_id = $1 AND operation_id = $2",
      [campaign, operationId],
    );
    expect(outcomes.rows[0].n).toBe(1);
  });

  it("F2 — replay divergente do outcome ⇒ operation_identity_conflict; equivalente idempotente", async () => {
    const campaign = await createCampaign(ctx.supabase, storeId);
    const operationId = await freshOperation(storeId, campaign);
    const client = new ProductOneToOneAttemptStartClient(ctx.supabase);

    const first = await client.recordOperationOutcome({
      campaignId: campaign,
      operationId,
      outcome: "failed",
    });
    expect(first).toMatchObject({ outcome: "failed", idempotent: false });

    let caught: unknown;
    try {
      await client.recordOperationOutcome({ campaignId: campaign, operationId, outcome: "unknown" });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(AttemptStartError);
    expect((caught as AttemptStartError).code).toBe("operation_identity_conflict");

    const replay = await client.recordOperationOutcome({
      campaignId: campaign,
      operationId,
      outcome: "failed",
    });
    expect(replay).toMatchObject({ outcome: "failed", idempotent: true });

    const outcomes = await ctx.pg.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM public.product_1_1_generation_outcomes WHERE campaign_id = $1 AND operation_id = $2",
      [campaign, operationId],
    );
    expect(outcomes.rows[0].n).toBe(1);
  });

  it("I1 — reenvio com operação EM ANDAMENTO ⇒ zero mutações e zero provider", async () => {
    const campaign = await createCampaign(ctx.supabase, storeId);
    const operationId = await freshOperation(storeId, campaign);

    let persistCalls = 0;
    let reserveCalls = 0;
    let acquireCalls = 0;
    let gatewayCalls = 0;
    let storeCalls = 0;

    const realAttempts = new ProductOneToOneAttemptStartClient(ctx.supabase);
    const credit = new ProductOneToOneCreditOperationClient(ctx.supabase);
    const deps = baseDeps({
      persistSnapshot: async () => {
        persistCalls += 1;
        return { snapshotOriginalId: randomUUID(), reused: false };
      },
      credit: {
        reserve: async (input) => {
          reserveCalls += 1;
          return credit.reserve(input);
        },
        beginPublication: (c, o) => credit.beginPublication(c, o),
        getPublicationEpoch: (c, o) => credit.getPublicationEpoch(c, o),
        abortPublication: (c, o, t, p) => credit.abortPublication(c, o, t, p),
        markResultUnknown: (c, o, t) => credit.markResultUnknown(c, o, t),
        markArtUploaded: (c, o, t) => credit.markArtUploaded(c, o, t),
        deliver: (c, o, t) => credit.deliver(c, o, t),
        refund: (c, o, r) => credit.refund(c, o, r),
        closeFailedOperation: (i) => credit.closeFailedOperation(i),
      },
      attempts: {
        acquire: async (input) => {
          acquireCalls += 1;
          return realAttempts.acquire(input);
        },
        finish: (input) => realAttempts.finish(input),
        recordOperationOutcome: (input) => realAttempts.recordOperationOutcome(input),
        getCampaignOperation: (c) => realAttempts.getCampaignOperation(c),
      },
      createGateway: () => {
        gatewayCalls += 1;
        return { invoke: async () => ({ imageBase64: "x", mimeType: "image/png" }) } as unknown as AiInvoker;
      },
      artifact: {
        storeArtifact: async () => {
          storeCalls += 1;
          return { storagePath: "x", width: 1024, height: 1024, mimeType: "image/jpeg" };
        },
        probeArtifact: async () => ({ kind: "indeterminate" as const }),
      },
    });

    const response = await runProductOneToOneGeneration(
      {
        campaignId: campaign,
        operationId,
        storeId,
        briefing: briefings,
        briefingText: "briefing",
        campaignIntent: "offer",
        backgroundDirection: "studio",
      },
      deps,
    );
    const terminal = terminalEvent(await readNdjson(response));

    expect(terminal.type).toBe("error");
    expect(terminal.code).toBe("operation_in_progress");
    expect(persistCalls).toBe(0);
    expect(reserveCalls).toBe(0);
    expect(acquireCalls).toBe(0);
    expect(gatewayCalls).toBe(0);
    expect(storeCalls).toBe(0);

    const claims = await attemptClaimRows(ctx.pg, campaign, operationId);
    expect(claims).toHaveLength(0);
  });

  it("I2 — falha ao persistir `unknown` ⇒ claim residual, SEM estorno e SEM reexecução", async () => {
    // NENHUMA reserva prévia: o orquestrador cria a operação (evita o
    // curto-circuito `operação existe`).
    const campaign = await createCampaign(ctx.supabase, storeId);
    const operationId = randomUUID();

    const realAttempts = new ProductOneToOneAttemptStartClient(ctx.supabase);
    const realCredit = new ProductOneToOneCreditOperationClient(ctx.supabase);
    let refundCalls = 0;
    let finishAbandoned = 0;

    const abortGateway = {
      invoke: async () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        throw error;
      },
    } as unknown as AiInvoker;

    const deps = baseDeps({
      attempts: {
        acquire: (input) => realAttempts.acquire(input),
        finish: async (input) => {
          if (input.status === "abandoned") finishAbandoned += 1;
          return realAttempts.finish(input);
        },
        // A persistência do `unknown` FALHA (fail-closed I2).
        recordOperationOutcome: async () => {
          throw new Error("persist_unknown_failed");
        },
        getCampaignOperation: (c) => realAttempts.getCampaignOperation(c),
      },
      credit: {
        reserve: (input) => realCredit.reserve(input),
        beginPublication: (c, o) => realCredit.beginPublication(c, o),
        getPublicationEpoch: (c, o) => realCredit.getPublicationEpoch(c, o),
        abortPublication: (c, o, t, p) => realCredit.abortPublication(c, o, t, p),
        markResultUnknown: (c, o, t) => realCredit.markResultUnknown(c, o, t),
        markArtUploaded: (c, o, t) => realCredit.markArtUploaded(c, o, t),
        deliver: (c, o, t) => realCredit.deliver(c, o, t),
        refund: async (c, o, r) => {
          refundCalls += 1;
          return realCredit.refund(c, o, r);
        },
        closeFailedOperation: (i) => realCredit.closeFailedOperation(i),
      },
      createGateway: () => abortGateway,
      artifact: {
        storeArtifact: async () => {
          throw new Error("not_reached");
        },
        probeArtifact: async () => ({ kind: "indeterminate" as const }),
      },
    });

    const response = await runProductOneToOneGeneration(
      {
        campaignId: campaign,
        operationId,
        storeId,
        briefing: briefings,
        briefingText: "briefing",
        campaignIntent: "offer",
        backgroundDirection: "studio",
      },
      deps,
    );
    const terminal = terminalEvent(await readNdjson(response));

    expect(terminal.type).toBe("unknown");
    expect(refundCalls).toBe(0);
    expect(finishAbandoned).toBe(0);

    // O claim permanece `in_progress` RESIDUAL (pendente) — não foi liberado.
    const claims = await attemptClaimRows(ctx.pg, campaign, operationId);
    expect(claims).toHaveLength(1);
    expect(claims[0]).toMatchObject({ status: "in_progress", target: "primary" });

    const credit = await creditOperationRow(ctx.pg, campaign, operationId);
    expect(credit?.status).toBe("reserved");
  });
});
