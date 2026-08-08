import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: {} as any,
}));

import {
  AiModelPricingService,
  getModelPricing,
  DEFAULT_AI_MODEL_PRICING,
} from "../ai-model-pricing";

const UUID = "11111111-1111-4111-8111-111111111111";

// Cadeia mock: from("ai_model_pricing").select(...).eq(provider).eq(model).is("effective_until", null).maybeSingle()
const mockMaybeSingle = vi.fn();
const mockIs = vi.fn();
const mockEq = vi.fn();
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockClient = { from: mockFrom };

let service: AiModelPricingService;

beforeEach(() => {
  vi.clearAllMocks();
  service = new AiModelPricingService(mockClient as any);
  mockFrom.mockReturnValue({ select: mockSelect });
  mockSelect.mockReturnValue({ eq: mockEq });
  // Cadeia: .eq(provider).eq(model).is("effective_until", null).maybeSingle()
  mockEq.mockImplementation(() => ({ eq: mockEq, is: mockIs }));
  mockIs.mockReturnValue({ maybeSingle: mockMaybeSingle });
  mockMaybeSingle.mockResolvedValue({ data: null, error: null });
});

describe("AiModelPricingService.getModelPricing (D8)", () => {
  it("linha vigente na tabela → pricing mapeado + versionId = uuid da linha (não code_default)", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: UUID,
        provider: "openai",
        model: "gpt-4o",
        input_token_usd_per_1m: 2.5,
        output_token_usd_per_1m: 10,
        cached_input_token_usd_per_1m: null,
        image_unit_usd: null,
        image_token_usd_per_1m: null,
      },
      error: null,
    });

    const result = await service.getModelPricing({ provider: "openai", model: "gpt-4o" });

    expect(result).toEqual({
      pricing: { inputCostUsd: 2.5, outputCostUsd: 10 },
      versionId: UUID,
    });
    expect(result?.versionId).not.toBe("code_default");
    expect(mockFrom).toHaveBeenCalledWith("ai_model_pricing");
  });

  it("linha superseded (effective_until NOT NULL) NÃO é retornada — query filtra .is('effective_until', null)", async () => {
    // A linha antiga tem effective_until preenchido → a query de vigentes não a retorna;
    // o serviço cai no bootstrap de código (code_default), nunca na linha histórica.
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    const result = await service.getModelPricing({ provider: "openai", model: "gpt-4o" });

    expect(result?.versionId).toBe("code_default");
    expect(mockIs).toHaveBeenCalledWith("effective_until", null);
    expect(mockEq).toHaveBeenCalledTimes(2); // provider + model
    expect(mockMaybeSingle).toHaveBeenCalledTimes(1);
  });

  it("sem linha na tabela → bootstrap de DEFAULT_AI_MODEL_PRICING com versionId code_default (gpt-4o {2.50, 10.00})", async () => {
    const result = await service.getModelPricing({ provider: "openai", model: "gpt-4o" });

    expect(result).toEqual({
      pricing: { inputCostUsd: 2.5, outputCostUsd: 10 },
      versionId: "code_default",
    });
  });

  it("gpt-image-2 sem linha → bootstrap imageUnitCostUsd 0.040 SEM input/output (modelo só de imagem — dimensões opcionais D8)", async () => {
    const result = await service.getModelPricing({ provider: "openai", model: "gpt-image-2" });

    expect(result?.versionId).toBe("code_default");
    expect(result?.pricing.imageUnitCostUsd).toBe(0.04);
    expect(result?.pricing.inputCostUsd).toBeUndefined();
    expect(result?.pricing.outputCostUsd).toBeUndefined();
  });

  it("sem linha e sem default em código → null (caminho not_available do resolvedor)", async () => {
    const result = await service.getModelPricing({ provider: "anthropic", model: "claude-3" });

    expect(result).toBeNull();
  });

  it("erro de query (supabase) → null + console.error — nunca lança (best-effort D7)", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: { message: "connection failed" } });
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await service.getModelPricing({ provider: "openai", model: "gpt-4o" });

    expect(result).toBeNull();
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it("linha do banco com TODAS as 5 dimensões nulas → null (validação ao menos uma dimensão no mapper — espelha CHECK)", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: UUID,
        provider: "openai",
        model: "gpt-4o",
        input_token_usd_per_1m: null,
        output_token_usd_per_1m: null,
        cached_input_token_usd_per_1m: null,
        image_unit_usd: null,
        image_token_usd_per_1m: null,
      },
      error: null,
    });

    const result = await service.getModelPricing({ provider: "openai", model: "gpt-4o" });

    expect(result).toBeNull();
  });

  it("wrapper singleton getModelPricing exporta e delega ao serviço (mockável pelo resolvedor)", async () => {
    const prototypeSpy = vi
      .spyOn(AiModelPricingService.prototype, "getModelPricing")
      .mockResolvedValue({ pricing: { imageUnitCostUsd: 0.04 }, versionId: "code_default" });

    const result = await getModelPricing({ provider: "openai", model: "gpt-image-2" });

    expect(result?.versionId).toBe("code_default");
    expect(prototypeSpy).toHaveBeenCalledTimes(1);

    prototypeSpy.mockRestore();
  });

  it("DEFAULT_AI_MODEL_PRICING espelha os 7 seeds da migration 38-1-01 (D8)", () => {
    expect(Object.keys(DEFAULT_AI_MODEL_PRICING).sort()).toEqual([
      "dall-e-3",
      "gemini-2.0-flash",
      "gemini-3.1-flash-lite",
      "gpt-4o",
      "gpt-4o-mini",
      "gpt-5.5",
      "gpt-image-2",
    ]);
    expect(DEFAULT_AI_MODEL_PRICING["gpt-4o"]).toEqual({ inputCostUsd: 2.5, outputCostUsd: 10 });
    expect(DEFAULT_AI_MODEL_PRICING["gpt-4o-mini"]).toEqual({ inputCostUsd: 0.15, outputCostUsd: 0.6 });
    expect(DEFAULT_AI_MODEL_PRICING["gpt-5.5"]).toEqual({ inputCostUsd: 5, cachedInputCostUsd: 0.5, outputCostUsd: 30 });
    expect(DEFAULT_AI_MODEL_PRICING["gpt-image-2"]).toEqual({ imageUnitCostUsd: 0.04 });
    expect(DEFAULT_AI_MODEL_PRICING["dall-e-3"]).toEqual({ imageUnitCostUsd: 0.04 });
    expect(DEFAULT_AI_MODEL_PRICING["gemini-2.0-flash"]).toEqual({ inputCostUsd: 0.1, outputCostUsd: 0.4 });
    expect(DEFAULT_AI_MODEL_PRICING["gemini-3.1-flash-lite"]).toEqual({ inputCostUsd: 0.1, outputCostUsd: 0.4 });
    // Modelos com sufixo de data NÃO têm entrada própria — o normalizeModel resolve na busca
    expect(DEFAULT_AI_MODEL_PRICING["gpt-5.5-2026-04-23"]).toBeUndefined();
  });
});
