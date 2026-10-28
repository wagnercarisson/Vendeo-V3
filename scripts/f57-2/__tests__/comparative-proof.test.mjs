import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "../../..");
const cli = path.join(root, "scripts/f57-2/comparative-proof.mjs");
const tables = [
  "stores",
  "store_billing_info",
  "credit_transactions",
  "credit_balances",
  "freemium_entitlements",
  "legal_acceptances",
  "campaigns",
  "admin_audit_log",
];
const scenarios = ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9"];

function fingerprint() {
  return {
    store: { name: "f572proof-fixture" },
    credit_transactions: [],
    credit_balances: [],
    freemium_entitlements: [],
    legal_acceptances: [],
    store_billing_info: null,
    campaigns_by_status: [],
    campaigns_ready: 0,
    admin_audit_log: [],
    store_market_settings: null,
  };
}

function scenarioDoc(side) {
  return {
    side,
    table_present: true,
    counts_store_market_settings: 0,
    scenarios: Object.fromEntries(scenarios.map((id) => [id, { ok: true }])),
    fingerprints: Object.fromEntries(scenarios.map((id) => [id, fingerprint()])),
  };
}

function s0(tablesValue = tables.map((table) => ({ table, present: true, count: 0, md5: "0".repeat(32) }))) {
  return { target: "127.0.0.1:57782/postgres", tables: tablesValue };
}

function run(dir, files) {
  const args = [
    cli,
    "compare",
    "--base",
    path.join(dir, "base.json"),
    "--new",
    path.join(dir, "new.json"),
    "--s0-before",
    path.join(dir, "s0-before.json"),
    "--s0-after-01",
    path.join(dir, "s0-after-01.json"),
    "--s0-after-02",
    path.join(dir, "s0-after-02.json"),
    "--out-md",
    path.join(dir, "out.md"),
  ];
  for (const [name, payload] of Object.entries(files)) {
    if (payload !== undefined) fs.writeFileSync(path.join(dir, name), JSON.stringify(payload));
  }
  return spawnSync(process.execPath, args, { cwd: root, encoding: "utf8" });
}

function withDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "f572-compare-"));
  try {
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("compare aceita evidências completas e ignora store_market_settings", () => {
  withDir((dir) => {
    const base = scenarioDoc("base");
    const next = scenarioDoc("new");
    next.fingerprints.S7.store_market_settings = { country_code: "BR" };
    const result = run(dir, {
      "base.json": base,
      "new.json": next,
      "s0-before.json": s0(),
      "s0-after-01.json": s0(),
      "s0-after-02.json": s0(),
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(fs.readFileSync(path.join(dir, "out.md"), "utf8"), /sem divergência/);
  });
});

test("compare reprova S0 sem as oito tabelas", () => {
  withDir((dir) => {
    const result = run(dir, {
      "base.json": scenarioDoc("base"),
      "new.json": scenarioDoc("new"),
      "s0-before.json": s0([]),
      "s0-after-01.json": s0(),
      "s0-after-02.json": s0(),
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /exatamente as oito tabelas/);
  });
});

test("compare reprova fingerprints/scenarios incompletos", () => {
  withDir((dir) => {
    const base = scenarioDoc("base");
    base.fingerprints = { S1: fingerprint() };
    base.scenarios = { S1: { ok: true } };
    const result = run(dir, {
      "base.json": base,
      "new.json": scenarioDoc("new"),
      "s0-before.json": s0(),
      "s0-after-01.json": s0(),
      "s0-after-02.json": s0(),
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /fingerprints incompletos/);
  });
});

test("compare reprova divergência nos resultados dos cenários", () => {
  withDir((dir) => {
    const base = scenarioDoc("base");
    const next = scenarioDoc("new");
    next.scenarios.S8 = { ok: false };
    const result = run(dir, {
      "base.json": base,
      "new.json": next,
      "s0-before.json": s0(),
      "s0-after-01.json": s0(),
      "s0-after-02.json": s0(),
    });
    assert.notEqual(result.status, 0);
    assert.match(fs.readFileSync(path.join(dir, "out.md"), "utf8"), /DIVERGENTE|DIVERGIRAM/);
  });
});
