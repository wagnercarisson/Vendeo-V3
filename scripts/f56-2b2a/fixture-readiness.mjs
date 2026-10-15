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
//   parseReturnedUuid(lines)        -> { ok, uuid, reason }  (check do `RETURNING`)
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
 * F56.2b2a — Plano 05 (correção do check de `RETURNING`).
 *
 * Ao rodar `psql -c "INSERT ... RETURNING <uuid_col>"` NÃO se pode contar TODAS as
 * linhas de saída: o psql também imprime a TAG DE COMANDO (`INSERT 0 1`). Contar
 * linhas cruas confundiria o status do comando com uma linha de DADOS, e uma
 * fixture "ausente" poderia passar como presente (ou vice-versa). Este helper
 * valida EXPLICITAMENTE o UUID devolvido (ignorando qualquer tag/ruído) — o
 * harness (`scripts/run-f56-2b2a-f562b-proof.ps1`) aplica o MESMO critério ao
 * inserir as fixtures de backfill. Preferir ainda `psql -q` para que a tag não
 * seja sequer emitida.
 */
export const RETURNED_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Extrai o ÚNICO UUID devolvido por um `INSERT ... RETURNING`, IGNORANDO a tag de
 * comando (`INSERT 0 1`) e linhas vazias. Falha se não houver exatamente um UUID.
 * @param {string|string[]} lines saída do psql (uma string ou lista de linhas)
 * @returns {{ ok: boolean, uuid: string|null, reason: string }}
 */
export function parseReturnedUuid(lines) {
  const list = Array.isArray(lines) ? lines : [lines];
  const uuids = list
    .map((line) => String(line ?? "").trim())
    .filter((line) => RETURNED_UUID_PATTERN.test(line));
  if (uuids.length === 1) {
    return { ok: true, uuid: uuids[0], reason: "single_returned_uuid" };
  }
  if (uuids.length === 0) {
    return { ok: false, uuid: null, reason: "no_returned_uuid" };
  }
  return { ok: false, uuid: null, reason: "multiple_returned_uuids" };
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
