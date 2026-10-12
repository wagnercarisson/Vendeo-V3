// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import type { AiInvoker } from "@/lib/ai/gateway";
import type { AiInvocationRequest, AiInvocationResult, AiTelemetryContext } from "@/lib/ai/types";
import type {
  ImageGenerationConfigSnapshot,
  CurrentImageGenerationConfig,
} from "@/lib/ai/image-generation-config-snapshot";
import type { ImageModelPairConfig } from "@/lib/ai/image-model-pair";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import type { CampaignOperationState, AttemptTarget } from "../orchestration/attempt-start-types";
import type { ProductPromptCompositionBriefing } from "../policies/types";
import type { ProductOneToOneArtifactRef } from "../artifact/types";

const ORCHESTRATOR_PATH = path.resolve(
  process.cwd(),
  "src/lib/product-1-1/orchestration/generation-orchestrator.ts",
);

const CAMPAIGN_ID = "11111111-1111-4111-8111-111111111111";
const OPERATION_ID = "22222222-2222-4222-8222-222222222222";
const STORE_ID = "33333333-3333-4333-8333-333333333333";
const SNAPSHOT_ID = "44444444-4444-4444-8444-444444444444";

const CONFIG: CurrentImageGenerationConfig = {
  primary: { model: "gpt-image-2.5-sunburst", quality: "medium" },
  fallback: { model: "gpt-image-2", quality: "medium" },
  origin: "human_decision",
  configVersionId: "55555555-5555-4555-8555-555555555555",
};

