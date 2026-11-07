import { describe, expect, it } from "vitest";

import {
  BENCH_PRICING_ENTRIES,
  BENCH_PRICING_RULE_VERSION,
  resolveBenchPricing,
} from "@/lib/lab/bench/domain/bench-pricing";

/**
 * Pricing local da bancada (F48.2.5, regra `2026-10-bench-3`).
 *
 * Tarifas oficiais (Standard, por 1M tokens): **texto US$5 / imagem de entrada
 * US$8 / imagem de saída US$30** para os três modelos. A estimativa prévia é
 * honesta: estimativa do calculador oficial é somente de saída; tokens de entrada
 * e imagens parciais em streaming são adicionais, logo coverage permanece partial.
 */

const BASE = {
  provider: "openai",
  protocol: "images",
  size: "1024x1024",
} as const;

const OFFICIAL_RATES = {
  inputTextUsdPerMillion: 5,
  inputImageUsdPerMillion: 8,
  outputImageUsdPerMillion: 30,
};

describe("bench-pricing — versionamento", () => {
  it("a versão vigente é 2026-11-bench-4 e é propagada na resolução", () => {
    expect(BENCH_PRICING_RULE_VERSION).toBe("2026-11-bench-4");
    const resolution = resolveBenchPricing({ ...BASE, model: "gpt-image-2", quality: "low" });
    expect(resolution.ruleVersion).toBe(BENCH_PRICING_RULE_VERSION);
  });
});

describe("bench-pricing — tarifas oficiais por token (5/8/30)", () => {
  it.each(["gpt-image-2", "gpt-image-2.5-flare", "gpt-image-2.5-sunburst"])(
    "%s usa texto US$5 / imagem entrada US$8 / saída US$30",
    (model) => {
      const resolution = resolveBenchPricing({ ...BASE, model, quality: "low" });
      expect(resolution.mode).toBe("token_based");
      expect(resolution.tokenRates).toEqual(OFFICIAL_RATES);
    },
  );
});

describe("bench-pricing — estimativa prévia honesta", () => {
  it("gpt-image-2 low usa estimativa oficial de saída; medium permanece sem estimativa", () => {
    const low = resolveBenchPricing({ ...BASE, model: "gpt-image-2", quality: "low" });
    const medium = resolveBenchPricing({ ...BASE, model: "gpt-image-2", quality: "medium" });

    expect(low.coverage).toBe("partial");
    expect(medium.coverage).toBe("partial");
    // Os tokens 400/3533 derivados da tarifa antiga (US$15/M) NÃO são reaproveitados.
    expect(low.estimatedOutputTokens).toBe(196);
    expect(low.estimateSource).toBe("official_calculator");
    expect(low.unitPriceUsd).toBeCloseTo(0.00588, 6);
    expect(medium.estimatedOutputTokens).toBeUndefined();
    expect(medium.unitPriceUsd).toBeUndefined();
    expect(low.coverage).toBe("partial");
  });

  it("gpt-image-2.5-flare low usa 196 tokens (calculador oficial); medium fica ausente", () => {
    const low = resolveBenchPricing({ ...BASE, model: "gpt-image-2.5-flare", quality: "low" });
    const medium = resolveBenchPricing({
      ...BASE,
      model: "gpt-image-2.5-flare",
      quality: "medium",
    });

    expect(low.estimatedOutputTokens).toBe(196);
    expect(low.estimateSource).toBe("official_calculator");
    expect(low.unitPriceUsd).toBeCloseTo(0.00588, 6);
    expect(low.coverage).toBe("partial");

    expect(medium.estimatedOutputTokens).toBeUndefined();
    expect(medium.unitPriceUsd).toBeUndefined();
    expect(medium.coverage).toBe("partial");
  });

  it("gpt-image-2.5-sunburst low usa estimativa oficial; medium permanece ausente", () => {
    for (const quality of ["low", "medium"]) {
      const resolution = resolveBenchPricing({
        ...BASE,
        model: "gpt-image-2.5-sunburst",
        quality,
      });
      expect(resolution.coverage, quality).toBe("partial");
      expect(resolution.mode, quality).toBe("token_based");
      if (quality === "low") {
        expect(resolution.estimatedOutputTokens).toBe(196);
        expect(resolution.estimateSource).toBe("official_calculator");
        expect(resolution.unitPriceUsd).toBeCloseTo(0.00588, 6);
      } else {
        expect(resolution.estimatedOutputTokens).toBeUndefined();
        expect(resolution.unitPriceUsd).toBeUndefined();
      }
    }
  });
});

