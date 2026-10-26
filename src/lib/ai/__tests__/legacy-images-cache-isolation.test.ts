import { describe, expect, it, vi } from "vitest";

const { mockGetModelPricing } = vi.hoisted(() => ({
  mockGetModelPricing: vi.fn(),
}));

vi.mock("@/lib/ai-cost/ai-model-pricing", () => ({
  getModelPricing: mockGetModelPricing,
}));

import { resolveAiCost } from "@/lib/ai-cost/cost-estimator";
import {
  normalizeImagesUsage,
  normalizeUpstreamImagesUsage,
} from "@/lib/ai/adapters/images";
import { calculateProductOneToOneImageUsageCost } from "@/lib/ai-cost/image-usage-token-cost";

const RAW_IMAGES_USAGE = {
  input_tokens: 1000,
  output_tokens: 50,
  total_tokens: 1050,
  input_tokens_details: {
    text_tokens: 400,
    image_tokens: 600,
    // Cache agregado (sem split textual/imagem): o legado NÃO lê; o Produto 1:1
    // lê e classifica como ambíguo, sem inferir a modalidade.
    cached_tokens: 300,
  },
  output_tokens_details: { image_tokens: 50 },
};

const PRICING = {
  inputCostUsd: 5,
  cachedInputCostUsd: 1.25,
  outputCostUsd: 10,
  imageInputTokenUsdPer1M: 8,
  imageCachedInputTokenUsdPer1M: 2,
  imageTokenUsdPer1M: 30,
};

describe("isolamento do cache de Images API — legado × Produto 1:1", () => {
  it("mesma resposta crua: legado ignora cache e mantém US$ 0,021500", async () => {
    mockGetModelPricing.mockResolvedValue({
      pricing: PRICING,
      versionId: "pricing-1",
    });

    const legacyUsage = normalizeImagesUsage(RAW_IMAGES_USAGE);
    expect(legacyUsage).toMatchObject({
      inputTextTokens: 400,
      inputImageTokens: 600,
      outputImageTokens: 50,
    });
    expect(legacyUsage?.cachedInputTokens).toBeUndefined();
    expect(legacyUsage?.cachedInputTextTokens).toBeUndefined();
    expect(legacyUsage?.cachedInputImageTokens).toBeUndefined();

    const legacyCost = await resolveAiCost({
      provider: "openai",
      model: "gpt-image-2.5-sunburst",
      usage: legacyUsage,
      generationType: "campaign_image",
    });

    // 400×5 + 600×30 + 50×30 = 0,021500 (sem cache).
    expect(legacyCost.estimatedCostUsd).toBe(0.0215);
    expect(legacyCost.costSource).toBe("pricing_table");
  });

  it("mesma resposta crua: Produto 1:1 lê o cache agregado e o trata como ambíguo", () => {
    const upstreamUsage = normalizeUpstreamImagesUsage(RAW_IMAGES_USAGE);

    expect(upstreamUsage).toMatchObject({
      cachedInputTokens: 300,
      inputTextTokens: 400,
      inputImageTokens: 600,
      outputImageTokens: 50,
    });
    expect(upstreamUsage?.cachedInputTextTokens).toBeUndefined();
    expect(upstreamUsage?.cachedInputImageTokens).toBeUndefined();

    const cost = calculateProductOneToOneImageUsageCost({
      usage: upstreamUsage,
      pricing: PRICING,
      pricingVersion: "pricing-1",
      pricingSource: "pricing_table",
      model: "gpt-image-2.5-sunburst",
      quality: "medium",
    });

    // Cache total sem split não é rateado por inferência: indisponível, não 0,021875.
    expect(cost.estimatedCostUsd).toBeNull();
    expect(cost.costSource).toBe("not_available");
    expect(cost.productOneToOneImageUsage.cacheMode).toBe("ambiguous");
    expect(cost.productOneToOneImageUsage.missing).toContain(
      "cache_modality_ambiguous",
    );
  });

  it("Produto 1:1 usa cache quando o split é explícito (sem alterar o legado)", () => {
    const splitRaw = {
      ...RAW_IMAGES_USAGE,
      input_tokens_details: {
        text_tokens: 400,
        image_tokens: 600,
        cached_tokens: 300,
        cached_text_tokens: 100,
        cached_image_tokens: 200,
      },
    };
    const upstreamUsage = normalizeUpstreamImagesUsage(splitRaw);

    const cost = calculateProductOneToOneImageUsageCost({
      usage: upstreamUsage,
      pricing: PRICING,
      pricingVersion: "pricing-1",
      pricingSource: "pricing_table",
      model: "gpt-image-2.5-sunburst",
      quality: "medium",
    });

    // texto: 300×5 + 100×1,25 = 0,001625
    // imagem: 400×8 + 200×2 + 50×30 = 0,0051
    expect(cost.estimatedCostUsd).toBe(0.006725);
    expect(cost.productOneToOneImageUsage.cacheMode).toBe("explicit");

    // O legado continua sem ler nenhum campo de cache.
    const legacyUsage = normalizeImagesUsage(splitRaw);
    expect(legacyUsage?.cachedInputTokens).toBeUndefined();
    expect(legacyUsage?.cachedInputTextTokens).toBeUndefined();
    expect(legacyUsage?.cachedInputImageTokens).toBeUndefined();
  });
});
