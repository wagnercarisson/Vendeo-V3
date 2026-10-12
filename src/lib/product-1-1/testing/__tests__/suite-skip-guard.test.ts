import { describe, expect, it } from "vitest";

import {
  assertSuitesFullyExecuted,
  evaluateSuiteCoverage,
  parseVitestTestsSummary,
} from "../suite-skip-guard";

/**
 * F56.2b1b — T-56.2.2-09-02: o validador por suíte precisa (a) detectar uma
 * suíte INTEIRAMENTE pulada (executados = 0), (b) recusar qualquer skip e
 * (c) recusar entradas INCONSISTENTES (soma != total; segmento desconhecido),
 * para que "verde por skipped"/"verde por contagem inventada" não passe no gate
 * isolado. Testes puros — sem banco.
 */

const ALL_PASSED = [
  " Test Files  1 passed (1)",
  "      Tests  12 passed (12)",
  "   Start at  20:00:00",
  "   Duration  1.23s",
].join("\n");

const FULLY_SKIPPED = [
  " Test Files  1 skipped (1)",
  "      Tests  5 skipped (5)",
  "   Duration  0.01s",
].join("\n");

const PARTIAL_SKIP = [
  " Test Files  1 passed (1)",
  "      Tests  10 passed | 2 skipped (12)",
  "   Duration  0.50s",
].join("\n");

const WITH_FAILURE = [
  " Test Files  1 failed (1)",
  "      Tests  1 failed | 11 passed (12)",
  "   Duration  0.60s",
].join("\n");

const WITH_TODO = [
  " Test Files  1 passed (1)",
  "      Tests  11 passed | 1 todo (12)",
  "   Duration  0.40s",
].join("\n");

const COMPILE_ERROR = [
  "Error: Transform failed with 1 error",
  "src/foo.ts:1:1: error: unexpected token",
].join("\n");

const ANSI_COLORED = "\u001b[32m      Tests  7 passed (7)\u001b[39m";

// Segmento NÃO reconhecido (o vitest usa `skipped`, não `pending`): um parser
// permissivo leria isto como "1 passou" ⇒ "integralmente executado". Deve RECUSAR.
const UNKNOWN_SEGMENT = [
  " Test Files  1 passed (1)",
  "      Tests  1 passed | 4 pending (5)",
].join("\n");

// Soma das contagens (1) DIFERE do total (5): entrada inconsistente. Deve RECUSAR.
const INCONSISTENT_TOTAL = [
  " Test Files  1 passed (1)",
  "      Tests  1 passed (5)",
].join("\n");

describe("parseVitestTestsSummary", () => {
  it("extrai as contagens da linha agregada `Tests`", () => {
    expect(parseVitestTestsSummary(ALL_PASSED)).toEqual({
      ok: true,
      summary: { passed: 12, failed: 0, skipped: 0, todo: 0, total: 12 },
    });
  });

  it("soma skipped/todo e tolera saída com ANSI", () => {
    expect(parseVitestTestsSummary(PARTIAL_SKIP)).toEqual({
      ok: true,
      summary: { passed: 10, failed: 0, skipped: 2, todo: 0, total: 12 },
    });
    const ansi = parseVitestTestsSummary(ANSI_COLORED);
    expect(ansi.ok && ansi.summary.passed).toBe(7);
  });

  it("não confunde a linha `Test Files` com `Tests`", () => {
    const parsed = parseVitestTestsSummary(
      [" Test Files  1 passed (1)", "      Tests  3 passed (3)"].join("\n"),
    );
    expect(parsed.ok && parsed.summary.passed).toBe(3);
    expect(parsed.ok && parsed.summary.total).toBe(3);
  });

  it("recusa quando a linha agregada está ausente (erro de compilação)", () => {
    expect(parseVitestTestsSummary(COMPILE_ERROR)).toEqual({
      ok: false,
      reason: "summary_unparsable",
    });
  });

  it("recusa SEGMENTO DESCONHECIDO (`pending`) em vez de tratar como executado", () => {
    expect(parseVitestTestsSummary(UNKNOWN_SEGMENT)).toEqual({
      ok: false,
      reason: "unknown_segment",
    });
  });

  it("recusa contagens INCONSISTENTES (soma != total)", () => {
    expect(parseVitestTestsSummary(INCONSISTENT_TOTAL)).toEqual({
      ok: false,
      reason: "inconsistent_total",
    });
  });
});

