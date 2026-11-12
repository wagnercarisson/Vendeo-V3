// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

/**
 * Sink de destino observável sem banco: `AiCostTracker` é substituído por um
 * coletor. O `DefaultAiTelemetrySink` REAL continua resolvendo o custo (e
 * chamando `onCostResolved`) — só a gravação final é capturada.
 */
const captured = vi.hoisted(() => ({ events: [] as Record<string, unknown>[] }));

vi.mock("@/lib/ai-cost/tracker", () => ({
  AiCostTracker: class {
    async record(event: unknown): Promise<void> {
      captured.events.push(event as Record<string, unknown>);
    }
  },
}));

import type { AiCallEnvelope } from "@/lib/ai/types";
import type { ModelPricing } from "@/lib/ai-cost/ai-model-pricing";
import type { ImagePairCostResolution } from "@/lib/ai-cost/image-pair-pricing";

import { PROVIDER_SIZE } from "../policy";
import {
  SQUARE_BASE_OUTCOME_BY_KIND,
  SQUARE_BASE_TELEMETRY_FIELDS,
  createSquareBaseTelemetry,
  squareBaseOutcomeFor,
  type SquareBaseTelemetryInput,
} from "../telemetry";

const OPERATION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CALL_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CALL_ID_2 = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const STORE_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const CAMPAIGN_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

const COMPLETE_PRICING: ModelPricing = {
  inputCostUsd: 1,
  cachedInputCostUsd: 0.5,
  outputCostUsd: 2,
  imageInputTokenUsdPer1M: 10,
  imageCachedInputTokenUsdPer1M: 5,
  imageTokenUsdPer1M: 40,
  imageUnitCostUsd: 0.04,
};

const FULL_USAGE = {
  inputTextTokens: 100,
  inputImageTokens: 200,
  outputTextTokens: 0,
  outputImageTokens: 300,
  cachedInputTextTokens: 0,
  cachedInputImageTokens: 0,
};

function pairCost(): ImagePairCostResolution {
  return {
    primary: {
      model: "gpt-image-2.5-sunburst",
      quality: "medium",
      costUsd: 0.04,
      versionId: "pricing-version-1",
      costSource: "pricing_table",
      pricing: COMPLETE_PRICING,
    },
    fallback: {
      model: "gpt-image-2",
      quality: "medium",
      costUsd: 0.04,
      versionId: "pricing-version-1",
      costSource: "pricing_table",
      pricing: COMPLETE_PRICING,
    },
  };
}

function telemetryInput(
  overrides: Partial<SquareBaseTelemetryInput> = {},
): SquareBaseTelemetryInput {
  return {
    operationId: OPERATION_ID,
    callId: CALL_ID,
    attemptNumber: 1,
    attemptReference: "attempt-ref-1",
    storeId: STORE_ID,
    campaignId: CAMPAIGN_ID,
    pair: {
      primary: { model: "gpt-image-2.5-sunburst", quality: "medium" },
      fallback: { model: "gpt-image-2", quality: "medium" },
    },
    target: "primary",
    usdBrlRateAtGeneration: 5.5,
    ...overrides,
  };
}

function envelope(overrides: Partial<AiCallEnvelope> = {}): AiCallEnvelope {
  return {
    capability: "campaign_product_image",
    protocol: "images",
    status: "success",
    provider: "openai",
    model: "gpt-image-2.5-sunburst",
    durationMs: 1234,
    quality: "medium",
    attemptNumber: 1,
    ...overrides,
  };
}

const resolveCost = vi.fn(async () => pairCost());

beforeEach(() => {
  captured.events.length = 0;
  resolveCost.mockClear();
});

