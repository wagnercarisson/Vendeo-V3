import assert from "node:assert/strict";
import test from "node:test";
import {
  assertF60Target,
  evaluateF60Target,
  evaluateF60Window,
  isHomologTarget,
} from "../../testing/f60-window.mjs";
import { f60GateStatus } from "../../testing/test-status.mjs";

const iso = (offsetMs) => new Date(Date.now() + offsetMs).toISOString();
const window = (start, end, responsible = "responsavel-teste") =>
  `${start} / ${end} / ${responsible}`;

test("reconhece homolog em endereços loopback equivalentes", () => {
  for (const hostname of ["127.0.0.1", "localhost", "[::1]", "::1"]) {
    assert.equal(
      isHomologTarget({ hostname, port: "57782", pathname: "/postgres" }),
      true,
      hostname,
    );
  }
  assert.equal(
    isHomologTarget({ hostname: "localhost", port: "54322", pathname: "/postgres" }),
    false,
  );
});

test("janela inválida é recusada", () => {
  assert.equal(evaluateF60Window("invalida").status, "invalid");
  assert.equal(evaluateF60Window("2026-01-01/2026-01-02").status, "invalid");
  assert.equal(
    evaluateF60Window(window(iso(3600_000), iso(-3600_000))).status,
    "invalid",
  );
});

test("janela encerrada é recusada", () => {
  const state = evaluateF60Window(window(iso(-7200_000), iso(-3600_000)));
  assert.equal(state.status, "closed");
});

test("janela futura é recusada", () => {
  const state = evaluateF60Window(window(iso(3600_000), iso(7200_000)));
  assert.equal(state.status, "future");
});

test("janela vigente é aceita", () => {
  const state = evaluateF60Window(window(iso(-3600_000), iso(3600_000)));
  assert.equal(state.status, "active");
});

test("gate f60 aceita homolog somente com janela vigente", () => {
  const base = {
    TEST_DATABASE_URL: "postgresql://postgres@localhost:57782/postgres",
    F60_HOMOLOG_AUTHORIZED: "1",
    F60_TEST_ALLOW_WRITES: "1",
  };
  assert.equal(
    f60GateStatus({
      ...base,
      F60_EXCLUSIVITY_WINDOW: window(iso(-3600_000), iso(3600_000)),
    }).ready,
    true,
  );
  const closed = f60GateStatus({
    ...base,
    F60_EXCLUSIVITY_WINDOW: window(iso(-7200_000), iso(-3600_000)),
  });
  assert.equal(closed.ready, false);
  assert.ok(closed.reasons.some((r) => r.includes("closed")));
  const invalid = f60GateStatus({
    ...base,
    F60_EXCLUSIVITY_WINDOW: "invalida",
  });
  assert.equal(invalid.ready, false);
  assert.ok(invalid.reasons.some((r) => r.includes("invalid")));
  const future = f60GateStatus({
    ...base,
    F60_EXCLUSIVITY_WINDOW: window(iso(3600_000), iso(7200_000)),
  });
  assert.equal(future.ready, false);
  assert.ok(future.reasons.some((r) => r.includes("future")));
});

test("gate f60 aceita local/isolado sem janela", () => {
  const status = f60GateStatus({
    TEST_DATABASE_URL: "postgresql://postgres@127.0.0.1:54322/postgres",
    F60_TEST_ALLOW_WRITES: "1",
  });
  assert.equal(status.ready, true);
});

test("gate f60 exige F60_TEST_ALLOW_WRITES", () => {
  const status = f60GateStatus({
    TEST_DATABASE_URL: "postgresql://postgres@127.0.0.1:54322/postgres",
  });
  assert.equal(status.ready, false);
});

test("preflight compartilhado recusa alvo remoto e protocolo não-Postgres", () => {
  const base = { F60_TEST_ALLOW_WRITES: "1" };
  assert.throws(
    () =>
      assertF60Target("postgresql://postgres@db.example.com:5432/postgres", base),
    /loopback/,
  );
  assert.equal(
    evaluateF60Target("postgresql://postgres@10.0.0.5:5432/postgres", base).ok,
    false,
  );
  assert.equal(
    evaluateF60Target("https://127.0.0.1:54322/postgres", base).ok,
    false,
  );
  assert.throws(
    () => assertF60Target("postgresql://postgres@127.0.0.1:54322/postgres", {}),
    /F60_TEST_ALLOW_WRITES/,
  );
});

test("preflight compartilhado aceita loopback local e exige janela no homolog", () => {
  const local = evaluateF60Target(
    "postgresql://postgres@127.0.0.1:54322/postgres",
    { F60_TEST_ALLOW_WRITES: "1" },
  );
  assert.equal(local.ok, true);

  const homologBase = {
    TEST_DATABASE_URL: "postgresql://postgres@localhost:57782/postgres",
    F60_TEST_ALLOW_WRITES: "1",
    F60_HOMOLOG_AUTHORIZED: "1",
  };
  assert.equal(
    evaluateF60Target(homologBase.TEST_DATABASE_URL, {
      ...homologBase,
      F60_EXCLUSIVITY_WINDOW: window(iso(-3600_000), iso(3600_000)),
    }).ok,
    true,
  );
  const closed = evaluateF60Target(homologBase.TEST_DATABASE_URL, {
    ...homologBase,
    F60_EXCLUSIVITY_WINDOW: window(iso(-7200_000), iso(-3600_000)),
  });
  assert.equal(closed.ok, false);
  assert.ok(closed.errors.some((r) => r.includes("closed")));

  const unauthorized = evaluateF60Target(homologBase.TEST_DATABASE_URL, {
    ...homologBase,
    F60_HOMOLOG_AUTHORIZED: "0",
    F60_EXCLUSIVITY_WINDOW: window(iso(-3600_000), iso(3600_000)),
  });
  assert.equal(unauthorized.ok, false);
  assert.ok(unauthorized.errors.some((r) => r.includes("F60_HOMOLOG_AUTHORIZED")));
});
