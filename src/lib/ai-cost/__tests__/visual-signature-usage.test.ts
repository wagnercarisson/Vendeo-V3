// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  computeVisualSignatureCost,
  normalizeVisualSignatureUsage,
  type VisualSignatureRates,
} from "../visual-signature-usage";

const RATES: VisualSignatureRates = {
  inputTextUsdPer1M: 5,
  cachedTextUsdPer1M: 0.5,
  inputImageUsdPer1M: 8,
  cachedImageUsdPer1M: 1,
  outputTextUsdPer1M: 30,
  outputImageUsdPer1M: 30,
};

describe("F47.1 — normalização de usage", () => {
  it("reasoning é subconjunto do output e não é somado novamente", () => {
    const normalized = normalizeVisualSignatureUsage({
      promptTokens: 1000,
      completionTokens: 1000,
      reasoningTokens: 400,
    });
    expect(normalized.reasoningTokens).toBe(400);
    expect(normalized.reasoningExcludedFromOutput).toBe(false);
    expect(normalized.outputTokens).toBe(1000);
  });

  it("cache é subconjunto do input e não é somado novamente", () => {
    const normalized = normalizeVisualSignatureUsage({
      promptTokens: 1000,
      cachedInputTokens: 200,
    });
    expect(normalized.cachedInputTokens).toBe(200);
    expect(normalized.inputTokens).toBe(1000);
  });

  it("breakdown com soma maior que o total é marcado inconsistente e descartado", () => {
    const normalized = normalizeVisualSignatureUsage({
      promptTokens: 1000,
      completionTokens: 500,
      inputTextTokens: 900,
      inputImageTokens: 200,
      outputTextTokens: 300,
      outputImageTokens: 200,
    });
    expect(normalized.inputBreakdown).toBe("inconsistent");
    expect(normalized.inputTextTokens).toBeUndefined();
    expect(normalized.inputImageTokens).toBeUndefined();
    expect(normalized.notes).toContain("input_breakdown_inconsistent");
  });

  it("output ausente com breakdown não inventa total", () => {
    const normalized = normalizeVisualSignatureUsage({
      promptTokens: 1000,
      outputTextTokens: 300,
      outputImageTokens: 200,
    });
    expect(normalized.outputBreakdown).toBe("incomplete");
    expect(normalized.notes).toContain("output_total_missing");
  });
});

describe("F47.1 — fórmula A (breakdown completo)", () => {
  const usage = {
    promptTokens: 1000,
    completionTokens: 500,
    cachedInputTokens: 200,
    inputTextTokens: 800,
    inputImageTokens: 200,
    cachedTextTokens: 100,
    cachedImageTokens: 100,
    outputTextTokens: 300,
    outputImageTokens: 200,
    reasoningTokens: 100,
  };

  it("precifica texto e imagem uma única vez, sem dupla contagem de cache/reasoning", () => {
    const result = computeVisualSignatureCost({ usage, rates: RATES });

    expect(result.formula).toBe("A");
    expect(result.costCoverage).toBe("complete");
    expect(result.costSource).toBe("pricing_table");
    expect(result.estimatedCostUsd).toBeCloseTo(0.01945, 8);
    expect(result.components.input_text).toEqual({ tokens: 700, usd: 0.0035 });
    expect(result.components.cached_text).toEqual({ tokens: 100, usd: 0.00005 });
    expect(result.components.input_image).toEqual({ tokens: 100, usd: 0.0008 });
    expect(result.components.cached_image).toEqual({ tokens: 100, usd: 0.0001 });
    expect(result.components.output_text).toEqual({ tokens: 300, usd: 0.009 });
    expect(result.components.output_image).toEqual({ tokens: 200, usd: 0.006 });
    // Reasoning já está nos 500 de output — nenhum componente separado.
    expect(result.components.reasoning).toBeUndefined();
  });
});

