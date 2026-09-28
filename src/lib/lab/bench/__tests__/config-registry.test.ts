import { describe, expect, it } from "vitest";

import {
  BENCH_CONFIG_REGISTRY,
  BENCH_REGISTRY_DIMENSIONS,
  BenchConfigRegistryError,
  DEFAULT_BENCH_CONFIG,
  listBenchConfigOptions,
  resolveBenchConfig,
  validateBenchConfigRegistry,
} from "@/lib/lab/bench/domain/config-registry";
import type { BenchDimensions } from "@/lib/lab/bench/domain/schemas";

/**
 * Registry de dimensões da bancada (F48.2.2, D6).
 *
 * A autoridade dos valores é o registry em código: o primeiro recorte fica
 * habilitado, os valores futuros ficam desabilitados com motivo e um valor fora
 * do registry é recusado antes de qualquer chamada paga.
 */

function fullConfig(overrides: Partial<BenchDimensions> = {}): BenchDimensions {
  return {
    pipeline: "manual-direto",
    formato: "1:1",
    modelo: "gpt-image-2",
    qualidade: "low",
    intencao: "oferta",
    tipoConteudo: "produto",
    estrutura: "peca-unica",
    tema: "nenhum",
    ...overrides,
  };
}

describe("config-registry — primeiro recorte habilitado", () => {
  it("DEFAULT_BENCH_CONFIG é o primeiro recorte travado", () => {
    expect(DEFAULT_BENCH_CONFIG).toEqual({
      pipeline: "manual-direto",
      formato: "1:1",
      intencao: "oferta",
      tipoConteudo: "produto",
      estrutura: "peca-unica",
      tema: "nenhum",
    });
  });

  it("resolveBenchConfig aceita o primeiro recorte e preserva modelo/qualidade", () => {
    const resolved = resolveBenchConfig(fullConfig());
    expect(resolved).toEqual(fullConfig());
    expect(resolved.modelo).toBe("gpt-image-2");
    expect(resolved.qualidade).toBe("low");
  });

  it("o registry é válido (fail-fast) e cada dimensão tem exatamente uma entrada habilitada", () => {
    expect(() => validateBenchConfigRegistry()).not.toThrow();
    for (const dimension of BENCH_REGISTRY_DIMENSIONS) {
      const enabled = BENCH_CONFIG_REGISTRY[dimension].filter((entry) => entry.enabled);
      expect(enabled, `${dimension} habilitadas`).toHaveLength(1);
    }
  });

  it("todas as entradas desabilitadas declaram motivo", () => {
    for (const dimension of BENCH_REGISTRY_DIMENSIONS) {
      for (const entry of BENCH_CONFIG_REGISTRY[dimension]) {
        if (!entry.enabled) {
          expect(entry.reason, `${dimension}:${entry.id}`).toBeTruthy();
        }
      }
    }
  });
});

describe("config-registry — valor fora do registry é recusado", () => {
  it("lança config_registry_unknown_value antes de qualquer chamada paga", () => {
    const error = (() => {
      try {
        resolveBenchConfig(fullConfig({ pipeline: "inexistente" }));
        return null;
      } catch (caught) {
        return caught;
      }
    })();

    expect(error).toBeInstanceOf(BenchConfigRegistryError);
    expect((error as BenchConfigRegistryError).code).toBe("config_registry_unknown_value");
    expect((error as BenchConfigRegistryError).dimension).toBe("pipeline");
    expect((error as BenchConfigRegistryError).value).toBe("inexistente");
  });

  it("lança config_registry_value_disabled com motivo para os valores futuros", () => {
    for (const [dimension, value] of [
      ["formato", "9:16"],
      ["intencao", "destaque"],
      ["intencao", "exclusivo"],
      ["tipoConteudo", "servico"],
      ["estrutura", "carrossel"],
    ] as const) {
      const error = (() => {
        try {
          resolveBenchConfig(fullConfig({ [dimension]: value } as Partial<BenchDimensions>));
          return null;
        } catch (caught) {
          return caught;
        }
      })();

      expect(error, `${dimension}=${value}`).toBeInstanceOf(BenchConfigRegistryError);
      expect((error as BenchConfigRegistryError).code).toBe("config_registry_value_disabled");
      expect((error as BenchConfigRegistryError).reason).toBeTruthy();
    }
  });

  it("listBenchConfigOptions expõe habilitados e desabilitados com motivo", () => {
    const formats = listBenchConfigOptions("formato");
    expect(formats.some((entry) => entry.id === "1:1" && entry.enabled)).toBe(true);
    const vertical = formats.find((entry) => entry.id === "9:16");
    expect(vertical?.enabled).toBe(false);
    expect(vertical?.reason).toBeTruthy();
  });
});
