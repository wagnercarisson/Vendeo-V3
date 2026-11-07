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
  it("expõe 1:1 e 9:16 com os tamanhos travados", () => {
    expect(BENCH_FORMAT_IDS).toEqual(["1:1", "9:16"]);
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
  });

  it("9:16 é divisível por 16 e tem proporção exata (sem float)", () => {
    const spec = BENCH_FORMAT_SPECS["9:16"];
    expect(spec.width % 16).toBe(0);
    expect(spec.height % 16).toBe(0);
    expect(spec.width * 16).toBe(spec.height * 9);
  });

  it("resolve formato válido e recusa valor fora da tabela", () => {
    expect(resolveBenchFormat("1:1").size).toBe("1024x1024");
    expect(resolveBenchFormat("9:16").size).toBe("1152x2048");
    expect(sizeForFormat("9:16")).toBe("1152x2048");
    expect(expectedAspectRatioForFormat("9:16")).toBe(9 / 16);
    expect(expectedDimensionsForFormat("9:16")).toEqual({ width: 1152, height: 2048 });

    for (const invalid of ["4:5", "", null, undefined, 16]) {
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
