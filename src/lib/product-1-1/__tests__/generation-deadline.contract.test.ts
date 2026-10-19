// @vitest-environment node
//
// F56.2b2d — Plano 02: contrato do DEADLINE do Produto 1:1.
//
// Cabeçalho — abordagem determinística (Task 3):
//   * O caso de deadline curto usa `vi.useFakeTimers()` + `deps.deadlineMs`
//     (seam de teste). NUNCA há espera real de 240s. O `deadlineMs` injetado
//     (30s) é ESTRITAMENTE MAIOR que `PRODUCT_1_1_PERSISTENCE_RESERVE_MS` (20s),
//     de modo que as guardas `canStartDurableWrite` passam no início e a corrida
//     provider×deadline é efetivamente exercitada (o provider nunca resolve).
//   * O caso "tempo consumido ANTES do orquestrador" usa relógio REAL (sem fake)
//     com `requestStartedAtMs` anterior ao deadline.
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AiInvocationResult } from "@/lib/ai/types";
import type { ImageModelPairConfig } from "@/lib/ai/image-model-pair";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import type {
  CampaignOperationState,
  AttemptTarget,
} from "../orchestration/attempt-start-types";
import type { ProductPromptCompositionBriefing } from "../policies/types";
import type { ProductOneToOneArtifactRef } from "../artifact/types";
import {
  PRODUCT_1_1_GENERATION_DEADLINE_MS,
  PRODUCT_1_1_PERSISTENCE_RESERVE_MS,
  PRODUCT_1_1_PLATFORM_TIMEOUT_MS,
  assertDeadlineBelowPlatform,
  canStartDurableWrite,
  createDeadlineRejection,
  deadlineAt,
  remainingBeforeDeadline,
  remainingBudget,
} from "../orchestration/deadline";

const ORCHESTRATOR_PATH = path.resolve(
  process.cwd(),
  "src/lib/product-1-1/orchestration/generation-orchestrator.ts",
);

const CAMPAIGN_ID = "11111111-1111-4111-8111-111111111111";
const OPERATION_ID = "22222222-2222-4222-8222-222222222222";
const STORE_ID = "33333333-3333-4333-8333-333333333333";
const SNAPSHOT_ID = "44444444-4444-4444-8444-444444444444";

// Deadline injetado nos testes comportamentais: > reserva (20s) e curto o
// bastante para ser disparado por fake timers sem espera real.
const TEST_DEADLINE_MS = 30_000;

const CONFIG = {
  primary: { model: "gpt-image-2.5-sunburst", quality: "medium" },
  fallback: { model: "gpt-image-2", quality: "medium" },
  origin: "human_decision",
  configVersionId: "55555555-5555-4555-8555-555555555555",
};

const SNAPSHOT = Object.freeze({
  campaignId: CAMPAIGN_ID,
  primaryModel: "gpt-image-2.5-sunburst",
  primaryQuality: "medium",
  fallbackModel: "gpt-image-2",
  fallbackQuality: "medium",
  configVersionId: CONFIG.configVersionId,
  origin: "human_decision",
  createdAt: "2026-10-12T00:00:00.000Z",
});

const BRIEFING: ProductPromptCompositionBriefing = {
  backgroundDirection: "studio",
  product: { name: "Produto Teste", description: null },
  commercial: {
    intent: "offer",
    originalPriceText: null,
    discountedPriceText: "R$ 19,90",
    badge: null,
    validity: null,
  },
  constraints: { mandatoryArtworkText: null },
};

function makeInput() {
  return {
    campaignId: CAMPAIGN_ID,
    operationId: OPERATION_ID,
    storeId: STORE_ID,
    briefing: BRIEFING,
    briefingText: "briefing congelado",
    campaignIntent: "offer" as const,
    backgroundDirection: "studio" as const,
    productImagesDataUrls: ["data:image/png;base64,primary"],
    runId: "run-1",
    traceId: "trace-1",
  };
}

async function baseExisting(
  overrides: Partial<CampaignOperationState> = {},
): Promise<CampaignOperationState> {
  return Object.freeze({
    campaignId: CAMPAIGN_ID,
    operationId: OPERATION_ID,
    status: "reserved",
    amount: 1,
    creditTxId: "tx-1",
    refundTxId: null,
    consumedDefinitive: false,
    terminal: false,
    unknown: false,
    outcome: null,
    supportReference: null,
    ...overrides,
  });
}

