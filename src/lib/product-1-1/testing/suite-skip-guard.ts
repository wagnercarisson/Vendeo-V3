/**
 * F56.2b1b (Plano 09 — T-56.2.2-09-02) — VALIDADOR DE COBERTURA POR SUÍTE.
 *
 * O gate isolado (`scripts/run-f56-2b1b-isolated-integration.ps1`) roda
 * `npx vitest run <suite>` e só falha quando o vitest retorna exit != 0. Um
 * arquivo de teste INTEIRAMENTE pulado (`describe.skip` / filtro) NÃO produz
 * falha — o vitest sai com 0 — de modo que uma "suíte verde por skipped"
 * passaria pelo gate. Este validador fecha essa lacuna: para CADA suíte, exige
 * `executados > 0` **E** `skipped === 0`.
 *
 * O parsing é ESTRITO e fail-closed (T-56.2.2-09-02):
 *  - a linha agregada ausente ⇒ `summary_unparsable`;
 *  - QUALQUER segmento fora de `passed|failed|skipped|todo` ⇒ `unknown_segment`
 *    (ex.: `1 passed | 4 pending (5)` NÃO pode ser lido como "tudo executado");
 *  - `passed + failed + skipped + todo !== total` ⇒ `inconsistent_total`.
 *
 * As funções abaixo são PURAS (não acessam banco, rede ou filesystem) e são
 * testadas em `__tests__/suite-skip-guard.test.ts`. O runner as consome via
 * `scripts/verify/f56-2-2-suite-skip-guard.ts` (wrapper `tsx`), alimentado com a
 * saída SANITIZADA de cada suíte.
 */

/** Resumo agregado das contagens da linha `Tests` do vitest. */
export interface VitestTestsSummary {
  readonly passed: number;
  readonly failed: number;
  readonly skipped: number;
  readonly todo: number;
  readonly total: number;
}

/** Motivos de REJEIÇÃO do parsing (fail-closed). */
export type VitestParseFailureReason =
  | "summary_unparsable"
  | "unknown_segment"
  | "inconsistent_total";

/** Resultado ESTRITO do parsing: ou um resumo íntegro, ou o motivo da recusa. */
export type VitestSummaryParse =
  | { readonly ok: true; readonly summary: VitestTestsSummary }
  | { readonly ok: false; readonly reason: VitestParseFailureReason };

/** Cobertura avaliada de uma suíte. */
export interface SuiteCoverage {
  readonly suite: string;
  /** Testes que DE FATO rodaram (passed + failed). */
  readonly executed: number;
  /** Testes não executados (skipped + todo). */
  readonly skipped: number;
  readonly total: number;
  readonly ok: boolean;
  readonly reason:
    | "fully_executed"
    | "no_tests_executed"
    | "tests_skipped"
    | VitestParseFailureReason;
}

/** Remove sequências ANSI para tornar a análise robusta a saída colorida. */
function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\u001b\[[0-9;]*m/g, "");
}

// A linha agregada do vitest tem a forma:
//   `      Tests  12 passed (12)`
//   `      Tests  10 passed | 2 skipped (12)`
//   `      Tests  1 failed | 11 passed (12)`
// `Test Files  1 passed (1)` NÃO casa (o rótulo é `Test Files`, não `Tests`).
const TESTS_LINE = /^[ \t]*Tests[ \t]{2,}(.+?)[ \t]+\((\d+)\)[ \t]*$/m;
// Um segmento válido é EXATAMENTE `<inteiro> <rótulo minúsculo>`; o rótulo é
// então validado contra o conjunto conhecido (recusa de `pending`, `ignored`, …).
const SEGMENT = /^(\d+)[ \t]+([a-z]+)$/;
const KNOWN_SEGMENTS: ReadonlySet<string> = new Set([
  "passed",
  "failed",
  "skipped",
  "todo",
]);

/**
 * Extrai o resumo da linha `Tests` de forma ESTRITA. Nunca "adivinha": qualquer
 * inconsistência resulta em recusa (fail-closed), nunca em cobertura otimista.
 */
export function parseVitestTestsSummary(output: string): VitestSummaryParse {
  const match = TESTS_LINE.exec(stripAnsi(output));
  if (!match) return { ok: false, reason: "summary_unparsable" };

  const total = Number(match[2]);
  const parts = match[1]
    .split("|")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (parts.length === 0) return { ok: false, reason: "summary_unparsable" };

  let passed = 0;
  let failed = 0;
  let skipped = 0;
  let todo = 0;

  for (const part of parts) {
    const segment = SEGMENT.exec(part);
    if (!segment || !KNOWN_SEGMENTS.has(segment[2])) {
      return { ok: false, reason: "unknown_segment" };
    }
    const value = Number(segment[1]);
    switch (segment[2]) {
      case "passed":
        passed += value;
        break;
      case "failed":
        failed += value;
        break;
      case "skipped":
        skipped += value;
        break;
      case "todo":
        todo += value;
        break;
    }
  }

  // Toda contagem precisa ser atribuível: nenhuma perda/segmento não contado.
  if (passed + failed + skipped + todo !== total) {
    return { ok: false, reason: "inconsistent_total" };
  }

  return { ok: true, summary: { passed, failed, skipped, todo, total } };
}

/**
 * Avalia a cobertura de uma suíte a partir da sua saída. `ok` é `true` SOMENTE
 * quando a suíte executou ao menos um teste e não pulou nenhum.
 */
export function evaluateSuiteCoverage(suite: string, output: string): SuiteCoverage {
  const parsed = parseVitestTestsSummary(output);
  if (!parsed.ok) {
    return {
      suite,
      executed: 0,
      skipped: 0,
      total: 0,
      ok: false,
      reason: parsed.reason,
    };
  }

  const { passed, failed, skipped: skippedCount, todo, total } = parsed.summary;
  const executed = passed + failed;
  const skipped = skippedCount + todo;

  if (total <= 0 || executed <= 0) {
    return { suite, executed, skipped, total, ok: false, reason: "no_tests_executed" };
  }
  if (skipped > 0) {
    return { suite, executed, skipped, total, ok: false, reason: "tests_skipped" };
  }
  return { suite, executed, skipped, total, ok: true, reason: "fully_executed" };
}

/**
 * Lança quando QUALQUER suíte não foi integralmente executada. A mensagem é
 * determinística e lista todas as suítes problemáticas (fail-closed).
 */
export function assertSuitesFullyExecuted(
  coverages: readonly SuiteCoverage[],
): void {
  const failing = coverages.filter((coverage) => !coverage.ok);
  if (failing.length > 0) {
    const detail = failing
      .map(
        (coverage) =>
          `${coverage.suite}: ${coverage.reason} (executed=${coverage.executed}, skipped=${coverage.skipped})`,
      )
      .join("; ");
    throw new Error(`suite_coverage_guard: ${detail}`);
  }
}
