import assert from "node:assert/strict";
import { test } from "node:test";

import { evaluateF601Target } from "../f60-1-gate.mjs";

const HOMOLOG_DB = "postgresql://user:pass@127.0.0.1:57782/postgres";
const HOMOLOG_API = "http://127.0.0.1:57781";
const DISPOSABLE_DB = "postgresql://user:pass@127.0.0.1:54322/postgres";
const DISPOSABLE_API = "http://127.0.0.1:54321";

function base(overrides = {}) {
  return {
    F60_1_TARGET: "homolog-existing",
    F60_1_HOMOLOG_AUTHORIZED: "1",
    F60_TEST_ALLOW_WRITES: "1",
    TEST_DATABASE_URL: HOMOLOG_DB,
    SUPABASE_URL: HOMOLOG_API,
    ...overrides,
  };
}

test("aceita o par autorizado do homolog", () => {
  const result = evaluateF601Target(base());
  assert.equal(result.ready, true);
  assert.equal(result.targetKind, "homolog-existing");
});

test("recusa o homolog sem autorização explícita", () => {
  const result = evaluateF601Target(base({ F60_1_HOMOLOG_AUTHORIZED: "" }));
  assert.equal(result.ready, false);
  assert.match(result.reasons.join(" "), /F60_1_HOMOLOG_AUTHORIZED/);
});

test("recusa DB 54322 com API 57781 (par cruzado)", () => {
  const result = evaluateF601Target(
    base({ TEST_DATABASE_URL: DISPOSABLE_DB, SUPABASE_URL: HOMOLOG_API }),
  );
  assert.equal(result.ready, false);
  assert.match(result.reasons.join(" "), /TEST_DATABASE_URL/);
});

test("recusa DB 57782 com API 54321 (par cruzado)", () => {
  const result = evaluateF601Target(
    base({ TEST_DATABASE_URL: HOMOLOG_DB, SUPABASE_URL: DISPOSABLE_API }),
  );
  assert.equal(result.ready, false);
  assert.match(result.reasons.join(" "), /SUPABASE_URL/);
});

test("aceita o par autorizado descartável", () => {
  const result = evaluateF601Target(
    base({
      F60_1_TARGET: "disposable-local",
      F60_1_HOMOLOG_AUTHORIZED: "",
      TEST_DATABASE_URL: DISPOSABLE_DB,
      SUPABASE_URL: DISPOSABLE_API,
    }),
  );
  assert.equal(result.ready, true);
  assert.equal(result.targetKind, "disposable-local");
});

test("recusa alvo remoto e target ausente", () => {
  assert.equal(
    evaluateF601Target(
      base({
        F60_1_TARGET: "disposable-local",
        TEST_DATABASE_URL: DISPOSABLE_DB,
        SUPABASE_URL: "https://example.supabase.co",
      }),
    ).ready,
    false,
  );

  const missingTarget = evaluateF601Target(base({ F60_1_TARGET: "" }));
  assert.equal(missingTarget.ready, false);
  assert.match(missingTarget.reasons.join(" "), /F60_1_TARGET/);
});

test("recusa ausência de opt-in de escrita", () => {
  const result = evaluateF601Target(base({ F60_TEST_ALLOW_WRITES: "" }));
  assert.equal(result.ready, false);
  assert.match(result.reasons.join(" "), /F60_TEST_ALLOW_WRITES/);
});
