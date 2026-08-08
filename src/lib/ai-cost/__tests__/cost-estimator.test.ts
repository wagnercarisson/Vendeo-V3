import { vi, describe, it, expect, beforeEach } from "vitest";

// Mock do serviço de preços (D8) — retorno com uuid estável para os cenários
// pricing_table; null para os cenários fallback/not_available.
vi.mock("@/lib/ai-cost/ai-model-pricing", () => ({
  getModelPricing: vi.fn(),
}));

import { resolveAiCost } from "../cost-estimator";
import { getModelPricing } from "@/lib/ai-cost/ai-model-pricing";

const UUID = "22222222-2222-4222-8222-222222222222";

const mockGetModelPricing = getModelPricing as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  mockGetModelPricing.mockReset();
  // Default: sem linha na tabela e sem default em código → null
  mockGetModelPricing.mockResolvedValue(null);
});

describe("resolveAiCost — cenários 6.1 (D9)", () => {
  it("cenário #1 — usage + linha na tabela → pricing_table com uuid da linha (gpt-4o 1000/500 = 0.0075)", async () => {
    mockGetModelPricing.mockResolvedValue({
      pricing: { inputCostUsd: 2.5, outputCostUsd: 10 },
      versionId: UUID,
    });

    const result = await resolveAiCost({
      provider: "openai",
      model: "gpt-4o",
      usage: { promptTokens: 1000, completionTokens: 500 },
    });

    expect(result).toEqual({
      estimatedCostUsd: 0.0075,
      costSource: "pricing_table",
      pricingVersion: UUID,
    });
  });

  it("cenário #2 — providerReportedCostUsd presente → provider_reported (0.02) e cálculo interno NÃO sobrescreve (D3)", async () => {
    const result = await resolveAiCost({
      provider: "openai",
      model: "gpt-4o",
      usage: { promptTokens: 1000, completionTokens: 500 },
      providerReportedCostUsd: 0.02,
    });

    expect(result).toEqual({
      estimatedCostUsd: 0.02,
      providerReportedCostUsd: 0.02,
      costSource: "provider_reported",
    });
    // Fonte 1 vence ANTES da leitura de pricing (ordem rígida D9)
    expect(mockGetModelPricing).not.toHaveBeenCalled();
  });

  it("cenário #3 — gpt-image-2 sem usage → pricing_table via image_unit_usd (0.040)", async () => {
    mockGetModelPricing.mockResolvedValue({
      pricing: { imageUnitCostUsd: 0.04 },
      versionId: UUID,
    });

    const result = await resolveAiCost({ provider: "openai", model: "gpt-image-2" });

    expect(result).toEqual({
      estimatedCostUsd: 0.04,
      costSource: "pricing_table",
      pricingVersion: UUID,
    });
  });

  it("cenário #4 — gemini-3.1-flash-lite com usage {1000, 200} → 0.00018 (furo 3 sanado, NÃO null)", async () => {
    mockGetModelPricing.mockResolvedValue({
      pricing: { inputCostUsd: 0.1, outputCostUsd: 0.4 },
      versionId: UUID,
    });

    const result = await resolveAiCost({
      provider: "gemini",
      model: "gemini-3.1-flash-lite",
      usage: { promptTokens: 1000, completionTokens: 200 },
    });

    expect(result.estimatedCostUsd).toBeCloseTo(0.00018, 6);
    expect(result.costSource).toBe("pricing_table");
    expect(result.pricingVersion).toBe(UUID);
    expect(result.estimatedCostUsd).not.toBeNull();
  });

  it("cenário #5 — gpt-4o sem usage (sem linha) → fallback_static 0.15 — NUNCA null (furo 1 sanado)", async () => {
    const result = await resolveAiCost({ provider: "openai", model: "gpt-4o" });

    expect(result).toEqual({ estimatedCostUsd: 0.15, costSource: "fallback_static" });
    expect(result.estimatedCostUsd).not.toBeNull();
  });

  it("cenário #6 — modelo desconhecido sem usage → fallback_static", async () => {
    const result = await resolveAiCost({ provider: "openai", model: "unknown-model" });

    expect(result).toEqual({ estimatedCostUsd: 0.15, costSource: "fallback_static" });
  });

  it("cenário #7 — code_default — sem linha, default em código → pricing_table + 'code_default' (bootstrap D8)", async () => {
    mockGetModelPricing.mockResolvedValue({
      pricing: { inputCostUsd: 2.5, outputCostUsd: 10 },
      versionId: "code_default",
    });

    const result = await resolveAiCost({
      provider: "openai",
      model: "gpt-4o",
      usage: { promptTokens: 1000, completionTokens: 500 },
    });

    expect(result).toEqual({
      estimatedCostUsd: 0.0075,
      costSource: "pricing_table",
      pricingVersion: "code_default",
    });
  });

  it("cenário #8 — not_available com tokens — sem linha e sem default → estimatedCostUsd null, costSource not_available (tokens preservados D4)", async () => {
    // Fallback explicitamente desabilitado (D4: sem preço/config → custo desconhecido)
    vi.stubEnv("VENDEO_AI_FALLBACK_COST_USD", "none");

    const result = await resolveAiCost({
      provider: "anthropic",
      model: "claude-3",
      usage: { promptTokens: 100, completionTokens: 50 },
    });

    expect(result).toEqual({ estimatedCostUsd: null, costSource: "not_available" });
    expect(result.estimatedCostUsd).toBeNull();
  });

  it("cenário #9 — cached tokens gpt-5.5 (1000 prompt, 400 cached, 200 output, cached 0.50) descontam do input → 0.0092", async () => {
    mockGetModelPricing.mockResolvedValue({
      pricing: { inputCostUsd: 5, cachedInputCostUsd: 0.5, outputCostUsd: 30 },
      versionId: UUID,
    });

    const result = await resolveAiCost({
      provider: "openai",
      model: "gpt-5.5",
      usage: { promptTokens: 1000, completionTokens: 200, cachedInputTokens: 400 },
    });

    // uncached 600/1M * 5.0 = 0.003 + cached 400/1M * 0.5 = 0.0002 + output 200/1M * 30 = 0.006
    expect(result.estimatedCostUsd).toBeCloseTo(0.0092, 6);
    expect(result.costSource).toBe("pricing_table");
    expect(result.pricingVersion).toBe(UUID);
  });

  it("cenário #10 — manual_unknown (D4) — via ajuste manual → costSource manual_unknown", async () => {
    const result = await resolveAiCost({
      provider: "openai",
      model: "unknown-model",
      manualCostUsd: 0.75,
    });

    expect(result).toEqual({ estimatedCostUsd: 0.75, costSource: "manual_unknown" });
    expect(mockGetModelPricing).not.toHaveBeenCalled();
  });
});

