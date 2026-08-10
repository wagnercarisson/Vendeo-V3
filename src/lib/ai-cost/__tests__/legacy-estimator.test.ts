import { describe, it, expect, vi, beforeEach } from "vitest";
import { estimateAiCost } from "../legacy-estimator";

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("estimateAiCost (LEGADO — wrapper síncrono @deprecated, contrato F28)", () => {
  it("calcula gpt-4o com usage → openai_published_pricing 0.0075", () => {
    const result = estimateAiCost({
      provider: "openai",
      model: "gpt-4o",
      usage: { promptTokens: 1000, completionTokens: 500 },
    });
    expect(result).not.toBeNull();
    expect(result!.estimatedCostUsd).toBeCloseTo(0.0075, 4);
    expect(result!.source).toBe("openai_published_pricing");
  });

  it("retorna null para modelo de texto conhecido sem usage (comportamento legado preservado)", () => {
    const result = estimateAiCost({ provider: "openai", model: "gpt-4o" });
    expect(result).toBeNull();
  });

  it("dall-e-3 → custo fixo 0.04 (openai_published_pricing)", () => {
    const result = estimateAiCost({ provider: "openai", model: "dall-e-3" });
    expect(result).not.toBeNull();
    expect(result!.estimatedCostUsd).toBe(0.04);
    expect(result!.source).toBe("openai_published_pricing");
  });

  it("gpt-image-2 sem usage → configured_fallback 0.15 (não estava na Record legada — furo 3)", () => {
    const result = estimateAiCost({ provider: "openai", model: "gpt-image-2" });
    expect(result).not.toBeNull();
    expect(result!.estimatedCostUsd).toBe(0.15);
    expect(result!.source).toBe("configured_fallback");
  });

  it("modelo desconhecido com usage → configured_fallback_unknown_model_with_usage 0.15", () => {
    const result = estimateAiCost({
      provider: "openai",
      model: "unknown-model",
      usage: { promptTokens: 1000, completionTokens: 500 },
    });
    expect(result).not.toBeNull();
    expect(result!.estimatedCostUsd).toBe(0.15);
    expect(result!.source).toBe("configured_fallback_unknown_model_with_usage");
  });

  it("gpt-5.5 com cached tokens desconta do input (600 uncached + 2000 cached no caso legado)", () => {
    const result = estimateAiCost({
      provider: "openai",
      model: "gpt-5.5",
      usage: { promptTokens: 5000, completionTokens: 1000, cachedInputTokens: 2000 },
    });
    expect(result).not.toBeNull();
    // 3000/1M*5 + 2000/1M*0.5 + 1000/1M*30 = 0.015 + 0.001 + 0.03 = 0.046
    expect(result!.estimatedCostUsd).toBeCloseTo(0.046, 4);
  });

  it("gpt-5.5-2026-04-23 usa a entrada explícita da Record legada", () => {
    const result = estimateAiCost({
      provider: "openai",
      model: "gpt-5.5-2026-04-23",
      usage: { promptTokens: 1000, completionTokens: 500 },
    });
    expect(result).not.toBeNull();
    expect(result!.estimatedCostUsd).toBeCloseTo(0.02, 4);
  });

  it("VENDEO_IMAGE_GENERATION_FALLBACK_COST_USD é respeitado; inválido → 0.15", () => {
    vi.stubEnv("VENDEO_IMAGE_GENERATION_FALLBACK_COST_USD", "0.50");
    expect(estimateAiCost({ provider: "openai", model: "gpt-5.5" })!.estimatedCostUsd).toBe(0.5);
    vi.unstubAllEnvs();

    vi.stubEnv("VENDEO_IMAGE_GENERATION_FALLBACK_COST_USD", "invalid");
    expect(estimateAiCost({ provider: "openai", model: "gpt-5.5" })!.estimatedCostUsd).toBe(0.15);
  });

  it("gemini-2.0-flash com usage → gemini_published_pricing 0.00018", () => {
    const result = estimateAiCost({
      provider: "gemini",
      model: "gemini-2.0-flash",
      usage: { promptTokens: 1000, completionTokens: 200 },
    });
    expect(result).not.toBeNull();
    expect(result!.estimatedCostUsd).toBeCloseTo(0.00018, 6);
    expect(result!.source).toBe("gemini_published_pricing");
  });

  it("provider desconhecido → null (contrato legado)", () => {
    const result = estimateAiCost({ provider: "anthropic", model: "claude-3" });
    expect(result).toBeNull();
  });
});