const SNAPSHOT: ImageGenerationConfigSnapshot = Object.freeze({
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

interface Harness {
  readonly deps: Parameters<
    typeof import("../orchestration/generation-orchestrator").runProductOneToOneGeneration
  >[1];
  readonly calls: {
    order: string[];
    providerCalls: number;
    reserve: ReturnType<typeof vi.fn>;
    markArtUploaded: ReturnType<typeof vi.fn>;
    deliver: ReturnType<typeof vi.fn>;
    refund: ReturnType<typeof vi.fn>;
    acquire: ReturnType<typeof vi.fn>;
    finish: ReturnType<typeof vi.fn>;
    recordOutcome: ReturnType<typeof vi.fn>;
    persist: ReturnType<typeof vi.fn>;
    storeArtifact: ReturnType<typeof vi.fn>;
    recordAttempt: ReturnType<typeof vi.fn>;
    gatewayPairs: ImageModelPairConfig[];
    gatewayRequests: AiInvocationRequest[];
  };
  setExistingOperation(state: CampaignOperationState | null): void;
  setProviderResult(result: AiInvocationResult | Error): void;
  setProviderSequence(seq: Array<AiInvocationResult | Error>): void;
  setAcquireSequence(seq: Array<{ acquired: boolean; reason: string | null }>): void;
  setRecordOutcomeFailure(fail: boolean): void;
  setRefundFailure(fail: boolean): void;
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

async function buildHarness(): Promise<Harness> {
  const order: string[] = [];
  let existingOperation: CampaignOperationState | null = null;
  let providerSequence: Array<AiInvocationResult | Error> = [];
  let providerIndex = 0;
  let acquireIndex = 0;
  let acquireSequence: Array<{ acquired: boolean; reason: string | null }> = [];
  let recordOutcomeFailure = false;
  let refundFailure = false;
  let providerCalls = 0;
  const gatewayPairs: ImageModelPairConfig[] = [];
  const gatewayRequests: AiInvocationRequest[] = [];
  let currentTarget: AttemptTarget = "primary";

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
    return await baseExisting({ status: "delivered", terminal: true, consumedDefinitive: true });
  });
  const refund = vi.fn(async () => {
    order.push("refund");
    if (refundFailure) throw new Error("refund_failed");
    return await baseExisting({ status: "refunded", terminal: true });
  });

  const acquire = vi.fn(
    async (input: { target: AttemptTarget; attemptNumber: number }) => {
      order.push(`acquire:${input.target}:${input.attemptNumber}`);
      currentTarget = input.target;
      const step = acquireSequence[acquireIndex] ?? { acquired: true, reason: null };
      acquireIndex += 1;
      return {
        acquired: step.acquired,
        reason: step.reason,
        campaignId: CAMPAIGN_ID,
        operationId: OPERATION_ID,
        attemptNumber: step.acquired ? input.attemptNumber : null,
        target: step.acquired ? input.target : null,
      };
    },
  );
  const finish = vi.fn(
    async (input: { attemptNumber: number; status: "done" | "failed" }) => {
      order.push(`finish:${input.status}`);
      return {
        campaignId: CAMPAIGN_ID,
        operationId: OPERATION_ID,
        attemptNumber: input.attemptNumber,
        target: currentTarget,
        status: input.status,
        idempotent: false,
      };
    },
  );
  const recordOutcome = vi.fn(async (input: { outcome: string }) => {
    order.push(`recordOutcome:${input.outcome}`);
    if (recordOutcomeFailure) throw new Error("record_outcome_failed");
    return {
      campaignId: CAMPAIGN_ID,
      operationId: OPERATION_ID,
      outcome: input.outcome,
      supportReference: null,
      idempotent: false,
    };
  });
  const getCampaignOperation = vi.fn(async () => existingOperation);

  const persist = vi.fn(async () => {
    order.push("persist");
    return { snapshotOriginalId: SNAPSHOT_ID, reused: false };
  });

  const storeArtifact = vi.fn(async (): Promise<ProductOneToOneArtifactRef> => {
    order.push("storeArtifact");
    return Object.freeze({
      storagePath: `${STORE_ID}/${CAMPAIGN_ID}/product-1-1/${OPERATION_ID}/art-1024.jpg`,
      width: 1024,
      height: 1024,
      mimeType: "image/jpeg",
    });
  });

  const recordAttempt = vi.fn(async () => {
    order.push("recordAttempt");
    return { id: "op-row-1", operationId: OPERATION_ID };
  });

  const createGateway = vi.fn((pair: ImageModelPairConfig): AiInvoker => {
    gatewayPairs.push(pair);
    return {
      async invoke(_capability, request): Promise<AiInvocationResult> {
        providerCalls += 1;
        order.push(`provider:${currentTarget}`);
        gatewayRequests.push(request);
        const next = providerSequence[providerIndex] ?? {
          imageBase64: "AAAA",
          mimeType: "image/png",
          model: "gpt-image-2.5-sunburst",
        };
        providerIndex += 1;
        if (next instanceof Error) throw next;
        return next;
      },
      async hasFallback() {
        return true;
      },
    };
  });

  const deps = {
    runPreflight: async () => {
      order.push("preflight");
      return {
        config: CONFIG,
        pricing: { primary: {} as never, fallback: {} as never, missingComponents: [], pricingCoverage: "complete" as const },
      };
    },
    buildSnapshot: () => {
      order.push("buildSnapshot");
      return SNAPSHOT;
    },
    persistSnapshot: persist,
    credit: {
      reserve,
      markArtUploaded,
      deliver,
      refund,
    } as never,
    attempts: {
      acquire,
      finish,
      recordOperationOutcome: recordOutcome,
      getCampaignOperation,
    } as never,
    artifact: { storeArtifact } as never,
    createGateway,
    createTelemetry: (): AiTelemetryContext => ({
      operationRunId: "run-1",
      operationRunType: "campaign_delivery",
      traceId: "trace-1",
      storeId: STORE_ID,
      campaignId: CAMPAIGN_ID,
      attemptNumber: 1,
      sink: { emit: async () => {} },
    }),
    recordAttempt,
    generateSupportReference: () => "66666666-6666-4666-8666-666666666666",
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
      acquire,
      finish,
      recordOutcome,
      persist,
      storeArtifact,
      recordAttempt,
      gatewayPairs,
      gatewayRequests,
    },
    setExistingOperation(state) {
      existingOperation = state;
    },
    setProviderResult(result) {
      providerSequence = [result];
      providerIndex = 0;
    },
    setProviderSequence(seq) {
      providerSequence = seq;
      providerIndex = 0;
    },
    setAcquireSequence(seq) {
      acquireSequence = seq;
      acquireIndex = 0;
    },
    setRecordOutcomeFailure(fail) {
      recordOutcomeFailure = fail;
    },
    setRefundFailure(fail) {
      refundFailure = fail;
    },
  } as Harness;
}

async function runOrchestrator(harness: Harness) {
  const { runProductOneToOneGeneration } = await import(
    "../orchestration/generation-orchestrator"
  );
  const response = await runProductOneToOneGeneration(makeInput(), harness.deps);
  const text = await response.text();
  const events = text
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
  return { response, events, terminal: events.at(-1) };
}

