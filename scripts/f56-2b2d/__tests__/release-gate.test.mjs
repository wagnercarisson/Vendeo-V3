// F56.2b2d — Plano 03 / Task 3: testes dos scripts (manifesto + avaliador fail-closed).
// node:test + node:assert/strict. Determinístico, offline, sem rede/banco/CLI.
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  computeSha256,
  buildMigrationSet,
  compareMigrationSet,
  parseMigrationVersion,
  serializeManifest,
} from "../fix-migration-set.mjs";

import {
  REQUIRED_CRITERIA,
  evaluateReleaseGate,
  redact,
  assertAllowedHost,
} from "../verify-hosted-release.mjs";

const CONTENT = {
  "20260101000001_a.sql": "AAA",
  "20260101000002_b.sql": "BBB",
  "20260101000003_c.sql": "CCC",
};
const hashOf = (file) => computeSha256(CONTENT[file] ?? `unmapped:${file}`);
const manifestFrom = (files, opts = {}) => buildMigrationSet(files, { hashOf, ...opts });

function criterion(id, overrides = {}) {
  return {
    id,
    status: overrides.status ?? "PASS",
    source: "source" in overrides ? overrides.source : "evidence/run-1",
    timestamp: "timestamp" in overrides ? overrides.timestamp : "2026-10-18T21:00:00Z",
  };
}

function goodDoc(profile, overrides = {}) {
  const criteria = {};
  for (const id of REQUIRED_CRITERIA[profile]) {
    criteria[id] = criterion(id, overrides[id] ?? {});
  }
  const doc = { profile, criteria };
  if ("approved" in overrides) doc.approved = overrides.approved;
  return doc;
}

// --- Manifesto ---------------------------------------------------------------

test("manifesto: conjunto exato confere (ok)", () => {
  const set = manifestFrom(Object.keys(CONTENT));
  assert.equal(set.count, 3);
  const res = compareMigrationSet(set, Object.keys(CONTENT), { hashOf });
  assert.equal(res.ok, true);
  assert.deepEqual(res.missing, []);
  assert.deepEqual(res.extra, []);
  assert.deepEqual(res.hash_mismatch, []);
  assert.equal(res.countMatch, true);
});

test("manifesto: hash divergente é detectado", () => {
  const set = manifestFrom(Object.keys(CONTENT));
  const badHash = (f) => (f === "20260101000002_b.sql" ? computeSha256("TAMPERED") : hashOf(f));
  const res = compareMigrationSet(set, Object.keys(CONTENT), { hashOf: badHash });
  assert.equal(res.ok, false);
  assert.equal(res.hash_mismatch.length, 1);
  assert.equal(res.hash_mismatch[0].file, "20260101000002_b.sql");
});

test("manifesto: arquivo extra é detectado", () => {
  const set = manifestFrom(Object.keys(CONTENT));
  CONTENT["20260101000004_d.sql"] = "DDD";
  const res = compareMigrationSet(set, Object.keys(CONTENT), { hashOf });
  delete CONTENT["20260101000004_d.sql"];
  assert.equal(res.ok, false);
  assert.deepEqual(res.extra, ["20260101000004_d.sql"]);
});

test("manifesto: arquivo faltante é detectado", () => {
  const set = manifestFrom(Object.keys(CONTENT));
  const res = compareMigrationSet(set, ["20260101000001_a.sql"], { hashOf });
  assert.equal(res.ok, false);
  assert.equal(res.missing.length, 2);
  assert.equal(res.countMatch, false);
});

test("manifesto: ordenado por versão crescente", () => {
  const set = manifestFrom(["20260101000003_c.sql", "20260101000001_a.sql", "20260101000002_b.sql"]);
  assert.deepEqual(
    set.files.map((f) => f.version),
    ["20260101000001", "20260101000002", "20260101000003"],
  );
});

test("manifesto: versão duplicada é rejeitada", () => {
  assert.throws(
    () => buildMigrationSet([
      { file: "20260101000001_a.sql", version: "20260101000001" },
      { file: "20260101000001_b.sql", version: "20260101000001" },
    ]),
    /duplicada/,
  );
});

test("manifesto: nome fora do padrão é rejeitado", () => {
  assert.throws(() => buildMigrationSet(["not_a_migration.sql"]), /fora do padrão/);
  assert.equal(parseMigrationVersion("20260101000001_ok.sql"), "20260101000001");
  assert.equal(parseMigrationVersion("bad.sql"), null);
});

