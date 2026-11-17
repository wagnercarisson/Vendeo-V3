// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

// O client global é um objeto que LANÇA ao ser usado: qualquer leitura que
// dependa dele (em vez de dependências injetadas) falha de forma observável.
vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: new Proxy(
    {},
    {
      get() {
        throw new Error("global supabaseAdmin must not be touched");
      },
    },
  ),
}));

import { readFileSync } from "node:fs";
import path from "node:path";

import {
  buildNineSixteenExpansionConfigView,
  createUsagePricingCoverageResolver,
  type NineSixteenExpansionConfigServiceLike,
  type NineSixteenExpansionCoverageStatus,
  type NineSixteenExpansionTargetCoverageResolver,
} from "../nine-sixteen-expansion-model-config-view";
import type { NineSixteenExpansionConfigReadResult } from "../nine-sixteen-expansion-model-config-service";
import type { ModelPricing } from "@/lib/ai-cost/ai-model-pricing";
import { AiModelPricingService } from "@/lib/ai-cost/ai-model-pricing";

const CONFIG_VERSION_ID = "11111111-1111-4111-8111-111111111111";
const ADMIN_ID = "33333333-3333-4333-8333-333333333333";

const FOUND: NineSixteenExpansionConfigReadResult = {
  kind: "found",
  selection: {
    model: "gpt-image-2.5-flare",
    quality: "medium",
    configVersionId: CONFIG_VERSION_ID,
    origin: "configured",
  },
  metadata: {
    updatedBy: ADMIN_ID,
    updatedAt: "2026-11-17T12:00:00.000Z",
    reason: "troca aprovada",
  },
};

function fakeService(
  result: NineSixteenExpansionConfigReadResult | (() => Promise<NineSixteenExpansionConfigReadResult>),
): { service: NineSixteenExpansionConfigServiceLike; reads: () => number } {
  const read = vi.fn(async () =>
    typeof result === "function" ? result() : result,
  );
  return {
    service: { readNineSixteenExpansionConfig: read },
    reads: () => read.mock.calls.length,
  };
}

/** Cobertura `complete` para todas as combinações, exceto as sobrescritas. */
function fakeCoverage(
  overrides: Record<string, "complete" | "partial" | "missing"> = {},
): { resolver: NineSixteenExpansionTargetCoverageResolver; calls: () => number } {
  const calls = vi.fn();
  const resolver: NineSixteenExpansionTargetCoverageResolver = async ({ model, quality }) => {
    calls({ model, quality });
    const status = overrides[`${model}|${quality}`] ?? "complete";
    return {
      model,
      quality,
      pricingCoverage: status,
      missingComponents: status === "complete" ? [] : ["imageTokenUsdPer1M"],
    };
  };
  return { resolver, calls: () => calls.mock.calls.length };
}

describe("buildNineSixteenExpansionConfigView — estado tolerante (nunca lança)", () => {
  it("read_failed do serviço → state read_failed, configured false e readError preenchido", async () => {
    const view = await buildNineSixteenExpansionConfigView({
      service: fakeService({
        kind: "read_failed",
        reason: "nine_sixteen_expansion_config_read_failed:db_down",
      }).service,
    });

    expect(view.state).toBe("read_failed");
    expect(view.configured).toBe(false);
    expect(view.current).toBeNull();
    expect(view.readError).toContain("nine_sixteen_expansion_config_read_failed");
  });

  it("absent → state absent com readError null (nunca preenche fallback)", async () => {
    const view = await buildNineSixteenExpansionConfigView({
      service: fakeService({ kind: "absent" }).service,
    });

    expect(view.state).toBe("absent");
    expect(view.configured).toBe(false);
    expect(view.current).toBeNull();
    expect(view.readError).toBeNull();
    expect(view.configVersionId).toBeNull();
    expect(view.updatedBy).toBeNull();
    expect(view.updatedAt).toBeNull();
    expect(view.reason).toBeNull();
  });

  it("invalid → state invalid e configured false (nunca vira absent nem vigente)", async () => {
    const view = await buildNineSixteenExpansionConfigView({
      service: fakeService({ kind: "invalid", reason: "divergent:model" }).service,
    });

    expect(view.state).toBe("invalid");
    expect(view.configured).toBe(false);
    expect(view.current).toBeNull();
  });

  it("exceção do serviço → read_failed (nunca ausência)", async () => {
    const service = fakeService(async () => {
      throw new Error("unexpected");
    });

    const view = await buildNineSixteenExpansionConfigView({ service: service.service });

    expect(view.state).toBe("read_failed");
    expect(view.configured).toBe(false);
    expect(view.readError).toContain("unexpected");
  });

  it("found → vigente com modelo, qualidade, versão, autor, data e motivo", async () => {
    const coverage = fakeCoverage();
    const service = fakeService(FOUND);

    const view = await buildNineSixteenExpansionConfigView({
      service: service.service,
      coverage: coverage.resolver,
    });

    expect(service.reads()).toBe(1);
    expect(view.state).toBe("configured");
    expect(view.configured).toBe(true);
    expect(view.current).toEqual(FOUND.kind === "found" ? FOUND.selection : null);
    expect(view.configVersionId).toBe(CONFIG_VERSION_ID);
    expect(view.updatedBy).toBe(ADMIN_ID);
    expect(view.updatedAt).toBe("2026-11-17T12:00:00.000Z");
    expect(view.reason).toBe("troca aprovada");
    expect(view.readError).toBeNull();
  });
});