type ProviderMode = "resolve" | "never" | "deferred";

interface Harness {
  readonly deps: Record<string, unknown>;
  readonly calls: {
    order: string[];
    providerCalls: number;
    reserve: ReturnType<typeof vi.fn>;
    markArtUploaded: ReturnType<typeof vi.fn>;
    deliver: ReturnType<typeof vi.fn>;
    refund: ReturnType<typeof vi.fn>;
    closeFailedOperation: ReturnType<typeof vi.fn>;
    abortPublication: ReturnType<typeof vi.fn>;
    getPublicationEpoch: ReturnType<typeof vi.fn>;
    storeArtifact: ReturnType<typeof vi.fn>;
    finish: ReturnType<typeof vi.fn>;
    recordOutcome: ReturnType<typeof vi.fn>;
    getCampaignOperation: ReturnType<typeof vi.fn>;
    beginPaidCall: ReturnType<typeof vi.fn>;
    endPaidCall: ReturnType<typeof vi.fn>;
    markUnknown: ReturnType<typeof vi.fn>;
  };
  setProviderMode(mode: ProviderMode): void;
  resolveDeferred(result: AiInvocationResult): void;
  rejectDeferred(error: unknown): void;
  setRecordOutcomeFailure(fail: boolean): void;
  armGate(delayMs?: number): void;
}

