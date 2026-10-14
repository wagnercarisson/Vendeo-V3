#!/usr/bin/env node
// F56.2b2a — Plano 05 (hardening fail-closed).
//
// Guard PURO e testável de "prontidão de fixtures" ANTES da aplicação da
// `20261013000003_f56_2b2a_copy_state_backfill.sql`. NÃO abre banco nem rede:
// recebe os FATOS OBSERVADOS (linhas lidas do Postgres isolado pelo harness) e
// decide se a migração de backfill PODE ser aplicada.
//
// Regra (critérios 22 / §4.6 / §4.8): a `0003` só pode rodar quando AMBAS as
// fixtures existem e AINDA têm identidade NULL (a `0003` faz `SET NOT NULL` em
// `attempt_seq`/`attempt_token`, logo fixtures nulas são impossíveis DEPOIS).
//   - a fixture de `product_1_1_copy_state` existe com `attempt_seq IS NULL`
//     E `attempt_token IS NULL`;
//   - a fixture de `product_1_1_copy_cancellations` existe com `attempt_seq IS NULL`
//     E `attempt_token IS NULL`.
// Qualquer falha ⇒ `mayApplyBackfillMigration = false`; o harness DEVE parar
// (throw) antes de qualquer `migration up`. O harness consome ESTE módulo — a
// decisão testada aqui é a MESMA que decide o halt lá.
//
// Contrato (exportado):
//   evaluateFixtureReadiness(input) -> { ready, mayApplyBackfillMigration, failures }
// CLI: lê o JSON do stdin, imprime JSON e sai 0 (pronto) ou 1 (bloqueado).
//
// Como rodar o teste negativo (sem DB):
//   node --test scripts/f56-2b2a/__tests__/fixture-readiness.test.mjs

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

/**
 * @typedef {Object} FixtureObservation
 * @property {boolean} present       alguma linha existe para (campaign, operation)
 * @property {boolean} nullIdentity  TODAS as linhas têm attempt_seq/attempt_token NULL
 */

/**
 * @typedef {Object} ReadinessInput
 * @property {boolean} campaignPresent
 * @property {FixtureObservation} stateFixture
 * @property {FixtureObservation} cancellationFixture
 */

function isTrue(value) {
  return value === true;
}

/**
 * Decide, a partir dos fatos observados, se a `0003` pode ser aplicada.
 * @param {ReadinessInput} input
 * @returns {{ ready: boolean, mayApplyBackfillMigration: boolean, failures: string[] }}
 */
export function evaluateFixtureReadiness(input) {
  const failures = [];

  if (!isTrue(input?.campaignPresent)) {
    failures.push("campaign fixture missing");
  }

  /** @type {Array<[string, FixtureObservation|undefined]>} */
  const fixtures = [
    ["product_1_1_copy_state", input?.stateFixture],
    ["product_1_1_copy_cancellations", input?.cancellationFixture],
  ];

  for (const [role, fixture] of fixtures) {
    if (!isTrue(fixture?.present)) {
      failures.push(`${role} fixture missing (no row for campaign/operation)`);
      continue;
    }
    if (!isTrue(fixture?.nullIdentity)) {
      failures.push(
        `${role} fixture identity is not NULL (attempt_seq/attempt_token must be NULL before 0003)`,
      );
    }
  }

  const ready = failures.length === 0;
  return { ready, mayApplyBackfillMigration: ready, failures };
}

/**
 * @param {ReturnType<typeof evaluateFixtureReadiness>} result
 */
export function renderReadiness(result) {
  if (result.ready) {
    return "# fixture readiness: PASS (both fixtures present with NULL identity; 0003 may be applied)";
  }
  return `# fixture readiness: HALT (${result.failures.join("; ")})`;
}

function main() {
  let raw = "";
  try {
    raw = readFileSync(0, "utf8");
  } catch {
    raw = "";
  }

  let parsed;
  try {
    parsed = raw.trim() ? JSON.parse(raw) : {};
  } catch (err) {
    console.error(`ERRO: readiness input nao e JSON valido: ${err.message}`);
    process.exit(2);
  }

  const result = evaluateFixtureReadiness(parsed);
  console.log(JSON.stringify({ ...result, message: renderReadiness(result) }));
  process.exit(result.ready ? 0 : 1);
}

const thisFile = fileURLToPath(import.meta.url);
const invoked = process.argv[1]
  ? path.resolve(process.argv[1]) === path.resolve(thisFile)
  : false;
if (invoked) {
  main();
}
