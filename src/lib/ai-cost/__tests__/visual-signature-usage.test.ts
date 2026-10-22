// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  computeVisualSignatureCost,
  normalizeVisualSignatureUsage,
  type VisualSignatureImageRates,
  type VisualSignatureOrchestratorRates,
} from "../visual-signature-usage";

const ORCHESTRATOR: VisualSignatureOrchestratorRates = {
  inputTextUsdPer1M: 5,
  cachedTextUsdPer1M: 0.5,
  outputTextUsdPer1M: 30,
};

// Tarifas explícitas por direção para provar a fórmula A. Em produção, uma
// única tarifa de imagem só é usada quando a direção é inequívoca.
const IMAGE: VisualSignatureImageRates = {
  inputImageUsdPer1M: 8,
  outputImageUsdPer1M: 30,
  cachedImageUsdPer1M: 1,
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

  it("breakdown com soma maior que o total é inconsistente e descartado", () => {
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
    expect(normalized.inconsistent).toBe(true);
  });

  it("reasoning maior que output e cache de imagem maior que input de imagem são inconsistentes", () => {
    const reasoning = normalizeVisualSignatureUsage({
      promptTokens: 10,
      completionTokens: 10,
      reasoningTokens: 20,
    });
    expect(reasoning.inconsistent).toBe(true);
    expect(reasoning.notes).toContain("reasoning_exceeds_output");

    const cache = normalizeVisualSignatureUsage({
      promptTokens: 100,
      completionTokens: 10,
      inputTextTokens: 90,
      inputImageTokens: 10,
      cachedTextTokens: 20,
      cachedImageTokens: 80,
    });
    expect(cache.inconsistent).toBe(true);
    expect(cache.notes).toContain("cached_image_exceeds_input_image");
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
    const result = computeVisualSignatureCost({
      usage,
      orchestratorRates: ORCHESTRATOR,
      imageRates: IMAGE,
    });

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
    expect(result.components.reasoning).toBeUndefined();
  });

  it("tarifas do orquestrador e da imagem são independentes", () => {
    const cheap = computeVisualSignatureCost({
      usage,
      orchestratorRates: ORCHESTRATOR,
      imageRates: IMAGE,
    });
    const expensiveOrchestrator = computeVisualSignatureCost({
      usage,
      orchestratorRates: {
        ...ORCHESTRATOR,
        inputTextUsdPer1M: 50,
        outputTextUsdPer1M: 300,
      },
      imageRates: IMAGE,
    });

    expect(expensiveOrchestrator.estimatedCostUsd).toBeGreaterThan(
      cheap.estimatedCostUsd ?? 0,
    );
    expect(expensiveOrchestrator.components.output_image?.usd).toBe(
      cheap.components.output_image?.usd,
    );
  });

  it("tarifa única de imagem não é reutilizada para entrada E saída", () => {
    const result = computeVisualSignatureCost({
      usage,
      orchestratorRates: ORCHESTRATOR,
      imageRates: { imageTokenUsdPer1M: 8 },
    });

    expect(result.costCoverage).toBe("partial");
    expect(result.costEstimationNote).toContain("image_rate_direction_unproven");
    expect(result.components.input_image?.usd).toBeNull();
    expect(result.components.output_image?.usd).toBeNull();
  });
});

