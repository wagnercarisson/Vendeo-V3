// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import type { AiInvoker } from "@/lib/ai/gateway";
import type { AiInvocationRequest, AiInvocationResult, AiTelemetryContext } from "@/lib/ai/types";
import type {
  ImageGenerationConfigSnapshot,
  CurrentImageGenerationConfig,
} from "@/lib/ai/image-generation-config-snapshot";
import type { ImageModelPairConfig } from "@/lib/ai/image-model-pair";

import {
  buildAttemptTelemetry,
  emitAttemptEnvelope,
  reconstructAttemptSequence,
  recordFailureDiagnosis,
  type AttemptEnvelope,
} from "../orchestration/instrumentation";
import type { CampaignOperationState, AttemptTarget } from "../orchestration/attempt-start-types";
import type { ProductPromptCompositionBriefing } from "../policies/types";
import type { ProductOneToOneArtifactRef } from "../artifact/types";

// ---------------------------------------------------------------------------
// F56.2b1b — Plano 08 (Task 2): envelope/custo por tentativa + diagnóstico
// durável `IMG-001` (REQ-56.2.2-12). Contract test estático + simulado: SEM
// banco, SEM provider, SEM crédito. Provider SIMULADO.
// ---------------------------------------------------------------------------

const INSTRUMENTATION_SOURCE = readFileSync(
  path.resolve(process.cwd(), "src/lib/product-1-1/orchestration/instrumentation.ts"),
  "utf8",
);
const ORCHESTRATOR_SOURCE = readFileSync(
  path.resolve(process.cwd(), "src/lib/product-1-1/orchestration/generation-orchestrator.ts"),
  "utf8",
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
  runId: "run-1",
  traceId: "trace-1",
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

// ---------------------------------------------------------------------------
// Envelope/custo por tentativa + sequência reconstruível
// ---------------------------------------------------------------------------

describe("Plano 08 — envelope por tentativa (REQ-12)", () => {
  it("emitAttemptEnvelope resolve o par do SNAPSHOT (modelo/qualidade/alvo/attempt_number)", () => {
    const emitted: AttemptEnvelope[] = [];
    const envelope = emitAttemptEnvelope(
      {
        snapshot: SNAPSHOT,
        attemptNumber: 2,
        target: "fallback",
        result: "success",
        internalCostUsd: 0.03,
        runId: "run-1",
        traceId: "trace-1",
      },
      { emit: (e) => {
          emitted.push(e);
        } },
    );

    expect(envelope).toMatchObject({
      attemptNumber: 2,
      target: "fallback",
      model: "gpt-image-2",
      quality: "medium",
      result: "success",
      internalCostUsd: 0.03,
    });
    expect(emitted).toEqual([envelope]);
  });

  it("custo ausente nunca vira valor inventado (null)", () => {
    const envelope = emitAttemptEnvelope({
      snapshot: SNAPSHOT,
      attemptNumber: 1,
      target: "primary",
      result: "failed",
    });
    expect(envelope.internalCostUsd).toBeNull();
  });

  it("a sequência principal (×2) + fallback (×1) é reconstruível", () => {
    const envelopes: AttemptEnvelope[] = [1, 2, 3].map((n, index) =>
      emitAttemptEnvelope({
        snapshot: SNAPSHOT,
        attemptNumber: n,
        target: index < 2 ? "primary" : "fallback",
        result: index < 2 ? "failed" : "success",
        runId: "run-1",
        traceId: "trace-1",
      }),
    );

    const sequence = reconstructAttemptSequence(SNAPSHOT, envelopes);
    expect(sequence).toEqual([
      { attemptNumber: 1, target: "primary", model: "gpt-image-2.5-sunburst", quality: "medium" },
      { attemptNumber: 2, target: "primary", model: "gpt-image-2.5-sunburst", quality: "medium" },
      { attemptNumber: 3, target: "fallback", model: "gpt-image-2", quality: "medium" },
    ]);
  });

  it("buildAttemptTelemetry REUSA o caminho existente (createDefaultTelemetryContext)", () => {
    const context = buildAttemptTelemetry({
      operationRunId: "run-1",
      traceId: "trace-1",
      storeId: STORE_ID,
      campaignId: CAMPAIGN_ID,
      attemptNumber: 1,
    });
    expect(context).toMatchObject({ campaignId: CAMPAIGN_ID, attemptNumber: 1 });
    expect(typeof context.sink.emit).toBe("function");
  });

  it("a instrumentação NÃO altera a cadeia legada de custo (resolveAiCost/AiCostTracker.record)", () => {
    expect(INSTRUMENTATION_SOURCE).toContain("createDefaultTelemetryContext");
    expect(INSTRUMENTATION_SOURCE).not.toMatch(/resolveAiCost\s*\(/);
    expect(INSTRUMENTATION_SOURCE).not.toMatch(/(?:new\s+AiCostTracker\(\)[\s\S]{0,60}?\.record\s*\(|\btracker\.record\s*\()/);
  });
});

// ---------------------------------------------------------------------------
// Diagnóstico durável correlacionado a IMG-001
// ---------------------------------------------------------------------------

describe("Plano 08 — diagnóstico durável (REQ-12)", () => {
  it("persiste via repositório injetado e reduz o erro ao conjunto FECHADO", async () => {
    const records: Array<Record<string, unknown>> = [];
    const record = vi.fn(async (input: Record<string, unknown>) => {
      records.push(input);
      return { reference: String(input.reference) };
    });

    const result = await recordFailureDiagnosis(record, {
      reference: "66666666-6666-4666-8666-666666666666",
      category: "generation_failed",
      normalizedError: "sk-secret-key-and-https://provider.example/leak",
      model: "gpt-image-2",
      quality: "medium",
      target: "primary",
      attemptNumber: 3,
      runId: "run-1",
      traceId: "trace-1",
    });

    expect(result.reference).toBe("66666666-6666-4666-8666-666666666666");
    expect(record).toHaveBeenCalledTimes(1);
    expect(records[0]).toMatchObject({
      reference: "66666666-6666-4666-8666-666666666666",
      internalCategory: "generation_failed",
      normalizedError: "unknown_provider_error",
      target: "primary",
      attemptNumber: 3,
    });
  });

  it("distingue falha CONFIRMADA de resultado DESCONHECIDO pela categoria interna", async () => {
    const categories: string[] = [];
    const record = async (input: Record<string, unknown>) => {
      categories.push(String(input.internalCategory));
      return { reference: String(input.reference) };
    };

    await recordFailureDiagnosis(record, {
      reference: "ref-confirmed",
      category: "generation_failed",
      normalizedError: "provider_error",
    });
    await recordFailureDiagnosis(record, {
      reference: "ref-unknown",
      category: "generation_unknown",
      normalizedError: "timeout",
    });

    expect(categories).toEqual(["generation_failed", "generation_unknown"]);
  });

  it("best-effort: falha de persistência nunca lança (mantém a referência)", async () => {
    const record = async () => {
      throw new Error("diagnosis_repository_down");
    };
    await expect(
      recordFailureDiagnosis(record, {
        reference: "ref-1",
        category: "generation_failed",
        normalizedError: "provider_error",
      }),
    ).resolves.toEqual({ reference: "ref-1" });
  });
});

// ---------------------------------------------------------------------------
// Orquestrador (provider SIMULADO) — UM envelope por tentativa real
// ---------------------------------------------------------------------------

interface OrchestratorHarness {
  readonly deps: Parameters<
    typeof import("../orchestration/generation-orchestrator").runProductOneToOneGeneration
  >[1];
  readonly calls: {
    deliver: ReturnType<typeof vi.fn>;
    refund: ReturnType<typeof vi.fn>;
    providerCalls: number;
  };
  readonly envelopes: AttemptEnvelope[];
  setProviderSequence(seq: Array<AiInvocationResult | Error>): void;
}

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

async function buildOrchestratorHarness(): Promise<OrchestratorHarness> {
  let providerSequence: Array<AiInvocationResult | Error> = [];
  let providerIndex = 0;
  let providerCalls = 0;
  const envelopes: AttemptEnvelope[] = [];
  let currentTarget: AttemptTarget = "primary";

  const baseState = (overrides: Partial<CampaignOperationState> = {}): CampaignOperationState =>
    Object.freeze({
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

  const deliver = vi.fn(async () =>
    baseState({ status: "delivered", terminal: true, consumedDefinitive: true }),
  );
  const refund = vi.fn(async () => baseState({ status: "refunded", terminal: true }));

  const createGateway = vi.fn((_pair: ImageModelPairConfig): AiInvoker => ({
    async invoke(_capability, request): Promise<AiInvocationResult> {
      providerCalls += 1;
      const next = providerSequence[providerIndex] ?? {
        imageBase64: "AAAA",
        mimeType: "image/png",
        model: "gpt-image-2.5-sunburst",
      };
      providerIndex += 1;
      void request;
      if (next instanceof Error) throw next;
      return next;
    },
    async hasFallback() {
      return true;
    },
  }));

  const deps = {
    runPreflight: async () => ({
      config: CONFIG,
      pricing: {
        primary: {} as never,
        fallback: {} as never,
        missingComponents: [],
        pricingCoverage: "complete" as const,
      },
    }),
    buildSnapshot: () => SNAPSHOT,
    persistSnapshot: async () => ({ snapshotOriginalId: SNAPSHOT_ID, reused: false }),
    credit: {
      reserve: vi.fn(async () => baseState()),
      markArtUploaded: vi.fn(async () => baseState({ status: "art_uploaded" })),
      deliver,
      refund,
    } as never,
    attempts: {
      acquire: vi.fn(async (input: { target: AttemptTarget; attemptNumber: number }) => {
        currentTarget = input.target;
        return {
          acquired: true,
          reason: null,
          campaignId: CAMPAIGN_ID,
          operationId: OPERATION_ID,
          attemptNumber: input.attemptNumber,
          target: input.target,
        };
      }),
      finish: vi.fn(async () => ({
        campaignId: CAMPAIGN_ID,
        operationId: OPERATION_ID,
        attemptNumber: 1,
        target: currentTarget,
        status: "done",
        idempotent: false,
      })),
      recordOperationOutcome: vi.fn(async () => ({
        campaignId: CAMPAIGN_ID,
        operationId: OPERATION_ID,
        outcome: "unknown",
        supportReference: null,
        idempotent: false,
      })),
      getCampaignOperation: vi.fn(async () => null),
    } as never,
    artifact: {
      storeArtifact: vi.fn(async (): Promise<ProductOneToOneArtifactRef> => ({
        storagePath: `${STORE_ID}/${CAMPAIGN_ID}/product-1-1/${OPERATION_ID}/art-1024.jpg`,
        width: 1024,
        height: 1024,
        mimeType: "image/jpeg",
      })),
      probeArtifact: vi.fn(async () => ({ kind: "absent" as const })),
    } as never,
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
    recordAttempt: vi.fn(async () => ({ id: "op-row-1", operationId: OPERATION_ID })),
    recordDiagnosis: vi.fn(async () => ({ reference: "ref-test" })),
    generateSupportReference: () => "66666666-6666-4666-8666-666666666666",
    onAttemptEnvelope: (envelope: AttemptEnvelope) => {
      envelopes.push(envelope);
    },
  };

  return {
    deps,
    calls: {
      deliver,
      refund,
      get providerCalls() {
        return providerCalls;
      },
    },
    envelopes,
    setProviderSequence(seq) {
      providerSequence = seq;
      providerIndex = 0;
    },
  };
}

async function runOrchestrator(harness: OrchestratorHarness) {
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

describe("Plano 08 — envelope por tentativa no orquestrador (REQ-12)", () => {
  it("cada tentativa real emite exatamente um envelope; a sequência é reconstruível", async () => {
    const harness = await buildOrchestratorHarness();
    const providerError = () => Object.assign(new Error("provider down"), { kind: "provider_error" });
    harness.setProviderSequence([
      providerError(),
      providerError(),
      { imageBase64: "CCCC", mimeType: "image/png", model: "gpt-image-2" },
    ]);

    const { terminal } = await runOrchestrator(harness);

    expect(terminal).toMatchObject({ type: "result" });
    expect(harness.calls.providerCalls).toBe(3);
    expect(harness.envelopes).toHaveLength(3);
    expect(harness.envelopes.map((e) => e.target)).toEqual(["primary", "primary", "fallback"]);
    expect(harness.envelopes.map((e) => e.attemptNumber)).toEqual([1, 2, 3]);
    expect(harness.envelopes.map((e) => e.result)).toEqual(["failed", "failed", "success"]);

    const sequence = reconstructAttemptSequence(SNAPSHOT, harness.envelopes);
    expect(sequence).toHaveLength(3);
    expect(sequence[2]).toMatchObject({ target: "fallback", model: "gpt-image-2" });
  });

  it("falha confirmada + ausência comprovada ⇒ diagnóstico durável correlacionado a IMG-001", async () => {
    const harness = await buildOrchestratorHarness();
    harness.setProviderSequence([
      Object.assign(new Error("content policy violation"), { kind: "content_filter" }),
    ]);

    const { terminal } = await runOrchestrator(harness);

    expect(terminal).toMatchObject({ type: "error", code: "IMG-001" });
    expect(harness.calls.refund).toHaveBeenCalledTimes(1);
    const recordDiagnosis = (harness.deps as Record<string, unknown>).recordDiagnosis as ReturnType<
      typeof vi.fn
    >;
    expect(recordDiagnosis).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Guarda estática de wiring
// ---------------------------------------------------------------------------

describe("Plano 08 — wiring estático (instrumentação)", () => {
  it("o orquestrador emite envelope por tentativa e persiste o diagnóstico durável centralizado", () => {
    expect(ORCHESTRATOR_SOURCE).toContain("emitAttemptEnvelope");
    expect(ORCHESTRATOR_SOURCE).toContain("recordFailureDiagnosis");
    expect(ORCHESTRATOR_SOURCE).not.toContain("toInternalDiagnosis(");
  });
});