describe("bench-pricing — combinação ausente e modo confirmado", () => {
  it("combinação ausente devolve coverage: missing (sem pricing produtivo)", () => {
    const missing = resolveBenchPricing({
      ...BASE,
      model: "modelo-inexistente",
      quality: "low",
    });
    expect(missing.coverage).toBe("missing");
    expect(missing.mode).toBe("unknown");
    expect(missing.unitPriceUsd).toBeUndefined();
    expect(missing.tokenRates).toBeUndefined();
    expect(missing.ruleVersion).toBe(BENCH_PRICING_RULE_VERSION);
  });

  it("tamanho fora do recorte também é missing (a chave inclui o size)", () => {
    const missing = resolveBenchPricing({
      ...BASE,
      model: "gpt-image-2",
      quality: "low",
      size: "1536x1024",
    });
    expect(missing.coverage).toBe("missing");
  });

  it("todos os presets habilitados são token_based com as tarifas oficiais", () => {
    for (const entry of BENCH_PRICING_ENTRIES) {
      expect(entry.mode).toBe("token_based");
      expect(entry.tokenRates).toEqual(OFFICIAL_RATES);
      expect(entry.coverage).toBe("partial");
    }
  });
});

describe("bench-pricing — 9:16 e gpt-image-2.6-sunburst", () => {
  it("9:16 dos modelos existentes mantém tarifas oficiais e não inventa estimativa de saída", () => {
    for (const model of ["gpt-image-2", "gpt-image-2.5-flare", "gpt-image-2.5-sunburst"]) {
      for (const quality of ["low", "medium"]) {
        const resolution = resolveBenchPricing({
          provider: "openai",
          protocol: "images",
          model,
          quality,
          size: "1152x2048",
        });
        expect(resolution.mode, `${model}/${quality}`).toBe("token_based");
        expect(resolution.coverage, `${model}/${quality}`).toBe("partial");
        expect(resolution.tokenRates, `${model}/${quality}`).toEqual(OFFICIAL_RATES);
        expect(resolution.estimatedOutputTokens, `${model}/${quality}`).toBeUndefined();
        expect(resolution.unitPriceUsd, `${model}/${quality}`).toBeUndefined();
      }
    }
  });

  it("4:5 dos modelos existentes e do 2.6 mantém tarifas oficiais e não inventa estimativa", () => {
    for (const [model, quality] of [
      ["gpt-image-2", "low"],
      ["gpt-image-2", "medium"],
      ["gpt-image-2.5-flare", "low"],
      ["gpt-image-2.5-flare", "medium"],
      ["gpt-image-2.5-sunburst", "low"],
      ["gpt-image-2.5-sunburst", "medium"],
      ["gpt-image-2.6-sunburst", "medium"],
    ] as const) {
      const resolution = resolveBenchPricing({
        provider: "openai",
        protocol: "images",
        model,
        quality,
        size: "1152x1440",
      });
      expect(resolution.mode, `${model}/${quality}`).toBe("token_based");
      expect(resolution.coverage, `${model}/${quality}`).toBe("partial");
      expect(resolution.tokenRates, `${model}/${quality}`).toEqual(OFFICIAL_RATES);
      expect(resolution.estimatedOutputTokens, `${model}/${quality}`).toBeUndefined();
      expect(resolution.unitPriceUsd, `${model}/${quality}`).toBeUndefined();
    }
  });

  it("2.6 medium em 1:1 e 9:16 usa 5/8/30 e fica sem estimativa inventada", () => {
    for (const size of ["1024x1024", "1152x2048"]) {
      const resolution = resolveBenchPricing({
        provider: "openai",
        protocol: "images",
        model: "gpt-image-2.6-sunburst",
        quality: "medium",
        size,
      });
      expect(resolution.mode, size).toBe("token_based");
      expect(resolution.coverage, size).toBe("partial");
      expect(resolution.tokenRates, size).toEqual(OFFICIAL_RATES);
      expect(resolution.estimatedOutputTokens, size).toBeUndefined();
      expect(resolution.unitPriceUsd, size).toBeUndefined();
    }
  });
});
