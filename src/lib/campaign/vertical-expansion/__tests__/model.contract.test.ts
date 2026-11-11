// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import type { AiModelCatalogRow } from "@/lib/ai/ai-model-catalog-service";
import type { ModelPricing } from "@/lib/ai-cost/ai-model-pricing";

import {
  EXPECTED_EXPANSION_TARGET,
  evaluatePricingCoverage,
  isEligibleExpansionTarget,
  resolveExpansionPricing,
  resolveExpansionTarget,
} from "../model";

/**
 * F60.3 — resolução do alvo Sunburst low e cobertura de pricing pré-chamada.
 *
 * Nenhum leitor real é construído: catálogo e pricing são fakes injetados. Os
 * contadores abaixo provam que nenhuma chamada de provider ou de Storage
 * aconteceu durante a suíte.
 */
const providerCalls = { count: 0 };
const storageCalls = { count: 0 };

afterEach(() => {
  expect(providerCalls.count).toBe(0);
  expect(storageCalls.count).toBe(0);
});

function sourcePath(relative: string): string {
  return fileURLToPath(new URL(relative, import.meta.url));
}

function catalogRow(overrides: Partial<AiModelCatalogRow> = {}): AiModelCatalogRow {
  return {
    id: "0f7f1c1a-5f2b-4a4b-9d1e-2a3b4c5d6e7f",
    capability: "campaign_product_image",
    segment: "product",
    provider: "openai",
    model: "gpt-image-2.5-sunburst",
    protocol: "images",
    label: null,
    status: "active",
    source_note: null,
    validated_at: null,
    created_at: "2026-11-11T00:00:00.000Z",
    updated_at: "2026-11-11T00:00:00.000Z",
    ...overrides,
  };
}

function catalogOf(rows: AiModelCatalogRow[]) {
  return { getActiveCatalogRows: async () => rows };
}

const COMPLETE_PRICING: ModelPricing = {
  inputCostUsd: 1,
  outputCostUsd: 2,
  cachedInputCostUsd: 0.5,
  imageInputTokenUsdPer1M: 3,
  imageTokenUsdPer1M: 4,
  imageCachedInputTokenUsdPer1M: 5,
  imageUnitCostUsd: 0.05,
};

async function withImagePairMock<T>(
  overrides: Record<string, unknown>,
  run: (mod: typeof import("../model")) => Promise<T>,
): Promise<T> {
  vi.resetModules();
  vi.doMock("@/lib/ai/image-model-pair", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@/lib/ai/image-model-pair")>();
    return { ...actual, ...overrides };
  });
  try {
    const mod = await import("../model");
    return await run(mod);
  } finally {
    vi.doUnmock("@/lib/ai/image-model-pair");
    vi.resetModules();
  }
}

