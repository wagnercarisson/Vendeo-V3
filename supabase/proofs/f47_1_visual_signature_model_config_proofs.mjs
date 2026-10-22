#!/usr/bin/env node
/**
 * F47.1 — Provas REAIS em Postgres local isolado da configuracao dedicada
 * da Assinatura Visual (tabela, CHECKs, RLS/grants, RPCs set/reset,
 * idempotencia, conflito por operation_id, auditoria, catalogo Luna e
 * concorrencia).
 *
 * Garantias:
 *   * Conecta SOMENTE no Postgres local aprovado (host loopback + porta
 *     esperada por EXPECTED_DB_PORT). Recusa qualquer outro destino.
 *   * NAO chama provider, NAO faz push/deploy, NAO aplica migration.
 *   * Provas nao concorrentes rodam em UMA transacao com ROLLBACK: nenhuma
 *     escrita persistente no schema public.
 *   * Provas concorrentes usam um DATABASE descartavel criado e removido
 *     neste mesmo servidor local (as transacoes concorrentes precisam de
 *     commits reais; o schema public aprovado nunca e tocado).
 *   * Antes/depois compara EXATAMENTE a linha preexistente de
 *     visual_signature_model_config (incluindo config_version_id), a
 *     auditoria, o catalogo e ai_model_pricing.
 *
 * Nunca imprime connection string, senha, chave ou token.
 */

import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { Client } from "pg";

const DATABASE_URL = process.env.DATABASE_URL ?? "";
const EXPECTED_DB_PORT = Number(process.env.EXPECTED_DB_PORT ?? "57782");
const EXPECTED_PROJECT_ID = process.env.EXPECTED_PROJECT_ID ?? "vendeo-homolog";
const MIGRATION_PATH = process.env.MIGRATION_PATH ?? "";
const MIGRATION_VERSION = process.env.EXPECTED_MIGRATION_VERSION ?? "20261021000001";
const PROOFS_ONLY = process.env.PROOFS_ONLY === "1";