describe("buildNineSixteenExpansionConfigView — cobertura das quatro combinações", () => {
  it("usa chaves `${model}|${quality}`, no máximo quatro entradas e chama o resolvedor 4x", async () => {
    const coverage = fakeCoverage();

    const view = await buildNineSixteenExpansionConfigView({
      service: fakeService(FOUND).service,
      coverage: coverage.resolver,
    });

    const keys = Object.keys(view.targetCoverageByCombination).sort();
    expect(keys).toEqual(
      [
        "gpt-image-2.5-flare|low",
        "gpt-image-2.5-flare|medium",
        "gpt-image-2.5-sunburst|low",
        "gpt-image-2.5-sunburst|medium",
      ].sort(),
    );
    expect(keys).toHaveLength(4);
    expect(coverage.calls()).toBe(4);
  });

  it("mapeia complete/partial/missing e propaga missingComponents do resolver", async () => {
    const coverage = fakeCoverage({
      "gpt-image-2.5-flare|medium": "partial",
      "gpt-image-2.5-sunburst|low": "missing",
    });

    const view = await buildNineSixteenExpansionConfigView({
      service: fakeService(FOUND).service,
      coverage: coverage.resolver,
    });

    expect(view.targetCoverageByCombination["gpt-image-2.5-flare|medium"]).toMatchObject({
      model: "gpt-image-2.5-flare",
      quality: "medium",
      pricingCoverage: "partial",
      missingComponents: ["imageTokenUsdPer1M"],
    });
    expect(view.targetCoverageByCombination["gpt-image-2.5-sunburst|low"]?.pricingCoverage).toBe(
      "missing",
    );
    expect(view.targetCoverageByCombination["gpt-image-2.5-sunburst|medium"]?.pricingCoverage).toBe(
      "complete",
    );
    expect(
      view.targetCoverageByCombination["gpt-image-2.5-sunburst|medium"]?.missingComponents,
    ).toEqual([]);
  });

  it("omite a combinação cuja leitura lança (desconhecido nunca vira complete)", async () => {
    const resolver: NineSixteenExpansionTargetCoverageResolver = async ({ model, quality }) => {
      if (model === "gpt-image-2.5-flare" && quality === "low") {
        throw new Error("pricing read failed");
      }
      return {
        model,
        quality,
        pricingCoverage: "complete",
        missingComponents: [],
      } satisfies NineSixteenExpansionCoverageStatus;
    };

    const view = await buildNineSixteenExpansionConfigView({
      service: fakeService(FOUND).service,
      coverage: resolver,
    });

    expect(view.targetCoverageByCombination["gpt-image-2.5-flare|low"]).toBeUndefined();
    expect(Object.keys(view.targetCoverageByCombination)).toHaveLength(3);
  });

  it("estados não vigentes não calculam cobertura (mapa vazio)", async () => {
    const coverage = fakeCoverage();

    const view = await buildNineSixteenExpansionConfigView({
      service: fakeService({ kind: "absent" }).service,
      coverage: coverage.resolver,
    });

    expect(view.targetCoverageByCombination).toEqual({});
    expect(coverage.calls()).toBe(0);
  });
});