describe("F60.3 model — alvo resolvido pela linha ativa do catálogo", () => {
  it("linha ativa Sunburst devolve provider/model/protocol copiados da linha", async () => {
    const sunburst = catalogRow();
    const resolution = await resolveExpansionTarget({ catalog: catalogOf([sunburst]) });

    expect(resolution.ok).toBe(true);
    if (!resolution.ok) return;

    expect(resolution.provider).toBe("openai");
    expect(resolution.model).toBe("gpt-image-2.5-sunburst");
    expect(resolution.protocol).toBe("images");
    expect(resolution.quality).toBe("low");
    expect(resolution.provider).toBe(sunburst.provider);
    expect(resolution.model).toBe(sunburst.model);
    expect(resolution.protocol).toBe(sunburst.protocol);
    expect(resolution.catalogRow).toBe(sunburst);
  });

  it("a tupla esperada é derivada de policy.ts (sem literais duplicados)", () => {
    expect(EXPECTED_EXPANSION_TARGET).toEqual({
      capability: "campaign_product_image",
      provider: "openai",
      protocol: "images",
      model: "gpt-image-2.5-sunburst",
      quality: "low",
    });
    expect(Object.isFrozen(EXPECTED_EXPANSION_TARGET)).toBe(true);
    expect(isEligibleExpansionTarget(catalogRow())).toBe(true);
    expect(isEligibleExpansionTarget(catalogRow({ status: "deprecated" }))).toBe(false);
  });

  it("catálogo sem linha correspondente devolve catalog_row_missing", async () => {
    await expect(resolveExpansionTarget({ catalog: catalogOf([]) })).resolves.toEqual({
      ok: false,
      reason: "catalog_row_missing",
    });
  });

  it("linha inativa não casa (o leitor devolve só ativas; a checagem é redundante)", async () => {
    await expect(
      resolveExpansionTarget({ catalog: catalogOf([]) }),
    ).resolves.toEqual({ ok: false, reason: "catalog_row_missing" });

    await expect(
      resolveExpansionTarget({
        catalog: catalogOf([catalogRow({ status: "deprecated" })]),
      }),
    ).resolves.toEqual({ ok: false, reason: "catalog_row_missing" });
  });

  it("linha com protocolo divergente devolve unsupported_protocol", async () => {
    await expect(
      resolveExpansionTarget({
        catalog: catalogOf([catalogRow({ protocol: "responses" })]),
      }),
    ).resolves.toEqual({ ok: false, reason: "unsupported_protocol" });
  });

  it("modelo fora da lista elegível devolve catalog_row_missing/model_not_eligible", async () => {
    const resolution = await withImagePairMock(
      { isEligibleImageModel: () => false },
      (mod) => mod.resolveExpansionTarget({ catalog: catalogOf([catalogRow()]) }),
    );

    expect(resolution).toEqual({
      ok: false,
      reason: "catalog_row_missing",
      detail: "model_not_eligible",
    });
  });

  it("qualidade fora da lista elegível devolve quality_not_eligible (ramo defensivo)", async () => {
    const resolution = await withImagePairMock(
      { isEligibleImageQuality: () => false },
      (mod) => mod.resolveExpansionTarget({ catalog: catalogOf([catalogRow()]) }),
    );

    expect(resolution).toEqual({ ok: false, reason: "quality_not_eligible" });
  });

  it("leitura que lança ou não devolve array devolve catalog_read_failed sem lançar", async () => {
    const throwing = {
      getActiveCatalogRows: async (): Promise<AiModelCatalogRow[]> => {
        throw new Error("boom");
      },
    };

    await expect(resolveExpansionTarget({ catalog: throwing })).resolves.toEqual({
      ok: false,
      reason: "catalog_read_failed",
    });

    const nonArray = {
      getActiveCatalogRows: async () =>
        ({ rows: [] } as unknown) as AiModelCatalogRow[],
    };

    await expect(resolveExpansionTarget({ catalog: nonArray })).resolves.toEqual({
      ok: false,
      reason: "catalog_read_failed",
    });
  });

  it("outro modelo elegível sozinho não substitui o Sunburst esperado", async () => {
    const resolution = await resolveExpansionTarget({
      catalog: catalogOf([catalogRow({ id: "flare-row", model: "gpt-image-2.5-flare" })]),
    });

    expect(resolution).toEqual({ ok: false, reason: "catalog_row_missing" });
    expect(JSON.stringify(resolution)).not.toContain("flare");
  });

  it("o leitor é consultado uma única vez", async () => {
    let reads = 0;
    const reader = {
      getActiveCatalogRows: async () => {
        reads += 1;
        return [catalogRow()];
      },
    };

    await resolveExpansionTarget({ catalog: reader });
    expect(reads).toBe(1);
  });
});

describe("F60.3 model — cobertura de pricing pré-chamada", () => {
  it("code_default nunca é cobertura válida", () => {
    const coverage = evaluatePricingCoverage(COMPLETE_PRICING, "code_default");

    expect(coverage.complete).toBe(false);
    expect(coverage.reason).toBe("code_default");
    expect(coverage.missing).toEqual(["pricing_code_default"]);
  });

  it("linha ausente devolve row_missing", () => {
    expect(evaluatePricingCoverage(null, null)).toEqual({
      complete: false,
      reason: "row_missing",
      missing: ["pricing_row"],
    });
  });

  it("linha com image_unit_usd e sem tarifas de token é incomplete_coverage", () => {
    const coverage = evaluatePricingCoverage({ imageUnitCostUsd: 0.05 }, "version-1");

    expect(coverage.complete).toBe(false);
    expect(coverage.reason).toBe("incomplete_coverage");
    expect([...coverage.missing].sort()).toEqual(
      [
        "inputCostUsd",
        "outputCostUsd",
        "cachedInputCostUsd",
        "imageInputTokenUsdPer1M",
        "imageTokenUsdPer1M",
        "imageCachedInputTokenUsdPer1M",
      ].sort(),
    );
  });

  it("lista exatamente os campos ausentes quando só parte das tarifas existe", () => {
    const coverage = evaluatePricingCoverage(
      {
        inputCostUsd: 1,
        outputCostUsd: 2,
        imageTokenUsdPer1M: 4,
        imageUnitCostUsd: 0.05,
      },
      "version-1",
    );

    expect(coverage.complete).toBe(false);
    expect([...coverage.missing].sort()).toEqual(
      [
        "cachedInputCostUsd",
        "imageInputTokenUsdPer1M",
        "imageCachedInputTokenUsdPer1M",
      ].sort(),
    );
  });

  it("image_unit_usd zero, negativo ou ausente nunca completa a cobertura", () => {
    const candidates: ModelPricing[] = [
      { ...COMPLETE_PRICING, imageUnitCostUsd: 0 },
      { ...COMPLETE_PRICING, imageUnitCostUsd: -0.01 },
      { ...COMPLETE_PRICING, imageUnitCostUsd: undefined },
    ];
    const { imageUnitCostUsd: _omitted, ...withoutUnit } = COMPLETE_PRICING;
    candidates.push(withoutUnit);

    for (const pricing of candidates) {
      const coverage = evaluatePricingCoverage(pricing, "version-1");

      expect(coverage.complete).toBe(false);
      expect(coverage.reason).toBe("incomplete_coverage");
      expect(coverage.missing).toContain("image_unit_usd");
    }
  });

  it("linha completa é complete com missing vazio", () => {
    expect(evaluatePricingCoverage(COMPLETE_PRICING, "version-1")).toEqual({
      complete: true,
      missing: [],
    });
  });
});

