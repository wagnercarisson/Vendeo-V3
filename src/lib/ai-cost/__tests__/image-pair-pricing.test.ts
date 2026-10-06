import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: {} as any,
}));

import { AiModelPricingService } from "../ai-model-pricing";

const UUID = "11111111-1111-4111-8111-111111111111";

/** Colunas legadas do select de getModelPricing — a query sem qualidade deve ser idêntica. */
const LEGACY_COLUMNS =
  "id, provider, model, input_token_usd_per_1m, output_token_usd_per_1m, cached_input_token_usd_per_1m, image_unit_usd, image_token_usd_per_1m";

interface PricingRowFixture {
  id: string;
  provider: string;
  model: string;
  quality?: string | null;
  input_token_usd_per_1m: number | null;
  output_token_usd_per_1m: number | null;
  cached_input_token_usd_per_1m: number | null;
  image_unit_usd: number | null;
  image_token_usd_per_1m: number | null;
}

function row(overrides: Partial<PricingRowFixture> = {}): PricingRowFixture {
  return {
    id: UUID,
    provider: "openai",
    model: "gpt-4o",
    quality: null,
    input_token_usd_per_1m: null,
    output_token_usd_per_1m: null,
    cached_input_token_usd_per_1m: null,
    image_unit_usd: null,
    image_token_usd_per_1m: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Task 1 — qualidade opcional na leitura de pricing (D-08)
// ---------------------------------------------------------------------------
describe("getModelPricing — dimensão de qualidade aditiva (D-08)", () => {
  const mockMaybeSingle = vi.fn();
  const mockQualityEq = vi.fn();
  const mockIs = vi.fn();
  const mockEq = vi.fn();
  const mockSelect = vi.fn();
  const mockFrom = vi.fn();
  let service: AiModelPricingService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AiModelPricingService({ from: mockFrom } as any);
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq });
    // Cadeia sem qualidade: .eq(provider).eq(model).is("effective_until", null).maybeSingle()
    // Cadeia com qualidade: ...is(...).eq("quality", q).maybeSingle()
    mockEq.mockImplementation(() => ({ eq: mockEq, is: mockIs }));
    mockIs.mockReturnValue({ eq: mockQualityEq, maybeSingle: mockMaybeSingle });
    mockQualityEq.mockReturnValue({ maybeSingle: mockMaybeSingle });
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
  });

  it("sem quality → query byte a byte a legada (select legado e nenhum .eq('quality'))", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: row({ model: "gpt-4o", input_token_usd_per_1m: 2.5, output_token_usd_per_1m: 10 }),
      error: null,
    });

    const result = await service.getModelPricing({ provider: "openai", model: "gpt-4o" });

    expect(mockSelect).toHaveBeenCalledWith(LEGACY_COLUMNS);
    expect(mockEq).toHaveBeenCalledTimes(2);
    expect(mockIs).toHaveBeenCalledWith("effective_until", null);
    expect(mockQualityEq).not.toHaveBeenCalled();
    expect(mockMaybeSingle).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      pricing: { inputCostUsd: 2.5, outputCostUsd: 10 },
      versionId: UUID,
    });
  });

  it("sem quality e sem linha → bootstrap de código (code_default) permanece (legado intacto)", async () => {
    const result = await service.getModelPricing({ provider: "openai", model: "gpt-image-2" });

    expect(mockQualityEq).not.toHaveBeenCalled();
    expect(result).toEqual({ pricing: { imageUnitCostUsd: 0.04 }, versionId: "code_default" });
  });

  it("com quality → seleciona quality e filtra .eq('quality', 'medium')", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: row({ model: "gpt-image-2", quality: "medium", image_unit_usd: 0.05 }),
      error: null,
    });

    const result = await service.getModelPricing({
      provider: "openai",
      model: "gpt-image-2",
      quality: "medium",
    });

    expect(mockSelect).toHaveBeenCalledWith(`${LEGACY_COLUMNS}, quality`);
    expect(mockQualityEq).toHaveBeenCalledWith("quality", "medium");
    expect(result).toEqual({ pricing: { imageUnitCostUsd: 0.05 }, versionId: UUID });
  });

  it("com quality e sem linha vigente → null (nunca code_default — D-09/D-10)", async () => {
    const result = await service.getModelPricing({
      provider: "openai",
      model: "gpt-image-2",
      quality: "medium",
    });

    expect(mockQualityEq).toHaveBeenCalledWith("quality", "medium");
    expect(result).toBeNull();
  });

  it("com quality, linha de outra qualidade coexistente não é retornada (filtro por qualidade)", async () => {
    // Apenas a linha de 'low' existe; a query pede 'medium' → nenhuma linha → null.
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    const result = await service.getModelPricing({
      provider: "openai",
      model: "gpt-image-2",
      quality: "medium",
    });

    expect(result).toBeNull();
  });
});
