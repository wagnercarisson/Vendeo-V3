import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: {} as any,
}));

import { AiModelPricingService } from "../ai-model-pricing";
import {
  ImagePairPricingService,
  ImagePairPricingIncompleteError,
  IMAGE_PAIR_PRICING_INCOMPLETE,
  resolveImagePairCoverage,
  assertImagePairExecutable,
  resolveImagePairCost,
} from "../image-pair-pricing";
import { ImageModelPairNotEligibleError, type ImageModelPairConfig } from "@/lib/ai/image-model-pair";

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

// ---------------------------------------------------------------------------
// Task 2 — cobertura por par e fail-closed do novo fluxo (D-09/D-10/D-22/D-24)
// ---------------------------------------------------------------------------

/** Fake em memória do client Supabase — sem provider/banco/rede. */
function fakePricingClient(rows: PricingRowFixture[]) {
  let reads = 0;
  const client = {
    from: () => ({
      select: () => {
        const filters: Record<string, unknown> = {};
        const builder: any = {
          eq: (column: string, value: unknown) => {
            filters[column] = value;
            return builder;
          },
          is: (column: string, value: unknown) => {
            filters[column] = value;
            return builder;
          },
          maybeSingle: async () => {
            reads += 1;
            const found = rows.find(
              (candidate) =>
                candidate.provider === filters.provider &&
                candidate.model === filters.model &&
                (candidate.quality ?? null) === ((filters.quality as string | undefined) ?? null),
            );
            return { data: found ?? null, error: null };
          },
        };
        return builder;
      },
    }),
  };
  return { client, getReads: () => reads };
}

const imageRow = (model: string, quality: string, imageUnitUsd = 0.05): PricingRowFixture =>
  row({ model, quality, image_unit_usd: imageUnitUsd });

const pairConfig = (): ImageModelPairConfig => ({
  primary: { model: "gpt-image-2.5-sunburst", quality: "medium" },
  fallback: { model: "gpt-image-2", quality: "medium" },
});

