import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

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
import { COST_SOURCES } from "../types";
import { resolveAiCost } from "../cost-estimator";

const UUID = "11111111-1111-4111-8111-111111111111";

/** Colunas legadas do select de getModelPricing — o caminho sem qualidade preserva esse conjunto. */
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
    // Cadeia sem qualidade: .eq(provider).eq(model).is("effective_until", null).is("quality", null).maybeSingle()
    // Cadeia com qualidade: ...is("effective_until", null).eq("quality", q).maybeSingle()
    mockEq.mockImplementation(() => ({ eq: mockEq, is: mockIs }));
    mockIs.mockImplementation((column: string) => {
      // O primeiro `.is` ("effective_until") devolve o nó que aceita tanto o `.is`
      // seguinte ("quality") quanto o `.eq("quality", q)` do caminho com qualidade.
      if (column === "quality") return { maybeSingle: mockMaybeSingle };
      return { eq: mockQualityEq, is: mockIs, maybeSingle: mockMaybeSingle };
    });
    mockQualityEq.mockReturnValue({ maybeSingle: mockMaybeSingle });
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
  });

  it("sem quality → comportamento legado preservado (select legado, NÃO filtra por valor e aplica quality IS NULL)", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: row({ model: "gpt-4o", input_token_usd_per_1m: 2.5, output_token_usd_per_1m: 10 }),
      error: null,
    });

    const result = await service.getModelPricing({ provider: "openai", model: "gpt-4o" });

    expect(mockSelect).toHaveBeenCalledWith(LEGACY_COLUMNS);
    expect(mockEq).toHaveBeenCalledTimes(2);
    expect(mockIs).toHaveBeenCalledWith("effective_until", null);
    // O filtro `quality IS NULL` é REQUERIDO para desambiguar a linha legada da coluna
    // aditiva `quality` (a migration F56.1 admite NULL + valor vigentes simultâneos).
    expect(mockIs).toHaveBeenCalledWith("quality", null);
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

/**
 * Fake em memória do client Supabase — sem provider/banco/rede.
 *
 * Fidelidade de cardinalidade (espelha o `maybeSingle()` real / PGRST116):
 *   - SEM filtro de `quality` aplicado → considera TODAS as linhas vigentes do
 *     `(provider, model)`. Mais de uma → `{ data: null, error }` (erro de
 *     cardinalidade "multiple rows"); exatamente uma → devolve a linha.
 *   - COM filtro `quality IS NULL` → devolve apenas a linha `quality IS NULL`.
 *   - COM filtro `quality = valor` → devolve apenas a linha de mesma qualidade.
 * Isso é o que prova que a query legada PRECISA do `quality IS NULL` para não
 * estourar a cardinalidade quando coexistem linha NULL e linha com valor.
 */
