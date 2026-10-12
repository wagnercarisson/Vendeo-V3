/**
 * F56.2b1b (Plano 09 — T-56.2.2-09-02) — CLI do validador de cobertura por suíte.
 *
 * Consome a saída SANITIZADA de UMA suíte e sai com código != 0 quando a suíte não
 * foi integralmente executada (`executados > 0` E `skipped === 0`). Chamado pelo
 * runner isolado via `tsx` — sem acesso a banco.
 *
 * Uso:
 *   npx tsx scripts/verify/f56-2-2-suite-skip-guard.ts \
 *     --suite <caminho-da-suíte> --output-file <arquivo-com-saída>
 */

import { readFileSync } from "node:fs";

import {
  assertSuitesFullyExecuted,
  evaluateSuiteCoverage,
} from "../../src/lib/product-1-1/testing/suite-skip-guard";

function argValue(name: string): string | null {
  const index = process.argv.indexOf(name);
  if (index === -1 || index + 1 >= process.argv.length) return null;
  return process.argv[index + 1];
}

const suite = argValue("--suite");
const outputFile = argValue("--output-file");

if (!suite || !outputFile) {
  console.error(
    "suite_coverage_guard: uso inválido — requeridos --suite <nome> e --output-file <caminho>",
  );
  process.exit(2);
}

let output: string;
try {
  output = readFileSync(outputFile, "utf8");
} catch {
  console.error(`suite_coverage_guard: ${suite}: output_unreadable`);
  process.exit(1);
}

const coverage = evaluateSuiteCoverage(suite, output);
try {
  assertSuitesFullyExecuted([coverage]);
  console.log(
    `suite_coverage_guard: OK ${suite} (executed=${coverage.executed}, skipped=${coverage.skipped})`,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