function buildHarness(): Harness {
  const order: string[] = [];
  let providerMode: ProviderMode = "resolve";
  let deferredResolve: ((result: AiInvocationResult) => void) | null = null;
  let deferredReject: ((error: unknown) => void) | null = null;
  let recordOutcomeFailure = false;
  let providerCalls = 0;
  let beginDelayMs = 0;
  const providerResult: AiInvocationResult = {
    imageBase64: "AAAA",
    mimeType: "image/png",
    model: "gpt-image-2.5-sunburst",
  };

  const reserve = vi.fn(async () => {
    order.push("reserve");
    return await baseExisting();
  });
  const markArtUploaded = vi.fn(async () => {
    order.push("markArtUploaded");
    return await baseExisting({ status: "art_uploaded" });
  });
  const deliver = vi.fn(async () => {
    order.push("deliver");
    return await baseExisting({ status: "delivered", terminal: true });
  });
  const refund = vi.fn(async () => {
    order.push("refund");
    return await baseExisting({ status: "refunded", terminal: true });
  });
  const closeFailedOperation = vi.fn(async () => {
    order.push("closeFailedOperation");
    return await baseExisting({ status: "refunded", terminal: true });
  });
  const abortPublication = vi.fn(async () => {
    order.push("abortPublication");
    return { success: true };
  });
  const getPublicationEpoch = vi.fn(async () => {
    order.push("getPublicationEpoch");
    return 0;
  });

  const finish = vi.fn(async (input: { status: string }) => {
    order.push(`finish:${input.status}`);
    return {};
  });
  const recordOutcome = vi.fn(async (input: { outcome: string }) => {
    order.push(`recordOutcome:${input.outcome}`);
    if (recordOutcomeFailure) throw new Error("record_outcome_failed");
    return { outcome: input.outcome, supportReference: null };
  });
  const getCampaignOperation = vi.fn(async () => null);

  // Gate de gasto do piloto (armado por `armGate`). `beginPaidCall` pode
  // atravessar o deadline (defeito 3); `markUnknown`/`endPaidCall` são
  // espiões (defeito 2).
  const pilotHandle = {
    callId: "call-1",
    ownerToken: "tok-1",
    kind: "image_primary" as const,
  };
  const beginPaidCall = vi.fn(async () => {
    order.push("beginPaidCall");
    if (beginDelayMs > 0) {
      await new Promise<void>((resolveDelay) => {
        setTimeout(resolveDelay, beginDelayMs);
      });
    }
    return { acquired: true as const, handle: pilotHandle };
  });
  const endPaidCall = vi.fn(async () => {
    order.push("endPaidCall");
  });
  const markUnknown = vi.fn(async () => {
    order.push("markUnknown");
  });

  const acquire = vi.fn(async (input: { target: AttemptTarget; attemptNumber: number }) => {
    order.push(`acquire:${input.target}:${input.attemptNumber}`);
    return {
      acquired: true,
      reason: null,
      campaignId: CAMPAIGN_ID,
      operationId: OPERATION_ID,
      attemptNumber: input.attemptNumber,
      target: input.target,
    };
  });

  const storeArtifact = vi.fn(async (): Promise<ProductOneToOneArtifactRef> => {
    order.push("storeArtifact");
    return Object.freeze({
      storagePath: `${STORE_ID}/${CAMPAIGN_ID}/product-1-1/${OPERATION_ID}/art.jpg`,
      width: 1024,
      height: 1024,
      mimeType: "image/jpeg",
    });
  });

  const createGateway = vi.fn((_pair: ImageModelPairConfig) => ({
    invoke(): Promise<AiInvocationResult> {
      providerCalls += 1;
      order.push("provider");
      if (providerMode === "never") {
        return new Promise<AiInvocationResult>(() => {});
      }
      if (providerMode === "deferred") {
        return new Promise<AiInvocationResult>((resolvePromise, rejectPromise) => {
          deferredResolve = resolvePromise;
          deferredReject = rejectPromise;
        });
      }
      return Promise.resolve(providerResult);
    },
    async hasFallback() {
      return true;
    },
  }));

  const deps: Record<string, unknown> = {
    deadlineMs: TEST_DEADLINE_MS,
    runPreflight: async () => ({
      config: CONFIG,
      pricing: {
        primary: {},
        fallback: {},
        missingComponents: [],
        pricingCoverage: "complete",
      },
    }),
    buildSnapshot: () => SNAPSHOT,
    persistSnapshot: async () => ({ snapshotOriginalId: SNAPSHOT_ID, reused: false }),
    credit: {
      reserve,
      beginPublication: vi.fn(async () => ({
        acquired: true,
        token: "pub-token",
        publicationState: "in_flight",
      })),
      getPublicationEpoch,
      abortPublication,
      markResultUnknown: vi.fn(async () => ({ success: true })),
      markArtUploaded,
      deliver,
      refund,
      closeFailedOperation,
    },
    attempts: { acquire, finish, recordOperationOutcome: recordOutcome, getCampaignOperation },
    artifact: { storeArtifact, probeArtifact: vi.fn(async () => ({ kind: "absent" })) },
    createGateway,
    createTelemetry: () => ({
      operationRunId: "run-1",
      operationRunType: "campaign_delivery",
      traceId: "trace-1",
      storeId: STORE_ID,
      campaignId: CAMPAIGN_ID,
      attemptNumber: 1,
      sink: { emit: async () => {} },
    }),
    recordAttempt: vi.fn(async () => ({ id: "op-1" })),
    recordDiagnosis: vi.fn(async () => ({ reference: "ref" })),
    generateSupportReference: () => "66666666-6666-4666-8666-666666666666",
    // Pricing do novo fluxo SIMULADA (estimativa positiva) — necessária quando o
    // gate de gasto está armado (estimativa obrigatória > 0).
    resolveAttemptCost: async () => ({
      primary: {
        model: SNAPSHOT.primaryModel,
        quality: SNAPSHOT.primaryQuality,
        costUsd: 0.041,
        versionId: "pricing-ver-1",
        costSource: "pricing_table" as const,
      },
      fallback: {
        model: SNAPSHOT.fallbackModel,
        quality: SNAPSHOT.fallbackQuality,
        costUsd: 0.019,
        versionId: "pricing-ver-1",
        costSource: "pricing_table" as const,
      },
    }),
  };

  return {
    deps,
    calls: {
      order,
      get providerCalls() {
        return providerCalls;
      },
      reserve,
      markArtUploaded,
      deliver,
      refund,
      closeFailedOperation,
      abortPublication,
      getPublicationEpoch,
      storeArtifact,
      finish,
      recordOutcome,
      getCampaignOperation,
      beginPaidCall,
      endPaidCall,
      markUnknown,
    },
    setProviderMode(mode) {
      providerMode = mode;
    },
    resolveDeferred(result) {
      if (deferredResolve) {
        const resolvePromise = deferredResolve;
        deferredResolve = null;
        resolvePromise(result);
      }
    },
    rejectDeferred(error) {
      if (deferredReject) {
        const rejectPromise = deferredReject;
        deferredReject = null;
        rejectPromise(error);
      }
    },
    setRecordOutcomeFailure(fail) {
      recordOutcomeFailure = fail;
    },
    armGate(delayMs = 0) {
      beginDelayMs = delayMs;
      (deps as { pilotSpend?: unknown }).pilotSpend = {
        beginPaidCall,
        endPaidCall,
        markUnknown,
      };
    },
  };
}