describe("F56.2b1b — orquestrador NDJSON no ciclo da requisição (Plano 04)", () => {
  it("sucesso: ordem C5 (preflight → persist → reserve → acquire → provider), um crédito efetivado e terminal `result`", async () => {
    const harness = await buildHarness();
    const { response, terminal, events } = await runOrchestrator(harness);

    expect(response.headers.get("Content-Type")).toBe("application/x-ndjson");
    expect(terminal).toMatchObject({ type: "result", operationId: OPERATION_ID, campaignId: CAMPAIGN_ID });

    // C5 — ordem EXATA.
    const idx = (needle: string) => harness.calls.order.findIndex((o) => o === needle);
    expect(idx("preflight")).toBe(0);
    expect(idx("persist")).toBeGreaterThan(idx("preflight"));
    expect(idx("reserve")).toBeGreaterThan(idx("persist"));
    expect(idx("acquire:primary:1")).toBeGreaterThan(idx("reserve"));
    expect(idx("provider:primary")).toBeGreaterThan(idx("acquire:primary:1"));

    expect(harness.calls.markArtUploaded).toHaveBeenCalledTimes(1);
    expect(harness.calls.deliver).toHaveBeenCalledTimes(1);
    expect(harness.calls.refund).not.toHaveBeenCalled();
    expect(harness.calls.providerCalls).toBe(1);
    // Exatamente um evento terminal.
    expect(events.filter((e) => ["result", "error", "unknown"].includes(String(e.type)))).toHaveLength(1);
  });

  it("F6/I1: operação existente (delivered) ⇒ curto-circuito SOMENTE leitura (zero persist/reserve/acquire/provider)", async () => {
    const harness = await buildHarness();
    harness.setExistingOperation(
      await baseExisting({ status: "delivered", terminal: true, consumedDefinitive: true }),
    );

    const { terminal } = await runOrchestrator(harness);

    expect(terminal).toMatchObject({ type: "result", operationId: OPERATION_ID });
    expect(harness.calls.persist).not.toHaveBeenCalled();
    expect(harness.calls.reserve).not.toHaveBeenCalled();
    expect(harness.calls.acquire).not.toHaveBeenCalled();
    expect(harness.calls.providerCalls).toBe(0);
  });

  it("I1: operação EM ANDAMENTO (reserved/art_uploaded) ⇒ recusa sem snapshot/reserva/acquire/provider", async () => {
    for (const status of ["reserved", "art_uploaded"] as const) {
      const harness = await buildHarness();
      harness.setExistingOperation(await baseExisting({ status }));

      const { terminal } = await runOrchestrator(harness);

      expect(terminal).toMatchObject({ type: "error", code: "operation_in_progress" });
      expect(harness.calls.persist).not.toHaveBeenCalled();
      expect(harness.calls.reserve).not.toHaveBeenCalled();
      expect(harness.calls.acquire).not.toHaveBeenCalled();
      expect(harness.calls.providerCalls).toBe(0);
    }
  });

  it("C1: operação desconhecida PERSISTIDA ⇒ terminal `unknown`, sem refund e sem nova chamada", async () => {
    const harness = await buildHarness();
    harness.setExistingOperation(await baseExisting({ unknown: true, outcome: "unknown" }));

    const { terminal } = await runOrchestrator(harness);

    expect(terminal).toMatchObject({
      type: "unknown",
      operationId: OPERATION_ID,
      reference: "66666666-6666-4666-8666-666666666666",
    });
    expect(harness.calls.refund).not.toHaveBeenCalled();
    expect(harness.calls.providerCalls).toBe(0);
  });

  it("corrida perdida (`acquired:false`) ⇒ ZERO chamadas ao provider e terminal somente leitura", async () => {
    const harness = await buildHarness();
    harness.setAcquireSequence([{ acquired: false, reason: "in_progress" }]);
    harness.setExistingOperation(await baseExisting({ status: "reserved" }));

    const { terminal } = await runOrchestrator(harness);

    expect(harness.calls.providerCalls).toBe(0);
    expect(terminal).toMatchObject({ type: "error", code: "operation_in_progress" });
  });

  it("F1: indisponibilidade explícita no `primary` aciona `fallback` JÁ na 2ª chamada (alvo fallback, attemptNumber 2)", async () => {
    const harness = await buildHarness();
    const availabilityError = Object.assign(new Error("model overloaded"), {
      code: "model_overloaded",
    });
    harness.setProviderSequence([
      availabilityError,
      { imageBase64: "BBBB", mimeType: "image/png", model: "gpt-image-2" },
    ]);

    const { terminal } = await runOrchestrator(harness);

    expect(harness.calls.acquire.mock.calls[0][0]).toMatchObject({ target: "primary", attemptNumber: 1 });
    expect(harness.calls.acquire.mock.calls[1][0]).toMatchObject({ target: "fallback", attemptNumber: 2 });
    expect(terminal).toMatchObject({ type: "result" });
    expect(harness.calls.refund).not.toHaveBeenCalled();
  });

  it("F3/C5: o gateway recebe o par COMPLETO do SNAPSHOT e o prompt é o de `composeProductPrompt` com a base Produto 1:1", async () => {
    const harness = await buildHarness();
    await runOrchestrator(harness);

    expect(harness.calls.gatewayPairs).toHaveLength(1);
    expect(harness.calls.gatewayPairs[0]).toEqual({
      primary: { model: "gpt-image-2.5-sunburst", quality: "medium" },
      fallback: { model: "gpt-image-2", quality: "medium" },
    });
    const request = harness.calls.gatewayRequests[0];
    expect(request.prompt).toContain("Crie uma peça profissional");
    expect(request.quality).toBe("medium");
    expect(request.productImagesDataUrls).toEqual(["data:image/png;base64,primary"]);
  });

  it("falha confirmada sem arte ⇒ `refund` exatamente UMA vez e terminal `error`", async () => {
    const harness = await buildHarness();
    harness.setProviderSequence([
      Object.assign(new Error("content policy violation"), { code: "content_policy" }),
    ]);

    const { terminal } = await runOrchestrator(harness);

    expect(harness.calls.refund).toHaveBeenCalledTimes(1);
    expect(terminal).toMatchObject({ type: "error", code: "generation_failed" });
  });

  it("C1: timeout/abort ⇒ `recordOperationOutcome('unknown')` ANTES do terminal, SEM refund e SEM nova tentativa", async () => {
    const harness = await buildHarness();
    harness.setProviderSequence([Object.assign(new Error("aborted"), { name: "AbortError" })]);

    const { terminal } = await runOrchestrator(harness);

    expect(harness.calls.recordOutcome).toHaveBeenCalledTimes(1);
    expect(harness.calls.recordOutcome.mock.calls[0][0]).toMatchObject({ outcome: "unknown" });
    expect(harness.calls.refund).not.toHaveBeenCalled();
    expect(terminal).toMatchObject({ type: "unknown" });
  });

  it("I2 fail-closed: quando `recordOperationOutcome` FALHA, NÃO finaliza o claim como falha comum e NÃO estorna", async () => {
    const harness = await buildHarness();
    harness.setProviderSequence([Object.assign(new Error("timeout"), { name: "AbortError" })]);
    harness.setRecordOutcomeFailure(true);

    const { terminal } = await runOrchestrator(harness);

    expect(harness.calls.recordOutcome).toHaveBeenCalledTimes(1);
    expect(harness.calls.refund).not.toHaveBeenCalled();
    // NÃO chama finish com status que habilite nova tentativa (não vira falha comum reexecutável).
    expect(harness.calls.finish).not.toHaveBeenCalled();
    // Não chama o provider uma segunda vez.
    expect(harness.calls.providerCalls).toBe(1);
    expect(terminal).toMatchObject({ type: "unknown" });
  });

  it("asserção negativa: o orquestrador NÃO referencia revisor automático de imagem", () => {
    const source = readFileSync(ORCHESTRATOR_PATH, "utf8");
    expect(source).not.toContain("image-review-service");
    expect(source).not.toContain("campaign-image-reviewer");
    // Nenhum intervalo/worker/fila de retomada: apenas o timeout que ABORTA a chamada.
    expect(source).not.toContain("setInterval(");
  });

  it("F3/C5 (source): a configuração é resolvida UMA única vez (sem releitura após o congelamento)", () => {
    const source = readFileSync(ORCHESTRATOR_PATH, "utf8");
    const preflightCalls = source.match(/runPreflight\(/g) ?? [];
    expect(preflightCalls).toHaveLength(1);
    const gatewaySource = source.match(/createGateway\(/g) ?? [];
    expect(gatewaySource).toHaveLength(1);
  });
});