describe("resolveImagePairCoverage / assertImagePairExecutable (D-09/D-10)", () => {
  it("par com pricing de qualidade vigente em ambos → coverage complete e executável", async () => {
    const { client } = fakePricingClient([
      imageRow("gpt-image-2.5-sunburst", "medium"),
      imageRow("gpt-image-2", "medium", 0.04),
    ]);
    const service = new ImagePairPricingService(client as never);

    const coverage = await service.resolveCoverage(pairConfig());

    expect(coverage.pricingCoverage).toBe("complete");
    expect(coverage.primary.pricingCoverage).toBe("complete");
    expect(coverage.fallback.pricingCoverage).toBe("complete");
    expect(coverage.missingComponents).toEqual([]);
    await expect(service.assertExecutable(pairConfig())).resolves.toEqual(coverage);
  });

  it("modelo existe sem pricing da qualidade → partial com componentes ausentes explicitados", async () => {
    const { client } = fakePricingClient([imageRow("gpt-image-2.5-sunburst", "medium")]);
    const service = new ImagePairPricingService(client as never);

    const coverage = await service.resolveCoverage(pairConfig());

    expect(coverage.pricingCoverage).toBe("partial");
    expect(coverage.primary.pricingCoverage).toBe("complete");
    expect(coverage.fallback.pricingCoverage).toBe("missing");
    expect(coverage.fallback.missingComponents).toEqual(["image_unit"]);
    expect(coverage.missingComponents).toEqual(["image_unit"]);
  });

  it("nenhum pricing → coverage missing (sem inventar valor)", async () => {
    const { client } = fakePricingClient([]);
    const service = new ImagePairPricingService(client as never);

    const coverage = await service.resolveCoverage(pairConfig());

    expect(coverage.pricingCoverage).toBe("missing");
    expect(coverage.primary.missingComponents).toEqual(["image_unit"]);
    expect(coverage.fallback.missingComponents).toEqual(["image_unit"]);
    expect(coverage.missingComponents).toEqual(["image_unit"]);
  });

  it("linha legada sem qualidade NÃO preenche a cobertura por qualidade (sem bootstrap)", async () => {
    // As linhas existem, mas com quality = NULL — a cobertura por 'medium' deve ficar missing.
    const { client } = fakePricingClient([
      row({ model: "gpt-image-2.5-sunburst", quality: null, image_unit_usd: 0.05 }),
      row({ model: "gpt-image-2", quality: null, image_unit_usd: 0.04 }),
    ]);
    const service = new ImagePairPricingService(client as never);

    const coverage = await service.resolveCoverage(pairConfig());

    expect(coverage.pricingCoverage).toBe("missing");
    expect(coverage.missingComponents).toEqual(["image_unit"]);
  });

  it("assertImagePairExecutable lança image_pair_pricing_incomplete quando o principal está incompleto", async () => {
    const { client } = fakePricingClient([imageRow("gpt-image-2", "medium", 0.04)]);
    const service = new ImagePairPricingService(client as never);

    await expect(service.assertExecutable(pairConfig())).rejects.toBeInstanceOf(
      ImagePairPricingIncompleteError,
    );
    await expect(service.assertExecutable(pairConfig())).rejects.toMatchObject({
      code: IMAGE_PAIR_PRICING_INCOMPLETE,
    });
  });

  it("assertImagePairExecutable lança quando o fallback está incompleto", async () => {
    const { client } = fakePricingClient([imageRow("gpt-image-2.5-sunburst", "medium")]);
    const service = new ImagePairPricingService(client as never);

    const error = await service.assertExecutable(pairConfig()).catch((err) => err);

    expect(error).toBeInstanceOf(ImagePairPricingIncompleteError);
    expect(error.coverage.fallback.pricingCoverage).toBe("missing");
    expect(error.coverage.primary.pricingCoverage).toBe("complete");
  });

  it("par fora do catálogo fechado → erro de elegibilidade fail-closed (D-02/D-06)", async () => {
    const { client } = fakePricingClient([]);
    const service = new ImagePairPricingService(client as never);

    await expect(
      service.resolveCoverage({
        primary: { model: "dall-e-3", quality: "medium" },
        fallback: { model: "gpt-image-2", quality: "medium" },
      }),
    ).rejects.toBeInstanceOf(ImageModelPairNotEligibleError);
  });

  it("resolveImagePairCoverage delega ao serviço injetado (client injetável)", async () => {
    const { client } = fakePricingClient([
      imageRow("gpt-image-2.5-sunburst", "medium"),
      imageRow("gpt-image-2", "medium", 0.04),
    ]);

    const coverage = await resolveImagePairCoverage(pairConfig(), new ImagePairPricingService(client as never));

    expect(coverage.pricingCoverage).toBe("complete");
  });

  it("resolveImagePairCost retorna o custo por par com versionId e origem quando completo (D-22)", async () => {
    const { client } = fakePricingClient([
      imageRow("gpt-image-2.5-sunburst", "medium", 0.05),
      imageRow("gpt-image-2", "medium", 0.04),
    ]);
    const service = new ImagePairPricingService(client as never);

    const cost = await service.resolveCost(pairConfig());

    expect(cost.primary).toEqual({
      model: "gpt-image-2.5-sunburst",
      quality: "medium",
      costUsd: 0.05,
      versionId: UUID,
      costSource: "pricing_table",
    });
    expect(cost.fallback).toEqual({
      model: "gpt-image-2",
      quality: "medium",
      costUsd: 0.04,
      versionId: UUID,
      costSource: "pricing_table",
    });
  });

  it("resolveImagePairCost é fail-closed quando a cobertura é incompleta (não inventa custo)", async () => {
    const { client } = fakePricingClient([imageRow("gpt-image-2.5-sunburst", "medium")]);

    await expect(
      resolveImagePairCost(pairConfig(), new ImagePairPricingService(client as never)),
    ).rejects.toMatchObject({ code: IMAGE_PAIR_PRICING_INCOMPLETE });
  });

  it("assertImagePairExecutable (função exportada) resolve quando ambos completos", async () => {
    const { client } = fakePricingClient([
      imageRow("gpt-image-2.5-sunburst", "medium"),
      imageRow("gpt-image-2", "medium", 0.04),
    ]);

    await expect(
      assertImagePairExecutable(pairConfig(), new ImagePairPricingService(client as never)),
    ).resolves.toHaveProperty("pricingCoverage", "complete");
  });

  it("cache curto memoiza a leitura vigente e re-lê após o TTL (now/TTL injetáveis)", async () => {
    let now = 1_000;
    const { client, getReads } = fakePricingClient([
      imageRow("gpt-image-2.5-sunburst", "medium"),
      imageRow("gpt-image-2", "medium", 0.04),
    ]);
    const service = new ImagePairPricingService(client as never, () => now, 5_000);

    await service.resolveCoverage(pairConfig());
    expect(getReads()).toBe(2); // principal + fallback

    await service.resolveCoverage(pairConfig());
    expect(getReads()).toBe(2); // cache quente — sem nova leitura

    now += 6_000; // TTL expirado
    await service.resolveCoverage(pairConfig());
    expect(getReads()).toBe(4); // re-leitura após o TTL
  });
});