async function invokeOrchestrator(
  harness: Harness,
  inputOverrides: Record<string, unknown> = {},
) {
  const { runProductOneToOneGeneration } = await import(
    "../orchestration/generation-orchestrator"
  );
  return runProductOneToOneGeneration(
    { ...makeInput(), ...inputOverrides } as never,
    harness.deps as never,
  );
}

function parseEvents(text: string): Record<string, unknown>[] {
  return text
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

afterEach(() => {
  vi.useRealTimers();
});

describe("F56.2b2d — deadline: constantes e helpers puros", () => {
  it("deadline estritamente abaixo do teto da plataforma, com margem positiva", () => {
    expect(PRODUCT_1_1_PLATFORM_TIMEOUT_MS).toBe(300_000);
    expect(PRODUCT_1_1_GENERATION_DEADLINE_MS).toBeGreaterThanOrEqual(240_000);
    expect(PRODUCT_1_1_GENERATION_DEADLINE_MS).toBeLessThanOrEqual(270_000);
    expect(PRODUCT_1_1_GENERATION_DEADLINE_MS).toBeLessThan(PRODUCT_1_1_PLATFORM_TIMEOUT_MS);
    expect(PRODUCT_1_1_PERSISTENCE_RESERVE_MS).toBeGreaterThan(0);
    expect(PRODUCT_1_1_PERSISTENCE_RESERVE_MS).toBeLessThan(
      PRODUCT_1_1_PLATFORM_TIMEOUT_MS - PRODUCT_1_1_GENERATION_DEADLINE_MS,
    );
  });

  it("assertDeadlineBelowPlatform lança em 300000 e não lança em 240000", () => {
    expect(() => assertDeadlineBelowPlatform(300_000)).toThrow(
      "product_1_1_deadline_not_below_platform",
    );
    expect(() => assertDeadlineBelowPlatform(0)).toThrow(
      "product_1_1_deadline_not_below_platform",
    );
    expect(() => assertDeadlineBelowPlatform(240_000)).not.toThrow();
  });

  it("deadlineAt/remaining*/canStartDurableWrite são absolutos e estritos", () => {
    expect(deadlineAt(1_000, 240_000)).toBe(241_000);
    expect(remainingBudget(1_000, 241_000)).toBe(240_000);
    expect(remainingBeforeDeadline(1_000, 241_000, 20_000)).toBe(220_000);
    expect(remainingBeforeDeadline(300_000, 241_000, 20_000)).toBe(0);
    // Estrito: exatamente `now + reserve === deadlineAt` NÃO autoriza escrita.
    expect(canStartDurableWrite(220_000, 240_000, 20_000)).toBe(false);
    expect(canStartDurableWrite(219_999, 240_000, 20_000)).toBe(true);
  });

  it("createDeadlineRejection rejeita no prazo, imediatamente com orçamento esgotado e cancel impede rejeição", async () => {
    // Orçamento já esgotado ⇒ rejeição imediata.
    const immediate = createDeadlineRejection(Date.now() - 1);
    await expect(immediate.promise).rejects.toThrow("product_1_1_deadline_reached");
    expect(immediate.didHit()).toBe(true);

    // No prazo (fake timers).
    vi.useFakeTimers();
    const now = Date.now();
    const pending = createDeadlineRejection(now + 5_000, now);
    const pendingAssertion = expect(pending.promise).rejects.toThrow(
      "product_1_1_deadline_reached",
    );
    await vi.advanceTimersByTimeAsync(5_000);
    await pendingAssertion;
    expect(pending.didHit()).toBe(true);

    // cancel() NÃO assenta a promessa: cancelar NUNCA pode parecer um resultado
    // do provider (vazio), falha confirmada ou autorização de estorno.
    const cancelled = createDeadlineRejection(Date.now() + 5_000);
    cancelled.cancel();
    await vi.advanceTimersByTimeAsync(10_000);
    const settled = await Promise.race([
      cancelled.promise.then(() => "settled").catch(() => "rejected"),
      Promise.resolve("pending"),
    ]);
    expect(settled).toBe("pending");
    expect(cancelled.didHit()).toBe(false);
  });
});

describe("F56.2b2d — deadline: leitura estática do orquestrador", () => {
  const orchSrc = readFileSync(ORCHESTRATOR_PATH, "utf8");

  it("o deadline é ancorado no INÍCIO DA REQUISIÇÃO (requestStartedAtMs)", () => {
    expect(orchSrc).toContain("input.requestStartedAtMs");
    expect(orchSrc).toContain("PRODUCT_1_1_GENERATION_DEADLINE_MS");
    expect(orchSrc).toMatch(/deadlineAt\(/);
  });

  it("o setTimeout/abort usa o deadline novo e NÃO o timeout do legado", () => {
    expect(orchSrc).toMatch(/controllerAbort\.abort\(\)[\s\S]{0,80}remainingBudget/);
    expect(orchSrc).not.toMatch(
      /setTimeout\([\s\S]{0,120}IMAGE_GENERATION_GLOBAL_TIMEOUT_MS/,
    );
    expect(orchSrc).not.toContain("IMAGE_GENERATION_GLOBAL_TIMEOUT_MS");
  });

  it("orçamento da copy limitado pelo restante; guardas de escrita presentes; corrida provider×deadline", () => {
    expect(orchSrc).toContain("remainingBeforeDeadline");
    expect(orchSrc).toContain("canStartDurableWrite");
    expect(orchSrc).toContain("Promise.race");
    expect(orchSrc).toContain("deadlineRejection.promise");
  });
});

describe("F56.2b2d — deadline: fechamento com provider não cooperativo", () => {
  it("provider que NUNCA resolve ⇒ um único terminal `unknown`, uma invocação, zero estorno/entrega", async () => {
    vi.useFakeTimers();
    const harness = buildHarness();
    harness.setProviderMode("never");

    const response = await invokeOrchestrator(harness);
    await vi.advanceTimersByTimeAsync(TEST_DEADLINE_MS);
    const events = parseEvents(await response.text());
    const terminal = events.at(-1);
    const terminals = events.filter((e) =>
      ["result", "error", "unknown"].includes(String(e.type)),
    );

    expect(terminal).toMatchObject({ type: "unknown", operationId: OPERATION_ID });
    expect(terminals).toHaveLength(1);
    expect(harness.calls.providerCalls).toBe(1);
    // Zero retry/fallback (uma única invocação), zero estorno, zero entrega.
    expect(harness.calls.refund).not.toHaveBeenCalled();
    expect(harness.calls.deliver).not.toHaveBeenCalled();
    expect(harness.calls.markArtUploaded).not.toHaveBeenCalled();
    // Marcador `unknown` tentado em best-effort.
    expect(harness.calls.recordOutcome).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "unknown" }),
    );
    // Estado durável anterior permanece LEGÍVEL (leitura não lança).
    await expect(
      (harness.calls.getCampaignOperation as unknown as () => Promise<null>)(),
    ).resolves.toBeNull();
  });

  it("resultado TARDIO do provider é contido: nenhum segundo terminal nem efeito", async () => {
    vi.useFakeTimers();
    const harness = buildHarness();
    harness.setProviderMode("deferred");

    const response = await invokeOrchestrator(harness);
    await vi.advanceTimersByTimeAsync(TEST_DEADLINE_MS);
    const events = parseEvents(await response.text());
    expect(events.at(-1)).toMatchObject({ type: "unknown" });
    const outcomeCallsAfterTerminal = harness.calls.recordOutcome.mock.calls.length;

    // Provider resolve DEPOIS do terminal `unknown` (com imagem válida).
    harness.resolveDeferred({
      imageBase64: "AAAA",
      mimeType: "image/png",
      model: "gpt-image-2.5-sunburst",
    });
    await vi.advanceTimersByTimeAsync(0);
    await Promise.resolve();
    await Promise.resolve();

    // Nada reabre/reclassifica o terminal.
    expect(harness.calls.deliver).not.toHaveBeenCalled();
    expect(harness.calls.markArtUploaded).not.toHaveBeenCalled();
    expect(harness.calls.refund).not.toHaveBeenCalled();
    expect(harness.calls.closeFailedOperation).not.toHaveBeenCalled();
    expect(harness.calls.storeArtifact).not.toHaveBeenCalled();
    expect(harness.calls.recordOutcome.mock.calls.length).toBe(outcomeCallsAfterTerminal);
    expect(harness.calls.providerCalls).toBe(1);
  });
});

