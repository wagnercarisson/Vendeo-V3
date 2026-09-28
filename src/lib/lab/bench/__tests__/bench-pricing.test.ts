import { describe, expect, it } from "vitest";

import {
  BENCH_PRICING_ENTRIES,
  BENCH_PRICING_RULE_VERSION,
  resolveBenchPricing,
} from "@/lib/lab/bench/domain/bench-pricing";

/**
 * Pricing local da bancada (F48.2.2, D11/D12).
 *
 * O pricing é chaveado pelo preset completo (`provider + model + protocol +
 * quality + size`) e vive **somente em código** — nunca no pricing produtivo por
 * `provider + model` (que não distingue qualidade).
 */

const BASE = {
  provider: "openai",
  protocol: "images",
  size: "1024x1024",
} as const;

describe("bench-pricing — versionamento", () => {
  it("a versão da regra é estável e propagada na resolução", () => {
    expect(BENCH_PRICING_RULE_VERSION).toBe("2026-09-bench-1");
    const resolution = resolveBenchPricing({ ...BASE, model: "gpt-image-2", quality: "low" });
    expect(resolution.ruleVersion).toBe(BENCH_PRICING_RULE_VERSION);
  });
});

describe("bench-pricing — quality distingue o custo (low ≠ medium)", () => {
  it("gpt-image-2: low e medium devolvem custos/estimativas distintos", () => {
    const low = resolveBenchPricing({ ...BASE, model: "gpt-image-2", quality: "low" });
    const medium = resolveBenchPricing({ ...BASE, model: "gpt-image-2", quality: "medium" });

    expect(low.coverage).not.toBe("missing");
    expect(medium.coverage).not.toBe("missing");
    expect(low.unitPriceUsd).toBeDefined();
    expect(medium.unitPriceUsd).toBeDefined();
    expect(low.unitPriceUsd).not.toBe(medium.unitPriceUsd);
    expect(low.estimatedOutputTokens).not.toBe(medium.estimatedOutputTokens);
    expect(low.mode).toBe("token_based");
  });

  it("gpt-image-2.5-flare: low e medium também devolvem custos distintos", () => {
    const low = resolveBenchPricing({ ...BASE, model: "gpt-image-2.5-flare", quality: "low" });
    const medium = resolveBenchPricing({
      ...BASE,
      model: "gpt-image-2.5-flare",
      quality: "medium",
    });

    expect(low.unitPriceUsd).toBeDefined();
    expect(medium.unitPriceUsd).toBeDefined();
    expect(low.unitPriceUsd).not.toBe(medium.unitPriceUsd);
  });

  it("há entradas distintas por qualidade para o mesmo modelo/protocolo/tamanho", () => {
    const forModel = BENCH_PRICING_ENTRIES.filter((entry) => entry.model === "gpt-image-2");
    const qualities = new Set(forModel.map((entry) => entry.quality));
    expect(qualities.size).toBeGreaterThan(1);
    const unitPrices = new Set(forModel.map((entry) => entry.unitPriceUsd));
    expect(unitPrices.size).toBeGreaterThan(1);
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

  it("o modo confirmado pelo spike é token_based com taxas por token", () => {
    for (const entry of BENCH_PRICING_ENTRIES) {
      expect(entry.mode).toBe("token_based");
      expect(entry.tokenRates).toBeDefined();
      expect(entry.tokenRates!.outputImageUsdPerMillion).toBeGreaterThan(0);
    }
  });
});