describe("resolveAiCost — env de fallback (T-38.1-20)", () => {
  it("VENDEO_AI_FALLBACK_COST_USD controla fallback_static", async () => {
    vi.stubEnv("VENDEO_AI_FALLBACK_COST_USD", "0.50");

    const result = await resolveAiCost({ provider: "openai", model: "gpt-4o" });

    expect(result.estimatedCostUsd).toBe(0.5);
    expect(result.costSource).toBe("fallback_static");
  });

  it("compat retroativa — VENDEO_IMAGE_GENERATION_FALLBACK_COST_USD usado quando o novo env não existe", async () => {
    vi.stubEnv("VENDEO_IMAGE_GENERATION_FALLBACK_COST_USD", "0.30");

    const result = await resolveAiCost({ provider: "openai", model: "gpt-4o" });

    expect(result.estimatedCostUsd).toBe(0.3);
  });

  it("env inválido → default 0.15 (parse numérico com validação)", async () => {
    vi.stubEnv("VENDEO_AI_FALLBACK_COST_USD", "abc");

    const result = await resolveAiCost({ provider: "openai", model: "gpt-4o" });

    expect(result.estimatedCostUsd).toBe(0.15);
  });
});

describe("resolveAiCost — extensões (D9/D12)", () => {
  it("normalizeModel resolve sufixo de data na busca (gpt-4o-2024-08-06 → gpt-4o)", async () => {
    mockGetModelPricing.mockResolvedValue({
      pricing: { inputCostUsd: 2.5, outputCostUsd: 10 },
      versionId: UUID,
    });

    const result = await resolveAiCost({
      provider: "openai",
      model: "gpt-4o-2024-08-06",
      usage: { promptTokens: 1000, completionTokens: 500 },
    });

    expect(result.estimatedCostUsd).toBeCloseTo(0.0075, 4);
    expect(result.costSource).toBe("pricing_table");
  });

  it("image tokens (output_tokens_details.image_tokens) contabilizados via imageTokenUsdPer1M", async () => {
    mockGetModelPricing.mockResolvedValue({
      pricing: { inputCostUsd: 2.5, outputCostUsd: 10, imageTokenUsdPer1M: 5 },
      versionId: UUID,
    });

    const result = await resolveAiCost({
      provider: "openai",
      model: "gpt-4o",
      usage: { promptTokens: 1000, completionTokens: 500, imageTokens: 1000 },
    });

    // 0.0025 + 0.005 + 1000/1M * 5 = 0.005 → 0.0125
    expect(result.estimatedCostUsd).toBeCloseTo(0.0125, 6);
    expect(result.costSource).toBe("pricing_table");
  });

  it("modelo de texto com pricing conhecido mas SEM usage → fallback_static (não computável por tokens)", async () => {
    mockGetModelPricing.mockResolvedValue({
      pricing: { inputCostUsd: 2.5, outputCostUsd: 10 },
      versionId: UUID,
    });

    const result = await resolveAiCost({ provider: "openai", model: "gpt-4o" });

    expect(result).toEqual({ estimatedCostUsd: 0.15, costSource: "fallback_static" });
  });
});