describe("F47.1 — fórmulas B/C/E", () => {
  it("apenas totais: precifica uma vez e marca cobertura parcial (imagem não comprovada)", () => {
    const result = computeVisualSignatureCost({
      usage: { promptTokens: 1000, completionTokens: 500, cachedInputTokens: 200 },
      orchestratorRates: ORCHESTRATOR,
      imageRates: IMAGE,
    });

    expect(result.formula).toBe("B");
    expect(result.costCoverage).toBe("partial");
    expect(result.costEstimationNote).toContain("image_inclusion_unproven");
    expect(result.estimatedCostUsd).toBeCloseTo(0.0191, 8);
  });

  it("cache sem atribuição não é distribuído para texto nem precificado como input normal", () => {
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
      orchestratorRates: ORCHESTRATOR,
      imageRates: IMAGE,
    });

    expect(result.formula).toBe("E");
    expect(result.costCoverage).toBe("partial");
    expect(result.costEstimationNote).toContain("cache_attribution_missing");
    expect(result.components.input_text).toBeUndefined();
    expect(result.components.cached_text).toBeUndefined();
    expect(result.components.input_image).toBeUndefined();
    // Apenas a saída confirmada (300*30 + 200*30 = 0.015).
    expect(result.estimatedCostUsd).toBeCloseTo(0.015, 8);
  });

  it("reasoning fora do output é precificado uma única vez", () => {
    const result = computeVisualSignatureCost({
      usage: {
        promptTokens: 1000,
        completionTokens: 500,
        reasoningTokens: 100,
        reasoningExcludedFromOutput: true,
      },
      orchestratorRates: ORCHESTRATOR,
      imageRates: IMAGE,
    });

    expect(result.components.output_text?.tokens).toBe(500);
    expect(result.components.reasoning?.tokens).toBe(100);
    expect(result.estimatedCostUsd).toBeCloseTo(0.023, 8);
  });

  it("inconsistência de reasoning impede cobertura complete", () => {
    const result = computeVisualSignatureCost({
      usage: {
        promptTokens: 100,
        completionTokens: 10,
        inputTextTokens: 90,
        inputImageTokens: 10,
        outputTextTokens: 10,
        outputImageTokens: 0,
        reasoningTokens: 20,
      },
      orchestratorRates: ORCHESTRATOR,
      imageRates: IMAGE,
    });

    expect(result.costCoverage).toBe("partial");
    expect(result.costEstimationNote).toContain("usage_inconsistent_coverage_not_complete");
  });

  it("cache de imagem maior que input de imagem impede cobertura complete", () => {
    const result = computeVisualSignatureCost({
      usage: {
        promptTokens: 100,
        completionTokens: 10,
        cachedInputTokens: 100,
        inputTextTokens: 90,
        inputImageTokens: 10,
        cachedTextTokens: 20,
        cachedImageTokens: 80,
        outputTextTokens: 10,
        outputImageTokens: 0,
      },
      orchestratorRates: ORCHESTRATOR,
      imageRates: IMAGE,
    });

    expect(result.costCoverage).toBe("partial");
    expect(result.costEstimationNote).toContain("usage_inconsistent_coverage_not_complete");
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
      orchestratorRates: ORCHESTRATOR,
      imageRates: {},
    });

    expect(result.costCoverage).toBe("partial");
    expect(result.missingRates).toEqual(
      expect.arrayContaining(["image.inputImageUsdPer1M", "image.outputImageUsdPer1M"]),
    );
  });

  it("sem usage: referência histórica só na nota, custo null e not_available", () => {
    const result = computeVisualSignatureCost({
      usage: undefined,
      orchestratorRates: {},
      imageRates: {},
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
      orchestratorRates: ORCHESTRATOR,
      imageRates: IMAGE,
      providerReportedCostUsd: 0.02,
    });

    expect(result.providerReportedCostUsd).toBe(0.02);
    expect(result.costSource).toBe("provider_reported");
    expect(result.estimatedCostUsd).toBeCloseTo(0.02, 8);
    expect(result.costEstimationNote).toContain("provider_reported_separate");
  });

  it("tool usando total + imagem sem texto não conta a imagem como texto", () => {
    const result = computeVisualSignatureCost({
      usage: undefined,
      orchestratorRates: ORCHESTRATOR,
      imageRates: { imageTokenUsdPer1M: 30 },
      imageToolUsage: { completionTokens: 1000, outputImageTokens: 196 },
    });

    expect(result.formula).toBe("C");
    expect(result.costCoverage).toBe("complete");
    // Texto derivado = 1000 - 196 = 804; imagem = 196. Total = 0.03.
    expect(result.components.tool_output_text?.tokens).toBe(804);
    expect(result.components.tool_output_image?.tokens).toBe(196);
    expect(result.estimatedCostUsd).toBeCloseTo(0.03, 8);
  });

  it("tool com usage principal presente não é somado (exclusão não comprovada)", () => {
    const result = computeVisualSignatureCost({
      usage: { promptTokens: 1000, completionTokens: 500 },
      orchestratorRates: ORCHESTRATOR,
      imageRates: IMAGE,
      imageToolUsage: { outputImageTokens: 1000 },
    });

    expect(result.components.tool_output_image).toBeUndefined();
    expect(result.costCoverage).toBe("partial");
    expect(result.costEstimationNote).toContain("tool_usage_overlap_unproven");
  });
});
