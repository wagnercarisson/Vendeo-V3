#!/usr/bin/env node
/**
 * F47.2 — Provas comportamentais em Postgres descartável do schema combinado.
 *
 * Requer que as migrations F47.1 (renumerada) + F47.2 já estejam aplicadas no
 * banco alvo. NÃO aplica migration, NÃO usa provider e NÃO escreve fora de uma
 * transação revertida ao final.
 *
 * Executar no Plano 06, com DATABASE_URL de banco descartável e
 * EXPECTED_DB_PORT fixado no checkpoint.
 */

import { randomUUID } from "node:crypto";
import { Client } from "pg";

const DATABASE_URL = process.env.DATABASE_URL ?? "";
const EXPECTED_DB_PORT = Number(process.env.EXPECTED_DB_PORT ?? "57882");
const ACTOR_INSTANCE = process.env.F47_2_ACTOR_INSTANCE ?? "127.0.0.1:57881";
const LOOPBACK = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok: Boolean(ok), detail: String(detail).slice(0, 320) });
}
function fail(name, detail) {
  record(name, false, detail);
}
function errorDetail(error) {
  return `${error?.code ?? "no_code"}: ${String(error?.message ?? error ?? "unknown").split("\n")[0]}`.slice(0, 300);
}

function assertLocalTarget() {
  if (!DATABASE_URL) throw new Error("database_url_missing");
  const url = new URL(DATABASE_URL);
  if (!LOOPBACK.has(url.hostname) || Number(url.port || 5432) !== EXPECTED_DB_PORT) {
    throw new Error("proof_target_not_approved_local_postgres");
  }
}

async function connect() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  await client.query("SET statement_timeout = '30s'");
  return client;
}

async function expectFailure(client, name, sql, params, pattern) {
  await client.query("SAVEPOINT f47_2_expected_failure");
  try {
    await client.query(sql, params);
    fail(name, "operation unexpectedly succeeded");
  } catch (error) {
    record(name, pattern.test(String(error?.message ?? "")), errorDetail(error));
  } finally {
    await client.query("ROLLBACK TO SAVEPOINT f47_2_expected_failure");
    await client.query("RELEASE SAVEPOINT f47_2_expected_failure");
  }
}

