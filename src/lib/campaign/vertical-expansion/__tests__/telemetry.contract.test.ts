// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

/**
 * Sink de destino observável sem banco: o `AiCostTracker` é substituído por um
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

import { assertNoSensitiveFields } from "@/lib/product-vertical-9-16/telemetry/format-attempt";
import type { AiCallEnvelope } from "@/lib/ai/types";

import { EXPANSION_STAGE, PROVIDER_SIZE } from "../policy";
import {
  EXPANSION_OUTCOME_BY_KIND,
  EXPANSION_TELEMETRY_FIELDS,
  createExpansionTelemetry,
  expansionOutcomeFor,
  type ExpansionTelemetryInput,
} from "../telemetry";

const OPERATION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CALL_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const STORE_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const CAMPAIGN_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const SOURCE_ARTIFACT_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const CONFIG_VERSION_ID = "9b1d3c4e-5f60-4a7b-8c9d-0e1f2a3b4c5d";

function telemetryInput(
  overrides: Partial<ExpansionTelemetryInput> = {},
): ExpansionTelemetryInput {
  return {
    operationId: OPERATION_ID,
    callId: CALL_ID,
    attemptNumber: 2,
    attemptReference: "attempt-ref-2",
    storeId: STORE_ID,
    campaignId: CAMPAIGN_ID,
    promptVersion: "f60.3-expand-9-16-v1",
    sourceArtifactId: SOURCE_ARTIFACT_ID,
    provider: "openai",
    model: "gpt-image-2.5-sunburst",
    quality: "low",
    configVersionId: CONFIG_VERSION_ID,
    selectionOrigin: "configured",
    pricingVersion: "pricing-version-1",
    tokenPricing: {
      inputCostUsd: 1,
      cachedInputCostUsd: 0.5,
      outputCostUsd: 2,
      imageInputTokenUsdPer1M: 10,
      imageCachedInputTokenUsdPer1M: 5,
      imageTokenUsdPer1M: 40,
    },
    imageUnitUsd: 0.04,
    usdBrlRateAtGeneration: 5.42,
    creditValueBrlAtGeneration: 1.07,
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
    quality: "low",
    attemptNumber: 2,
    ...overrides,
  };
}

const FULL_USAGE = {
  inputTextTokens: 100,
  inputImageTokens: 200,
  outputTextTokens: 0,
  outputImageTokens: 300,
  cachedInputTextTokens: 0,
  cachedInputImageTokens: 0,
};

beforeEach(() => {
  captured.events.length = 0;
});

describe("createExpansionTelemetry — contexto e um envelope por chamada", () => {
  it("correlaciona operação, chamada e tentativa do chamador", () => {
    const handle = createExpansionTelemetry(telemetryInput());

    expect(handle.telemetry.operationRunId).toBe(OPERATION_ID);
    expect(handle.telemetry.traceId).toBe(CALL_ID);
    expect(handle.telemetry.attemptNumber).toBe(2);
    expect(handle.telemetry.operationRunType).toBe("campaign_delivery");
    expect(typeof handle.finalize).toBe("function");
    expect(typeof handle.flush).toBe("function");
  });

  it("bufferiza um envelope e só entrega ao sink de destino no flush", async () => {
    const handle = createExpansionTelemetry(telemetryInput());

    await handle.telemetry.sink.emit(envelope());
    expect(handle.bufferedEnvelopes()).toBe(1);
    expect(captured.events).toHaveLength(0);

    handle.finalize({ outcome: "expanded", returnedSize: "1152x2048", durationMs: 900 });
    await handle.flush();

    expect(captured.events).toHaveLength(1);
    expect(handle.bufferedEnvelopes()).toBe(0);
  });

  it("decora metadata com a allowlist e nenhum campo sensível", async () => {
    const handle = createExpansionTelemetry(telemetryInput());
    await handle.telemetry.sink.emit(envelope());
    handle.finalize({
      outcome: "invalid_output",
      returnedSize: "1152x2048",
      durationMs: 4321,
    });
    await handle.flush();

    const metadata = captured.events[0].metadata as Record<string, unknown>;

    expect(metadata).toMatchObject({
      stage: EXPANSION_STAGE,
      operationId: OPERATION_ID,
      callId: CALL_ID,
      attemptRef: "attempt-ref-2",
      requestedSize: PROVIDER_SIZE,
      returnedSize: "1152x2048",
      promptVersion: "f60.3-expand-9-16-v1",
      sourceArtifactId: SOURCE_ARTIFACT_ID,
      expansionOutcome: "invalid_output",
      provider: "openai",
      model: "gpt-image-2.5-sunburst",
      quality: "low",
      configVersionId: CONFIG_VERSION_ID,
      selectionOrigin: "configured",
    });

    for (const field of EXPANSION_TELEMETRY_FIELDS) {
      expect(metadata).toHaveProperty(field);
    }
    expect(metadata).not.toHaveProperty("prompt");
    expect(metadata).not.toHaveProperty("apiKey");
    expect(metadata).not.toHaveProperty("authorization");
    expect(metadata).not.toHaveProperty("bytes");
    expect(metadata).not.toHaveProperty("url");
    assertNoSensitiveFields(metadata);
  });

  it("resolvedCost espelha o custo persistido", async () => {
    const handle = createExpansionTelemetry(telemetryInput());
    await handle.telemetry.sink.emit(envelope({ usage: FULL_USAGE }));
    handle.finalize({ outcome: "expanded", returnedSize: "1152x2048", durationMs: 10 });
    await handle.flush();

    const event = captured.events[0];
    expect(handle.resolvedCost()).toEqual(event.cost);
  });

  it("registra a origem legada explícita sem criar um novo desfecho", async () => {
    const handle = createExpansionTelemetry(
      telemetryInput({
        quality: "medium",
        configVersionId: null,
        selectionOrigin: "legacy_sunburst_low",
      }),
    );
    await handle.telemetry.sink.emit(envelope({ quality: "medium" }));
    handle.finalize({ outcome: "expanded", returnedSize: "1152x2048", durationMs: 10 });
    await handle.flush();

    const metadata = captured.events[0].metadata as Record<string, unknown>;
    expect(metadata.quality).toBe("medium");
    expect(metadata.configVersionId).toBeNull();
    expect(metadata.selectionOrigin).toBe("legacy_sunburst_low");
    expect(metadata.expansionOutcome).toBe("expanded");
    expect(EXPANSION_TELEMETRY_FIELDS).toContain("configVersionId");
    expect(EXPANSION_TELEMETRY_FIELDS).toContain("selectionOrigin");
  });
});

describe("createExpansionTelemetry — snapshot econômico congelado (D-05/D-07)", () => {
  it("o contexto principal recebe os dois valores do snapshot", () => {
    const handle = createExpansionTelemetry(telemetryInput());

    expect(handle.telemetry.usdBrlRateAtGeneration).toBe(5.42);
    expect(handle.telemetry.creditValueBrlAtGeneration).toBe(1.07);
  });

  it("o contexto por envelope (criado no flush) persiste os mesmos valores", async () => {
    const handle = createExpansionTelemetry(telemetryInput());
    await handle.telemetry.sink.emit(envelope({ usage: FULL_USAGE }));
    handle.finalize({ outcome: "expanded", returnedSize: "1152x2048", durationMs: 10 });
    await handle.flush();

    expect(captured.events).toHaveLength(1);
    const event = captured.events[0];
    expect(event.usdBrlRateAtGeneration).toBe(5.42);
    expect(event.creditValueBrlAtGeneration).toBe(1.07);
  });

  it("null explícito quando o snapshot não existe — nunca herda do contexto principal nem vira zero", async () => {
    const handle = createExpansionTelemetry(
      telemetryInput({
        usdBrlRateAtGeneration: null,
        creditValueBrlAtGeneration: null,
      }),
    );
    await handle.telemetry.sink.emit(envelope({ usage: FULL_USAGE }));
    handle.finalize({ outcome: "expanded", returnedSize: "1152x2048", durationMs: 10 });
    await handle.flush();

    const event = captured.events[0];
    expect(event.usdBrlRateAtGeneration).toBeNull();
    expect(event.creditValueBrlAtGeneration).toBeNull();
  });

  it("os campos econômicos NÃO entram em metadata (allowlist intacta)", async () => {
    const handle = createExpansionTelemetry(telemetryInput());
    await handle.telemetry.sink.emit(envelope({ usage: FULL_USAGE }));
    handle.finalize({ outcome: "expanded", returnedSize: "1152x2048", durationMs: 10 });
    await handle.flush();

    const metadata = captured.events[0].metadata as Record<string, unknown>;
    expect(metadata).not.toHaveProperty("usdBrlRateAtGeneration");
    expect(metadata).not.toHaveProperty("creditValueBrlAtGeneration");
    expect(EXPANSION_TELEMETRY_FIELDS).not.toContain("usdBrlRateAtGeneration");
    expect(EXPANSION_TELEMETRY_FIELDS).not.toContain("creditValueBrlAtGeneration");
    assertNoSensitiveFields(metadata);
  });
});

describe("createExpansionTelemetry — custo com origem", () => {
  it("providerReportedCostUsd usa provider_reported", async () => {
    const handle = createExpansionTelemetry(telemetryInput());
    await handle.telemetry.sink.emit(
      envelope({ usage: FULL_USAGE, providerReportedCostUsd: 0.42 }),
    );
    handle.finalize({ outcome: "expanded", returnedSize: "1152x2048", durationMs: 10 });
    await handle.flush();

    const cost = captured.events[0].cost as Record<string, unknown>;
    expect(cost.costSource).toBe("provider_reported");
    expect(cost.estimatedCostUsd).toBe(0.42);
    // Snapshot econômico também no caminho de custo REPORTADO pelo provider.
    expect(captured.events[0].usdBrlRateAtGeneration).toBe(5.42);
    expect(captured.events[0].creditValueBrlAtGeneration).toBe(1.07);
  });

  it("usage real sem custo reportado usa pricing_table", async () => {
    const handle = createExpansionTelemetry(telemetryInput());
    await handle.telemetry.sink.emit(envelope({ usage: FULL_USAGE }));
    handle.finalize({ outcome: "expanded", returnedSize: "1152x2048", durationMs: 10 });
    await handle.flush();

    const cost = captured.events[0].cost as Record<string, unknown>;
    expect(cost.costSource).toBe("pricing_table");
    expect(typeof cost.estimatedCostUsd).toBe("number");
    expect(cost.estimatedCostUsd as number).toBeGreaterThan(0);
    // Snapshot econômico também no caminho de custo por tokens.
    expect(captured.events[0].usdBrlRateAtGeneration).toBe(5.42);
    expect(captured.events[0].creditValueBrlAtGeneration).toBe(1.07);
  });

  it("sem usage e sem custo reportado é not_available com null (nunca zero)", async () => {
    const handle = createExpansionTelemetry(telemetryInput());
    await handle.telemetry.sink.emit(envelope());
    handle.finalize({ outcome: "expanded", returnedSize: "1152x2048", durationMs: 10 });
    await handle.flush();

    const cost = captured.events[0].cost as Record<string, unknown>;
    expect(cost.costSource).toBe("not_available");
    expect(cost.estimatedCostUsd).toBeNull();
  });

  it("estimativa ausente (image_unit null) não vira zero: custo efetivo vem de usage × tarifas", async () => {
    const handle = createExpansionTelemetry(telemetryInput({ imageUnitUsd: null }));
    await handle.telemetry.sink.emit(envelope({ usage: FULL_USAGE }));
    handle.finalize({ outcome: "expanded", returnedSize: "1152x2048", durationMs: 10 });
    await handle.flush();

    const event = captured.events[0];
    const cost = event.cost as Record<string, unknown>;
    expect(cost.costSource).toBe("pricing_table");
    expect(typeof cost.estimatedCostUsd).toBe("number");
    expect(cost.estimatedCostUsd as number).toBeGreaterThan(0);
    expect((event.metadata as Record<string, unknown>).internal_cost_pre_call_estimate_usd).toBeNull();
  });
});

describe("createExpansionTelemetry — flush único e protegido", () => {
  it("finalize após flush não emite segundo evento e flush duplo não duplica", async () => {
    const handle = createExpansionTelemetry(telemetryInput());
    await handle.telemetry.sink.emit(envelope());
    handle.finalize({ outcome: "expanded", returnedSize: "1152x2048", durationMs: 10 });
    await handle.flush();

    handle.finalize({ outcome: "persistence_failed", returnedSize: null, durationMs: 20 });
    await handle.flush();

    expect(captured.events).toHaveLength(1);
  });

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
      const handle = mod.createExpansionTelemetry(telemetryInput());

      await handle.telemetry.sink.emit(envelope());
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

describe("EXPANSION_OUTCOME_BY_KIND — tabela explícita", () => {
  it("mapeia o par (bucket, kind preciso) dos desfechos pós-chamada", () => {
    expect(expansionOutcomeFor("expanded")).toBe("expanded");
    expect(expansionOutcomeFor("reused")).toBe("expanded");
    expect(expansionOutcomeFor("export_failed")).toBe("invalid_output");
    expect(expansionOutcomeFor("invalid_output")).toBe("invalid_output");
    expect(expansionOutcomeFor("definitive_failure")).toBe("provider_failure");
    expect(expansionOutcomeFor("provider_failure")).toBe("provider_failure");
    expect(expansionOutcomeFor("unknown_result")).toBe("unknown");
    expect(expansionOutcomeFor("readback_failed")).toBe("persistence_failed");
    expect(expansionOutcomeFor("conflict")).toBe("persistence_failed");
    expect(expansionOutcomeFor("persistence_failed")).toBe("persistence_failed");
  });

  it("kinds pré-chamada devolvem null (nenhuma evidência de chamada)", () => {
    expect(expansionOutcomeFor("blocked")).toBeNull();
    expect(expansionOutcomeFor("existing_artifact_conflict")).toBeNull();
    expect(expansionOutcomeFor("invalid_input")).toBeNull();
    expect(expansionOutcomeFor("authorization_denied")).toBeNull();
    expect(expansionOutcomeFor("source_unavailable")).toBeNull();
    expect(expansionOutcomeFor("model_unavailable")).toBeNull();
    expect(expansionOutcomeFor("pricing_unavailable")).toBeNull();
  });

  it("a tabela exportada é a mesma autoridade da função", () => {
    for (const [kind, expected] of Object.entries(EXPANSION_OUTCOME_BY_KIND)) {
      expect(expansionOutcomeFor(kind as keyof typeof EXPANSION_OUTCOME_BY_KIND)).toBe(
        expected,
      );
    }
  });
});