describe("F47.1 — fórmulas B/C/E", () => {
  it("apenas totais: precifica uma vez e marca cobertura parcial (imagem não comprovada)", () => {
    const result = computeVisualSignatureCost({
      usage: { promptTokens: 1000, completionTokens: 500, cachedInputTokens: 200 },
      rates: RATES,
    });

    expect(result.formula).toBe("B");
    expect(result.costCoverage).toBe("partial");
    expect(result.costEstimationNote).toContain("image_inclusion_unproven");
    expect(result.estimatedCostUsd).toBeCloseTo(0.0191, 8);
  });

  it("cache sem atribuição não é precificado como input normal", () => {
    const result = computeVisualSignatureCost({
      usage: {
        promptTokens: 1000,
        completionTokens: 500,
        cachedInputTokens: 200,
        inputTextTokens: 800,
        inputImageTokens: 200,
        outputTextTokens: 300,
        outputImageTokens: 200,
      },
      rates: RATES,
    });

    expect(result.formula).toBe("E");
    expect(result.costCoverage).toBe("partial");
    expect(result.costEstimationNote).toContain("cache_attribution_missing");
    expect(result.components.cached_text?.tokens).toBe(200);
    expect(result.components.input_text?.tokens).toBe(600);
  });

  it("reasoning fora do output é precificado uma única vez", () => {
    const result = computeVisualSignatureCost({
      usage: {
        promptTokens: 1000,
        completionTokens: 500,
        reasoningTokens: 100,
        reasoningExcludedFromOutput: true,
      },
      rates: RATES,
    });

    expect(result.components.output_text?.tokens).toBe(500);
    expect(result.components.reasoning?.tokens).toBe(100);
    expect(result.estimatedCostUsd).toBeCloseTo(0.023, 8);
  });

  it("tarifa de imagem ausente → parcial, sem unitário histórico por cima", () => {
    const result = computeVisualSignatureCost({
      usage: {
        promptTokens: 1000,
        completionTokens: 500,
        inputTextTokens: 800,
        inputImageTokens: 200,
        outputTextTokens: 300,
        outputImageTokens: 200,
      },
      rates: { ...RATES, inputImageUsdPer1M: undefined, outputImageUsdPer1M: undefined },
    });

    expect(result.costCoverage).toBe("partial");
    expect(result.missingRates).toEqual(
      expect.arrayContaining(["inputImageUsdPer1M", "outputImageUsdPer1M"]),
    );
    expect(result.costEstimationNote).toContain("missing_rates=");
  });

  it("sem usage: referência histórica só na nota, custo null e not_available", () => {
    const result = computeVisualSignatureCost({
      usage: undefined,
      rates: {},
      historicalEstimateUsd: 0.036,
      historicalEstimateSource: "local_historical_images",
      preset: "flare_low",
    });

    expect(result.estimatedCostUsd).toBeNull();
    expect(result.costSource).toBe("not_available");
    expect(result.costCoverage).toBe("partial");
    expect(result.costEstimationNote).toContain("visual_signature_image_estimate_no_usage");
    expect(result.costEstimationNote).toContain("historical_reference_usd=0.036");
  });

  it("custo reportado permanece separado da estimativa", () => {
    const result = computeVisualSignatureCost({
      usage: { promptTokens: 1000, completionTokens: 500 },
      rates: RATES,
      providerReportedCostUsd: 0.02,
    });

    expect(result.providerReportedCostUsd).toBe(0.02);
    expect(result.costSource).toBe("provider_reported");
    expect(result.estimatedCostUsd).toBeCloseTo(0.02, 8);
    expect(result.costEstimationNote).toContain("provider_reported_separate");
  });

  it("tool usage separado é precificado uma vez e não entra no texto do orquestrador", () => {
    const result = computeVisualSignatureCost({
      usage: { promptTokens: 1000, completionTokens: 500 },
      rates: RATES,
      imageToolUsage: { outputImageTokens: 1000 },
    });

    expect(result.formula).toBe("C");
    expect(result.costCoverage).toBe("complete");
    expect(result.components.tool_output_image?.tokens).toBe(1000);
    expect(result.components.tool_output_image?.usd).toBe(0.03);
    expect(result.components.output_text?.tokens).toBe(500);
  });

  it("tool usage e imagem no orquestrador: não combina as duas fontes", () => {
    const result = computeVisualSignatureCost({
      usage: {
        promptTokens: 1000,
        completionTokens: 500,
        outputTextTokens: 300,
        outputImageTokens: 200,
      },
      rates: RATES,
      imageToolUsage: { outputImageTokens: 1000 },
    });

    expect(result.components.tool_output_image).toBeUndefined();
    expect(result.costCoverage).toBe("partial");
    expect(result.costEstimationNote).toContain(
      "tool_usage_ambiguous_with_orchestrator_image_tokens",
    );
  });
});