const LOOPBACK = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
const ACTOR_INSTANCE = "127.0.0.1:57781";

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok: Boolean(ok), detail: String(detail).slice(0, 320) });
}
function fail(name, detail) {
  record(name, false, detail);
}
function errorDetail(error) {
  const code = error?.code ?? "no_code";
  const message = String(error?.message ?? error ?? "unknown").split("\n")[0];
  return `${code}: ${message}`.slice(0, 300);
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseTarget(rawUrl) {
  if (!rawUrl) throw new Error("database_url_missing");
  const url = new URL(rawUrl);
  const host = url.hostname;
  const port = Number(url.port || (url.protocol === "postgres:" ? 5432 : NaN));
  return { url, host, port, database: url.pathname.replace(/^\//, "") || "postgres" };
}

function assertLocalTarget() {
  const target = parseTarget(DATABASE_URL);
  if (!LOOPBACK.has(target.host) || target.port !== EXPECTED_DB_PORT) {
    throw new Error("proof_target_not_approved_local_postgres");
  }
  return target;
}

async function connect(url) {
  const client = new Client({ connectionString: url });
  await client.connect();
  await client.query("SET statement_timeout = '30s'");
  return client;
}

async function withSavepoint(client, fn) {
  await client.query("SAVEPOINT f47_proof_sp");
  try {
    const value = await fn();
    await client.query("RELEASE SAVEPOINT f47_proof_sp");
    return { ok: true, value };
  } catch (error) {
    await client.query("ROLLBACK TO SAVEPOINT f47_proof_sp");
    await client.query("RELEASE SAVEPOINT f47_proof_sp");
    try {
      await client.query("RESET ROLE");
    } catch {
      /* ignore */
    }
    return { ok: false, error };
  }
}

function rpcSet(client, args) {
  return client
    .query(
      "SELECT public.admin_set_visual_signature_model_config($1::uuid,$2::text,$3::text,$4::text,$5::text,$6::uuid,$7::text) AS result",
      [
        args.actor,
        args.orchestrator,
        args.preset,
        args.reasoning ?? "low",
        args.reason,
        args.operationId,
        args.instance ?? ACTOR_INSTANCE,
      ],
    )
    .then((result) => result.rows[0].result);
}

function rpcReset(client, args) {
  return client
    .query(
      "SELECT public.admin_reset_visual_signature_model_config($1::uuid,$2::text,$3::uuid,$4::text) AS result",
      [args.actor, args.reason, args.operationId, args.instance ?? ACTOR_INSTANCE],
    )
    .then((result) => result.rows[0].result);
}

const VERIFY_CATALOG_SQL = `
DO $f47_1_catalog_verify$
DECLARE
  v_segment TEXT;
  v_status TEXT;
BEGIN
  SELECT segment, status INTO v_segment, v_status
  FROM public.ai_model_catalog
  WHERE capability = 'visual_signature_image'
    AND provider = 'openai'
    AND model = 'gpt-6-luna'
    AND protocol = 'responses';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'f47_1_catalog_row_missing';
  END IF;

  IF v_segment <> 'image' OR v_status <> 'active' THEN
    RAISE EXCEPTION 'f47_1_catalog_row_divergent (segment=%, status=%)', v_segment, v_status;
  END IF;
END;
$f47_1_catalog_verify$;`;

async function snapshot(client) {
  const config = (
    await client.query(
      "SELECT to_jsonb(t) AS row FROM public.visual_signature_model_config t ORDER BY t.scope",
    )
  ).rows.map((row) => row.row);
  const catalog = (
    await client.query(
      `SELECT to_jsonb(t) AS row FROM public.ai_model_catalog t
        WHERE capability = 'visual_signature_image'
        ORDER BY provider, model, protocol`,
    )
  ).rows.map((row) => row.row);
  const audit = (
    await client.query(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE action LIKE 'visual_signature_model_config%')::int AS f47
         FROM public.admin_audit_log`,
    )
  ).rows[0];
  const pricing = (
    await client.query(
      `SELECT count(*)::int AS count,
              coalesce(max(updated_at)::text, '') AS max_updated_at,
              coalesce(md5(string_agg(t::text, '|' ORDER BY t.id::text)), '') AS fingerprint
         FROM public.ai_model_pricing t`,
    )
  ).rows[0];
  return { config, catalog, audit, pricing };
}

/* ------------------------------------------------------------------------- *
 * Provas no schema public real (transacao unica + ROLLBACK)
 * ------------------------------------------------------------------------- */

async function runRealProofs(admin, pre) {
  const actorRows = await admin.query("SELECT id::text AS id FROM auth.users ORDER BY id LIMIT 1");
  const actor = actorRows.rows[0]?.id;
  if (!actor) {
    fail("real: ator de auditoria disponivel", "no auth.users row (FK de auditoria)");
    return;
  }

  await admin.query("BEGIN");
  try {
    /* (a) tabela / colunas ------------------------------------------------- */
    const columns = (
      await admin.query(
        `SELECT column_name, data_type, is_nullable, column_default
           FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'visual_signature_model_config'
          ORDER BY ordinal_position`,
      )
    ).rows;
    const byName = new Map(columns.map((column) => [column.column_name, column]));
    const expectedColumns = [
      "scope",
      "environment_scope",
      "instance_identity",
      "orchestrator_model",
      "image_preset",
      "image_model",
      "image_quality",
      "reasoning_effort",
      "config_version_id",
      "reason",
      "updated_by",
      "updated_at",
      "created_at",
    ];
    record(
      "table: 13 colunas exatas",
      columns.length === 13 && expectedColumns.every((name) => byName.has(name)),
      `count=${columns.length}`,
    );
    record(
      "table: defaults canonicos",
      /visual_signature/.test(byName.get("scope")?.column_default ?? "") &&
        /local_validation/.test(byName.get("environment_scope")?.column_default ?? "") &&
        /low/.test(byName.get("reasoning_effort")?.column_default ?? "") &&
        /gen_random_uuid/.test(byName.get("config_version_id")?.column_default ?? "") &&
        byName.get("instance_identity")?.is_nullable === "NO",
      `scope_default=${byName.get("scope")?.column_default ?? "null"}`,
    );

    const constraints = (
      await admin.query(
        `SELECT conname, pg_get_constraintdef(oid) AS def
           FROM pg_constraint
          WHERE conrelid = 'public.visual_signature_model_config'::regclass`,
      )
    ).rows;
    const constraintNames = new Set(constraints.map((row) => row.conname));
    const requiredChecks = [
      "chk_vs_scope",
      "chk_vs_environment",
      "chk_vs_orchestrator",
      "chk_vs_quality",
      "chk_vs_reasoning",
      "chk_vs_instance_identity",
      "chk_vs_preset_tuple",
    ];
    record(
      "table: CHECKs presentes",
      requiredChecks.every((name) => constraintNames.has(name)),
      `missing=${requiredChecks.filter((name) => !constraintNames.has(name)).join(",") || "none"}`,
    );
    const presetTuple = constraints.find((row) => row.conname === "chk_vs_preset_tuple")?.def ?? "";
    record(
      "table: preset tuple fechada (4 tuples, sem image-2-low)",
      ["flare_low", "flare_medium", "sunburst_low", "sunburst_medium"].every((preset) =>
        presetTuple.includes(preset),
      ) && !/image-2-low/.test(presetTuple),
      "preset_tuple_checked",
    );

    /* (b) RLS / grants ----------------------------------------------------- */
    const rls = (
      await admin.query(
        "SELECT relrowsecurity FROM pg_class WHERE oid = 'public.visual_signature_model_config'::regclass",
      )
    ).rows[0]?.relrowsecurity;
    record("rls: habilitada na tabela", rls === true, `relrowsecurity=${rls}`);

    const policies = (
      await admin.query(
        "SELECT policyname, roles::text AS roles FROM pg_policies WHERE schemaname='public' AND tablename='visual_signature_model_config'",
      )
    ).rows;
    record(
      "rls: policy exclusiva de service_role",
      policies.length === 1 && /service_role/.test(policies[0].roles),
      `policies=${policies.length}`,
    );

    const table = "public.visual_signature_model_config";
    const priv = async (role, privilege) =>
      (
        await admin.query("SELECT has_table_privilege($1, $2, $3) AS ok", [role, table, privilege])
      ).rows[0].ok;
    const allPrivileges = ["SELECT", "INSERT", "UPDATE", "DELETE"];
    const anonDenied = (
      await Promise.all(allPrivileges.map((privilege) => priv("anon", privilege)))
    ).every((ok) => ok === false);
    const authenticatedDenied = (
      await Promise.all(allPrivileges.map((privilege) => priv("authenticated", privilege)))
    ).every((ok) => ok === false);
    const serviceAllowed = (
      await Promise.all(allPrivileges.map((privilege) => priv("service_role", privilege)))
    ).every((ok) => ok === true);
    record("grants: anon sem SELECT/INSERT/UPDATE/DELETE", anonDenied);
    record("grants: authenticated sem SELECT/INSERT/UPDATE/DELETE", authenticatedDenied);
    record("grants: service_role com SELECT/INSERT/UPDATE/DELETE", serviceAllowed);

    const publicPrivileges = (
      await admin.query(
        `SELECT count(*)::int AS n
           FROM aclexplode(coalesce((SELECT relacl FROM pg_class WHERE oid = $1::regclass), '{}')) AS a
          WHERE a.grantee = 0`,
        [table],
      )
    ).rows[0].n;
    record("grants: PUBLIC sem privilegios na tabela", publicPrivileges === 0, `public_entries=${publicPrivileges}`);

    const fnSet = "public.admin_set_visual_signature_model_config(uuid,text,text,text,text,uuid,text)";
    const fnReset = "public.admin_reset_visual_signature_model_config(uuid,text,uuid,text)";
    const fnPriv = async (role, fn) =>
      (await admin.query("SELECT has_function_privilege($1, $2, 'EXECUTE') AS ok", [role, fn]))
        .rows[0].ok;
    record(
      "grants: RPCs negadas a anon/authenticated",
      (await fnPriv("anon", fnSet)) === false &&
        (await fnPriv("authenticated", fnSet)) === false &&
        (await fnPriv("anon", fnReset)) === false &&
        (await fnPriv("authenticated", fnReset)) === false,
    );
    record(
      "grants: RPCs concedidas a service_role",
      (await fnPriv("service_role", fnSet)) === true &&
        (await fnPriv("service_role", fnReset)) === true,
    );

    const anonSelect = await withSavepoint(admin, async () => {
      await admin.query("SET LOCAL ROLE anon");
      return admin.query("SELECT count(*) FROM public.visual_signature_model_config");
    });
    record(
      "rls: SELECT como anon e negado em runtime",
      !anonSelect.ok && anonSelect.error?.code === "42501",
      anonSelect.ok ? "unexpected success" : errorDetail(anonSelect.error),
    );

    const serviceSelect = await withSavepoint(admin, async () => {
      await admin.query("SET LOCAL ROLE service_role");
      return admin.query("SELECT count(*)::int AS n FROM public.visual_signature_model_config");
    });
    record(
      "rls: SELECT como service_role e permitido em runtime",
      serviceSelect.ok,
      serviceSelect.ok ? `rows=${serviceSelect.value.rows[0].n}` : errorDetail(serviceSelect.error),
    );

    /* (c) tuples invalidas rejeitadas ------------------------------------- */
    const insert = (overrides) => {
      const values = {
        instance_identity: ACTOR_INSTANCE,
        orchestrator_model: "gpt-5.5",
        image_preset: "flare_low",
        image_model: "gpt-image-2.5-flare",
        image_quality: "low",
        reasoning_effort: "low",
        ...overrides,
      };
      const keys = Object.keys(values);
      return admin.query(
        `INSERT INTO public.visual_signature_model_config (${keys.join(", ")})
         VALUES (${keys.map((_, index) => `$${index + 1}`).join(", ")})`,
        keys.map((key) => values[key]),
      );
    };
    const expectDbFailure = async (name, fn, matcher) => {
      const attempt = await withSavepoint(admin, fn);
      if (attempt.ok) return record(name, false, "unexpected success");
      record(name, matcher(attempt.error), errorDetail(attempt.error));
    };
    const checkViolation = (error) => error?.code === "23514" && /chk_vs_/.test(error.message);

    await expectDbFailure(
      "check: orquestrador invalido rejeitado",
      () => insert({ orchestrator_model: "gpt-4o" }),
      (error) => checkViolation(error) && /chk_vs_orchestrator/.test(error.message),
    );
    await expectDbFailure(
      "check: preset/modelo divergente rejeitado",
      () => insert({ image_preset: "flare_low", image_model: "gpt-image-2.5-sunburst" }),
      (error) => checkViolation(error) && /chk_vs_preset_tuple/.test(error.message),
    );
    await expectDbFailure(
      "check: reasoning != low rejeitado",
      () => insert({ reasoning_effort: "high" }),
      (error) => checkViolation(error) && /chk_vs_reasoning/.test(error.message),
    );
    await expectDbFailure(
      "check: environment != local_validation rejeitado",
      () => insert({ environment_scope: "production" }),
      (error) => checkViolation(error) && /chk_vs_environment/.test(error.message),
    );
    await expectDbFailure(
      "check: scope != visual_signature rejeitado",
      () => insert({ scope: "other" }),
      (error) => checkViolation(error) && /chk_vs_scope/.test(error.message),
    );
    await expectDbFailure(
      "check: imagem quality invalida rejeitada",
      () => insert({ image_quality: "high" }),
      (error) => error?.code === "23514",
    );
    await expectDbFailure(
      "check: instance_identity vazia rejeitada",
      () => insert({ instance_identity: "   " }),
      (error) => checkViolation(error) && /chk_vs_instance_identity/.test(error.message),
    );
    await expectDbFailure(
      "check: preset image-2-low inexistente rejeitado",
      () =>
        insert({
          image_preset: "image-2-low",
          image_model: "gpt-image-2.5-flare",
          image_quality: "low",
        }),
      (error) => checkViolation(error) && /chk_vs_preset_tuple/.test(error.message),
    );

    /* (d) validacoes da RPC set ------------------------------------------- */
    const expectRpcFailure = async (name, args, pattern) => {
      const attempt = await withSavepoint(admin, () => rpcSet(admin, args));
      if (attempt.ok) return record(name, false, "unexpected success");
      record(
        name,
        attempt.error?.code === "P0001" && pattern.test(attempt.error.message),
        errorDetail(attempt.error),
      );
    };
    const baseArgs = {
      actor,
      orchestrator: "gpt-5.5",
      preset: "flare_low",
      reasoning: "low",
      reason: "proof",
      operationId: randomUUID(),
      instance: ACTOR_INSTANCE,
    };
    await expectRpcFailure("rpc: actor ausente rejeitado", { ...baseArgs, actor: null }, /missing_actor_id/);
    await expectRpcFailure("rpc: motivo vazio rejeitado", { ...baseArgs, reason: "  " }, /missing_reason/);
    await expectRpcFailure(
      "rpc: reasoning != low rejeitado",
      { ...baseArgs, reasoning: "medium" },
      /invalid_reasoning/,
    );
    await expectRpcFailure(
      "rpc: preset invalido rejeitado no servidor",
      { ...baseArgs, preset: "image-2-low" },
      /invalid_preset/,
    );
    await expectRpcFailure(
      "rpc: orquestrador invalido rejeitado",
      { ...baseArgs, orchestrator: "gpt-4o" },
      /invalid_orchestrator/,
    );
    await expectRpcFailure(
      "rpc: instance_identity vazia rejeitada",
      { ...baseArgs, instance: "   " },
      /missing_instance_identity/,
    );
    await expectRpcFailure(
      "rpc: operation_id ausente rejeitado",
      { ...baseArgs, operationId: null },
      /missing_operation_id/,
    );

    /* (e) set valido deriva modelo/qualidade e nova versao ----------------- */
    const op1 = randomUUID();
    const set1 = await rpcSet(admin, { ...baseArgs, operationId: op1, reason: "proof set 1" });
    record(
      "set: sucesso com derivacao server-side",
      set1?.success === true &&
        set1?.idempotent === false &&
        set1?.image_model === "gpt-image-2.5-flare" &&
        set1?.image_quality === "low",
      `model=${set1?.image_model} quality=${set1?.image_quality}`,
    );
    record("set: nova config_version_id UUID", UUID_RE.test(set1?.config_version_id ?? ""));
    const row1 = (
      await admin.query(
        `SELECT orchestrator_model, image_preset, image_model, image_quality, reasoning_effort,
                config_version_id::text AS config_version_id, updated_by::text AS updated_by, reason
           FROM public.visual_signature_model_config WHERE scope = 'visual_signature'`,
      )
    ).rows[0];
    record(
      "set: linha persistida corresponde ao retorno",
      Boolean(row1) &&
        row1.config_version_id === set1.config_version_id &&
        row1.image_model === set1.image_model &&
        row1.image_quality === set1.image_quality &&
        row1.updated_by === actor,
      row1 ? `version=${row1.config_version_id}` : "row missing",
    );

    const auditFor = async (operationId) =>
      (
        await admin.query(
          `SELECT id::text AS id, action, target_type, target_id::text AS target_id,
                  actor_id::text AS actor_id, operation_id::text AS operation_id, metadata
             FROM public.admin_audit_log WHERE operation_id = $1`,
          [operationId],
        )
      ).rows;
    const audit1 = await auditFor(op1);
    record(
      "audit: set registra acao/target/ator/versao",
      audit1.length === 1 &&
        audit1[0].action === "visual_signature_model_config_update" &&
        audit1[0].target_type === "visual_signature_model_config" &&
        audit1[0].target_id === set1.config_version_id &&
        audit1[0].actor_id === actor,
      `rows=${audit1.length}`,
    );
    const meta1 = audit1[0]?.metadata ?? {};
    record(
      "audit: metadata completa (ator/motivo/preset/modelos/qualidade/reasoning/versao)",
      meta1.actor_id === actor &&
        meta1.reason === "proof set 1" &&
        meta1.image_preset === "flare_low" &&
        meta1.orchestrator_model === "gpt-5.5" &&
        meta1.image_model === "gpt-image-2.5-flare" &&
        meta1.image_quality === "low" &&
        meta1.reasoning_effort === "low" &&
        meta1.config_version_id === set1.config_version_id,
      `keys=${Object.keys(meta1).length}`,
    );

    /* (f) replay idempotente ---------------------------------------------- */
    const replay1 = await rpcSet(admin, { ...baseArgs, operationId: op1, reason: "proof set 1" });
    const auditAfterReplay = await auditFor(op1);
    record(
      "set: replay equivalente idempotente sem nova versao",
      replay1?.idempotent === true &&
        replay1?.config_version_id === set1.config_version_id &&
        auditAfterReplay.length === 1,
      `idempotent=${replay1?.idempotent} audits=${auditAfterReplay.length}`,
    );

    /* (g) conflito divergente --------------------------------------------- */
    const conflict = await withSavepoint(admin, () =>
      rpcSet(admin, {
        ...baseArgs,
        operationId: op1,
        preset: "sunburst_medium",
        reason: "proof set 1",
      }),
    );
    record(
      "set: mesmo operation_id com conteudo divergente -> operation_id_conflict",
      !conflict.ok &&
        conflict.error?.code === "P0001" &&
        /operation_id_conflict/.test(conflict.error.message),
      conflict.ok ? "unexpected success" : errorDetail(conflict.error),
    );
    const rowAfterConflict = (
      await admin.query(
        "SELECT image_preset, config_version_id::text AS config_version_id FROM public.visual_signature_model_config WHERE scope='visual_signature'",
      )
    ).rows[0];
    record(
      "set: conflito nao altera a configuracao vigente",
      rowAfterConflict?.image_preset === "flare_low" &&
        rowAfterConflict?.config_version_id === set1.config_version_id &&
        (await auditFor(op1)).length === 1,
    );

    /* (h) segundo set: singleton e nova versao ---------------------------- */
    const op2 = randomUUID();
    await rpcSet(admin, {
      ...baseArgs,
      orchestrator: "gpt-6-luna",
      preset: "sunburst_medium",
      operationId: op2,
      reason: "proof set 2",
    });
    const row2 = (
      await admin.query(
        "SELECT image_model, image_quality, config_version_id::text AS config_version_id FROM public.visual_signature_model_config",
      )
    ).rows;
    record(
      "set: novo set renova versao e mantem singleton",
      row2.length === 1 &&
        row2[0].image_model === "gpt-image-2.5-sunburst" &&
        row2[0].image_quality === "medium" &&
        row2[0].config_version_id !== set1.config_version_id,
      `rows=${row2.length}`,
    );

    /* (i) orquestrador fora do catalogo ---------------------------------- */
    const outOfCatalog = await withSavepoint(admin, async () => {
      await admin.query(
        `UPDATE public.ai_model_catalog SET status = 'deprecated'
          WHERE capability = 'visual_signature_image' AND provider = 'openai'
            AND model = 'gpt-6-luna' AND protocol = 'responses'`,
      );
      return rpcSet(admin, {
        ...baseArgs,
        orchestrator: "gpt-6-luna",
        preset: "sunburst_low",
        operationId: randomUUID(),
        reason: "proof out of catalog",
      });
    });
    record(
      "rpc: orquestrador fora do catalogo ativo recusado",
      !outOfCatalog.ok &&
        outOfCatalog.error?.code === "P0001" &&
        /orchestrator_not_in_catalog/.test(outOfCatalog.error.message),
      outOfCatalog.ok ? "unexpected success" : errorDetail(outOfCatalog.error),
    );

    /* (j) reset com auditoria e idempotencia ------------------------------ */
    const resetOp = randomUUID();
    const reset1 = await rpcReset(admin, {
      actor,
      reason: "proof reset 1",
      operationId: resetOp,
    });
    const rowsAfterReset = (
      await admin.query("SELECT count(*)::int AS n FROM public.visual_signature_model_config")
    ).rows[0].n;
    const resetAudit1 = await auditFor(resetOp);
    record(
      "reset: remove a linha com auditoria na mesma transacao",
      reset1?.success === true &&
        reset1?.removed === true &&
        reset1?.idempotent === false &&
        rowsAfterReset === 0 &&
        resetAudit1.length === 1 &&
        resetAudit1[0].action === "visual_signature_model_config_reset" &&
        resetAudit1[0].target_type === "visual_signature_model_config",
      `rows=${rowsAfterReset} audits=${resetAudit1.length}`,
    );
    const resetReplay = await rpcReset(admin, {
      actor,
      reason: "proof reset 1",
      operationId: resetOp,
    });
    record(
      "reset: replay idempotente",
      resetReplay?.idempotent === true && (await auditFor(resetOp)).length === 1,
      `idempotent=${resetReplay?.idempotent}`,
    );
    const resetEmpty = await rpcReset(admin, {
      actor,
      reason: "proof reset empty",
      operationId: randomUUID(),
    });
    record(
      "reset: sem linha retorna idempotent=true e nao apaga auditoria",
      resetEmpty?.idempotent === true &&
        resetEmpty?.removed === false &&
        (await auditFor(resetOp)).length === 1,
      `removed=${resetEmpty?.removed}`,
    );
    const resetDivergent = await withSavepoint(admin, () =>
      rpcReset(admin, {
        actor,
        reason: "proof reset divergent",
        operationId: resetOp,
      }),
    );
    record(
      "reset: operation_id divergente -> operation_id_conflict",
      !resetDivergent.ok &&
        resetDivergent.error?.code === "P0001" &&
        /operation_id_conflict/.test(resetDivergent.error.message),
      resetDivergent.ok ? "unexpected success" : errorDetail(resetDivergent.error),
    );

    /* (k) CHECKs de auditoria estendidos sem remover valores antigos ------ */
    const auditInsert = (action, targetType) =>
      admin.query(
        `INSERT INTO public.admin_audit_log (actor_id, action, target_type, target_id, reason, operation_id, metadata)
         VALUES ($1::uuid, $2, $3, gen_random_uuid(), 'proof audit check', gen_random_uuid(), '{}'::jsonb)`,
        [actor, action, targetType],
      );
    for (const [action, targetType] of [
      ["visual_signature_model_config_update", "visual_signature_model_config"],
      ["visual_signature_model_config_reset", "visual_signature_model_config"],
      ["image_model_pair_config_update", "image_model_pair_config"],
      ["product_1_1_pending_resolution", "user"],
    ]) {
      const attempt = await withSavepoint(admin, () => auditInsert(action, targetType));
      record(
        `audit check: aceita acao ${action}`,
        attempt.ok,
        attempt.ok ? "accepted" : errorDetail(attempt.error),
      );
    }

    /* (l) catalogo Luna: integridade, insercao idempotente, divergencia --- */
    const catalogBefore = (
      await admin.query(
        `SELECT segment, status FROM public.ai_model_catalog
          WHERE capability='visual_signature_image' AND provider='openai'
            AND model='gpt-6-luna' AND protocol='responses'`,
      )
    ).rows;
    record(
      "catalog: Luna responses ativa em visual_signature_image",
      catalogBefore.length === 1 &&
        catalogBefore[0].segment === "image" &&
        catalogBefore[0].status === "active",
      `rows=${catalogBefore.length}`,
    );

    const catalogCount = async () =>
      (
        await admin.query(
          "SELECT count(*)::int AS n FROM public.ai_model_catalog WHERE capability='visual_signature_image'",
        )
      ).rows[0].n;
    const countBeforeInsert = await catalogCount();
    const insertIdempotent = await withSavepoint(admin, () =>
      admin.query(
        `INSERT INTO public.ai_model_catalog
           (capability, segment, provider, model, protocol, label, status, source_note, validated_at)
         VALUES ('visual_signature_image','image','openai','gpt-6-luna','responses',
                 'GPT-6 Luna (Responses)','active','F47.1 visual signature local validation',NULL)
         ON CONFLICT (capability, provider, model, protocol) DO NOTHING`,
      ),
    );
    record(
      "catalog: insercao idempotente nao duplica nem altera",
      insertIdempotent.ok && (await catalogCount()) === countBeforeInsert,
      `count=${countBeforeInsert}`,
    );
    const verifyCatalog = await withSavepoint(admin, () => admin.query(VERIFY_CATALOG_SQL));
    record(
      "catalog: verificacao de integridade passa",
      verifyCatalog.ok,
      verifyCatalog.ok ? "ok" : errorDetail(verifyCatalog.error),
    );
    const divergentCatalog = await withSavepoint(admin, async () => {
      await admin.query(
        `UPDATE public.ai_model_catalog SET status='deprecated'
          WHERE capability='visual_signature_image' AND provider='openai'
            AND model='gpt-6-luna' AND protocol='responses'`,
      );
      return admin.query(VERIFY_CATALOG_SQL);
    });
    record(
      "catalog: divergencia falha explicitamente (sem ON CONFLICT silencioso)",
      !divergentCatalog.ok && /f47_1_catalog_row_divergent/.test(divergentCatalog.error?.message ?? ""),
      divergentCatalog.ok ? "unexpected success" : errorDetail(divergentCatalog.error),
    );

    /* (m) pricing intocado ------------------------------------------------- */
    const pricingNow = (
      await admin.query(
        `SELECT count(*)::int AS count,
                coalesce(max(updated_at)::text,'') AS max_updated_at,
                coalesce(md5(string_agg(t::text, '|' ORDER BY t.id::text)),'') AS fingerprint
           FROM public.ai_model_pricing t`,
      )
    ).rows[0];
    record(
      "pricing: nenhuma linha criada/alterada",
      pricingNow.count === pre.pricing.count &&
        pricingNow.max_updated_at === pre.pricing.max_updated_at &&
        pricingNow.fingerprint === pre.pricing.fingerprint,
      `count=${pricingNow.count}`,
    );

    /* (n) nenhuma chamada paga -------------------------------------------- */
    const source = readFileSync(new URL(import.meta.url), "utf8");
    const bannedTokens = [
      "node:" + "http",
      "api." + "openai" + ".com",
      "anthro" + "pic",
      "generative" + "language",
    ];
    const hasFetchCall = new RegExp("\\b" + "fetch" + "\\s*\\(").test(source);
    record(
      "no-paid-calls: harness sem fetch/HTTP/provider",
      !hasFetchCall && bannedTokens.every((token) => !source.includes(token)),
      "static_scan",
    );
  } catch (error) {
    fail("real: execucao completa das provas", errorDetail(error));
  } finally {
    await admin.query("ROLLBACK");
  }
}

/* ------------------------------------------------------------------------- *
 * Provas de concorrencia em DATABASE descartavel no MESMO servidor local
 * ------------------------------------------------------------------------- */

const DISPOSABLE_PREREQ_SQL = `
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid()
);
CREATE TABLE public.ai_model_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  capability text NOT NULL,
  segment text NOT NULL,
  provider text NOT NULL,
  model text NOT NULL,
  protocol text NOT NULL,
  label text,
  status text NOT NULL DEFAULT 'active',
  source_note text,
  validated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_model_catalog_capability_provider_model_protocol_key
    UNIQUE (capability, provider, model, protocol),
  CONSTRAINT ai_model_catalog_protocol_check
    CHECK (protocol IN ('chat-completions','responses','images','gemini')),
  CONSTRAINT ai_model_catalog_segment_check
    CHECK (segment IN ('text','vision','image')),
  CONSTRAINT ai_model_catalog_status_check
    CHECK (status IN ('active','deprecated'))
);
CREATE TABLE public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES auth.users(id),
  action text NOT NULL,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  reason text NOT NULL,
  operation_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_admin_audit_log_operation
  ON public.admin_audit_log (operation_id) WHERE operation_id IS NOT NULL;
INSERT INTO public.ai_model_catalog
  (capability, segment, provider, model, protocol, label, status)
VALUES
  ('visual_signature_image','image','openai','gpt-5.5','responses','GPT-5.5','active');
`;

async function cleanDisposable(client) {
  await client.query("DELETE FROM public.admin_audit_log");
  await client.query("DELETE FROM public.visual_signature_model_config");
  await client.query("UPDATE public.ai_model_catalog SET status='active'");
}

async function disposableCounts(client) {
  const config = (await client.query("SELECT count(*)::int AS n FROM public.visual_signature_model_config")).rows[0].n;
  const audit = (await client.query("SELECT count(*)::int AS n FROM public.admin_audit_log")).rows[0].n;
  return { config, audit };
}

async function currentConfig(client) {
  return (
    await client.query(
      `SELECT orchestrator_model, image_preset, image_model, image_quality,
              config_version_id::text AS config_version_id
         FROM public.visual_signature_model_config WHERE scope='visual_signature'`,
    )
  ).rows[0];
}

async function runConcurrencyAgainst(conn, actor, disposableUrl) {
  const room = ACTOR_INSTANCE;
  const openPeer = () => connect(disposableUrl);
  const same = (op, preset) => ({
    actor,
    orchestrator: "gpt-5.5",
    preset,
    reasoning: "low",
    reason: "concurrent proof",
    operationId: op,
    instance: room,
  });

  /* 1. set x set, mesmo operation_id, conteudo equivalente ------------- */
  {
    await cleanDisposable(conn);
    const op = randomUUID();
    const a = await openPeer();
    const b = await openPeer();
    let aRes = null;
    let bRes = null;
    let bErr = null;
    try {
      await a.query("BEGIN");
      aRes = await rpcSet(a, same(op, "flare_low"));
      await b.query("BEGIN");
      const bPromise = rpcSet(b, same(op, "flare_low")).then(
        (value) => { bRes = value; },
        (error) => { bErr = error; },
      );
      await sleep(400);
      await a.query("COMMIT");
      await bPromise;
      if (bErr) await b.query("ROLLBACK");
      else await b.query("COMMIT");
    } catch (error) {
      fail("concurrency set x set equivalente executou", errorDetail(error));
    } finally {
      await a.end().catch(() => {});
      await b.end().catch(() => {});
    }
    const counts = await disposableCounts(conn);
    record(
      "concurrency set x set equivalente: ambas sucesso/idempotente",
      aRes?.success === true &&
        aRes?.idempotent === false &&
        bRes?.success === true &&
        bRes?.idempotent === true,
      `a_idem=${aRes?.idempotent} b_idem=${bRes?.idempotent} b_err=${bErr ? errorDetail(bErr) : "none"}`,
    );
    record(
      "concurrency set x set equivalente: exatamente 1 versao/auditoria, sem unique violation",
      !bErr &&
        counts.config === 1 &&
        counts.audit === 1 &&
        aRes?.config_version_id === bRes?.config_version_id,
      `config=${counts.config} audit=${counts.audit}`,
    );
    record(
      "concurrency set x set equivalente: sem violacao de unicidade",
      !bErr || !/duplicate key|unique/i.test(bErr.message ?? ""),
      bErr ? errorDetail(bErr) : "no error",
    );
  }

  /* 2. set x set, mesmo operation_id, conteudo divergente --------------- */
  {
    await cleanDisposable(conn);
    const op = randomUUID();
    const a = await openPeer();
    const b = await openPeer();
    let aRes = null;
    let bErr = null;
    try {
      await a.query("BEGIN");
      aRes = await rpcSet(a, same(op, "flare_low"));
      await b.query("BEGIN");
      const bPromise = rpcSet(b, same(op, "sunburst_low")).then(
        () => { bErr = null; },
        (error) => { bErr = error; },
      );
      await sleep(400);
      await a.query("COMMIT");
      await bPromise;
      if (bErr) await b.query("ROLLBACK");
      else await b.query("COMMIT");
    } catch (error) {
      fail("concurrency set x set divergente executou", errorDetail(error));
    } finally {
      await a.end().catch(() => {});
      await b.end().catch(() => {});
    }
    const config = await currentConfig(conn);
    const counts = await disposableCounts(conn);
    record(
      "concurrency set x set divergente: uma sucesso, outra operation_id_conflict",
      aRes?.success === true &&
        bErr?.code === "P0001" &&
        /operation_id_conflict/.test(bErr?.message ?? ""),
      bErr ? errorDetail(bErr) : "second unexpectedly succeeded",
    );
    record(
      "concurrency set x set divergente: configuracao/auditoria intactas",
      config?.image_preset === "flare_low" &&
        config?.config_version_id === aRes?.config_version_id &&
        counts.config === 1 &&
        counts.audit === 1,
      `config=${counts.config} audit=${counts.audit}`,
    );
  }

  /* 3. dois sets com operation_id distintos: serializacao singleton ----- */
  {
    await cleanDisposable(conn);
    const opA = randomUUID();
    const opB = randomUUID();
    const a = await openPeer();
    const b = await openPeer();
    let aRes = null;
    let bRes = null;
    let bErr = null;
    try {
      await a.query("BEGIN");
      aRes = await rpcSet(a, same(opA, "flare_low"));
      await b.query("BEGIN");
      const bPromise = rpcSet(b, same(opB, "sunburst_medium")).then(
        (value) => { bRes = value; },
        (error) => { bErr = error; },
      );
      await sleep(400);
      await a.query("COMMIT");
      await bPromise;
      if (bErr) await b.query("ROLLBACK");
      else await b.query("COMMIT");
    } catch (error) {
      fail("concurrency dois sets serializou", errorDetail(error));
    } finally {
      await a.end().catch(() => {});
      await b.end().catch(() => {});
    }
    const config = await currentConfig(conn);
    const counts = await disposableCounts(conn);
    record(
      "concurrency dois sets: serializados sem violar singleton/versao",
      !bErr &&
        aRes?.success === true &&
        bRes?.success === true &&
        counts.config === 1 &&
        counts.audit === 2 &&
        config?.image_preset === "sunburst_medium" &&
        aRes?.config_version_id !== bRes?.config_version_id,
      `config=${counts.config} audit=${counts.audit}`,
    );
  }

  /* 4. reset x reset, mesmo operation_id, equivalente ------------------ */
  {
    await cleanDisposable(conn);
    const setOp = randomUUID();
    await rpcSet(conn, same(setOp, "flare_low"));
    const resetOp = randomUUID();
    const a = await openPeer();
    const b = await openPeer();
    let aRes = null;
    let bRes = null;
    let bErr = null;
    try {
      await a.query("BEGIN");
      aRes = await rpcReset(a, { actor, reason: "concurrent reset", operationId: resetOp });
      await b.query("BEGIN");
      const bPromise = rpcReset(b, {
        actor,
        reason: "concurrent reset",
        operationId: resetOp,
      }).then((value) => { bRes = value; }, (error) => { bErr = error; });
      await sleep(400);
      await a.query("COMMIT");
      await bPromise;
      if (bErr) await b.query("ROLLBACK");
      else await b.query("COMMIT");
    } catch (error) {
      fail("concurrency reset x reset equivalente executou", errorDetail(error));
    } finally {
      await a.end().catch(() => {});
      await b.end().catch(() => {});
    }
    const counts = await disposableCounts(conn);
    record(
      "concurrency reset x reset equivalente: sucesso + idempotente, 1 auditoria",
      aRes?.removed === true &&
        aRes?.idempotent === false &&
        bRes?.idempotent === true &&
        counts.config === 0 &&
        counts.audit === 2,
      `config=${counts.config} audit=${counts.audit} b_err=${bErr ? errorDetail(bErr) : "none"}`,
    );
  }

  /* 5. reset x reset, mesmo operation_id, divergente ------------------- */
  {
    await cleanDisposable(conn);
    const setOp = randomUUID();
    await rpcSet(conn, same(setOp, "flare_low"));
    const resetOp = randomUUID();
    const a = await openPeer();
    const b = await openPeer();
    let aRes = null;
    let bErr = null;
    try {
      await a.query("BEGIN");
      aRes = await rpcReset(a, { actor, reason: "concurrent reset A", operationId: resetOp });
      await b.query("BEGIN");
      const bPromise = rpcReset(b, {
        actor,
        reason: "concurrent reset B divergent",
        operationId: resetOp,
      }).then(() => { bErr = null; }, (error) => { bErr = error; });
      await sleep(400);
      await a.query("COMMIT");
      await bPromise;
      if (bErr) await b.query("ROLLBACK");
      else await b.query("COMMIT");
    } catch (error) {
      fail("concurrency reset x reset divergente executou", errorDetail(error));
    } finally {
      await a.end().catch(() => {});
      await b.end().catch(() => {});
    }
    const counts = await disposableCounts(conn);
    record(
      "concurrency reset x reset divergente: um vence, outro operation_id_conflict",
      aRes?.removed === true &&
        bErr?.code === "P0001" &&
        /operation_id_conflict/.test(bErr?.message ?? "") &&
        counts.config === 0 &&
        counts.audit === 2,
      `b_err=${bErr ? errorDetail(bErr) : "none"} audit=${counts.audit}`,
    );
  }

  /* 6. set x reset, mesmo operation_id -------------------------------- */
  {
    await cleanDisposable(conn);
    const op = randomUUID();
    const a = await openPeer();
    const b = await openPeer();
    let aRes = null;
    let bErr = null;
    try {
      await a.query("BEGIN");
      aRes = await rpcSet(a, same(op, "flare_low"));
      await b.query("BEGIN");
      const bPromise = rpcReset(b, { actor, reason: "reset racing set", operationId: op }).then(
        () => { bErr = null; },
        (error) => { bErr = error; },
      );
      await sleep(400);
      await a.query("COMMIT");
      await bPromise;
      if (bErr) await b.query("ROLLBACK");
      else await b.query("COMMIT");
    } catch (error) {
      fail("concurrency set x reset executou", errorDetail(error));
    } finally {
      await a.end().catch(() => {});
      await b.end().catch(() => {});
    }
    const config = await currentConfig(conn);
    const counts = await disposableCounts(conn);
    record(
      "concurrency set x reset: um vence, outro operation_id_conflict, sem colisao de indice",
      aRes?.success === true &&
        bErr?.code === "P0001" &&
        /operation_id_conflict/.test(bErr?.message ?? "") &&
        config?.config_version_id === aRes?.config_version_id &&
        counts.config === 1 &&
        counts.audit === 1,
      `b_err=${bErr ? errorDetail(bErr) : "none"} config=${counts.config} audit=${counts.audit}`,
    );
  }
}

async function runConcurrencyProofs(admin) {
  if (!MIGRATION_PATH) {
    fail("concurrency: migration path disponivel", "MIGRATION_PATH ausente");
    return;
  }
  const migrationSql = readFileSync(MIGRATION_PATH, "utf8");
  const name = `f47_1_proofs_${Date.now()}_${Math.floor(Math.random() * 1_000_000)}`;
  if (!/^[a-z0-9_]+$/.test(name)) {
    fail("concurrency: nome de database descartavel valido", name);
    return;
  }
  await admin.query(`CREATE DATABASE ${name}`);
  const disposableUrl = (() => {
    const url = new URL(DATABASE_URL);
    url.pathname = `/${name}`;
    return url.toString();
  })();
  let conn = null;
  try {
    conn = await connect(disposableUrl);
    await conn.query(DISPOSABLE_PREREQ_SQL);
    await conn.query(migrationSql);
    const actor = (await conn.query("INSERT INTO auth.users DEFAULT VALUES RETURNING id::text AS id")).rows[0].id;
    await runConcurrencyAgainst(conn, actor, disposableUrl);
  } catch (error) {
    fail("concurrency: database descartavel executou", errorDetail(error));
  } finally {
    if (conn) await conn.end().catch(() => {});
    await admin
      .query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1", [name])
      .catch(() => {});
    await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`).catch((error) => {
      fail("concurrency: database descartavel removido", errorDetail(error));
    });
  }
}

