import { describe, expect, it } from "vitest";
import {
  calculateProductOneToOneImageUsageCost,
  PRODUCT_1_1_IMAGE_USAGE_COMPLETE_NOTE,
  PRODUCT_1_1_IMAGE_USAGE_FORMULA_VERSION,
  PRODUCT_1_1_IMAGE_USAGE_PARTIAL_NOTE,
} from "../image-usage-token-cost";
import type { UsageTokenPricing } from "../types";

const PRICING: UsageTokenPricing = {
  inputCostUsd: 5,
  cachedInputCostUsd: 1.25,
  outputCostUsd: 10,
  imageInputTokenUsdPer1M: 8,
  imageCachedInputTokenUsdPer1M: 2,
  imageTokenUsdPer1M: 30,
};

const BASE = {
  pricing: PRICING,
  pricingVersion: "pricing-ver-1",
  pricingSource: "pricing_table",
  model: "gpt-image-2.5-sunburst",
  quality: "medium",
};

describe("calculateProductOneToOneImageUsageCost — tokens reais × tarifas", () => {
  it("exemplo aprovado: 464 texto + 1784 imagem + 439 saída = US$ 0,029762", () => {
    const result = calculateProductOneToOneImageUsageCost({
      ...BASE,
      usage: {
        inputTextTokens: 464,
        inputImageTokens: 1784,
        outputImageTokens: 439,
      },
    });

    expect(result.estimatedCostUsd).toBe(0.029762);
    expect(result.textComponentUsd).toBe(0.00232);
    expect(result.imageToolComponentUsd).toBe(0.027442);
    expect(result.costSource).toBe("pricing_table");
    expect(result.pricingVersion).toBe("pricing-ver-1");
    expect(result.costFormulaVersion).toBe(PRODUCT_1_1_IMAGE_USAGE_FORMULA_VERSION);
    expect(result.costEstimationNote).toBe(PRODUCT_1_1_IMAGE_USAGE_COMPLETE_NOTE);
    expect(result.providerReportedCostUsd).toBeUndefined();
    expect(result.productOneToOneImageUsage).toMatchObject({
      origin: "usage_tokens",
      model: "gpt-image-2.5-sunburst",
      quality: "medium",
      inputTextTokens: 464,
      inputImageTokens: 1784,
      outputImageTokens: 439,
      coverage: "complete",
      missing: [],
      cacheMode: "none",
      usageBreakdown: "detailed",
    });
  });

  it("cache explícito é descontado da entrada normal (sem dupla contagem)", () => {
    const result = calculateProductOneToOneImageUsageCost({
      ...BASE,
      usage: {
        inputTextTokens: 1000,
        cachedInputTextTokens: 200,
        inputImageTokens: 2000,
        cachedInputImageTokens: 500,
        outputImageTokens: 500,
      },
    });

    // texto: 800×5 + 200×1,25 = 0,00425
    // imagem: 1500×8 + 500×2 + 500×30 = 0,028
    expect(result.textComponentUsd).toBe(0.00425);
    expect(result.imageToolComponentUsd).toBe(0.028);
    expect(result.estimatedCostUsd).toBe(0.03225);
    expect(result.productOneToOneImageUsage.cacheMode).toBe("explicit");
  });

  it("cache textual agregado sem modalidade NÃO é inferido", () => {
    const result = calculateProductOneToOneImageUsageCost({
      ...BASE,
      usage: {
        inputTextTokens: 1000,
        inputImageTokens: 2000,
        outputImageTokens: 500,
        cachedInputTokens: 200,
      },
    });

    expect(result.estimatedCostUsd).toBeNull();
    expect(result.costSource).toBe("not_available");
    expect(result.costEstimationNote).toBe(PRODUCT_1_1_IMAGE_USAGE_PARTIAL_NOTE);
    expect(result.productOneToOneImageUsage.cacheMode).toBe("ambiguous");
    expect(result.productOneToOneImageUsage.missing).toContain(
      "cache_modality_ambiguous",
    );
  });

  it("apenas uma modalidade de cache explícita → parcial (não assume zero na outra)", () => {
    const result = calculateProductOneToOneImageUsageCost({
      ...BASE,
      usage: {
        inputTextTokens: 1000,
        cachedInputTextTokens: 200,
        inputImageTokens: 2000,
        outputImageTokens: 500,
      },
    });

    expect(result.estimatedCostUsd).toBeNull();
    expect(result.productOneToOneImageUsage.cacheMode).toBe("ambiguous");
    expect(result.productOneToOneImageUsage.missing).toContain(
      "cache_modality_ambiguous",
    );
  });

  it("zero explícito é válido e calcula US$ 0", () => {
    const result = calculateProductOneToOneImageUsageCost({
      ...BASE,
      usage: {
        inputTextTokens: 0,
        inputImageTokens: 0,
        outputImageTokens: 0,
      },
    });

    expect(result.estimatedCostUsd).toBe(0);
    expect(result.costSource).toBe("pricing_table");
    expect(result.productOneToOneImageUsage.coverage).toBe("complete");
  });

  it("usage ausente → custo indisponível (não usa image_unit)", () => {
    const result = calculateProductOneToOneImageUsageCost({
      ...BASE,
      usage: undefined,
    });

    expect(result.estimatedCostUsd).toBeNull();
    expect(result.costSource).toBe("not_available");
    expect(result.imageToolComponentUsd).toBeUndefined();
    expect(result.productOneToOneImageUsage.missing).toContain("usage");
    expect(result.productOneToOneImageUsage.usageBreakdown).toBe("absent");
  });

  it("breakdown agregado/incompleto não é separado por inferência", () => {
    const result = calculateProductOneToOneImageUsageCost({
      ...BASE,
      usage: { promptTokens: 1000, completionTokens: 100 },
    });

    expect(result.estimatedCostUsd).toBeNull();
    expect(result.productOneToOneImageUsage.usageBreakdown).toBe("aggregate");
    expect(result.productOneToOneImageUsage.missing).toContain(
      "input_image_tokens",
    );
    expect(result.productOneToOneImageUsage.missing).toContain(
      "output_image_tokens",
    );
  });

  it("tarifa de entrada de imagem ausente → parcial, sem zero artificial", () => {
    const result = calculateProductOneToOneImageUsageCost({
      ...BASE,
      pricing: { ...PRICING, imageInputTokenUsdPer1M: undefined },
      usage: {
        inputTextTokens: 464,
        inputImageTokens: 1784,
        outputImageTokens: 439,
      },
    });

    expect(result.estimatedCostUsd).toBeNull();
    expect(result.imageToolComponentUsd).toBeUndefined();
    expect(result.productOneToOneImageUsage.missing).toContain("image_input_rate");
  });

  it("saída textual reportada usa sua própria tarifa; sem tarifa → parcial", () => {
    const withRate = calculateProductOneToOneImageUsageCost({
      ...BASE,
      usage: {
        inputTextTokens: 1000,
        outputTextTokens: 100,
        inputImageTokens: 1000,
        outputImageTokens: 100,
      },
    });
    // texto: 1000×5 + 100×10 = 0,006
    expect(withRate.textComponentUsd).toBe(0.006);

    const withoutRate = calculateProductOneToOneImageUsageCost({
      ...BASE,
      pricing: { ...PRICING, outputCostUsd: undefined },
      usage: {
        inputTextTokens: 1000,
        outputTextTokens: 100,
        inputImageTokens: 1000,
        outputImageTokens: 100,
      },
    });
    expect(withoutRate.estimatedCostUsd).toBeNull();
    expect(withoutRate.productOneToOneImageUsage.missing).toContain(
      "text_output_rate",
    );
  });

  it("code_default não é aceito como tarifa tabelada", () => {
    const result = calculateProductOneToOneImageUsageCost({
      ...BASE,
      pricingSource: "code_default",
      usage: {
        inputTextTokens: 464,
        inputImageTokens: 1784,
        outputImageTokens: 439,
      },
    });

    expect(result.estimatedCostUsd).toBeNull();
    expect(result.costSource).toBe("not_available");
    expect(result.productOneToOneImageUsage.missing).toContain(
      "pricing_code_default",
    );
  });

  it("image_unit_usd do pré-chamada não é usado no pós-chamada", () => {
    const result = calculateProductOneToOneImageUsageCost({
      ...BASE,
      pricing: { ...PRICING, imageUnitCostUsd: 0.041 },
      usage: {
        inputTextTokens: 464,
        inputImageTokens: 1784,
        outputImageTokens: 439,
      },
    });

    expect(result.estimatedCostUsd).toBe(0.029762);
    expect(result.estimatedCostUsd).not.toBe(0.041);
  });
});
