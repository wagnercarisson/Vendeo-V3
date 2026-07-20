import { describe, it, expect, vi, beforeEach } from "vitest";
import { estimateAiCost } from "../cost-estimator";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("estimateAiCost", () => {
  it("calculates gpt-4o cost correctly", () => {
    const result = estimateAiCost({
      provider: "openai",
      model: "gpt-4o",
      usage: { promptTokens: 1000, completionTokens: 500 },
    });
    expect(result).not.toBeNull();
    expect(result!.estimatedCostUsd).toBeCloseTo(0.0075, 4);
    expect(result!.source).toBe("openai_published_pricing");
  });

  it("returns null for unknown model", () => {
    const result = estimateAiCost({
      provider: "openai",
      model: "unknown-model",
      usage: { promptTokens: 1000, completionTokens: 500 },
    });
    expect(result).toBeNull();
  });

  it("returns dalle-3 fixed cost when model is known image model", () => {
    const result = estimateAiCost({
      provider: "openai",
      model: "dall-e-3",
    });
    expect(result).not.toBeNull();
    expect(result!.estimatedCostUsd).toBe(0.04);
    expect(result!.source).toBe("openai_published_pricing");
  });

  it("returns null for text model without usage", () => {
    const result = estimateAiCost({
      provider: "openai",
      model: "gpt-4o",
    });
    expect(result).toBeNull();
  });

  it("returns fallback for gpt-image models without usage", () => {
    const result = estimateAiCost({
      provider: "openai",
      model: "gpt-image-2",
    });
    expect(result).not.toBeNull();
    expect(result!.estimatedCostUsd).toBe(0.15);
    expect(result!.source).toBe("configured_fallback");
  });

  it("returns fallback for unknown OpenAI models without usage", () => {
    const result = estimateAiCost({
      provider: "openai",
      model: "gpt-5.5",
    });
    expect(result).not.toBeNull();
    expect(result!.estimatedCostUsd).toBe(0.15);
    expect(result!.source).toBe("configured_fallback");
  });

  it("respects VENDEO_IMAGE_GENERATION_FALLBACK_COST_USD env var", () => {
    vi.stubEnv("VENDEO_IMAGE_GENERATION_FALLBACK_COST_USD", "0.50");
    const result = estimateAiCost({
      provider: "openai",
      model: "gpt-5.5",
    });
    expect(result).not.toBeNull();
    expect(result!.estimatedCostUsd).toBe(0.50);
    expect(result!.source).toBe("configured_fallback");
    vi.unstubAllEnvs();
  });

  it("uses default fallback when env var is invalid", () => {
    vi.stubEnv("VENDEO_IMAGE_GENERATION_FALLBACK_COST_USD", "invalid");
    const result = estimateAiCost({
      provider: "openai",
      model: "gpt-5.5",
    });
    expect(result).not.toBeNull();
    expect(result!.estimatedCostUsd).toBe(0.15);
    vi.unstubAllEnvs();
  });

  it("uses usage-based calculation when usage is available", () => {
    const result = estimateAiCost({
      provider: "openai",
      model: "gpt-4o",
      usage: { promptTokens: 1000, completionTokens: 500 },
    });
    expect(result).not.toBeNull();
    expect(result!.estimatedCostUsd).toBeCloseTo(0.0075, 4);
    expect(result!.source).toBe("openai_published_pricing");
  });

  it("returns null for unknown providers", () => {
    const result = estimateAiCost({
      provider: "anthropic",
      model: "claude-3",
    });
    expect(result).toBeNull();
  });

  it("calculates gemini-2.0-flash cost correctly", () => {
    const result = estimateAiCost({
      provider: "gemini",
      model: "gemini-2.0-flash",
      usage: { promptTokens: 1000, completionTokens: 200 },
    });
    expect(result).not.toBeNull();
    expect(result!.estimatedCostUsd).toBeCloseTo(0.00018, 6);
    expect(result!.source).toBe("gemini_published_pricing");
  });
});
