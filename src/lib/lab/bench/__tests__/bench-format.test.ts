import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  BENCH_FORMAT_IDS,
  BENCH_FORMAT_SPECS,
  BenchFormatError,
  expectedAspectRatioForFormat,
  expectedDimensionsForFormat,
  isBenchFormat,
  matchesExpectedFormatSize,
  resolveBenchFormat,
  sizeForFormat,
} from "../domain/bench-format";

/**
 * Resolvedor interno de formato da bancada (quick 261107-hcx).
 *
 * Prova, sem provider:
 *  - `1:1` preservado em `1024x1024`;
 *  - `9:16` em `1152x2048` (múltiplos de 16, proporção 9:16);
 *  - comparação de dimensão exata, sem tolerância/resize;
 *  - módulo puro e desacoplado do resolvedor produtivo.
 */

describe("bench-format — tabela fechada", () => {
  it("expõe 1:1, 9:16 e 4:5 com os tamanhos travados", () => {
    expect(BENCH_FORMAT_IDS).toEqual(["1:1", "9:16", "4:5"]);
    expect(BENCH_FORMAT_SPECS["1:1"]).toEqual({
      id: "1:1",
      size: "1024x1024",
      width: 1024,
      height: 1024,
      aspectRatio: 1,
    });
    expect(BENCH_FORMAT_SPECS["9:16"]).toEqual({
      id: "9:16",
      size: "1152x2048",
      width: 1152,
      height: 2048,
      aspectRatio: 9 / 16,
    });
    expect(BENCH_FORMAT_SPECS["4:5"]).toEqual({
      id: "4:5",
      size: "1152x1440",
      width: 1152,
      height: 1440,
      aspectRatio: 4 / 5,
    });
  });

  it("9:16 e 4:5 são divisíveis por 16 e têm proporção exata (sem float)", () => {
    for (const id of ["9:16", "4:5"] as const) {
      const spec = BENCH_FORMAT_SPECS[id];
      expect(spec.width % 16, id).toBe(0);
      expect(spec.height % 16, id).toBe(0);
    }
    expect(BENCH_FORMAT_SPECS["9:16"].width * 16).toBe(
      BENCH_FORMAT_SPECS["9:16"].height * 9,
    );
    expect(BENCH_FORMAT_SPECS["4:5"].width * 5).toBe(
      BENCH_FORMAT_SPECS["4:5"].height * 4,
    );
  });

  it("resolve formato válido e recusa valor fora da tabela", () => {
    expect(resolveBenchFormat("1:1").size).toBe("1024x1024");
    expect(resolveBenchFormat("9:16").size).toBe("1152x2048");
    expect(sizeForFormat("9:16")).toBe("1152x2048");
    expect(expectedAspectRatioForFormat("9:16")).toBe(9 / 16);
    expect(expectedDimensionsForFormat("9:16")).toEqual({ width: 1152, height: 2048 });

    for (const invalid of ["16:9", "", null, undefined, 16]) {
      expect(isBenchFormat(invalid)).toBe(false);
      expect(() => resolveBenchFormat(invalid)).toThrow(BenchFormatError);
    }
  });
});

describe("bench-format — comparação exata da resposta", () => {
  it("aceita somente a dimensão exata do formato", () => {
    expect(
      matchesExpectedFormatSize({ formato: "9:16", width: 1152, height: 2048 }),
    ).toBe(true);
    expect(
      matchesExpectedFormatSize({ formato: "9:16", width: 1024, height: 1024 }),
    ).toBe(false);
    expect(
      matchesExpectedFormatSize({ formato: "9:16", width: 1080, height: 1920 }),
    ).toBe(false);
    expect(matchesExpectedFormatSize({ formato: "1:1", width: 1024, height: 1024 })).toBe(true);
    expect(
      matchesExpectedFormatSize({ formato: "4:5", width: 1152, height: 1440 }),
    ).toBe(true);
    expect(
      matchesExpectedFormatSize({ formato: "4:5", width: 1024, height: 1280 }),
    ).toBe(false);
  });
});

describe("bench-format — isolamento e ausência de resize", () => {
  it("não importa o resolvedor produtivo nem usa sharp/resize", () => {
    const source = readFileSync(
      path.resolve(process.cwd(), "src/lib/lab/bench/domain/bench-format.ts"),
      "utf8",
    );
    for (const forbidden of [
      'from "@/lib/product-vertical-9-16',
      'from "@/lib/product-1-1',
      'from "sharp"',
      "process.env.",
      "process.env[",
      "fetch(",
    ]) {
      expect(source, `bench-format não deve conter ${forbidden}`).not.toContain(forbidden);
    }
  });
});
