// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetModelPricing } = vi.hoisted(() => ({
  mockGetModelPricing: vi.fn(),
}));

vi.mock("../ai-model-pricing", () => ({
  getModelPricing: mockGetModelPricing,
}));

import { resolveAiCost } from "../cost-estimator";

const VERSION = "55555555-5555-4555-8555-555555555555";

const FULL_PRICING = {
  inputCostUsd: 5,
  outputCostUsd: 30,
  cachedInputCostUsd: 0.5,
  imageTokenUsdPer1M: 8,
};

const FULL_USAGE = {
  promptTokens: 1000,
  completionTokens: 500,
  cachedInputTokens: 200,
  inputTextTokens: 800,
  inputImageTokens: 200,
  cachedTextTokens: 200,
  cachedImageTokens: 0,
  outputTextTokens: 300,
  outputImageTokens: 200,
};

beforeEach(() => {
  mockGetModelPricing.mockReset();
  mockGetModelPricing.mockResolvedValue({ pricing: FULL_PRICING, versionId: VERSION });
  vi.unstubAllEnvs();
});

describe("F47.1 — roteamento do caminho com preset", () => {
  it("preset explícito usa tarifa por modelo/qualidade e cobertura completa", async () => {
    const result = await resolveAiCost({
      provider: "openai",
      model: "gpt-6-luna",
      usage: FULL_USAGE,
      generationType: "visual_signature_image",
      visualSignaturePreset: "sunburst_medium",
      imageGenerationModel: "gpt-image-2.5-sunburst",
      imageQuality: "medium",
    });

    expect(mockGetModelPricing).toHaveBeenCalledWith({
      provider: "openai",
      model: "gpt-image-2.5-sunburst",
      quality: "medium",
    });
    expect(mockGetModelPricing).not.toHaveBeenCalledWith(
      expect.objectContaining({ model: "responses:image_generation" }),
    );
    // 600*5 + 200*0.5 + 200*8 + 300*30 + 200*8 = 0.0153
    expect(result.estimatedCostUsd).toBeCloseTo(0.0153, 8);
    expect(result.costSource).toBe("pricing_table");
    expect(result.costCoverage).toBe("complete");
    expect(result.costFormulaVersion).toBe("visual_signature_usage_v1");
    expect(result.pricingVersion).toBe(VERSION);
  });

  it("sem usage → null/not_available/partial com referência histórica, sem fallback_static", async () => {
    vi.stubEnv("VENDEO_AI_FALLBACK_COST_USD", "0.15");

    const result = await resolveAiCost({
      provider: "openai",
      model: "gpt-6-luna",
      generationType: "visual_signature_image",
      visualSignaturePreset: "flare_low",
      imageGenerationModel: "gpt-image-2.5-flare",
      imageQuality: "low",
    });

    expect(result.estimatedCostUsd).toBeNull();
    expect(result.costSource).toBe("not_available");
    expect(result.costCoverage).toBe("partial");
    expect(result.costEstimationNote).toContain("visual_signature_image_estimate_no_usage");
    expect(result.costEstimationNote).toContain("historical_reference_usd=0.036");
    expect(result.costSource).not.toBe("fallback_static");
  });

  it("pricing ausente → not_available, nunca 0.065/fallback_static", async () => {
    mockGetModelPricing.mockResolvedValue(null);
    vi.stubEnv("VENDEO_AI_FALLBACK_COST_USD", "0.15");

    const result = await resolveAiCost({
      provider: "openai",
      model: "gpt-6-luna",
      usage: { promptTokens: 1000, completionTokens: 500 },
      generationType: "visual_signature_image",
      visualSignaturePreset: "sunburst_low",
      imageGenerationModel: "gpt-image-2.5-sunburst",
      imageQuality: "low",
    });

    expect(result.estimatedCostUsd).toBeNull();
    expect(result.costSource).toBe("not_available");
    expect(result.costCoverage).toBe("unknown");
    expect(result.costEstimationNote).not.toContain("0.065");
    expect(result.costSource).not.toBe("fallback_static");
  });

  it("custo reportado permanece separado da estimativa", async () => {
    const result = await resolveAiCost({
      provider: "openai",
      model: "gpt-6-luna",
      usage: FULL_USAGE,
      providerReportedCostUsd: 0.5,
      generationType: "visual_signature_image",
      visualSignaturePreset: "sunburst_medium",
      imageGenerationModel: "gpt-image-2.5-sunburst",
      imageQuality: "medium",
    });

    expect(result.providerReportedCostUsd).toBe(0.5);
    expect(result.estimatedCostUsd).toBeCloseTo(0.0153, 8);
    expect(result.costSource).toBe("provider_reported");
    expect(result.costEstimationNote).toContain("provider_reported_separate");
  });

  it("modelo do request divergente do preset não é corrigido silenciosamente", async () => {
    const result = await resolveAiCost({
      provider: "openai",
      model: "gpt-6-luna",
      usage: FULL_USAGE,
      generationType: "visual_signature_image",
      visualSignaturePreset: "sunburst_medium",
      imageGenerationModel: "gpt-image-2.5-flare",
      imageQuality: "medium",
    });

    expect(result.estimatedCostUsd).toBeNull();
    expect(result.costCoverage).toBe("partial");
    expect(result.costEstimationNote).toBe("visual_signature_preset_model_mismatch");
  });

  it("imageGenerationModel sem preset também usa leitura quality-aware", async () => {
    const result = await resolveAiCost({
      provider: "openai",
      model: "gpt-6-luna",
      usage: FULL_USAGE,
      generationType: "visual_signature_image",
      imageGenerationModel: "gpt-image-2.5-flare",
      imageQuality: "low",
    });

    expect(mockGetModelPricing).toHaveBeenCalledWith({
      provider: "openai",
      model: "gpt-image-2.5-flare",
      quality: "low",
    });
    expect(result.costCoverage).toBe("complete");
  });

  it("ajuste manual explícito continua vencendo o pricing automático", async () => {
    const result = await resolveAiCost({
      provider: "openai",
      model: "gpt-6-luna",
      usage: FULL_USAGE,
      manualCostUsd: 0.75,
      generationType: "visual_signature_image",
      visualSignaturePreset: "sunburst_medium",
    });

    expect(result).toEqual({ estimatedCostUsd: 0.75, costSource: "manual_unknown" });
    expect(mockGetModelPricing).not.toHaveBeenCalled();
  });

  it("caminho legado (sem preset) permanece sem costCoverage e sem fórmula visual", async () => {
    const result = await resolveAiCost({
      provider: "openai",
      model: "gpt-5.5",
      usage: { promptTokens: 1000, completionTokens: 500 },
      generationType: "visual_signature_image",
    });

    expect(result.costCoverage).toBeUndefined();
    expect(result.costFormulaVersion).toBeUndefined();
    expect(result.costSource).toBe("pricing_table");
    expect(mockGetModelPricing).toHaveBeenCalledWith({
      provider: "openai",
      model: "gpt-5.5",
    });
  });
});