test("manifesto: sha256 tem 64 hex e ledger não é presumido", () => {
  const set = manifestFrom(Object.keys(CONTENT));
  for (const f of set.files) assert.match(f.sha256, /^[0-9a-f]{64}$/);
  const json = serializeManifest(set, { dir: "supabase/migrations" });
  const parsed = JSON.parse(json);
  assert.equal(parsed.count, 3);
  assert.equal(parsed.dir, "supabase/migrations");
  assert.ok(Array.isArray(parsed.files));
  assert.equal(Object.prototype.hasOwnProperty.call(parsed, "ledger_applied"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(parsed, "ledger_pending"), false);
  const withLedger = JSON.parse(serializeManifest(set, { ledgerApplied: 100, ledgerPending: 30 }));
  assert.equal(withLedger.ledger_applied, 100);
  assert.equal(withLedger.ledger_pending, 30);
});

// --- Avaliador fail-closed ---------------------------------------------------

test("gate: REQUIRED_CRITERIA tem exatamente 7/8/4/7 chaves únicas", () => {
  assert.equal(REQUIRED_CRITERIA.release.length, 7);
  assert.equal(REQUIRED_CRITERIA.backup.length, 8);
  assert.equal(REQUIRED_CRITERIA.migrations.length, 4);
  assert.equal(REQUIRED_CRITERIA.pilot.length, 7);
  for (const list of Object.values(REQUIRED_CRITERIA)) {
    assert.equal(new Set(list).size, list.length);
  }
});

test("gate: documento completo APPROVED por perfil", () => {
  for (const profile of ["release", "backup", "migrations", "pilot"]) {
    const res = evaluateReleaseGate(goodDoc(profile), REQUIRED_CRITERIA[profile]);
    assert.equal(res.approved, true, `perfil ${profile}`);
    assert.equal(res.allPass, true);
    assert.deepEqual(res.blocking, []);
  }
});

test("gate: FAIL bloqueia", () => {
  const res = evaluateReleaseGate(goodDoc("release", { ledger_complete: { status: "FAIL" } }), REQUIRED_CRITERIA.release);
  assert.equal(res.approved, false);
  assert.ok(res.blocking.includes("ledger_complete"));
});

test("gate: INCONCLUSIVE bloqueia", () => {
  const res = evaluateReleaseGate(goodDoc("pilot", { hosted_proofs_pass: { status: "INCONCLUSIVE" } }), REQUIRED_CRITERIA.pilot);
  assert.equal(res.approved, false);
  assert.ok(res.blocking.includes("hosted_proofs_pass"));
});

test("gate: critério ausente bloqueia", () => {
  const doc = goodDoc("migrations");
  delete doc.criteria.no_repair_used;
  const res = evaluateReleaseGate(doc, REQUIRED_CRITERIA.migrations);
  assert.equal(res.approved, false);
  assert.ok(res.blocking.includes("no_repair_used"));
});

test("gate: status inválido bloqueia", () => {
  const res = evaluateReleaseGate(goodDoc("backup", { backup_db_manifest: { status: "OK" } }), REQUIRED_CRITERIA.backup);
  assert.equal(res.approved, false);
  assert.ok(res.blocking.includes("backup_db_manifest"));
});

test("gate: fonte ou timestamp vazio bloqueia", () => {
  const res = evaluateReleaseGate(goodDoc("release", { backup_manifest: { source: "" } }), REQUIRED_CRITERIA.release);
  assert.equal(res.approved, false);
  const c = res.criteria.find((x) => x.id === "backup_manifest");
  assert.match(c.reason, /sem fonte/);
});

test("gate: contradição approved:true com não-PASS bloqueia", () => {
  const doc = goodDoc("release", { restore_proof: { status: "FAIL" }, approved: true });
  const res = evaluateReleaseGate(doc, REQUIRED_CRITERIA.release);
  assert.equal(res.approved, false);
  assert.ok(res.errors.some((e) => e.includes("contradiz")));
});

test("gate: contradição approved:false com todos PASS bloqueia", () => {
  const doc = goodDoc("release", { approved: false });
  const res = evaluateReleaseGate(doc, REQUIRED_CRITERIA.release);
  assert.equal(res.approved, false);
  assert.ok(res.errors.some((e) => e.includes("contradiz")));
});

// --- Redaction / host --------------------------------------------------------

test("redaction: não ecoa tokens/chaves", () => {
  const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abcdefghijklmnop";
  const out = redact(`authorization: Bearer ${jwt} apikey=supersecret123 service_role=roletoken`);
  assert.equal(out.includes(jwt), false);
  assert.equal(out.includes("supersecret123"), false);
  assert.equal(out.includes("roletoken"), false);
  assert.ok(out.includes("[REDACTED"));
});

test("probe: host não autorizado aborta; loopback é permitido", () => {
  assert.throws(() => assertAllowedHost("https://evil.example.com", []), /não autorizado/);
  assert.equal(assertAllowedHost("http://127.0.0.1:54321", []), "127.0.0.1");
  assert.equal(assertAllowedHost("https://db.example.com", ["db.example.com"]), "db.example.com");
});
