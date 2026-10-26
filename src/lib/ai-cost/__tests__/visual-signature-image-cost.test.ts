import { describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://localhost:54321";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
});

import { calculateVisualSignatureImageCost } from "../visual-signature-image-cost";
import { getVisualSignatureImageUsageEstimate } from "../visual-signature-image-usage";
import type { TokenUsage } from "../types";
import type { ModelPricing } from "../ai-model-pricing";

const ORCHESTRATOR_PRICING: ModelPricing = {
  inputCostUsd: 5,
  outputCostUsd: 30,
  cachedInputCostUsd: 0.5,
};

/** Fixtures de conferência: entrada textual US$5/M e imagem US$30/M. */
const IMAGE_PRICING: ModelPricing = {
  inputCostUsd: 5,
  outputCostUsd: 30,
  imageTokenUsdPer1M: 30,
};

const USAGE: TokenUsage = {
  inputTextTokens: 1000,
  outputTextTokens: 100,
  // Tokens REAIS de imagem do provider: NÃO entram no componente textual.
  outputImageTokens: 123,
};

const VERSIONS = { orchestrator: "orch-pricing-v1", image: "image-pricing-v1" };

const CASES = [
  ["gpt-image-2.5-flare", "low", 0.00925],
  ["gpt-image-2.5-flare", "medium", 0.01675],
  ["gpt-image-2.5-sunburst", "low", 0.0095],
  ["gpt-image-2.5-sunburst", "medium", 0.017],
] as const;

function calculate(
  overrides: Partial<Parameters<typeof calculateVisualSignatureImageCost>[0]> = {},
) {
  const target = overrides.target ?? {
    imageModel: "gpt-image-2.5-flare",
    imageQuality: "low",
    size: "1024x1024",
    configVersionId: "cfg-v1",
  };

  return calculateVisualSignatureImageCost({
    provider: "openai",
    target,
    estimate: getVisualSignatureImageUsageEstimate(target),
    orchestratorPricing: ORCHESTRATOR_PRICING,
    imagePricing: IMAGE_PRICING,
    usage: USAGE,
    pricingVersions: VERSIONS,
    imageGenerated: true,
    ...overrides,
  });
}

