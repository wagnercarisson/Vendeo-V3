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

import { evaluateFixtureReadiness, renderReadiness, parseReturnedUuid } from "../fixture-readiness.mjs";

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

// ---------------------------------------------------------------------------
// Correção do check de `RETURNING` (Plano 05 / prova f562b): a tag de comando
// (`INSERT 0 1`) NÃO pode ser confundida com uma linha de DADOS.
// ---------------------------------------------------------------------------

const SAMPLE_UUID = "69978ee0-88fd-420f-a207-d690f1249c17";

test("parseReturnedUuid: UUID + tag de comando => 1 UUID (tag ignorada)", () => {
  const res = parseReturnedUuid([SAMPLE_UUID, "INSERT 0 1"]);
  assert.equal(res.ok, true);
  assert.equal(res.uuid, SAMPLE_UUID);
  assert.equal(res.reason, "single_returned_uuid");
});

test("parseReturnedUuid: somente a tag de comando => 0 UUID (bloqueia)", () => {
  const res = parseReturnedUuid(["INSERT 0 1"]);
  assert.equal(res.ok, false);
  assert.equal(res.uuid, null);
  assert.equal(res.reason, "no_returned_uuid");
});

test("parseReturnedUuid: saida vazia => 0 UUID (bloqueia)", () => {
  const res = parseReturnedUuid([""]);
  assert.equal(res.ok, false);
  assert.equal(res.reason, "no_returned_uuid");
});

test("parseReturnedUuid: MAIS de um UUID => bloqueia (nunca escolher arbitrario)", () => {
  const res = parseReturnedUuid([SAMPLE_UUID, "11111111-2222-3333-4444-555555555555"]);
  assert.equal(res.ok, false);
  assert.equal(res.reason, "multiple_returned_uuids");
});

test("parseReturnedUuid: aceita string unica (linha) sem tag", () => {
  const res = parseReturnedUuid(SAMPLE_UUID);
  assert.equal(res.ok, true);
  assert.equal(res.uuid, SAMPLE_UUID);
});
