// F56.2b2a — Plano 05 (hardening fail-closed).
//
// Teste NEGATIVO, DETERMINÍSTICO e SEM BANCO: prova que, quando uma fixture está
// ausente/falha (ou a identidade NÃO é NULL), o guard de prontidão BLOQUEIA a
// aplicação da `0003` (`mayApplyBackfillMigration === false`). Como o harness
// `scripts/run-f56-2b2a-isolated-integration.ps1` CONSUME este guard e faz
// `throw` quando ele retorna não-zero, bloquear aqui == o harness NUNCA alcança
// `migration up`.
//
// Executado com `node --test` (não com o Vitest: `scripts/f56-2b2a/**` está
// excluído do Vitest, espelhando `scripts/gsd/**`).
//
// Como rodar:
//   node --test scripts/f56-2b2a/__tests__/fixture-readiness.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { evaluateFixtureReadiness, renderReadiness } from "../fixture-readiness.mjs";

const GUARD = path.resolve(fileURLToPath(import.meta.url), "..", "..", "fixture-readiness.mjs");

function fixture(present, nullIdentity) {
  return { present, nullIdentity };
}

function runGuardCli(input) {
  return spawnSync(process.execPath, [GUARD], {
    input: JSON.stringify(input),
    encoding: "utf8",
  });
}

test("AMBAS as fixtures presentes com identidade NULL => libera a 0003", () => {
  const res = evaluateFixtureReadiness({
    campaignPresent: true,
    stateFixture: fixture(true, true),
    cancellationFixture: fixture(true, true),
  });
  assert.equal(res.ready, true);
  assert.equal(res.mayApplyBackfillMigration, true);
  assert.deepEqual(res.failures, []);
});

test("fixture de copy_state AUSENTE => bloqueia a 0003 (nunca chama migration up)", () => {
  const res = evaluateFixtureReadiness({
    campaignPresent: true,
    stateFixture: fixture(false, false),
    cancellationFixture: fixture(true, true),
  });
  assert.equal(res.ready, false);
  assert.equal(res.mayApplyBackfillMigration, false);
  assert.ok(res.failures.some((f) => f.includes("product_1_1_copy_state")));
});

test("fixture de copy_cancellations AUSENTE => bloqueia a 0003", () => {
  const res = evaluateFixtureReadiness({
    campaignPresent: true,
    stateFixture: fixture(true, true),
    cancellationFixture: fixture(false, false),
  });
  assert.equal(res.ready, false);
  assert.equal(res.mayApplyBackfillMigration, false);
  assert.ok(res.failures.some((f) => f.includes("product_1_1_copy_cancellations")));
});

test("fixture de copy_state com identidade NAO NULL => bloqueia a 0003", () => {
  const res = evaluateFixtureReadiness({
    campaignPresent: true,
    stateFixture: fixture(true, false),
    cancellationFixture: fixture(true, true),
  });
  assert.equal(res.ready, false);
  assert.equal(res.mayApplyBackfillMigration, false);
  assert.ok(res.failures.some((f) => f.includes("copy_state") && f.includes("not NULL")));
});

test("fixture de cancelamento com identidade NAO NULL => bloqueia a 0003", () => {
  const res = evaluateFixtureReadiness({
    campaignPresent: true,
    stateFixture: fixture(true, true),
    cancellationFixture: fixture(true, false),
  });
  assert.equal(res.ready, false);
  assert.equal(res.mayApplyBackfillMigration, false);
  assert.ok(res.failures.some((f) => f.includes("copy_cancellations") && f.includes("not NULL")));
});

test("campanha de fixture AUSENTE => bloqueia a 0003 (precondicao)", () => {
  const res = evaluateFixtureReadiness({
    campaignPresent: false,
    stateFixture: fixture(true, true),
    cancellationFixture: fixture(true, true),
  });
  assert.equal(res.ready, false);
  assert.equal(res.mayApplyBackfillMigration, false);
  assert.ok(res.failures.some((f) => f.includes("campaign")));
});

test("entrada ausente/incompleta => bloqueia (fail-closed)", () => {
  const res = evaluateFixtureReadiness({});
  assert.equal(res.ready, false);
  assert.equal(res.mayApplyBackfillMigration, false);
  assert.equal(res.failures.length, 3);
});

test("renderReadiness descreve o HALT com os motivos", () => {
  const res = evaluateFixtureReadiness({
    campaignPresent: true,
    stateFixture: fixture(false, false),
    cancellationFixture: fixture(true, true),
  });
  assert.match(renderReadiness(res), /HALT/);
  assert.match(renderReadiness(res), /product_1_1_copy_state/);
});

test("CLI do guard: fixtures ok => exit 0", () => {
  const run = runGuardCli({
    campaignPresent: true,
    stateFixture: fixture(true, true),
    cancellationFixture: fixture(true, true),
  });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(JSON.parse(run.stdout).mayApplyBackfillMigration, true);
});

test("CLI do guard: fixture faltando => exit NAO-ZERO (harness faz throw antes do migration up)", () => {
  const run = runGuardCli({
    campaignPresent: true,
    stateFixture: fixture(false, false),
    cancellationFixture: fixture(true, true),
  });
  assert.notEqual(run.status, 0);
  assert.equal(JSON.parse(run.stdout).mayApplyBackfillMigration, false);
});