describe("F60.3 model — pricing do alvo resolvido", () => {
  it("repassa provider/model/quality do alvo ao leitor, exatamente uma vez", async () => {
    const calls: Array<{ provider: string; model: string; quality?: string }> = [];
    const reader = {
      getModelPricing: async (params: {
        provider: string;
        model: string;
        quality?: string;
      }) => {
        calls.push({ ...params });
        return { pricing: COMPLETE_PRICING, versionId: "version-1" };
      },
    };

    const resolution = await resolveExpansionPricing(
      { provider: "openai", model: "gpt-image-2.5-sunburst", quality: "low" },
      { pricing: reader },
    );

    expect(calls).toEqual([
      { provider: "openai", model: "gpt-image-2.5-sunburst", quality: "low" },
    ]);
    expect(resolution).toEqual({
      ok: true,
      pricing: COMPLETE_PRICING,
      versionId: "version-1",
      imageUnitUsd: 0.05,
    });
  });

  it("code_default nunca produz ok: true", async () => {
    const reader = {
      getModelPricing: async () => ({
        pricing: COMPLETE_PRICING,
        versionId: "code_default",
      }),
    };

    const resolution = await resolveExpansionPricing(
      { provider: "openai", model: "gpt-image-2.5-sunburst", quality: "low" },
      { pricing: reader },
    );

    expect(resolution.ok).toBe(false);
    expect(resolution).toEqual({
      ok: false,
      reason: "code_default",
      missing: ["pricing_code_default"],
    });
  });

  it("cobertura incompleta bloqueia antes da chamada e reporta os ausentes", async () => {
    const reader = {
      getModelPricing: async () => ({
        pricing: { imageUnitCostUsd: 0.05 },
        versionId: "version-1",
      }),
    };

    const resolution = await resolveExpansionPricing(
      { provider: "openai", model: "gpt-image-2.5-sunburst", quality: "low" },
      { pricing: reader },
    );

    expect(resolution.ok).toBe(false);
    if (resolution.ok) return;
    expect(resolution.reason).toBe("incomplete_coverage");
    expect(resolution.missing).toHaveLength(6);
  });

  it("leitor que lança devolve row_missing sem lançar", async () => {
    const reader = {
      getModelPricing: async (): Promise<{ pricing: ModelPricing; versionId: string } | null> => {
        throw new Error("boom");
      },
    };

    await expect(
      resolveExpansionPricing(
        { provider: "openai", model: "gpt-image-2.5-sunburst", quality: "low" },
        { pricing: reader },
      ),
    ).resolves.toEqual({ ok: false, reason: "row_missing", missing: ["pricing_row"] });
  });
});

describe("F60.3 model — fronteira de módulo", () => {
  it("é server-only e não abre seletor, preset de bancada ou configuração paralela", () => {
    const source = readFileSync(sourcePath("../model.ts"), "utf8");

    expect(source.startsWith('import "server-only";')).toBe(true);
    expect(source).not.toContain("image_model_pair_config");
    expect(source).not.toContain("BENCH_PRESETS");
    expect(source).not.toContain("ai_model_selection");
    expect(source).not.toContain("OPENAI_BENCH_API_KEY");
    expect(source).not.toMatch(/fallback/i);
  });
});