describe("evaluateSuiteCoverage", () => {
  it("aceita suíte integralmente executada", () => {
    const coverage = evaluateSuiteCoverage("a.test.ts", ALL_PASSED);
    expect(coverage.ok).toBe(true);
    expect(coverage.reason).toBe("fully_executed");
    expect(coverage.executed).toBe(12);
    expect(coverage.skipped).toBe(0);
  });

  it("recusa suíte INTEIRAMENTE pulada (executados = 0)", () => {
    const coverage = evaluateSuiteCoverage("a.test.ts", FULLY_SKIPPED);
    expect(coverage.ok).toBe(false);
    expect(coverage.reason).toBe("no_tests_executed");
    expect(coverage.executed).toBe(0);
  });

  it("recusa suíte com QUALQUER skip", () => {
    expect(evaluateSuiteCoverage("a.test.ts", PARTIAL_SKIP).reason).toBe("tests_skipped");
    expect(evaluateSuiteCoverage("a.test.ts", WITH_TODO).reason).toBe("tests_skipped");
  });

  it("considera testes FALHOS como executados (o exit code cobre a falha)", () => {
    const coverage = evaluateSuiteCoverage("a.test.ts", WITH_FAILURE);
    expect(coverage.ok).toBe(true);
    expect(coverage.executed).toBe(12);
    expect(coverage.skipped).toBe(0);
  });

  it("falha fechado quando o resumo é inanalisável", () => {
    expect(evaluateSuiteCoverage("a.test.ts", COMPILE_ERROR).reason).toBe(
      "summary_unparsable",
    );
  });

  it("recusa segmento desconhecido e contagem inconsistente (fail-closed)", () => {
    const unknown = evaluateSuiteCoverage("a.test.ts", UNKNOWN_SEGMENT);
    expect(unknown.ok).toBe(false);
    expect(unknown.reason).toBe("unknown_segment");

    const inconsistent = evaluateSuiteCoverage("a.test.ts", INCONSISTENT_TOTAL);
    expect(inconsistent.ok).toBe(false);
    expect(inconsistent.reason).toBe("inconsistent_total");
  });
});

describe("assertSuitesFullyExecuted", () => {
  it("não lança quando todas as suítes estão cobertas", () => {
    expect(() =>
      assertSuitesFullyExecuted([
        evaluateSuiteCoverage("a.test.ts", ALL_PASSED),
        evaluateSuiteCoverage("b.test.ts", WITH_FAILURE),
      ]),
    ).not.toThrow();
  });

  it("lança com detalhe determinístico listando as suítes problemáticas", () => {
    expect(() =>
      assertSuitesFullyExecuted([
        evaluateSuiteCoverage("ok.test.ts", ALL_PASSED),
        evaluateSuiteCoverage("skipped.test.ts", FULLY_SKIPPED),
        evaluateSuiteCoverage("partial.test.ts", PARTIAL_SKIP),
      ]),
    ).toThrowError(
      /suite_coverage_guard: skipped\.test\.ts: no_tests_executed \(executed=0, skipped=5\); partial\.test\.ts: tests_skipped \(executed=10, skipped=2\)/,
    );
  });

  it("recusa entradas inconsistentes no agregado", () => {
    expect(() =>
      assertSuitesFullyExecuted([
        evaluateSuiteCoverage("unknown.test.ts", UNKNOWN_SEGMENT),
        evaluateSuiteCoverage("inconsistent.test.ts", INCONSISTENT_TOTAL),
      ]),
    ).toThrowError(
      /unknown\.test\.ts: unknown_segment .*consistent\.test\.ts: inconsistent_total/,
    );
  });
});