/* ------------------------------------------------------------------------- *
 * Main
 * ------------------------------------------------------------------------- */

async function main() {
  const target = assertLocalTarget();
  console.log(`== F47.1 proofs (${PROOFS_ONLY ? "ProofsOnly" : "full"}) ==`);
  console.log(
    `info db_target host=${target.host} port=${target.port} database=${target.database} project=${EXPECTED_PROJECT_ID}`,
  );
  console.log(`info migration_version=${MIGRATION_VERSION}`);

  const admin = await connect(DATABASE_URL);
  let pre = null;
  try {
    const dbInfo = await admin.query(
      "SELECT current_database() AS db, current_user AS usr",
    );
    record(
      "target: Postgres local aprovado",
      dbInfo.rows[0]?.db === "postgres" && LOOPBACK.has(target.host),
      `db=${dbInfo.rows[0]?.db}`,
    );
    pre = await snapshot(admin);

    await runRealProofs(admin, pre);
    await runConcurrencyProofs(admin);

    const post = await snapshot(admin);
    record(
      "preservation: config preexistente identica (inclui config_version_id)",
      JSON.stringify(pre.config) === JSON.stringify(post.config),
      pre.config.length === 0 ? "preexisting=none" : `rows=${pre.config.length}`,
    );
    record(
      "preservation: catalogo identico",
      JSON.stringify(pre.catalog) === JSON.stringify(post.catalog),
      `rows=${pre.catalog.length}`,
    );
    record(
      "preservation: auditoria inalterada (nenhuma linha removida)",
      pre.audit.total === post.audit.total && pre.audit.f47 === post.audit.f47,
      `before=${pre.audit.total} after=${post.audit.total}`,
    );
    record(
      "preservation: pricing identico",
      JSON.stringify(pre.pricing) === JSON.stringify(post.pricing),
      `count=${pre.pricing.count}`,
    );
  } catch (error) {
    fail("proofs: execucao", errorDetail(error));
  } finally {
    await admin.end().catch(() => {});
  }

  for (const result of results) {
    console.log(`${result.ok ? "PROOF OK  " : "PROOF FAIL"} ${result.name}${result.detail ? ` :: ${result.detail}` : ""}`);
  }
  const failed = results.filter((result) => !result.ok);
  const summary = {
    ok: failed.length === 0,
    proofs: results.length,
    passed: results.length - failed.length,
    failed: failed.length,
    failures: failed.map((result) => result.name),
    paid_provider_calls: false,
    remote_writes: false,
    preservation_strategy:
      "real public schema in a single rolled-back transaction + disposable database in the same local server for concurrency",
  };
  console.log(JSON.stringify(summary, null, 2));
  process.exitCode = failed.length === 0 ? 0 : 1;
}

main().catch((error) => {
  console.log(
    JSON.stringify({
      ok: false,
      error:
        /password|postgres(ql)?:\/\//i.test(String(error?.message ?? ""))
          ? "database_connection_failed"
          : String(error?.message ?? "unknown").slice(0, 200),
    }),
  );
  process.exitCode = 1;
});
