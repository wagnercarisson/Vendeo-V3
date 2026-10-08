import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateGate, parseGate, REQUIRED_CRITERIA } from "../validate-product-flow-gate.mjs";

const TS = "2026-10-08T19:24:57Z";

function criterionLine(key, status = "PASS", source = "evidence", ts = TS, note = "recorded") {
  return `CRITERION|${key}|${status}|${source}|${ts}|${note}`;
}

function goodDoc(overrides = {}) {
  const lines = [`GATE_STATUS|${overrides.gateStatus ?? "APPROVED"}|${TS}`];
  for (const key of REQUIRED_CRITERIA) {
    const o = overrides.criteria?.[key] ?? {};
    lines.push(
      criterionLine(key, o.status ?? "PASS", o.source ?? "evidence", o.ts ?? TS, o.note ?? "recorded"),
    );
  }
  if (overrides.omit) {
    return lines.filter((l) => !l.startsWith(`CRITERION|${overrides.omit}|`)).join("\n");
  }
  if (overrides.extra) lines.push(overrides.extra);
  return lines.join("\n");
}

test("documento APPROVED completo e aceito", () => {
  const res = evaluateGate(goodDoc());
  assert.equal(res.ok, true);
  assert.equal(res.approved, true);
  assert.equal(res.allPass, true);
  assert.deepEqual(res.errors, []);
});

test("criterio FAIL bloqueia APPROVED", () => {
  const res = evaluateGate(goodDoc({ criteria: { service_auth: { status: "FAIL" } } }));
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => e.includes("APPROVED")));
});

test("criterio obrigatorio ausente e rejeitado", () => {
  const res = evaluateGate(goodDoc({ omit: "schema_migrations_f56_2a" }));
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => e.includes("schema_migrations_f56_2a")));
});

test("status de criterio invalido e rejeitado", () => {
  const res = evaluateGate(goodDoc({ criteria: { flags_off: { status: "OK" } } }));
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => e.includes("flags_off")));
});

test("GATE_STATUS APPROVED com criterio nao-PASS e contraditorio", () => {
  const res = evaluateGate(goodDoc({ criteria: { fixture_baseline_absent: { status: "INCONCLUSIVE" } } }));
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => e.includes("APPROVED")));
});

test("NOT_APPROVED com criterio INCONCLUSIVE nao e aprovado nem erro estrutural", () => {
  const res = evaluateGate(
    goodDoc({ gateStatus: "NOT_APPROVED", criteria: { service_auth: { status: "INCONCLUSIVE" } } }),
  );
  assert.equal(res.ok, false);
  assert.equal(res.approved, false);
  assert.deepEqual(res.errors, []);
});

test("GATE_STATUS ausente e rejeitado", () => {
  const res = evaluateGate(goodDoc().split("\n").slice(1).join("\n"));
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => e.includes("GATE_STATUS")));
});

test("GATE_STATUS invalido e rejeitado", () => {
  const res = evaluateGate(goodDoc({ gateStatus: "APPROVED_MAYBE" }));
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => e.includes("invalido")));
});

test("criterio duplicado e rejeitado", () => {
  const res = evaluateGate(goodDoc({ extra: criterionLine("identity", "PASS") }));
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => e.includes("duplicado")));
});

test("criterio sem fonte/timestamp e rejeitado", () => {
  const res = evaluateGate(goodDoc({ criteria: { identity: { source: "" } } }));
  assert.equal(res.ok, false);
  assert.ok(res.errors.some((e) => e.includes("identity") && e.includes("fonte")));
});

test("conjunto de criterios obrigatorios tem 12 chaves unicas", () => {
  assert.equal(REQUIRED_CRITERIA.length, 12);
  assert.equal(new Set(REQUIRED_CRITERIA).size, 12);
});

test("parseGate le status e criterios sem conexao externa", () => {
  const parsed = parseGate(goodDoc());
  assert.equal(parsed.gateStatuses.length, 1);
  assert.equal(parsed.criteria.size, REQUIRED_CRITERIA.length);
  assert.deepEqual(parsed.lineErrors, []);
});
