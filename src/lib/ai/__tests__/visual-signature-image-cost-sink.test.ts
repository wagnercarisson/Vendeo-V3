import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRecord, mockResolveAiCost, mockGetModelPricing } = vi.hoisted(() => ({
  mockRecord: vi.fn(),
  mockResolveAiCost: vi.fn(),
  mockGetModelPricing: vi.fn(),
}));

vi.mock("@/lib/ai-cost/tracker", () => ({
  AiCostTracker: class {
    record = mockRecord;
    startRun = vi.fn();
  },
}));

vi.mock("@/lib/ai-cost/cost-estimator", () => ({
  resolveAiCost: mockResolveAiCost,
}));

vi.mock("@/lib/ai-cost/ai-model-pricing", () => ({
  getModelPricing: mockGetModelPricing,
}));

import { DefaultAiTelemetrySink, type AiTelemetrySinkContext } from "../telemetry-sink";
import type { AiCallEnvelope } from "../types";

const context: AiTelemetrySinkContext = {
  operationRunId: "run-1",
  operationRunType: "visual_signature",
  traceId: "trace-1",
  storeId: "store-1",
  attemptNumber: 0,
};

const VS_IMAGE_ENVELOPE: AiCallEnvelope = {
  capability: "visual_signature_image",
  protocol: "responses",
  status: "success",
  provider: "openai",
  // Orquestrador real (não o modelo da tool de imagem).
  model: "gpt-5.5",
  quality: "low",
  durationMs: 1000,
  usage: {
    inputTextTokens: 1000,
    outputTextTokens: 100,
    // Tokens REAIS de imagem: preservados no evento, mas não usados no
    // componente textual (substituídos pela estimativa).
    outputImageTokens: 123,
    promptTokens: 1000,
    completionTokens: 223,
    totalTokens: 1223,
  },
  usageMeta: {
    imageGenerationTool: true,
    providerUsageSource: "responses.image_generation",
    responsesModel: "gpt-5.5",
  },
  visualSignatureImageUsage: {
    imageModel: "gpt-image-2.5-flare",
    imageQuality: "low",
    size: "1024x1024",
    configVersionId: "cfg-v1",
  },
};

function pricingFor(model: string, quality?: string) {
  if (model === "gpt-5.5") {
    return {
      pricing: { inputCostUsd: 5, outputCostUsd: 30, cachedInputCostUsd: 0.5 },
      versionId: "orch-pricing-v1",
    };
  }
  if (model === "gpt-image-2.5-flare" && quality === "low") {
    return {
      pricing: { inputCostUsd: 5, outputCostUsd: 30, imageTokenUsdPer1M: 30 },
      versionId: "image-pricing-v1",
    };
  }
  return null;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRecord.mockResolvedValue(undefined);
  mockResolveAiCost.mockResolvedValue({
    estimatedCostUsd: 0.065,
    costSource: "pricing_table",
  });
  mockGetModelPricing.mockImplementation(
    async ({ model, quality }: { model: string; quality?: string }) =>
      pricingFor(model, quality),
  );
});