describe("createSquareBaseTelemetry — contexto e um envelope por chamada", () => {
  it("correlaciona operação, chamada, tentativa e alvo", () => {
    const handle = createSquareBaseTelemetry(telemetryInput(), { resolveCost });

    expect(handle.context.operationRunId).toBe(OPERATION_ID);
    expect(handle.context.traceId).toBe(CALL_ID);
    expect(handle.context.attemptNumber).toBe(1);
    expect(handle.context.operationRunType).toBe("campaign_delivery");
    expect(typeof handle.finalize).toBe("function");
    expect(typeof handle.flush).toBe("function");
  });

  it("bufferiza um envelope e só entrega ao sink no flush (1 evento por chamada)", async () => {
    const handle = createSquareBaseTelemetry(telemetryInput(), { resolveCost });

    await handle.context.sink.emit(envelope({ usage: FULL_USAGE }));
    expect(handle.bufferedEnvelopes()).toBe(1);
    expect(captured.events).toHaveLength(0);

    handle.finalize({ outcome: "generated", durationMs: 900 });
    await handle.flush();

    expect(captured.events).toHaveLength(1);
    expect(handle.bufferedEnvelopes()).toBe(0);

    const event = captured.events[0];
    expect(event).toMatchObject({
      operationRunId: OPERATION_ID,
      traceId: CALL_ID,
      attemptNumber: 1,
      provider: "openai",
      model: "gpt-image-2.5-sunburst",
      durationMs: 1234,
      status: "success",
    });
    const metadata = event.metadata as Record<string, unknown>;
    expect(metadata).toMatchObject({
      stage: "square_base",
      operationId: OPERATION_ID,
      callId: CALL_ID,
      attemptRef: "attempt-ref-1",
      requestedSize: PROVIDER_SIZE,
      squareOutcome: "generated",
      provider: "openai",
      model: "gpt-image-2.5-sunburst",
      quality: "medium",
    });
    for (const field of SQUARE_BASE_TELEMETRY_FIELDS) {
      expect(metadata).toHaveProperty(field);
    }
    expect(metadata).not.toHaveProperty("prompt");
    expect(metadata).not.toHaveProperty("apiKey");
    expect(metadata).not.toHaveProperty("authorization");
    expect(metadata).not.toHaveProperty("bytes");
    expect(metadata).not.toHaveProperty("url");
  });

  it("resolvedCost espelha o custo persistido", async () => {
    const handle = createSquareBaseTelemetry(telemetryInput(), { resolveCost });
    await handle.context.sink.emit(envelope({ usage: FULL_USAGE }));
    handle.finalize({ outcome: "generated", durationMs: 10 });
    await handle.flush();

    expect(handle.resolvedCost()).toEqual(captured.events[0].cost);
  });
});

describe("createSquareBaseTelemetry — custo com origem", () => {
  it("custo desconhecido vira null/not_available (nunca zero)", async () => {
    const handle = createSquareBaseTelemetry(telemetryInput(), { resolveCost });
    await handle.context.sink.emit(envelope());
    handle.finalize({ outcome: "generated", durationMs: 10 });
    await handle.flush();

    const cost = captured.events[0].cost as Record<string, unknown>;
    expect(cost.costSource).toBe("not_available");
    expect(cost.estimatedCostUsd).toBeNull();
  });

  it("providerReportedCostUsd usa provider_reported e NÃO resolve custo interno", async () => {
    const handle = createSquareBaseTelemetry(telemetryInput(), { resolveCost });
    await handle.context.sink.emit(
      envelope({ usage: FULL_USAGE, providerReportedCostUsd: 0.42 }),
    );
    handle.finalize({ outcome: "generated", durationMs: 10 });
    await handle.flush();

    const cost = captured.events[0].cost as Record<string, unknown>;
    expect(cost.costSource).toBe("provider_reported");
    expect(cost.estimatedCostUsd).toBe(0.42);
    expect(resolveCost).not.toHaveBeenCalled();
  });

  it("sem custo reportado usa o custo INTERNO do par congelado (pricing_table)", async () => {
    const handle = createSquareBaseTelemetry(telemetryInput(), { resolveCost });
    await handle.context.sink.emit(envelope({ usage: FULL_USAGE }));
    handle.finalize({ outcome: "generated", durationMs: 10 });
    await handle.flush();

    expect(resolveCost).toHaveBeenCalledTimes(1);
    const cost = captured.events[0].cost as Record<string, unknown>;
    expect(cost.costSource).toBe("pricing_table");
    const metadata = captured.events[0].metadata as Record<string, unknown>;
    expect(metadata.internal_cost_origin).toBe("new_flow_pair_pricing");
    expect(metadata.internal_cost_model).toBe("gpt-image-2.5-sunburst");
  });
});

