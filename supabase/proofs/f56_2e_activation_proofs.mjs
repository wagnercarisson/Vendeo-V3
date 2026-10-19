#!/usr/bin/env node
/**
 * F56.2b2e (56.2.7) - provas REAIS da RPC coordenadora no Postgres isolado.
 *
 * Destino permitido: vendeo-f562a-isolated (127.0.0.1:56322).
 * NUNCA producao, homologacao permanente ou instancia de restauracao.
 *
 * Prova: transicoes, falha intermediaria com rollback total, replay,
 * conflito, concorrencia e leitura atual pos-replay. Ao final, restaura OFF.
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";

const { Client } = pg;

const REQUIRED_HOST = "127.0.0.1";
const REQUIRED_PORT = 56322;
const REQUIRED_DB = "postgres";
const INSTANCE = "127.0.0.1:56321";
const ALL_KEY = "product_1_1_all_stores_enabled";
const TEST_KEY = "product_1_1_test_stores_enabled";

function connectionConfig() {
  return {
    host: process.env.F56_2E_DB_HOST ?? REQUIRED_HOST,
    port: Number(process.env.F56_2E_DB_PORT ?? REQUIRED_PORT),
    user: process.env.F56_2E_DB_USER ?? "postgres",
    password: process.env.F56_2E_DB_PASSWORD ?? "postgres",
    database: process.env.F56_2E_DB_NAME ?? REQUIRED_DB,
    ssl: false,
  };
}

function assertDestination(config) {
  assert.equal(config.host, REQUIRED_HOST, "host deve ser 127.0.0.1");
  assert.equal(config.port, REQUIRED_PORT, "porta deve ser 56322");
  assert.equal(config.database, REQUIRED_DB, "database deve ser postgres");
}

async function actorId(client) {
  const admins = await client.query(
    "SELECT user_id::text AS id FROM public.admin_users ORDER BY created_at LIMIT 1",
  );
  if (admins.rows[0]?.id) return admins.rows[0].id;
  const users = await client.query("SELECT id::text AS id FROM auth.users ORDER BY created_at LIMIT 1");
  assert.ok(users.rows[0]?.id, "nenhum ator de prova em admin_users/auth.users");
  return users.rows[0].id;
}

async function activation(client, actor, mode, operationId, reason = "F56.2e local proof") {
  const { rows } = await client.query(
    `SELECT public.admin_set_product_1_1_activation(
       $1::uuid, $2, $3, $4, $5::uuid
     ) AS result`,
    [actor, mode, INSTANCE, reason, operationId],
  );
  return rows[0].result;
}

async function readState(client) {
  const flags = await client.query(
    "SELECT key, enabled FROM public.feature_flags WHERE key IN ($1, $2)",
    [TEST_KEY, ALL_KEY],
  );
  const enabled = Object.fromEntries(flags.rows.map((r) => [r.key, r.enabled]));
  const stage = async (scope) => {
    const { rows } = await client.query(
      `SELECT stage, expires_at FROM public.product_flow_stage_authorizations
        WHERE scope = $1 AND instance_identity = $2 AND event_type <> 'refused'
        ORDER BY created_at DESC, seq DESC LIMIT 1`,
      [scope, INSTANCE],
    );
    const row = rows[0];
    if (!row) return "off";
    if (row.stage !== "off" && row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) {
      return "off";
    }
    return row.stage;
  };
  const testStage = await stage("test_stores");
  const allStage = await stage("all_stores");
  let mode = "inconsistent";
  if (!enabled[TEST_KEY] && !enabled[ALL_KEY]) {
    mode = testStage === "off" && allStage === "off" ? "off" : "inconsistent";
  } else if (enabled[TEST_KEY] && !enabled[ALL_KEY]) {
    mode = testStage === "test_stores" && allStage === "off" ? "test_stores" : "inconsistent";
  } else if (!enabled[TEST_KEY] && enabled[ALL_KEY]) {
    mode = allStage === "all_stores" && testStage === "test_stores" ? "all_stores" : "inconsistent";
  }
  return { mode, testEnabled: enabled[TEST_KEY], allEnabled: enabled[ALL_KEY], testStage, allStage };
}

async function assertState(client, expected, label) {
  const state = await readState(client);
  assert.equal(state.mode, expected, `${label}: mode`);
  if (expected === "off") {
    assert.equal(state.testEnabled, false);
    assert.equal(state.allEnabled, false);
    assert.equal(state.testStage, "off");
    assert.equal(state.allStage, "off");
  } else if (expected === "test_stores") {
    assert.equal(state.testEnabled, true);
    assert.equal(state.allEnabled, false);
    assert.equal(state.testStage, "test_stores");
    assert.equal(state.allStage, "off");
  } else if (expected === "all_stores") {
    assert.equal(state.allEnabled, true);
    assert.equal(state.testEnabled, false);
    assert.equal(state.testStage, "test_stores");
    assert.equal(state.allStage, "all_stores");
  }
  return state;
}

async function forcedFailureProof(client, actor) {
  await client.query(`
    CREATE OR REPLACE FUNCTION public._f56_2e_proof_fail()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.key = 'product_1_1_test_stores_enabled' THEN
        RAISE EXCEPTION 'proof_forced_failure';
      END IF;
      RETURN NEW;
    END;
    $$;
  `);
  await client.query("DROP TRIGGER IF EXISTS _f56_2e_proof_fail ON public.feature_flags");
  await client.query(`
    CREATE TRIGGER _f56_2e_proof_fail
    BEFORE UPDATE ON public.feature_flags
    FOR EACH ROW EXECUTE FUNCTION public._f56_2e_proof_fail();
  `);
  try {
    const before = await readState(client);
    const op = randomUUID();
    await assert.rejects(
      () => activation(client, actor, "test_stores", op, "forced failure proof"),
      /proof_forced_failure/,
    );
    const after = await readState(client);
    assert.deepEqual(after, before, "falha intermediaria deve reverter tudo");
    const action = await client.query(
      "SELECT 1 FROM public.product_1_1_activation_actions WHERE operation_id = $1",
      [op],
    );
    assert.equal(action.rowCount, 0, "acao falha nao deve ser registrada");
  } finally {
    await client.query("DROP TRIGGER IF EXISTS _f56_2e_proof_fail ON public.feature_flags");
    await client.query("DROP FUNCTION IF EXISTS public._f56_2e_proof_fail()");
  }
}

async function main() {
  const config = connectionConfig();
  assertDestination(config);
  const client = new Client(config);
  await client.connect();
  try {
    const actor = await actorId(client);

    // Estado inicial limpo.
    await activation(client, actor, "off", randomUUID(), "proof initial reset");
    await assertState(client, "off", "estado inicial");

    // Transicoes canonicas.
    await activation(client, actor, "test_stores", randomUUID(), "proof test_stores");
    await assertState(client, "test_stores", "off -> test_stores");

    await activation(client, actor, "all_stores", randomUUID(), "proof all_stores");
    await assertState(client, "all_stores", "test_stores -> all_stores");

    await activation(client, actor, "test_stores", randomUUID(), "proof all -> test");
    const backToTest = await assertState(client, "test_stores", "all_stores -> test_stores");
    assert.equal(backToTest.allEnabled, false, "chave geral deve ser desligada");
    assert.equal(backToTest.allStage, "off", "all_stores deve ser revogada");

    await activation(client, actor, "off", randomUUID(), "proof off");
    await assertState(client, "off", "test_stores -> off");

    // Replay idempotente.
    const replayOp = randomUUID();
    const first = await activation(client, actor, "all_stores", replayOp, "proof replay");
    assert.equal(first.verified, true);
    const actionsBefore = await client.query(
      "SELECT count(*)::int AS n FROM public.product_1_1_activation_actions",
    );
    const second = await activation(client, actor, "all_stores", replayOp, "proof replay");
    assert.equal(second.idempotent, true, "replay deve ser idempotente");
    const actionsAfter = await client.query(
      "SELECT count(*)::int AS n FROM public.product_1_1_activation_actions",
    );
    assert.equal(actionsAfter.rows[0].n, actionsBefore.rows[0].n, "replay nao cria nova acao");

    // Conflito de operationId.
    const conflict = await activation(client, actor, "off", replayOp, "proof replay conflict");
    assert.equal(conflict.conflict, true, "conteudo divergente deve conflitar");

    // Replay apos outra acao: resultado historico != estado atual.
    await activation(client, actor, "test_stores", randomUUID(), "proof newer action");
    const historical = await activation(client, actor, "all_stores", replayOp, "proof replay");
    assert.equal(historical.idempotent, true);
    assert.equal(historical.mode, "all_stores", "resultado historico preservado");
    const current = await readState(client);
    assert.equal(current.mode, "test_stores", "leitura fresca deve refletir a acao mais nova");

    // Autorizacao EXPIRADA nao pode aparecer como estado ativo nem bloquear
    // uma nova concessao (alreadyInMode deve ser false).
    await activation(client, actor, "off", randomUUID(), "proof before expiry");
    const expiredOp = randomUUID();
    await client.query(
      `INSERT INTO public.product_flow_stage_authorizations
         (event_type, stage, scope, instance_identity, granted_by, reason, operation_id, expires_at)
       VALUES ('granted', 'test_stores', 'test_stores', $1, $2, 'expired proof', $3, now() - interval '1 hour')`,
      [INSTANCE, actor, expiredOp],
    );
    const expiredState = await readState(client);
    assert.equal(expiredState.mode, "off", "autorizacao expirada nao pode parecer ativa");
    assert.equal(expiredState.testStage, "off", "leitura deve tratar expirada como off");
    const renewed = await activation(client, actor, "test_stores", randomUUID(), "proof renew expired");
    assert.equal(renewed.alreadyInMode, false, "autorizacao expirada nao pode bloquear nova concessao");
    await assertState(client, "test_stores", "apos renovar autorizacao expirada");

    // Falha intermediaria real.
    await activation(client, actor, "off", randomUUID(), "proof before failure");
    await forcedFailureProof(client, actor);
    await assertState(client, "off", "apos falha forcada");

    // Concorrencia: duas conexoes, duas acoes.
    const c1 = new Client(config);
    const c2 = new Client(config);
    await c1.connect();
    await c2.connect();
    try {
      const [r1, r2] = await Promise.all([
        activation(c1, actor, "all_stores", randomUUID(), "proof concurrent all"),
        activation(c2, actor, "test_stores", randomUUID(), "proof concurrent test"),
      ]);
      assert.equal(r1.success, true);
      assert.equal(r2.success, true);
      const final = await readState(client);
      assert.ok(["all_stores", "test_stores"].includes(final.mode), "estado final deve ser canonico");
    } finally {
      await c1.end();
      await c2.end();
    }

    // Restaura OFF e confirma.
    await activation(client, actor, "off", randomUUID(), "proof final reset");
    await assertState(client, "off", "estado final");

    console.log("PASS f56-2e activation proofs (transitions, rollback, replay, conflict, concurrency, current mode)");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("FAIL f56-2e activation proofs:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