describe("DefaultAiTelemetrySink — estimativa da imagem da Assinatura Visual", () => {
  it("caminho coberto: texto REAL + imagem ESTIMADA, sem 0,065 e com tokens reais preservados", async () => {
    const sink = new DefaultAiTelemetrySink(context, { record: mockRecord } as never);

    await sink.emit(VS_IMAGE_ENVELOPE);

    expect(mockResolveAiCost).not.toHaveBeenCalled();
    expect(mockRecord).toHaveBeenCalledTimes(1);
    const event = mockRecord.mock.calls[0][0];

    // Tokens REAIS do provider intactos.
    expect(event.tokens).toEqual(VS_IMAGE_ENVELOPE.usage);

    // Componentes separados: texto real (0,008) + imagem estimada (0,00925).
    expect(event.cost).toMatchObject({
      estimatedCostUsd: 0.01725,
      costSource: "pricing_table",
      pricingVersion: "orch-pricing-v1",
      costFormulaVersion: "visual_signature_image_usage_estimate_v1",
      textComponentUsd: 0.008,
      imageToolComponentUsd: 0.00925,
      imageToolPricingProvider: "openai",
      imageToolPricingModel: "gpt-image-2.5-flare",
      imageToolPricingVersion: "image-pricing-v1",
      costEstimationNote:
        "visual_signature_image_usage_estimated_vs-image-usage-v1",
    });
    expect(event.cost.providerReportedCostUsd).toBeUndefined();

    expect(event.metadata).toMatchObject({
      capability: "visual_signature_image",
      protocol: "responses",
      image_generation_tool: true,
      provider_usage_source: "responses.image_generation",
      image_usage_origin:
        "manual_observation_openai_platform_with_rounding_and_margin",
      image_usage_estimated: true,
      image_usage_estimate_version: "vs-image-usage-v1",
      image_usage_estimate_approved_at: "2026-10-26",
      image_usage_model: "gpt-image-2.5-flare",
      image_usage_quality: "low",
      image_usage_size: "1024x1024",
      image_usage_config_version_id: "cfg-v1",
      image_usage_input_text_tokens: 350,
      image_usage_output_image_tokens: 250,
      image_usage_pricing_version: "image-pricing-v1",
      image_usage_pricing_input_text_usd_per_1m: 5,
      image_usage_pricing_output_image_usd_per_1m: 30,
      image_usage_component_usd: 0.00925,
      image_usage_text_component_usd: 0.008,
      image_usage_coverage: "complete",
      image_usage_missing: [],
      orchestrator_pricing_version: "orch-pricing-v1",
    });
  });

  it("provider_reported_cost_usd do envelope é ignorado neste caminho estimado", async () => {
    const sink = new DefaultAiTelemetrySink(context, { record: mockRecord } as never);

    await sink.emit({ ...VS_IMAGE_ENVELOPE, providerReportedCostUsd: 99 });

    const event = mockRecord.mock.calls[0][0];
    expect(event.cost.providerReportedCostUsd).toBeUndefined();
    expect(event.cost.estimatedCostUsd).toBe(0.01725);
    expect(mockResolveAiCost).not.toHaveBeenCalled();
  });

  it("tarifa da imagem ausente → parcial/desconhecido (não 0,065, não zero)", async () => {
    mockGetModelPricing.mockImplementation(
      async ({ model }: { model: string }) =>
        model === "gpt-5.5"
          ? {
              pricing: { inputCostUsd: 5, outputCostUsd: 30 },
              versionId: "orch-pricing-v1",
            }
          : null,
    );
    const sink = new DefaultAiTelemetrySink(context, { record: mockRecord } as never);

    await sink.emit(VS_IMAGE_ENVELOPE);

    const event = mockRecord.mock.calls[0][0];
    expect(mockResolveAiCost).not.toHaveBeenCalled();
    expect(event.cost).toMatchObject({
      estimatedCostUsd: null,
      costSource: "not_available",
      textComponentUsd: 0.008,
      costEstimationNote:
        "visual_signature_image_usage_estimate_partial",
    });
    expect(event.cost.imageToolComponentUsd).toBeUndefined();
    expect(event.metadata).toMatchObject({
      image_usage_coverage: "partial",
      image_usage_missing: ["image_pricing"],
      image_usage_component_usd: null,
    });
  });

  it("code_default do orquestrador NÃO é aceito como tarifa tabelada neste caminho", async () => {
    mockGetModelPricing.mockImplementation(
      async ({ model, quality }: { model: string; quality?: string }) =>
        model === "gpt-5.5"
          ? {
              // Bootstrap de código: não é linha de `ai_model_pricing`.
              pricing: { inputCostUsd: 5, outputCostUsd: 30 },
              versionId: "code_default",
            }
          : pricingFor(model, quality),
    );
    const sink = new DefaultAiTelemetrySink(context, { record: mockRecord } as never);

    await sink.emit(VS_IMAGE_ENVELOPE);

    // O caminho novo NÃO cai na cadeia legada nem classifica code_default como
    // pricing_table; o legado (outros caminhos) permanece intacto.
    expect(mockResolveAiCost).not.toHaveBeenCalled();
    const event = mockRecord.mock.calls[0][0];
    expect(event.cost).toMatchObject({
      estimatedCostUsd: null,
      costSource: "not_available",
      imageToolComponentUsd: 0.00925,
    });
    expect(event.cost.textComponentUsd).toBeUndefined();
    expect(event.cost.pricingVersion).toBe("image-pricing-v1");
    expect(event.metadata).toMatchObject({
      image_usage_coverage: "partial",
      orchestrator_pricing_version: null,
    });
    expect(event.metadata.image_usage_missing).toContain("orchestrator_pricing");
  });

  it("combinação não coberta → desconhecida, sem tarifa de imagem e sem cadeia legada", async () => {
    const sink = new DefaultAiTelemetrySink(context, { record: mockRecord } as never);

    await sink.emit({
      ...VS_IMAGE_ENVELOPE,
      quality: "high",
      visualSignatureImageUsage: {
        imageModel: "gpt-image-2.5-flare",
        imageQuality: "high",
        size: "1024x1024",
      },
    });

    expect(mockResolveAiCost).not.toHaveBeenCalled();
    // Só a tarifa do orquestrador é consultada; a da imagem nem é buscada.
    expect(mockGetModelPricing).toHaveBeenCalledTimes(1);
    const event = mockRecord.mock.calls[0][0];
    expect(event.cost.estimatedCostUsd).toBeNull();
    expect(event.metadata.image_usage_missing).toContain("image_usage_estimate");
    expect(event.metadata.image_usage_input_text_tokens).toBeNull();
  });

  it("validação da assinatura continua na cadeia legada mesmo com alvo no envelope", async () => {
    const sink = new DefaultAiTelemetrySink(context, { record: mockRecord } as never);

    await sink.emit({
      ...VS_IMAGE_ENVELOPE,
      capability: "visual_signature_validation",
      protocol: "responses",
      usage: { promptTokens: 100, completionTokens: 20 },
    });

    expect(mockResolveAiCost).toHaveBeenCalledTimes(1);
    const event = mockRecord.mock.calls[0][0];
    expect(event.generationType).toBe("visual_signature_validation");
    expect(event.metadata).not.toHaveProperty("image_usage_origin");
    expect(event.metadata).not.toHaveProperty("image_usage_estimated");
  });

  it("caminho legado sem alvo de estimativa preserva a cadeia existente (0,065)", async () => {
    const sink = new DefaultAiTelemetrySink(context, { record: mockRecord } as never);

    const { visualSignatureImageUsage: _omit, ...legacyEnvelope } = VS_IMAGE_ENVELOPE;
    await sink.emit(legacyEnvelope);

    expect(mockResolveAiCost).toHaveBeenCalledTimes(1);
    expect(mockGetModelPricing).not.toHaveBeenCalled();
    const event = mockRecord.mock.calls[0][0];
    expect(event.cost.estimatedCostUsd).toBe(0.065);
    expect(event.metadata).not.toHaveProperty("image_usage_origin");
  });
});