describe("createSquareBaseTelemetry — snapshot econômico", () => {
  it("propaga usdBrlRateAtGeneration e creditValueBrlAtGeneration (inclusive null explícito)", async () => {
    const withCredit = createSquareBaseTelemetry(
      telemetryInput({ usdBrlRateAtGeneration: 5.5, creditValueBrlAtGeneration: 1.25 }),
      { resolveCost },
    );
    await withCredit.context.sink.emit(envelope({ usage: FULL_USAGE }));
    withCredit.finalize({ outcome: "generated", durationMs: 10 });
    await withCredit.flush();

    expect(captured.events[0].usdBrlRateAtGeneration).toBe(5.5);
    expect(captured.events[0].creditValueBrlAtGeneration).toBe(1.25);

    captured.events.length = 0;

    const nullCredit = createSquareBaseTelemetry(
      telemetryInput({ usdBrlRateAtGeneration: null, creditValueBrlAtGeneration: null }),
      { resolveCost },
    );
    expect(
      Object.prototype.hasOwnProperty.call(nullCredit.context, "creditValueBrlAtGeneration"),
    ).toBe(true);
    expect(
      (nullCredit.context as unknown as Record<string, unknown>)
        .creditValueBrlAtGeneration,
    ).toBeNull();
    await nullCredit.context.sink.emit(envelope({ usage: FULL_USAGE }));
    nullCredit.finalize({ outcome: "generated", durationMs: 10 });
    await nullCredit.flush();

    expect(captured.events[0].usdBrlRateAtGeneration).toBeNull();
    expect(captured.events[0].creditValueBrlAtGeneration).toBeNull();
  });

  it("creditValueBrlAtGeneration ausente NÃO é inventado", () => {
    const handle = createSquareBaseTelemetry(telemetryInput(), { resolveCost });
    expect(
      Object.prototype.hasOwnProperty.call(handle.context, "creditValueBrlAtGeneration"),
    ).toBe(false);
  });
});

describe("createSquareBaseTelemetry — resposta tardia após flush", () => {
  it("entrega o envelope tardio UMA vez ao sink base e mantém o buffer vazio", async () => {
    const handle = createSquareBaseTelemetry(telemetryInput(), { resolveCost });

    // Timeout/unknown: finalize + flush ANTES de o gateway resolver.
    handle.finalize({ outcome: "unknown", durationMs: 180_000 });
    await handle.flush();
    expect(captured.events).toHaveLength(0);
    expect(handle.bufferedEnvelopes()).toBe(0);

    // Envelope tardio chega depois do flush.
    await handle.context.sink.emit(envelope({ status: "timeout" }));

    expect(captured.events).toHaveLength(1);
    expect(handle.bufferedEnvelopes()).toBe(0);
    const metadata = captured.events[0].metadata as Record<string, unknown>;
    expect(metadata.squareOutcome).toBe("unknown");
  });

  it("flush duplo não duplica e finalize após flush não emite segundo evento", async () => {
    const handle = createSquareBaseTelemetry(telemetryInput(), { resolveCost });
    await handle.context.sink.emit(envelope({ usage: FULL_USAGE }));
    handle.finalize({ outcome: "generated", durationMs: 10 });
    await handle.flush();

    handle.finalize({ outcome: "persistence_failed", durationMs: 20 });
    await handle.flush();

    expect(captured.events).toHaveLength(1);
  });
});