function fakePricingClient(rows: PricingRowFixture[]) {
  let reads = 0;
  const CARDINALITY_ERROR = {
    message: "JSON object requested, multiple (or no) rows returned (PGRST116)",
  };
  const client = {
    from: () => ({
      select: () => {
        const filters: Record<string, unknown> = {};
        let qualityFilterApplied = false;
        let qualityFilterValue: string | null = null;
        const builder: any = {
          eq: (column: string, value: unknown) => {
            if (column === "quality") {
              qualityFilterApplied = true;
              qualityFilterValue = value as string | null;
            } else {
              filters[column] = value;
            }
            return builder;
          },
          is: (column: string, value: unknown) => {
            if (column === "quality") {
              qualityFilterApplied = true;
              qualityFilterValue = value as string | null;
            } else {
              filters[column] = value;
            }
            return builder;
          },
          maybeSingle: async () => {
            reads += 1;
            const forProviderModel = rows.filter(
              (candidate) =>
                candidate.provider === filters.provider && candidate.model === filters.model,
            );
            const matched = qualityFilterApplied
              ? forProviderModel.filter(
                  (candidate) => (candidate.quality ?? null) === qualityFilterValue,
                )
              : forProviderModel;

            // `maybeSingle()` exige <= 1 linha; sem filtro de qualidade, a coexistência
            // NULL + valor faz o Supabase retornar erro de cardinalidade.
            if (matched.length > 1) return { data: null, error: CARDINALITY_ERROR };
            return { data: matched[0] ?? null, error: null };
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

// ---------------------------------------------------------------------------
// Task 3 — coexistência de linhas e não-regressão do fluxo legado (D-08/D-10)
// ---------------------------------------------------------------------------
describe("coexistência de linhas com e sem qualidade (D-08)", () => {
  it("query sem qualidade escolhe deterministicamente a linha legada (quality IS NULL) e a query com qualidade escolhe a específica", async () => {
    // Duas linhas vigentes para o MESMO (provider, model): uma NULL e uma 'medium'.
    const { client } = fakePricingClient([
      row({ model: "gpt-image-2", quality: null, image_unit_usd: 0.03 }),
      row({ model: "gpt-image-2", quality: "medium", image_unit_usd: 0.04 }),
    ]);
    const service = new AiModelPricingService(client as never);

    // O filtro `quality IS NULL` garante a seleção da linha legada (sem erro de
    // cardinalidade e sem vazar o preço da linha com qualidade).
    const legacy = await service.getModelPricing({ provider: "openai", model: "gpt-image-2" });
    expect(legacy).toEqual({ pricing: { imageUnitCostUsd: 0.03 }, versionId: UUID });

    const withQuality = await service.getModelPricing({ provider: "openai", model: "gpt-image-2", quality: "medium" });
    expect(withQuality).toEqual({ pricing: { imageUnitCostUsd: 0.04 }, versionId: UUID });
  });

  it("[guarda de fidelidade] o fake modela a cardinalidade: sem o filtro quality IS NULL, duas linhas vigentes → erro", async () => {
    // Consulta CRUA (sem o `.is("quality", null)` que o serviço adiciona) para provar
    // que o fake reproduz o comportamento do Supabase: `maybeSingle()` com 2 linhas
    // vigentes retorna erro de cardinalidade (e o serviço cairia no caminho de erro).
    const { client } = fakePricingClient([
      row({ model: "gpt-image-2", quality: null, image_unit_usd: 0.03 }),
      row({ model: "gpt-image-2", quality: "medium", image_unit_usd: 0.04 }),
    ]);

    const response = await (client as any)
      .from("ai_model_pricing")
      .select("id")
      .eq("provider", "openai")
      .eq("model", "gpt-image-2")
      .is("effective_until", null)
      .maybeSingle();

    expect(response.data).toBeNull();
    expect(response.error).toMatchObject({ message: expect.stringContaining("multiple") });
  });

  it("sem o filtro quality IS NULL o serviço retornaria null (erro de cardinalidade) — o filtro é o que preserva a seleção legada", async () => {
    // Cenário de regressão controlado: injetamos um client cuja consulta SEM o filtro
    // de qualidade reporta erro de cardinalidade. O serviço, ao aplicar `quality IS NULL`,
    // seleciona a linha NULL e NÃO cai no erro — provando que o filtro é necessário.
    const rows = [
      row({ model: "gpt-image-2", quality: null, image_unit_usd: 0.03 }),
      row({ model: "gpt-image-2", quality: "medium", image_unit_usd: 0.04 }),
    ];
    const client = {
      from: () => ({
        select: () => {
          const filters: Record<string, unknown> = {};
          let qualityFilterApplied = false;
          let qualityFilterValue: string | null = null;
          const builder: any = {
            eq: (column: string, value: unknown) => {
              if (column === "quality") {
                qualityFilterApplied = true;
                qualityFilterValue = value as string | null;
              } else {
                filters[column] = value;
              }
              return builder;
            },
            is: (column: string, value: unknown) => {
              if (column === "quality") {
                qualityFilterApplied = true;
                qualityFilterValue = value as string | null;
              } else {
                filters[column] = value;
              }
              return builder;
            },
            maybeSingle: async () => {
              const forProviderModel = rows.filter(
                (candidate) =>
                  candidate.provider === filters.provider && candidate.model === filters.model,
              );
              if (!qualityFilterApplied) {
                return {
                  data: null,
                  error: { message: "JSON object requested, multiple (or no) rows returned" },
                };
              }
              const matched = forProviderModel.filter(
                (candidate) => (candidate.quality ?? null) === qualityFilterValue,
              );
              return { data: matched[0] ?? null, error: null };
            },
          };
          return builder;
        },
      }),
    };

    const service = new AiModelPricingService(client as never);
    const legacy = await service.getModelPricing({ provider: "openai", model: "gpt-image-2" });

    expect(legacy).toEqual({ pricing: { imageUnitCostUsd: 0.03 }, versionId: UUID });
  });

  it("resolveImagePairCost usa o pricing específico por qualidade, não a linha legada coexistente", async () => {
    const { client } = fakePricingClient([
      row({ model: "gpt-image-2.5-sunburst", quality: null, image_unit_usd: 0.03 }),
      row({ model: "gpt-image-2.5-sunburst", quality: "medium", image_unit_usd: 0.06 }),
      row({ model: "gpt-image-2", quality: null, image_unit_usd: 0.03 }),
      row({ model: "gpt-image-2", quality: "medium", image_unit_usd: 0.04 }),
    ]);
    const service = new ImagePairPricingService(client as never);

    const cost = await service.resolveCost(pairConfig());

    expect(cost.primary.costUsd).toBe(0.06);
    expect(cost.fallback.costUsd).toBe(0.04);
  });
});

describe("não-regressão da cadeia legada resolveAiCost (D-10)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("COST_SOURCES preserva exatamente a cadeia original (5 fontes)", () => {
    expect(COST_SOURCES).toEqual([
      "provider_reported",
      "pricing_table",
      "fallback_static",
      "manual_unknown",
      "not_available",
    ]);
  });

  it("provider_reported tem precedência e não consulta o pricing", async () => {
    const spy = vi.spyOn(AiModelPricingService.prototype, "getModelPricing");

    const result = await resolveAiCost({ provider: "openai", model: "gpt-4o", providerReportedCostUsd: 0.42 });

    expect(result).toEqual({
      estimatedCostUsd: 0.42,
      providerReportedCostUsd: 0.42,
      costSource: "provider_reported",
    });
    expect(spy).not.toHaveBeenCalled();
  });

  it("manual_unknown é preservado", async () => {
    const result = await resolveAiCost({ provider: "openai", model: "gpt-4o", manualCostUsd: 0.2 });

    expect(result.costSource).toBe("manual_unknown");
    expect(result.estimatedCostUsd).toBe(0.2);
  });

  it("pricing_table preserva code_default no caminho legado (sem usage, imagem)", async () => {
    vi.spyOn(AiModelPricingService.prototype, "getModelPricing").mockResolvedValue({
      pricing: { imageUnitCostUsd: 0.04 },
      versionId: "code_default",
    });

    const result = await resolveAiCost({ provider: "openai", model: "gpt-image-2" });

    expect(result.costSource).toBe("pricing_table");
    expect(result.pricingVersion).toBe("code_default");
    expect(result.estimatedCostUsd).toBe(0.04);
  });

  it("sem pricing e com fallback habilitado → fallback_static (default 0.15)", async () => {
    vi.spyOn(AiModelPricingService.prototype, "getModelPricing").mockResolvedValue(null);

    const result = await resolveAiCost({ provider: "unknown", model: "no-such-model" });

    expect(result.costSource).toBe("fallback_static");
    expect(result.estimatedCostUsd).toBe(0.15);
  });

  it("sem pricing e fallback desabilitado → not_available (custo NULL)", async () => {
    vi.spyOn(AiModelPricingService.prototype, "getModelPricing").mockResolvedValue(null);
    vi.stubEnv("VENDEO_AI_FALLBACK_COST_USD", "none");

    const result = await resolveAiCost({ provider: "unknown", model: "no-such-model" });

    expect(result.costSource).toBe("not_available");
    expect(result.estimatedCostUsd).toBeNull();
  });
});
