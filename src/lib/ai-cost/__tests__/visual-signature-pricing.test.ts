// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetModelPricing } = vi.hoisted(() => ({
  mockGetModelPricing: vi.fn(),
}));

vi.mock("../ai-model-pricing", () => ({
  getModelPricing: mockGetModelPricing,
}));

import {
  getVisualSignatureOrchestratorPricing,
  getVisualSignaturePresetPricing,
  VISUAL_SIGNATURE_HISTORICAL_ESTIMATES,
} from "../visual-signature-pricing";

const VERSION = "44444444-4444-4444-8444-444444444444";

const FULL_PRICING = {
  inputCostUsd: 5,
  outputCostUsd: 30,
  cachedInputCostUsd: 0.5,
  imageTokenUsdPer1M: 8,
};

beforeEach(() => {
  mockGetModelPricing.mockReset();
  mockGetModelPricing.mockResolvedValue({ pricing: FULL_PRICING, versionId: VERSION });
});

describe("F47.1 — pricing quality-aware do preset (imagem)", () => {
  it("Sunburst Medium procura openai/gpt-image-2.5-sunburst/medium", async () => {
    const result = await getVisualSignaturePresetPricing({ preset: "sunburst_medium" });

    expect(mockGetModelPricing).toHaveBeenCalledWith({
      provider: "openai",
      model: "gpt-image-2.5-sunburst",
      quality: "medium",
    });
    expect(result.status).toBe("complete");
    expect(result.pricingVersion).toBe(VERSION);
    expect(result.rates).toEqual({
      imageTokenUsdPer1M: 8,
      cachedImageUsdPer1M: undefined,
    });
    // A tarifa única NÃO é copiada para entrada e saída.
    expect(result.rates.inputImageUsdPer1M).toBeUndefined();
    expect(result.rates.outputImageUsdPer1M).toBeUndefined();
    expect(result.toolRates).toMatchObject({
      inputTextUsdPer1M: 5,
      outputTextUsdPer1M: 30,
      cachedTextUsdPer1M: 0.5,
      imageTokenUsdPer1M: 8,
    });
  });

  it("nunca consulta responses:image_generation (0.065)", async () => {
    await getVisualSignaturePresetPricing({ preset: "flare_low" });

    const models = mockGetModelPricing.mock.calls.map((call) => call[0].model);
    expect(models).not.toContain("responses:image_generation");
  });

  it("sem linha de qualidade → missing com referência histórica rotulada", async () => {
    mockGetModelPricing.mockResolvedValue(null);

    const result = await getVisualSignaturePresetPricing({ preset: "sunburst_medium" });

    expect(result.status).toBe("missing");
    expect(result.pricingVersion).toBeNull();
    expect(result.rates).toEqual({});
    expect(result.historicalReferenceUsd).toBe(0.044);
    expect(VISUAL_SIGNATURE_HISTORICAL_ESTIMATES.low).toBe(0.036);
  });

  it("linha sem tarifa de imagem → missing, sem inventar valor", async () => {
    mockGetModelPricing.mockResolvedValue({
      pricing: { inputCostUsd: 5, outputCostUsd: 30 },
      versionId: VERSION,
    });

    const result = await getVisualSignaturePresetPricing({ preset: "flare_medium" });

    expect(result.status).toBe("missing");
    expect(result.missingRates).toContain("image.imageTokenUsdPer1M");
  });
});

describe("F47.1 — pricing do orquestrador (texto)", () => {
  it("lê o modelo do orquestrador SEM quality e retorna tarifas de texto", async () => {
    const result = await getVisualSignatureOrchestratorPricing({
      provider: "openai",
      model: "gpt-6-luna",
    });

    expect(mockGetModelPricing).toHaveBeenCalledWith({
      provider: "openai",
      model: "gpt-6-luna",
    });
    expect(result.status).toBe("complete");
    expect(result.rates).toEqual({
      inputTextUsdPer1M: 5,
      outputTextUsdPer1M: 30,
      cachedTextUsdPer1M: 0.5,
    });
    expect(result.pricingVersion).toBe(VERSION);
  });

  it("code_default é tratado como ausente no caminho dedicado", async () => {
    mockGetModelPricing.mockResolvedValue({
      pricing: { inputCostUsd: 5, outputCostUsd: 30, cachedInputCostUsd: 0.5 },
      versionId: "code_default",
    });

    const result = await getVisualSignatureOrchestratorPricing({
      provider: "openai",
      model: "gpt-5.5",
    });

    expect(result.status).toBe("missing");
    expect(result.rates).toEqual({});
    expect(result.pricingVersion).toBeNull();
    expect(result.missingRates.length).toBeGreaterThan(0);
  });

  it("linha ausente → missing, sem usar tarifa de imagem", async () => {
    mockGetModelPricing.mockResolvedValue(null);

    const result = await getVisualSignatureOrchestratorPricing({
      provider: "openai",
      model: "gpt-6-luna",
    });

    expect(result.status).toBe("missing");
    expect(result.rates).toEqual({});
    expect(result.missingRates).toEqual(
      expect.arrayContaining([
        "orchestrator.inputTextUsdPer1M",
        "orchestrator.outputTextUsdPer1M",
      ]),
    );
  });
});
