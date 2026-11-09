import assert from "node:assert/strict";
import test from "node:test";
import {
  TABLES,
  compare,
  identityColumn,
  validateLedger,
} from "../homolog-snapshot.mjs";

function emptyTables() {
  return Object.fromEntries(TABLES.map((t) => [t, { exists: true, count: 0, rows: {} }]));
}

function snapshot(runId, mutator = () => {}) {
  const tables = emptyTables();
  mutator(tables);
  return {
    kind: "f60-homolog-snapshot",
    run_id: runId,
    target: { host: "127.0.0.1", port: "57782", database: "postgres" },
    ledger: {
      count: 154,
      count_excluding_f60: 153,
      last: "20261109174110",
      sha256_excluding_f60: "abc",
      f60_applied: true,
    },
    tables,
  };
}

function expectations(runId, additions) {
  const all = Object.fromEntries(TABLES.map((t) => [t, []]));
  return {
    run_id: runId,
    additions: { ...all, ...additions },
    ledger: { count_excluding_f60: 153, sha256_excluding_f60: "abc" },
  };
}

function addRow(tables, table, id, hash = "h") {
  tables[table].rows[id] = hash;
  tables[table].count += 1;
}

test("sucesso: linhas preexistentes, delta esperado e ledger", () => {
  const before = snapshot("run-1", (t) => addRow(t, "public.stores", "a", "h1"));
  const after = snapshot("run-1", (t) => {
    addRow(t, "public.stores", "a", "h1");
    addRow(t, "public.stores", "b", "h2");
  });
  const report = compare(before, after, expectations("run-1", { "public.stores": ["b"] }));
  assert.equal(report.pre_existing_integrity, "PASS");
  assert.equal(report.expected_delta_status, "PASS");
  assert.equal(report.ledger_status, "PASS");
  assert.equal(report.expected_delta_by_table["public.stores"].matches, true);
});

test("extra não manifestada reprova o delta", () => {
  const before = snapshot("run-1");
  const after = snapshot("run-1", (t) => addRow(t, "public.stores", "x", "hx"));
  const report = compare(before, after, expectations("run-1", {}));
  assert.equal(report.expected_delta_status, "FAIL");
  assert.deepEqual(report.unexpected_additions, [{ table: "public.stores", id: "x" }]);
});

test("adição esperada ausente reprova o delta", () => {
  const before = snapshot("run-1");
  const after = snapshot("run-1");
  const report = compare(before, after, expectations("run-1", { "public.stores": ["missing"] }));
  assert.equal(report.expected_delta_status, "FAIL");
  assert.deepEqual(report.missing_expected_additions, [
    { table: "public.stores", id: "missing" },
  ]);
});

test("ledger divergente reprova", () => {
  const before = snapshot("run-1");
  const after = snapshot("run-1");
  const exp = expectations("run-1", {});
  exp.ledger.sha256_excluding_f60 = "different";
  const report = compare(before, after, exp);
  assert.equal(report.ledger_status, "FAIL");
});

test("identidade de credit_balances é store_id", () => {
  assert.equal(identityColumn("public.credit_balances"), "store_id");
  assert.equal(identityColumn("auth.users"), "id");
  assert.equal(identityColumn("public.stores"), "id");
});

test("credit_balances compara pelo store_id", () => {
  const before = snapshot("run-1", (t) => addRow(t, "public.credit_balances", "store-a", "h1"));
  const after = snapshot("run-1", (t) => {
    addRow(t, "public.credit_balances", "store-a", "h1");
    addRow(t, "public.credit_balances", "store-b", "h2");
  });
  const report = compare(
    before,
    after,
    expectations("run-1", { "public.credit_balances": ["store-b"] }),
  );
  assert.equal(report.expected_delta_status, "PASS");
});

test("tabela esperada sem snapshot reprova", () => {
  const before = snapshot("run-1");
  const after = snapshot("run-1");
  const report = compare(
    before,
    after,
    expectations("run-1", { "public.tabela_inexistente": ["id"] }),
  );
  assert.equal(report.expected_delta_status, "FAIL");
  assert.deepEqual(report.unknown_expected_tables, ["public.tabela_inexistente"]);
});

test("tabela do snapshot sem expectativa reprova", () => {
  const before = snapshot("run-1");
  const after = snapshot("run-1");
  const exp = expectations("run-1", {});
  delete exp.additions["public.stores"];
  const report = compare(before, after, exp);
  assert.equal(report.expected_delta_status, "FAIL");
  assert.deepEqual(report.unknown_snapshot_tables, ["public.stores"]);
});

test("validateLedger: sucesso", () => {
  const result = validateLedger(snapshot("run-1"), 153, "abc", false);
  assert.equal(result.ok, true);
});

test("validateLedger: ledger divergente e F60 já aplicada", () => {
  const result = validateLedger(snapshot("run-1"), 152, "xyz", false);
  assert.equal(result.ok, false);
  assert.deepEqual(result.failures.sort(), ["ledger_count_mismatch", "ledger_sha256_mismatch"]);

  const applied = validateLedger(snapshot("run-1"), 153, "abc", true);
  assert.equal(applied.ok, false);
  assert.deepEqual(applied.failures, ["f60_already_applied"]);

  const absent = validateLedger(
    { ...snapshot("run-1"), ledger: { ...snapshot("run-1").ledger, f60_applied: false } },
    153,
    "abc",
    true,
  );
  assert.equal(absent.ok, true);
});

test("prove exige F60 aplicada", () => {
  const applied = validateLedger(snapshot("run-1"), 153, "abc", false, true);
  assert.equal(applied.ok, true);

  const absent = validateLedger(
    { ...snapshot("run-1"), ledger: { ...snapshot("run-1").ledger, f60_applied: false } },
    153,
    "abc",
    false,
    true,
  );
  assert.equal(absent.ok, false);
  assert.deepEqual(absent.failures, ["f60_not_applied"]);

  const missing = validateLedger(
    {
      ...snapshot("run-1"),
      ledger: { ...snapshot("run-1").ledger, f60_applied: undefined },
    },
    153,
    "abc",
    false,
    true,
  );
  assert.equal(missing.ok, false);
  assert.deepEqual(missing.failures, ["f60_not_applied"]);
});

test("pré-aplicação continua exigindo F60 ausente", () => {
  const absent = validateLedger(
    { ...snapshot("run-1"), ledger: { ...snapshot("run-1").ledger, f60_applied: false } },
    153,
    "abc",
    true,
    false,
  );
  assert.equal(absent.ok, true);

  const conflicting = validateLedger(snapshot("run-1"), 153, "abc", true, true);
  assert.equal(conflicting.ok, false);
  assert.deepEqual(conflicting.failures, ["f60_requirement_conflict"]);
});