async function main() {
  assertLocalTarget();
  const client = await connect();

  try {
    const actorRows = await client.query("SELECT id::text AS id FROM auth.users ORDER BY id LIMIT 1");
    const storeRows = await client.query("SELECT id::text AS id FROM public.stores ORDER BY id LIMIT 1");
    const actor = actorRows.rows[0]?.id;
    const store = storeRows.rows[0]?.id;
    if (!actor) throw new Error("proof_actor_missing");
    if (!store) throw new Error("proof_store_missing");

    await client.query("BEGIN");

    const legacySet = await client.query(
      "SELECT to_regprocedure('public.admin_set_visual_signature_model_config(uuid,text,text,text,text,uuid,text)') AS fn",
    );
    const legacyReset = await client.query(
      "SELECT to_regprocedure('public.admin_reset_visual_signature_model_config(uuid,text,uuid,text)') AS fn",
    );
    record("schema: RPC antiga de set removida", legacySet.rows[0].fn === null);
    record("schema: RPC antiga de reset removida", legacyReset.rows[0].fn === null);

    for (const table of [
      "visual_signature_model_config",
      "visual_signature_model_config_release",
      "visual_signature_model_config_pilot_stores",
    ]) {
      const privileges = await client.query(
        `SELECT has_table_privilege('service_role', $1, 'INSERT') AS ins,
                has_table_privilege('service_role', $1, 'UPDATE') AS upd,
                has_table_privilege('service_role', $1, 'DELETE') AS del,
                has_table_privilege('service_role', $1, 'SELECT') AS sel`,
        [`public.${table}`],
      );
      const row = privileges.rows[0];
      record(`grants: ${table} sem DML direto`, !row.ins && !row.upd && !row.del);
      record(`grants: ${table} mantém SELECT`, row.sel === true);
    }

    const setLocal = async (orchestrator, op, identity = ACTOR_INSTANCE) =>
      (
        await client.query(
          "SELECT public.admin_set_visual_signature_model_config_v2($1,$2,'sunburst_medium','low',$3,$4,'local_validation',$5) AS r",
          [actor, orchestrator, "set local", op, identity],
        )
      ).rows[0].r;

    const v1 = await setLocal("gpt-5.5", randomUUID());
    record("set v2: versão criada", Boolean(v1?.config_version_id));
    const release1 = (
      await client.query("SELECT * FROM public.visual_signature_model_config_release WHERE scope='visual_signature'")
    ).rows[0];
    record(
      "set v2: liberação nasce desativada",
      release1?.published_config_version_id === null &&
        release1?.activated_config_version_id === null &&
        release1?.activation_mode === "none",
    );

    await expectFailure(
      client,
      "publicação: NULL rejeitado",
      "SELECT public.admin_publish_visual_signature_model_config($1,NULL,$2,'publish null',$3,$4)",
      [actor, v1.config_version_id, randomUUID(), ACTOR_INSTANCE],
      /invalid_published/,
    );

    await expectFailure(
      client,
      "publicação: identidade divergente rejeitada",
      "SELECT public.admin_publish_visual_signature_model_config($1,true,$2,'publish wrong identity',$3,$4)",
      [actor, v1.config_version_id, randomUUID(), "127.0.0.1:99999"],
      /instance_identity_mismatch/,
    );

    await expectFailure(
      client,
      "publicação: versão divergente rejeitada",
      "SELECT public.admin_publish_visual_signature_model_config($1,true,$2,'publish wrong version',$3,$4)",
      [actor, randomUUID(), randomUUID(), ACTOR_INSTANCE],
      /config_version_mismatch/,
    );

    const published = (
      await client.query(
        "SELECT public.admin_publish_visual_signature_model_config($1,true,$2,'publish',$3,$4) AS r",
        [actor, v1.config_version_id, randomUUID(), ACTOR_INSTANCE],
      )
    ).rows[0].r;
    record("publicação: versão publicada", published?.config_published === true);

    await expectFailure(
      client,
      "ativação: identidade divergente rejeitada",
      "SELECT public.admin_activate_visual_signature_model_config($1,$2,'pilot',ARRAY[$3]::uuid[],'activation wrong identity',$4,$5)",
      [actor, v1.config_version_id, store, randomUUID(), "127.0.0.1:99999"],
      /instance_identity_mismatch/,
    );

    await expectFailure(
      client,
      "ativação: piloto exige allowlist",
      "SELECT public.admin_activate_visual_signature_model_config($1,$2,'pilot',NULL,'pilot empty',$3,$4)",
      [actor, v1.config_version_id, randomUUID(), ACTOR_INSTANCE],
      /pilot_allowlist_required/,
    );

    const active1 = (
      await client.query(
        "SELECT public.admin_activate_visual_signature_model_config($1,$2,'pilot',ARRAY[$3]::uuid[],'activate pilot',$4,$5) AS r",
        [actor, v1.config_version_id, store, randomUUID(), ACTOR_INSTANCE],
      )
    ).rows[0].r;
    record("ativação: piloto ativo", active1?.config_activated === true);
    const allow1 = await client.query("SELECT count(*)::int AS n FROM public.visual_signature_model_config_pilot_stores");
    record("ativação: allowlist gravada", allow1.rows[0].n === 1);

    const v2 = await setLocal("gpt-6-luna", randomUUID());
    const release2 = (
      await client.query("SELECT * FROM public.visual_signature_model_config_release WHERE scope='visual_signature'")
    ).rows[0];
    record(
      "set v2: salvar nova versão invalida publicação/ativação",
      release2.published_config_version_id === null &&
        release2.activated_config_version_id === null &&
        release2.activation_mode === "none",
    );
    const allow2 = await client.query("SELECT count(*)::int AS n FROM public.visual_signature_model_config_pilot_stores");
    record("set v2: allowlist limpa", allow2.rows[0].n === 0);
    const auditInvalidation = await client.query(
      "SELECT metadata FROM public.admin_audit_log WHERE target_id = $1 AND action='visual_signature_model_config_update' ORDER BY created_at DESC LIMIT 1",
      [v2.config_version_id],
    );
    record(
      "set v2: auditoria guarda composição anterior da allowlist",
      Array.isArray(auditInvalidation.rows[0]?.metadata?.previous_pilot_stores),
    );

    await client.query(
      "SELECT public.admin_publish_visual_signature_model_config($1,true,$2,'publish v2',$3,$4)",
      [actor, v2.config_version_id, randomUUID(), ACTOR_INSTANCE],
    );
    await client.query(
      "SELECT public.admin_activate_visual_signature_model_config($1,$2,'pilot',ARRAY[$3]::uuid[],'activate v2',$4,$5)",
      [actor, v2.config_version_id, store, randomUUID(), ACTOR_INSTANCE],
    );

    await expectFailure(
      client,
      "reset: com ativação vigente exige desativação",
      "SELECT public.admin_reset_visual_signature_model_config($1,$2,'reset active',$3,$4)",
      [actor, v2.config_version_id, randomUUID(), ACTOR_INSTANCE],
      /deactivate_required/,
    );

    await client.query(
      "SELECT public.admin_activate_visual_signature_model_config($1,$2,'none',NULL,'deactivate',$3,$4)",
      [actor, v2.config_version_id, randomUUID(), ACTOR_INSTANCE],
    );
    const allow3 = await client.query("SELECT count(*)::int AS n FROM public.visual_signature_model_config_pilot_stores");
    record("desativação: allowlist preservada inativa", allow3.rows[0].n === 1);

    const reset = (
      await client.query(
        "SELECT public.admin_reset_visual_signature_model_config($1,$2,'reset after deactivate',$3,$4) AS r",
        [actor, v2.config_version_id, randomUUID(), ACTOR_INSTANCE],
      )
    ).rows[0].r;
    record("reset: remove configuração", reset?.removed === true);
    const allowAfterReset = await client.query("SELECT count(*)::int AS n FROM public.visual_signature_model_config_pilot_stores");
    record("reset: limpa allowlist", allowAfterReset.rows[0].n === 0);
    const configAfterReset = await client.query("SELECT count(*)::int AS n FROM public.visual_signature_model_config");
    record("reset: configuração ausente", configAfterReset.rows[0].n === 0);
    const resetAudit = await client.query(
      "SELECT metadata FROM public.admin_audit_log WHERE action='visual_signature_model_config_reset' ORDER BY created_at DESC LIMIT 1",
    );
    record(
      "reset: auditoria preserva composição anterior da allowlist",
      Array.isArray(resetAudit.rows[0]?.metadata?.previous_pilot_stores) &&
        resetAudit.rows[0].metadata.previous_pilot_stores.length === 1,
    );

    const production = (
      await client.query(
        "SELECT public.admin_set_visual_signature_model_config_v2($1,'gpt-6-luna','sunburst_medium','low','set production',$2,'production',$3) AS r",
        [actor, randomUUID(), ACTOR_INSTANCE],
      )
    ).rows[0].r;
    const releaseProduction = (
      await client.query("SELECT environment_scope FROM public.visual_signature_model_config_release WHERE scope='visual_signature'")
    ).rows[0];
    record(
      "ambiente: produção aceita com identidade explícita",
      Boolean(production?.config_version_id) && releaseProduction.environment_scope === "production",
    );

    await client.query("ROLLBACK");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    fail("provas: execução", errorDetail(error));
  } finally {
    await client.end().catch(() => {});
  }

  for (const result of results) {
    console.log(`${result.ok ? "PROOF OK  " : "PROOF FAIL"} ${result.name}${result.detail ? ` :: ${result.detail}` : ""}`);
  }
  const failed = results.filter((result) => !result.ok);
  console.log(
    JSON.stringify(
      {
        ok: failed.length === 0,
        proofs: results.length,
        passed: results.length - failed.length,
        failed: failed.length,
        failures: failed.map((result) => result.name),
        paid_provider_calls: false,
        remote_writes: false,
        transaction: "rolled_back",
      },
      null,
      2,
    ),
  );
  process.exitCode = failed.length === 0 ? 0 : 1;
}

main().catch((error) => {
  console.log(JSON.stringify({ ok: false, error: String(error?.message ?? "unknown").slice(0, 200) }));
  process.exitCode = 1;
});