describe("calculateVisualSignatureImageCost — vs-image-usage-v1 × ai_model_pricing", () => {
  it.each(CASES)(
    "%s/%s → componente de imagem US$ %f (fixtures 5/M texto + 30/M imagem)",
    (imageModel, imageQuality, expectedImageComponent) => {
      const result = calculate({
        target: {
          imageModel,
          imageQuality,
          size: "1024x1024",
          configVersionId: "cfg-v1",
        },
      });

      expect(result.visualSignatureImageUsage.imageComponentUsd).toBe(
        expectedImageComponent,
      );
      expect(result.imageToolComponentUsd).toBe(expectedImageComponent);
      expect(result.textComponentUsd).toBe(0.008);
      expect(result.estimatedCostUsd).toBe(
        Number((expectedImageComponent + 0.008).toFixed(6)),
      );
      expect(result.costSource).toBe("pricing_table");
      expect(result.visualSignatureImageUsage.coverage).toBe("complete");
    },
  );

  it("usa input_token_usd_per_1m para a entrada TEXTUAL e image_token_usd_per_1m para a saída de IMAGEM", () => {
    const result = calculate({
      imagePricing: { inputCostUsd: 8, outputCostUsd: 30, imageTokenUsdPer1M: 30 },
    });

    // 350 * 8/M + 250 * 30/M — NÃO usa image_token para a entrada nem
    // output_token (texto) para a saída de imagem.
    expect(result.visualSignatureImageUsage.imageComponentUsd).toBe(0.0103);
    expect(result.visualSignatureImageUsage.imageInputTextUsdPer1M).toBe(8);
    expect(result.visualSignatureImageUsage.imageOutputImageUsdPer1M).toBe(30);
  });

  it("NÃO soma o componente genérico de US$ 0,065 nem usa provider_reported", () => {
    const result = calculate();

    expect(result.estimatedCostUsd).toBe(0.01725);
    expect(result.estimatedCostUsd).not.toBe(0.065);
    expect(result.providerReportedCostUsd).toBeUndefined();
  });

  it("cache não é contado duas vezes: desconta cached da entrada normal e cobra só a tarifa de cache", () => {
    const result = calculate({
      usage: {
        inputTextTokens: 1000,
        cachedInputTokens: 200,
        outputTextTokens: 100,
        outputImageTokens: 123,
      },
    });

    // (800 × 5 + 200 × 0,5 + 100 × 30) / 1M = 0,0071
    expect(result.textComponentUsd).toBe(0.0071);
    // Não é o valor com dupla contagem (1000 × 5 + 200 × 0,5 + 100 × 30 = 0,0081).
    expect(result.textComponentUsd).not.toBe(0.0081);
    expect(result.estimatedCostUsd).toBe(0.01635);
  });

  it("usage só com entrada NÃO vira saída zero: saída ausente é desconhecida", () => {
    const result = calculate({ usage: { inputTextTokens: 1000 } });

    expect(result.textComponentUsd).toBeUndefined();
    expect(result.estimatedCostUsd).toBeNull();
    expect(result.visualSignatureImageUsage.missing).toContain(
      "orchestrator_output_usage",
    );
    expect(result.visualSignatureImageUsage.coverage).toBe("partial");
  });

  it("saída explicitamente zero é zero reportado (não ausência) e mantém cobertura completa", () => {
    const result = calculate({
      usage: { inputTextTokens: 1000, outputTextTokens: 0 },
    });

    expect(result.textComponentUsd).toBe(0.005);
    expect(result.estimatedCostUsd).toBe(0.01425);
    expect(result.visualSignatureImageUsage.coverage).toBe("complete");
    expect(result.visualSignatureImageUsage.missing).toEqual([]);
  });

  it("usage agregado só com prompt também não completa a saída", () => {
    const result = calculate({ usage: { promptTokens: 1000 } });

    expect(result.textComponentUsd).toBeUndefined();
    expect(result.visualSignatureImageUsage.missing).toContain(
      "orchestrator_output_usage",
    );
  });

  it("usage só com saída também não completa: entrada ausente é desconhecida", () => {
    const result = calculate({ usage: { completionTokens: 100 } });

    expect(result.textComponentUsd).toBeUndefined();
    expect(result.visualSignatureImageUsage.missing).toContain(
      "orchestrator_input_usage",
    );
    expect(result.visualSignatureImageUsage.coverage).toBe("partial");
  });

  it("usage agregado completo (prompt+completion, sem breakdown de imagem) é aceito como orquestrador", () => {
    const result = calculate({
      usage: { promptTokens: 1000, completionTokens: 100 },
    });

    expect(result.textComponentUsd).toBe(0.008);
    expect(result.estimatedCostUsd).toBe(0.01725);
    expect(result.visualSignatureImageUsage.coverage).toBe("complete");
    expect(result.visualSignatureImageUsage.missing).toEqual([]);
    expect(result.visualSignatureImageUsage.usageBreakdown).toBe("aggregate");
  });

  it("preserva o snapshot/versionamento dos parâmetros usados", () => {
    const result = calculate();
    const audit = result.visualSignatureImageUsage;

    expect(audit).toMatchObject({
      origin: "manual_observation_openai_platform_with_rounding_and_margin",
      estimated: true,
      estimateVersion: "vs-image-usage-v1",
      approvedAt: "2026-10-26",
      model: "gpt-image-2.5-flare",
      quality: "low",
      size: "1024x1024",
      configVersionId: "cfg-v1",
      inputTextTokens: 350,
      outputImageTokens: 250,
      imagePricingVersion: "image-pricing-v1",
      orchestratorPricingVersion: "orch-pricing-v1",
      coverage: "complete",
      missing: [],
      usageBreakdown: "detailed",
    });
    expect(result.costFormulaVersion).toBe(
      "visual_signature_image_usage_estimate_v1",
    );
    expect(result.costEstimationNote).toBe(
      "visual_signature_image_usage_estimated_vs-image-usage-v1",
    );
    expect(result.pricingVersion).toBe("orch-pricing-v1");
  });

  it("combinação/tamanho não coberto → desconhecido, sem herdar outra estimativa", () => {
    const result = calculate({
      target: {
        imageModel: "gpt-image-2.5-flare",
        imageQuality: "high",
        size: "1024x1024",
      },
      estimate: null,
    });

    expect(result.estimatedCostUsd).toBeNull();
    expect(result.costSource).toBe("not_available");
    expect(result.imageToolComponentUsd).toBeUndefined();
    expect(result.textComponentUsd).toBe(0.008);
    expect(result.visualSignatureImageUsage).toMatchObject({
      inputTextTokens: null,
      outputImageTokens: null,
      imageComponentUsd: null,
      coverage: "partial",
    });
    expect(result.visualSignatureImageUsage.missing).toContain(
      "image_usage_estimate",
    );
  });

  it("tarifa da imagem ausente → parcial/desconhecido, sem inventar zero", () => {
    const result = calculate({ imagePricing: null });

    expect(result.estimatedCostUsd).toBeNull();
    expect(result.costSource).toBe("not_available");
    expect(result.imageToolComponentUsd).toBeUndefined();
    expect(result.textComponentUsd).toBe(0.008);
    expect(result.visualSignatureImageUsage.coverage).toBe("partial");
    expect(result.visualSignatureImageUsage.missing).toContain("image_pricing");
    expect(result.costEstimationNote).toBe(
      "visual_signature_image_usage_estimate_partial",
    );
  });

  it("dimensão de saída de imagem ausente na tarifa → parcial", () => {
    const result = calculate({
      imagePricing: { inputCostUsd: 5, outputCostUsd: 30 },
    });

    expect(result.estimatedCostUsd).toBeNull();
    expect(result.imageToolComponentUsd).toBeUndefined();
    expect(result.visualSignatureImageUsage.missing).toContain(
      "image_output_image",
    );
  });

  it("falha sem imagem gerada não estima saída de imagem", () => {
    const result = calculate({ imageGenerated: false });

    expect(result.estimatedCostUsd).toBeNull();
    expect(result.imageToolComponentUsd).toBeUndefined();
    expect(result.textComponentUsd).toBe(0.008);
    expect(result.visualSignatureImageUsage.missing).toContain(
      "image_not_generated",
    );
  });

  it("usage ausente → componente do orquestrador desconhecido (não zero)", () => {
    const result = calculate({ usage: undefined });

    expect(result.estimatedCostUsd).toBeNull();
    expect(result.textComponentUsd).toBeUndefined();
    expect(result.imageToolComponentUsd).toBe(0.00925);
    expect(result.visualSignatureImageUsage.usageBreakdown).toBe("absent");
    expect(result.visualSignatureImageUsage.missing).toContain(
      "orchestrator_usage",
    );
  });
});