describe("createSquareBaseTelemetry — falha de sink é best-effort", () => {
  it("flush que rejeita é capturado, não propaga e mantém o buffer consistente", async () => {
    vi.resetModules();
    vi.doMock("@/lib/ai/telemetry-sink", async () => {
      const actual = await vi.importActual<typeof import("@/lib/ai/telemetry-sink")>(
        "@/lib/ai/telemetry-sink",
      );
      return {
        ...actual,
        createDefaultTelemetryContext: (params: { sink?: unknown }) => {
          const context = actual.createDefaultTelemetryContext(params as never);
          if (params.sink !== undefined) return context;
          return {
            ...context,
            sink: {
              emit: async () => {
                throw new Error("sink_down");
              },
            },
          };
        },
      };
    });

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const mod = await import("../telemetry");
      const handle = mod.createSquareBaseTelemetry(telemetryInput(), { resolveCost });

      await handle.context.sink.emit(envelope({ usage: FULL_USAGE }));
      expect(handle.bufferedEnvelopes()).toBe(1);

      await expect(handle.flush()).resolves.toBeUndefined();
      expect(handle.bufferedEnvelopes()).toBe(0);
      expect(consoleSpy).toHaveBeenCalled();
    } finally {
      consoleSpy.mockRestore();
      vi.doUnmock("@/lib/ai/telemetry-sink");
      vi.resetModules();
    }
  });
});

describe("SQUARE_BASE_OUTCOME_BY_KIND — tabela explícita e exaustiva", () => {
  it("cobre as 14 variantes do resultado", () => {
    expect(Object.keys(SQUARE_BASE_OUTCOME_BY_KIND)).toHaveLength(14);
  });

  it("mapeia os desfechos pós-chamada", () => {
    expect(squareBaseOutcomeFor("completed")).toBe("generated");
    expect(squareBaseOutcomeFor("provider_failure")).toBe("provider_failure");
    expect(squareBaseOutcomeFor("definitive_failure")).toBe("definitive_failure");
    expect(squareBaseOutcomeFor("unknown_result")).toBe("unknown");
    expect(squareBaseOutcomeFor("invalid_output")).toBe("invalid_output");
    expect(squareBaseOutcomeFor("persistence_failed")).toBe("persistence_failed");
    expect(squareBaseOutcomeFor("readback_failed")).toBe("readback_failed");
  });

  it("kinds pré-chamada devolvem null (nenhum envelope)", () => {
    expect(squareBaseOutcomeFor("blocked")).toBeNull();
    expect(squareBaseOutcomeFor("invalid_input")).toBeNull();
    expect(squareBaseOutcomeFor("authorization_denied")).toBeNull();
    expect(squareBaseOutcomeFor("content_divergence")).toBeNull();
    expect(squareBaseOutcomeFor("frozen_state_conflict")).toBeNull();
    expect(squareBaseOutcomeFor("snapshot_failed")).toBeNull();
  });

  it("a tabela exportada é a mesma autoridade da função", () => {
    for (const [kind, expected] of Object.entries(SQUARE_BASE_OUTCOME_BY_KIND)) {
      expect(
        squareBaseOutcomeFor(kind as keyof typeof SQUARE_BASE_OUTCOME_BY_KIND),
      ).toBe(expected);
    }
  });
});

describe("base e expansão — mesmo operation_run_id, callId distinto", () => {
  it("duas chamadas da mesma operação compartilham operation_run_id", async () => {
    const first = createSquareBaseTelemetry(telemetryInput(), { resolveCost });
    const second = createSquareBaseTelemetry(
      telemetryInput({ callId: CALL_ID_2 }),
      { resolveCost },
    );

    expect(first.context.operationRunId).toBe(second.context.operationRunId);
    expect(first.context.traceId).not.toBe(second.context.traceId);

    await first.context.sink.emit(envelope({ usage: FULL_USAGE }));
    await second.context.sink.emit(envelope({ usage: FULL_USAGE }));
    first.finalize({ outcome: "generated", durationMs: 1 });
    second.finalize({ outcome: "generated", durationMs: 2 });
    await first.flush();
    await second.flush();

    expect(captured.events).toHaveLength(2);
    expect(captured.events[0].operationRunId).toBe(captured.events[1].operationRunId);
    expect(captured.events[0].traceId).toBe(CALL_ID);
    expect(captured.events[1].traceId).toBe(CALL_ID_2);
  });
});