describe("createUsagePricingCoverageResolver — decisão por tarifas de usage", () => {
  const COMPLETE_USAGE_PRICING: ModelPricing = {
    inputCostUsd: 1,
    cachedInputCostUsd: 0.1,
    imageInputTokenUsdPer1M: 2,
    imageTokenUsdPer1M: 3,
    imageCachedInputTokenUsdPer1M: 0.2,
  };

  it("tarifas de usage completas com imageUnitCostUsd null → complete (image_unit fora da decisão)", async () => {
    const resolver = createUsagePricingCoverageResolver({
      readModelPricing: async () => ({
        kind: "found",
        pricing: { ...COMPLETE_USAGE_PRICING, imageUnitCostUsd: undefined },
        versionId: CONFIG_VERSION_ID,
      }),
    });

    const status = await resolver({
      model: "gpt-image-2.5-sunburst",
      quality: "low",
    });

    expect(status.pricingCoverage).toBe("complete");
    expect(status.missingComponents).toEqual([]);
  });

  it("tarifa de usage ausente → partial (nunca complete)", async () => {
    const withoutUsageRate: ModelPricing = {
      ...COMPLETE_USAGE_PRICING,
      imageTokenUsdPer1M: undefined,
    };
    const resolver = createUsagePricingCoverageResolver({
      readModelPricing: async () => ({
        kind: "found",
        pricing: withoutUsageRate,
        versionId: CONFIG_VERSION_ID,
      }),
    });

    const status = await resolver({ model: "gpt-image-2.5-flare", quality: "medium" });

    expect(status.pricingCoverage).toBe("partial");
    expect(status.missingComponents).toContain("imageTokenUsdPer1M");
    expect(status.missingComponents).not.toContain("image_unit_usd");
  });

  it("linha só com image_unit_usd (sem tarifas de usage) → nunca complete", async () => {
    const resolver = createUsagePricingCoverageResolver({
      readModelPricing: async () => ({
        kind: "found",
        pricing: { imageUnitCostUsd: 0.04 },
        versionId: CONFIG_VERSION_ID,
      }),
    });

    const status = await resolver({ model: "gpt-image-2.5-sunburst", quality: "medium" });

    expect(status.pricingCoverage).toBe("partial");
    expect(status.missingComponents).toEqual(
      expect.arrayContaining([
        "inputCostUsd",
        "cachedInputCostUsd",
        "imageInputTokenUsdPer1M",
        "imageTokenUsdPer1M",
        "imageCachedInputTokenUsdPer1M",
      ]),
    );
  });

  it("linha ausente → missing com pricing_row", async () => {
    const resolver = createUsagePricingCoverageResolver({
      readModelPricing: async () => ({ kind: "row_missing" }),
    });

    const status = await resolver({ model: "gpt-image-2.5-flare", quality: "low" });

    expect(status.pricingCoverage).toBe("missing");
    expect(status.missingComponents).toEqual(["pricing_row"]);
  });

  it("code_default → missing com pricing_code_default (nunca complete)", async () => {
    const resolver = createUsagePricingCoverageResolver({
      readModelPricing: async () => ({
        kind: "code_default",
        pricing: COMPLETE_USAGE_PRICING,
      }),
    });

    const status = await resolver({ model: "gpt-image-2.5-flare", quality: "low" });

    expect(status.pricingCoverage).toBe("missing");
    expect(status.missingComponents).toContain("pricing_code_default");
  });

  it("erro de leitura real com DB simulado → cobertura desconhecida (chave omitida), nunca Ausente", async () => {
    const chain = {
      eq: vi.fn(),
      is: vi.fn(),
      maybeSingle: vi.fn(async () => ({
        data: null,
        error: { message: "db down" },
      })),
    };
    chain.eq.mockReturnValue(chain);
    chain.is.mockReturnValue(chain);
    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => chain),
      })),
    };
    const pricing = new AiModelPricingService(client as never);
    const resolver = createUsagePricingCoverageResolver(pricing);

    await expect(
      resolver({ model: "gpt-image-2.5-flare", quality: "low" }),
    ).rejects.toThrow("pricing_read_failed");

    const view = await buildNineSixteenExpansionConfigView({
      service: fakeService(FOUND).service,
      coverage: resolver,
    });

    expect(view.state).toBe("configured");
    expect(view.targetCoverageByCombination).toEqual({});
  });
});

describe("view — não-ativação (D7)", () => {
  it("não expõe productionActive no tipo nem no objeto serializado", async () => {
    const view = await buildNineSixteenExpansionConfigView({
      service: fakeService(FOUND).service,
      coverage: fakeCoverage().resolver,
    });

    expect("productionActive" in view).toBe(false);
    expect(JSON.stringify(view)).not.toContain("productionActive");
    expect(JSON.stringify(view)).not.toMatch(/Ativa|Ativo|Inativa/);
  });

  it("o fonte da view não menciona productionActive nem o resolvedor do par 1:1", () => {
    const source = readFileSync(
      path.resolve(
        process.cwd(),
        "src/lib/ai/nine-sixteen-expansion-model-config-view.ts",
      ),
      "utf8",
    );
    expect(source).not.toContain("productionActive");
    expect(source).not.toMatch(/resolveTargetCoverage|getImagePairPricingService|imageUnitCostUsd|imageUnitUsd/);
    expect(source).toContain("evaluatePricingCoverage");
  });
});