describe("F56.2b2d — deadline: âncora temporal (tempo consumido antes do orquestrador)", () => {
  it("orçamento já esgotado antes do orquestrador ⇒ ZERO chamada ao provider, sem gasto", async () => {
    const harness = buildHarness();
    const requestStartedAtMs = Date.now() - (TEST_DEADLINE_MS + 1);

    const response = await invokeOrchestrator(harness, { requestStartedAtMs });
    const events = parseEvents(await response.text());

    expect(events.at(-1)).toMatchObject({ type: "unknown" });
    expect(harness.calls.providerCalls).toBe(0);
    expect(harness.calls.reserve).not.toHaveBeenCalled();
    expect(harness.calls.refund).not.toHaveBeenCalled();
  });
});

describe("F56.2b2d — deadline: honestidade e kill não autoriza via", () => {
  it("falha ao persistir `unknown` NÃO inventa sucesso/terminal persistido nem ausência", async () => {
    vi.useFakeTimers();
    const harness = buildHarness();
    harness.setProviderMode("never");
    harness.setRecordOutcomeFailure(true);

    const response = await invokeOrchestrator(harness);
    await vi.advanceTimersByTimeAsync(TEST_DEADLINE_MS);
    const events = parseEvents(await response.text());

    // Terminal honesto de INCERTEZA (nunca sucesso/ausência).
    expect(events.at(-1)).toMatchObject({ type: "unknown" });
    // Nenhum estorno e nenhuma entrega.
    expect(harness.calls.refund).not.toHaveBeenCalled();
    expect(harness.calls.deliver).not.toHaveBeenCalled();
    // O claim NÃO é finalizado como `abandoned` quando o marcador não persistiu.
    expect(harness.calls.finish).not.toHaveBeenCalledWith(
      expect.objectContaining({ status: "abandoned" }),
    );
  });

  it("deadline não autoriza encerramento: sem probe/epoch, sem estorno, sem abort do fence", async () => {
    vi.useFakeTimers();
    const harness = buildHarness();
    harness.setProviderMode("never");

    const response = await invokeOrchestrator(harness);
    await vi.advanceTimersByTimeAsync(TEST_DEADLINE_MS);
    await response.text();

    // A via automática exige probe fresco + epoch (via `settleConfirmedFailure`).
    expect(harness.calls.getPublicationEpoch).not.toHaveBeenCalled();
    expect(harness.calls.abortPublication).not.toHaveBeenCalled();
    expect(harness.calls.closeFailedOperation).not.toHaveBeenCalled();
    expect(harness.calls.refund).not.toHaveBeenCalled();
  });
});

describe("F56.2b2d — deadline: cancelamento, gate e orçamento (correções)", () => {
  it("cancelar com provider que NUNCA resolve ⇒ execução encerra e chamada paga é tratada (sem execução sem limite)", async () => {
    vi.useFakeTimers();
    const harness = buildHarness();
    harness.setProviderMode("never");
    harness.armGate(0);

    const response = await invokeOrchestrator(harness);
    // Garante que a chamada paga foi invocada (gate armado) antes de cancelar.
    await vi.advanceTimersByTimeAsync(0);
    expect(harness.calls.providerCalls).toBe(1);

    await response.body?.cancel();
    // Desconectar NÃO remove o limite: mesmo com o provider pendente, a execução
    // encerra e a chamada paga recebe tratamento durável INCONCLUSIVO.
    await vi.advanceTimersByTimeAsync(TEST_DEADLINE_MS + 1_000);

    expect(harness.calls.beginPaidCall).toHaveBeenCalledTimes(1);
    expect(harness.calls.markUnknown).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "timeout_or_unknown" }),
    );
    expect(harness.calls.endPaidCall).not.toHaveBeenCalled();
    expect(harness.calls.deliver).not.toHaveBeenCalled();
    expect(harness.calls.refund).not.toHaveBeenCalled();
    expect(harness.calls.markArtUploaded).not.toHaveBeenCalled();
    expect(harness.calls.storeArtifact).not.toHaveBeenCalled();
  });

  it("provider resolve APÓS o cancelamento ⇒ resultado tardio contido (sem entrega/estorno)", async () => {
    vi.useFakeTimers();
    const harness = buildHarness();
    harness.setProviderMode("deferred");
    harness.armGate(0);

    const response = await invokeOrchestrator(harness);
    await vi.advanceTimersByTimeAsync(0);
    await response.body?.cancel();
    await vi.advanceTimersByTimeAsync(0);
    const markUnknownCallsAfterCancel = harness.calls.markUnknown.mock.calls.length;

    // Resolve DEPOIS do cancelamento (chamada paga já inconclusiva).
    harness.resolveDeferred({
      imageBase64: "AAAA",
      mimeType: "image/png",
      model: "gpt-image-2.5-sunburst",
    });
    await vi.advanceTimersByTimeAsync(0);
    await Promise.resolve();
    await Promise.resolve();

    expect(harness.calls.deliver).not.toHaveBeenCalled();
    expect(harness.calls.markArtUploaded).not.toHaveBeenCalled();
    expect(harness.calls.refund).not.toHaveBeenCalled();
    expect(harness.calls.storeArtifact).not.toHaveBeenCalled();
    // Nenhum novo tratamento de gasto pelo resultado tardio.
    expect(harness.calls.markUnknown.mock.calls.length).toBe(markUnknownCallsAfterCancel);
  });

  it("provider rejeita APÓS o cancelamento ⇒ sem segundo terminal nem estorno", async () => {
    vi.useFakeTimers();
    const harness = buildHarness();
    harness.setProviderMode("deferred");
    harness.armGate(0);

    const response = await invokeOrchestrator(harness);
    await vi.advanceTimersByTimeAsync(0);
    await response.body?.cancel();
    await vi.advanceTimersByTimeAsync(0);
    const refundBefore = harness.calls.refund.mock.calls.length;

    harness.rejectDeferred(new Error("provider_late_failure"));
    await vi.advanceTimersByTimeAsync(0);
    await Promise.resolve();
    await Promise.resolve();

    expect(harness.calls.refund.mock.calls.length).toBe(refundBefore);
    expect(harness.calls.deliver).not.toHaveBeenCalled();
    expect(harness.calls.endPaidCall).not.toHaveBeenCalled();
  });

  it("deadline dispara antes do abort propagar ⇒ markUnknown (nunca endPaidCall como desfecho conhecido)", async () => {
    vi.useFakeTimers();
    const harness = buildHarness();
    harness.setProviderMode("never");
    harness.armGate(0);

    const response = await invokeOrchestrator(harness);
    await vi.advanceTimersByTimeAsync(TEST_DEADLINE_MS);
    const events = parseEvents(await response.text());

    expect(harness.calls.beginPaidCall).toHaveBeenCalledTimes(1);
    expect(harness.calls.markUnknown).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "timeout_or_unknown" }),
    );
    expect(harness.calls.endPaidCall).not.toHaveBeenCalled();
    expect(harness.calls.providerCalls).toBe(1);
    expect(harness.calls.refund).not.toHaveBeenCalled();
    expect(harness.calls.deliver).not.toHaveBeenCalled();
    expect(events.at(-1)).toMatchObject({ type: "unknown" });
  });

  it("orçamento esgotado durante beginPaidCall ⇒ ZERO invocação ao provider e aquisição tratada", async () => {
    vi.useFakeTimers();
    const harness = buildHarness();
    harness.setProviderMode("resolve"); // resolveria, mas NÃO deve ser invocado
    harness.armGate(TEST_DEADLINE_MS); // beginPaidCall atravessa o deadline

    const response = await invokeOrchestrator(harness);
    await vi.advanceTimersByTimeAsync(TEST_DEADLINE_MS + 1_000);
    const events = parseEvents(await response.text());

    expect(harness.calls.beginPaidCall).toHaveBeenCalledTimes(1);
    expect(harness.calls.providerCalls).toBe(0);
    expect(harness.calls.markUnknown).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "deadline_before_provider" }),
    );
    expect(harness.calls.endPaidCall).not.toHaveBeenCalled();
    expect(harness.calls.refund).not.toHaveBeenCalled();
    expect(harness.calls.deliver).not.toHaveBeenCalled();
    expect(events.at(-1)).toMatchObject({ type: "unknown" });
  });
});
