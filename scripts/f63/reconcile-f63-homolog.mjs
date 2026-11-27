#!/usr/bin/env node
/**
 * F63.1 — reconciliação exclusiva do homolog existente.
 *
 * Modos:
 *   --r0       preflight somente leitura; grava evidência JSON/MD.
 *   --dry-run  imprime o SQL de R1 e as pré-checagens, sem docker cp/psql -f.
 *   --execute  executa R1 em uma única transação (somente após o Gate 2).
 *   --help     uso.
 *
 * Alvo fixo: supabase_db_vendeo-homolog, 127.0.0.1:57782/postgres.
 * Não aceita URL, banco, container, host ou project-ref alternativos.
 * Não executa produção, banco remoto, reset, push, link, backup ou restore.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  assertHomologIdentity,
  readLedgerFingerprint,
  readPreservedSnapshot,
  readSchemaGuards,
  readSettingsGuard,
  readVersionState,
} from './homolog-identity.mjs';

const CONTAINER = 'supabase_db_vendeo-homolog';
const LEDGER_TABLE = 'supabase_migrations.schema_migrations';
const LEDGER_161_SHA = 'd95abc29958780f9021c8c9e9f5b5b2db33a8d4924cbbb2700cfc468c8dd0b0e';
const LEDGER_158_SHA = '5f9a2c6263982cb144af9d933e71a7a8445d5f1466c745d9f02d63fa71b46365';
const D_VERSION = '20261127004704';
const A_ROW = '20261126223854/offer_catalog_versions';
const B_ROW = '20261126230735/offer_catalog_seed_v1';
const C_ROW = '20261126231022/offer_catalog_published_by_fix';
const ALLOWED_F63_SIGNATURES = new Set([
  'public.trial_offer_calendar_reaches_total(text,integer,integer,integer)',
  'public.trial_offer_versions_guard()',
  'public.trial_offer_versions_guard_delete()',
  'public.trial_offer_settings_guard_current_version()',
  'public.trial_offer_conditions(uuid)',
  'public.trial_offer_public_offer()',
  'public.trial_offer_release_schedule(uuid, timestamp with time zone)',
]);

export function isAllowedF63Signature(signature) {
  return ALLOWED_F63_SIGNATURES.has(signature);
}

export function classifyFailure({ commitConfirmed, rollbackConfirmed, stateObserved } = {}) {
  if (commitConfirmed === true) {
    return { class: 'post_commit_verification_failed', stateObserved: stateObserved ?? null };
  }
  if (rollbackConfirmed === true) {
    return { class: 'sql_error_rollback_confirmed', stateObserved: stateObserved ?? null };
  }
  return { class: 'unknown_commit_outcome', stateObserved: stateObserved ?? null };
}

function runSql(query) {
  const out = execFileSync('docker', [
    'exec', CONTAINER, 'psql', '-U', 'postgres', '-d', 'postgres',
    '-X', '-tAXq', '-v', 'ON_ERROR_STOP=1', '-c', query,
  ], { encoding: 'utf8', windowsHide: true });
  return out.replace(/\r\n/g, '\n').trim();
}

function runSqlInput(sql) {
  return spawnSync('docker', [
    'exec', '-i', CONTAINER, 'psql', '-U', 'postgres', '-d', 'postgres',
    '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-f', '-',
  ], { input: sql, encoding: 'utf8', timeout: 300_000, windowsHide: true });
}

function lines(text) {
  return text.length === 0 ? [] : text.split('\n').filter((line) => line.length > 0);
}

function sqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlArray(values) {
  return `ARRAY[${values.map((value) => sqlLiteral(value)).join(', ')}]`;
}

function readBaseline(file) {
  const data = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), file), 'utf8'));
  if (data.read_only !== true) throw new Error('baseline is not read_only');
  if (!data.preserved || !data.settings_guard || !data.schema_guards) {
    throw new Error('baseline incompleto');
  }
  return data;
}

function readDependencies() {
  const externalFks = lines(runSql(
    "select conrelid::regclass::text || '.' || conname from pg_constraint where confrelid = 'public.trial_offer_versions'::regclass and conrelid <> 'public.trial_offer_settings'::regclass order by 1;",
  ));
  const views = lines(runSql(
    "select dependent_ns.nspname || '.' || dependent_view.relname from pg_depend d join pg_rewrite r on r.oid = d.objid join pg_class dependent_view on dependent_view.oid = r.ev_class join pg_namespace dependent_ns on dependent_ns.oid = dependent_view.relnamespace where d.refobjid = 'public.trial_offer_versions'::regclass and dependent_view.relname <> 'trial_offer_versions' order by 1;",
  ));
  const functions = lines(runSql(
    "select n.nspname || '.' || p.proname || '(' || coalesce(oidvectortypes(p.proargtypes), '') || ')' from pg_proc p join pg_namespace n on n.oid = p.pronamespace where p.prosrc ilike '%trial_offer_versions%' order by 1;",
  ));
  const externalFunctions = functions.filter((signature) => !isAllowedF63Signature(signature));
  const offerVersionId = Number(runSql(
    "select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'trial_offer_enrollments' and column_name = 'offer_version_id';",
  ));
  return {
    external_fks: externalFks,
    views,
    functions_citing: functions,
    external_functions: externalFunctions,
    external_refs: [...externalFks, ...views, ...externalFunctions],
    offer_version_id: offerVersionId > 0,
    offer_version_id_count: offerVersionId,
  };
}

function readDVersionCount() {
  return Number(runSql(`select count(*) from ${LEDGER_TABLE} where version = '${D_VERSION}';`));
}

function buildVerdict({ ledger, versions, dependencies, preserved, settings, schema, baseline }) {
  const rows = versions.rows ?? [];
  const v1Rows = rows.filter((row) => row.version_label === 'v1' && row.published_at !== null);
  const fixtureRows = rows.filter((row) => row.version_label.startsWith('f63test-'));
  const otherRows = rows.filter((row) => row.version_label !== 'v1' && !row.version_label.startsWith('f63test-'));
  const labelsOk = versions.total === 16 && versions.draft_count === 0 && v1Rows.length === 1
    && fixtureRows.length === 15 && otherRows.length === 0
    && versions.current_version_label === 'v1' && versions.current_version_id_nullable === false;
  const ledgerTail = (ledger.lastRows ?? []).slice(-3).map((row) => `${row.version}/${row.name}`);
  const ledgerOk = ledger.count === 161 && ledger.sha256 === LEDGER_161_SHA
    && JSON.stringify(ledgerTail) === JSON.stringify([A_ROW, B_ROW, C_ROW]) && readDVersionCount() === 0;
  const preservedEqual = Object.keys(baseline.preserved).every((table) => {
    const current = preserved[table];
    const base = baseline.preserved[table];
    return current && current.count === base.count && current.row_checksum_md5 === base.row_checksum_md5;
  });
  const settingsEqual = Object.keys(baseline.settings_guard).every(
    (key) => JSON.stringify(settings[key]) === JSON.stringify(baseline.settings_guard[key]),
  );
  const schemaFunctionsEqual = Object.keys(baseline.schema_guards.functions).every(
    (key) => schema.functions[key] === baseline.schema_guards.functions[key],
  );
  const dependenciesOk = dependencies.external_refs.length === 0 && dependencies.offer_version_id === false;
  const divergences = [];
  if (!ledgerOk) divergences.push('ledger 161/A-B-C/D ausente divergente');
  if (!labelsOk) divergences.push('versions/labels/vigência divergentes');
  if (!preservedEqual) divergences.push('tabelas preservadas divergentes');
  if (!settingsEqual) divergences.push('oito campos de settings divergentes');
  if (!schemaFunctionsEqual) divergences.push('hashes das cinco funções legadas divergentes');
  if (!dependenciesOk) divergences.push('dependências externas inesperadas');
  return {
    labels_ok: labelsOk,
    ledger_ok: ledgerOk,
    preserved_equal: preservedEqual,
    settings_equal: settingsEqual,
    schema_functions_equal: schemaFunctionsEqual,
    dependencies_ok: dependenciesOk,
    verdict: divergences.length === 0 ? 'GO' : 'STOP',
    divergences,
  };
}

async function buildR0(baselineFile) {
  const identity = await assertHomologIdentity();
  const baseline = readBaseline(baselineFile);
  const ledger = await readLedgerFingerprint();
  const versions = await readVersionState();
  const settings = await readSettingsGuard();
  const preserved = await readPreservedSnapshot();
  const schema = await readSchemaGuards();
  const dependencies = readDependencies();
  const verdict = buildVerdict({ ledger, versions, dependencies, preserved, settings, schema, baseline });
  return {
    read_only: true,
    captured_at_utc: new Date().toISOString(),
    environment: {
      container: identity.container,
      published: identity.published,
      database: identity.database,
      server_version: identity.serverVersion,
      container_port: identity.containerPort,
      workdir: identity.workdir,
      image: identity.image,
    },
    ledger: {
      count: ledger.count,
      max_version: ledger.maxVersion,
      sha256: ledger.sha256,
      last_rows: ledger.lastRows,
    },
    versions: {
      table_present: versions.table_present,
      total: versions.total,
      published: versions.published_count,
      drafts: versions.draft_count,
      current_version_id: versions.current_version_id,
      current_version_label: versions.current_version_label,
      current_version_id_nullable: versions.current_version_id_nullable,
      labels_ok: verdict.labels_ok,
    },
    dependencies,
    settings,
    preserved,
    schema_functions: schema.functions,
    preserved_equal: verdict.preserved_equal,
    settings_equal: verdict.settings_equal,
    schema_functions_equal: verdict.schema_functions_equal,
    objects_absent: false,
    verdict: verdict.verdict,
    divergences: verdict.divergences,
  };
}

function buildR1Sql(baselineFile) {
  const baseline = readBaseline(baselineFile);
  const preservedBaseline = Object.entries(baseline.preserved)
    .map(([table, entry]) => `SELECT ${sqlLiteral(table)}::text AS table_name, ${entry.count}::bigint AS row_count, ${sqlLiteral(entry.row_checksum_md5)}::text AS row_checksum_md5`)
    .join('\nUNION ALL\n');
  const preservedAfter = `
    SELECT 'trial_offer_enrollments'::text AS table_name, count(*)::bigint AS row_count,
           md5(coalesce(string_agg(t::text, E'\\n' order by t.id), '')) AS row_checksum_md5
    FROM public.trial_offer_enrollments t
    UNION ALL
    SELECT 'credit_balances'::text, count(*)::bigint,
           md5(coalesce(string_agg(t::text, E'\\n' order by t.store_id), ''))
    FROM public.credit_balances t
    UNION ALL
    SELECT 'credit_transactions'::text, count(*)::bigint,
           md5(coalesce(string_agg(t::text, E'\\n' order by t.id), ''))
    FROM public.credit_transactions t
    UNION ALL
    SELECT 'freemium_entitlements'::text, count(*)::bigint,
           md5(coalesce(string_agg(t::text, E'\\n' order by t.id), ''))
    FROM public.freemium_entitlements t`;
  const enrollmentColumns = sqlArray(baseline.schema_guards.trial_offer_enrollments_columns);
  const settingsExistingColumns = sqlArray(baseline.schema_guards.trial_offer_settings_columns);
  const s = baseline.settings_guard;
  const uuidLiteral = (value) => (value === null ? 'NULL::uuid' : `${sqlLiteral(value)}::uuid`);
  const tsLiteral = (value) => (value === null ? 'NULL::timestamptz' : `${sqlLiteral(value)}::timestamptz`);
  const settingsApproved = `SELECT ${uuidLiteral(s.id)} AS id, ${sqlLiteral(s.offer_key)}::text AS offer_key, ${s.enabled ? 'true' : 'false'}::boolean AS enabled, ${tsLiteral(s.launch_at)} AS launch_at, ${tsLiteral(s.individual_launch_at)} AS individual_launch_at, ${uuidLiteral(s.updated_by)} AS updated_by, ${tsLiteral(s.updated_at)} AS updated_at, ${tsLiteral(s.created_at)} AS created_at`;
  const legacyFunctionChecks = Object.entries(baseline.schema_guards.functions)
    .map(([signature, expected]) => `  IF coalesce(md5(pg_get_functiondef(to_regprocedure(${sqlLiteral(signature)}))), '') <> ${sqlLiteral(expected)} THEN\n    RAISE EXCEPTION 'F63_RECONCILE_LEGACY_FUNCTION_CHANGED: ${signature}';\n  END IF;`)
    .join('\n');
  const allowedSignatures = sqlArray([...ALLOWED_F63_SIGNATURES]);
  return `\\set VERBOSITY verbose
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '180s';
SET LOCAL TIME ZONE 'UTC';
SET LOCAL DateStyle TO 'ISO, YMD';

DO $$
DECLARE
  v_count integer;
BEGIN
  IF to_regclass('public.trial_offer_versions') IS NULL THEN
    RAISE EXCEPTION 'F63_RECONCILE_PRECONDITION_FAILED: tabela ausente';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'trial_offer_settings' AND column_name = 'current_version_id'
  ) THEN
    RAISE EXCEPTION 'F63_RECONCILE_PRECONDITION_FAILED: coluna ausente';
  END IF;
  SELECT count(*) INTO v_count FROM public.trial_offer_versions;
  IF v_count <> 16 THEN
    RAISE EXCEPTION 'F63_RECONCILE_PRECONDITION_FAILED: versões=%', v_count;
  END IF;
  SELECT count(*) INTO v_count FROM public.trial_offer_versions
   WHERE version_label IS DISTINCT FROM 'v1' AND version_label NOT LIKE 'f63test-%';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'F63_RECONCILE_PRECONDITION_FAILED: labels fora do conjunto';
  END IF;
  SELECT count(*) INTO v_count FROM public.trial_offer_versions WHERE published_at IS NULL;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'F63_RECONCILE_PRECONDITION_FAILED: rascunhos=%', v_count;
  END IF;
  IF (SELECT count(*) FROM ${LEDGER_TABLE}) <> 161 THEN
    RAISE EXCEPTION 'F63_RECONCILE_PRECONDITION_FAILED: ledger != 161';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE confrelid = 'public.trial_offer_versions'::regclass AND conrelid <> 'public.trial_offer_settings'::regclass) THEN
    RAISE EXCEPTION 'F63_RECONCILE_PRECONDITION_FAILED: dependente externo';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_depend d
    JOIN pg_rewrite r ON r.oid = d.objid
    JOIN pg_class dependent_view ON dependent_view.oid = r.ev_class
    WHERE d.refobjid = 'public.trial_offer_versions'::regclass
      AND dependent_view.relname <> 'trial_offer_versions'
  ) THEN
    RAISE EXCEPTION 'F63_RECONCILE_PRECONDITION_FAILED: view externa';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.prosrc ILIKE '%trial_offer_versions%'
      AND (n.nspname || '.' || p.proname || '(' || coalesce(oidvectortypes(p.proargtypes), '') || ')') <> ALL (${allowedSignatures})
  ) THEN
    RAISE EXCEPTION 'F63_RECONCILE_PRECONDITION_FAILED: função externa';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.trial_offer_settings s
    JOIN public.trial_offer_versions v
      ON v.id = s.current_version_id AND v.offer_key = s.offer_key
    WHERE s.offer_key = 'trial_28d_v1'
      AND v.version_label = 'v1'
      AND v.published_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'F63_RECONCILE_PRECONDITION_FAILED: vigência não aponta para v1 publicada';
  END IF;
${legacyFunctionChecks}
END;
$$;

DO $$
BEGIN
  PERFORM 1 FROM public.trial_offer_settings WHERE offer_key = 'trial_28d_v1' FOR UPDATE;
END;
$$;

CREATE TEMP TABLE f631_settings_approved AS
${settingsApproved};

CREATE TEMP TABLE f631_settings_before AS
SELECT id, offer_key, enabled, launch_at, individual_launch_at, updated_by, updated_at, created_at
FROM public.trial_offer_settings
WHERE offer_key = 'trial_28d_v1';

DO $$
DECLARE
  v_before RECORD;
  v_approved RECORD;
BEGIN
  SELECT * INTO v_before FROM f631_settings_before;
  SELECT * INTO v_approved FROM f631_settings_approved;
  IF v_before.id IS DISTINCT FROM v_approved.id
     OR v_before.offer_key IS DISTINCT FROM v_approved.offer_key
     OR v_before.enabled IS DISTINCT FROM v_approved.enabled
     OR v_before.launch_at IS DISTINCT FROM v_approved.launch_at
     OR v_before.individual_launch_at IS DISTINCT FROM v_approved.individual_launch_at
     OR v_before.updated_by IS DISTINCT FROM v_approved.updated_by
     OR v_before.updated_at IS DISTINCT FROM v_approved.updated_at
     OR v_before.created_at IS DISTINCT FROM v_approved.created_at THEN
    RAISE EXCEPTION 'F63_RECONCILE_SETTINGS_NOT_MATCHING_BASELINE';
  END IF;
END;
$$;

CREATE TEMP TABLE f631_preserved_baseline AS
${preservedBaseline};

DROP TRIGGER trg_trial_offer_settings_guard_current_version ON public.trial_offer_settings;
ALTER TABLE public.trial_offer_settings DROP CONSTRAINT fk_trial_offer_settings_current_version;
ALTER TABLE public.trial_offer_settings ALTER COLUMN current_version_id DROP NOT NULL;
UPDATE public.trial_offer_settings SET current_version_id = NULL WHERE offer_key = 'trial_28d_v1';

DO $$
DECLARE
  v_before RECORD;
  v_after RECORD;
BEGIN
  SELECT * INTO v_before FROM f631_settings_before;
  SELECT id, offer_key, enabled, launch_at, individual_launch_at, updated_by, updated_at, created_at
    INTO v_after FROM public.trial_offer_settings WHERE offer_key = 'trial_28d_v1';
  IF v_after.id IS DISTINCT FROM v_before.id
     OR v_after.offer_key IS DISTINCT FROM v_before.offer_key
     OR v_after.enabled IS DISTINCT FROM v_before.enabled
     OR v_after.launch_at IS DISTINCT FROM v_before.launch_at
     OR v_after.individual_launch_at IS DISTINCT FROM v_before.individual_launch_at
     OR v_after.updated_by IS DISTINCT FROM v_before.updated_by
     OR v_after.updated_at IS DISTINCT FROM v_before.updated_at
     OR v_after.created_at IS DISTINCT FROM v_before.created_at THEN
    RAISE EXCEPTION 'F63_RECONCILE_SETTINGS_CHANGED';
  END IF;
END;
$$;

DROP TRIGGER trg_trial_offer_versions_guard ON public.trial_offer_versions;
DROP TRIGGER trg_trial_offer_versions_guard_delete ON public.trial_offer_versions;
DROP TABLE public.trial_offer_versions;
DROP FUNCTION public.trial_offer_release_schedule(UUID, TIMESTAMPTZ);
DROP FUNCTION public.trial_offer_public_offer();
DROP FUNCTION public.trial_offer_conditions(UUID);
DROP FUNCTION public.trial_offer_settings_guard_current_version();
DROP FUNCTION public.trial_offer_versions_guard_delete();
DROP FUNCTION public.trial_offer_versions_guard();
DROP FUNCTION public.trial_offer_calendar_reaches_total(TEXT, INTEGER, INTEGER, INTEGER);
ALTER TABLE public.trial_offer_settings DROP COLUMN current_version_id;

DO $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM supabase_migrations.schema_migrations
   WHERE (version, name) IN (
     ('20261126223854', 'offer_catalog_versions'),
     ('20261126230735', 'offer_catalog_seed_v1'),
     ('20261126231022', 'offer_catalog_published_by_fix')
   );
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  IF v_deleted <> 3 THEN
    RAISE EXCEPTION 'F63_RECONCILE_LEDGER_ROWS: %', v_deleted;
  END IF;
END;
$$;

CREATE TEMP TABLE f631_preserved_after AS
${preservedAfter};

DO $$
DECLARE
  v_count integer;
  v_sha text;
  v_cols text[];
  v_settings_cols text[];
  r RECORD;
BEGIN
  SELECT count(*) INTO v_count FROM ${LEDGER_TABLE};
  SELECT encode(extensions.digest(string_agg(version || '|' || coalesce(name, ''), E'\\n' order by version), 'sha256'), 'hex')
    INTO v_sha FROM ${LEDGER_TABLE};
  IF v_count <> 158 OR v_sha <> '${LEDGER_158_SHA}' THEN
    RAISE EXCEPTION 'F63_RECONCILE_LEDGER_FINGERPRINT: count=%, sha=%', v_count, v_sha;
  END IF;

  IF to_regclass('public.trial_offer_versions') IS NOT NULL THEN
    RAISE EXCEPTION 'F63_RECONCILE_OBJECTS_REMAIN: trial_offer_versions';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'trial_offer_settings' AND column_name = 'current_version_id') THEN
    RAISE EXCEPTION 'F63_RECONCILE_OBJECTS_REMAIN: current_version_id';
  END IF;
  IF to_regprocedure('public.trial_offer_versions_guard()') IS NOT NULL
     OR to_regprocedure('public.trial_offer_versions_guard_delete()') IS NOT NULL
     OR to_regprocedure('public.trial_offer_settings_guard_current_version()') IS NOT NULL
     OR to_regprocedure('public.trial_offer_conditions(uuid)') IS NOT NULL
     OR to_regprocedure('public.trial_offer_public_offer()') IS NOT NULL
     OR to_regprocedure('public.trial_offer_release_schedule(uuid,timestamp with time zone)') IS NOT NULL
     OR to_regprocedure('public.trial_offer_calendar_reaches_total(text,integer,integer,integer)') IS NOT NULL THEN
    RAISE EXCEPTION 'F63_RECONCILE_OBJECTS_REMAIN: function';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE NOT tgisinternal AND tgname IN ('trg_trial_offer_versions_guard','trg_trial_offer_versions_guard_delete','trg_trial_offer_settings_guard_current_version')) THEN
    RAISE EXCEPTION 'F63_RECONCILE_OBJECTS_REMAIN: trigger';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'trial_offer_versions') THEN
    RAISE EXCEPTION 'F63_RECONCILE_OBJECTS_REMAIN: policy';
  END IF;

  SELECT array_agg(column_name ORDER BY ordinal_position) INTO v_settings_cols
    FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'trial_offer_settings';
  IF v_settings_cols IS DISTINCT FROM ${settingsExistingColumns} THEN
    RAISE EXCEPTION 'F63_RECONCILE_SETTINGS_COLUMNS: %', v_settings_cols;
  END IF;
  SELECT array_agg(column_name ORDER BY ordinal_position) INTO v_cols
    FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'trial_offer_enrollments';
  IF v_cols IS DISTINCT FROM ${enrollmentColumns} THEN
    RAISE EXCEPTION 'F63_RECONCILE_ENROLLMENTS_COLUMNS: %', v_cols;
  END IF;

  FOR r IN
    SELECT b.table_name FROM f631_preserved_baseline b
    WHERE NOT EXISTS (
      SELECT 1 FROM f631_preserved_after a
      WHERE a.table_name = b.table_name AND a.row_count = b.row_count AND a.row_checksum_md5 = b.row_checksum_md5
    )
  LOOP
    RAISE EXCEPTION 'F63_RECONCILE_PRESERVED_CHANGED: %', r.table_name;
  END LOOP;
END;
$$;

COMMIT;
`;
}

function sameArray(left, right) {
  return Array.isArray(left) && Array.isArray(right)
    && left.length === right.length
    && left.every((value, index) => value === right[index]);
}

export async function verifyPostRemoval(baselineFile, readers = {}) {
  const readLedger = readers.readLedgerFingerprint ?? readLedgerFingerprint;
  const readVersions = readers.readVersionState ?? readVersionState;
  const readPreserved = readers.readPreservedSnapshot ?? readPreservedSnapshot;
  const readSettings = readers.readSettingsGuard ?? readSettingsGuard;
  const readSchema = readers.readSchemaGuards ?? readSchemaGuards;
  const baseline = readBaseline(baselineFile);
  const ledger = await readLedger();
  const versions = await readVersions();
  const preserved = await readPreserved();
  const settings = await readSettings();
  const schema = await readSchema();
  const preservedEqual = Object.keys(baseline.preserved).every((table) => {
    const current = preserved[table];
    const base = baseline.preserved[table];
    return current && current.count === base.count && current.row_checksum_md5 === base.row_checksum_md5;
  });
  const settingsEqual = Object.keys(baseline.settings_guard).every(
    (key) => JSON.stringify(settings[key]) === JSON.stringify(baseline.settings_guard[key]),
  );
  const schemaFunctionsEqual = Object.keys(baseline.schema_guards.functions).every(
    (key) => schema.functions[key] === baseline.schema_guards.functions[key],
  );
  const enrollmentsEqual = sameArray(
    schema.trial_offer_enrollments_columns,
    baseline.schema_guards.trial_offer_enrollments_columns,
  );
  const settingsColumnsEqual = sameArray(
    schema.trial_offer_settings_columns,
    baseline.schema_guards.trial_offer_settings_columns,
  );
  return {
    ledger,
    versions,
    preservedEqual,
    settingsEqual,
    schemaFunctionsEqual,
    enrollmentsEqual,
    settingsColumnsEqual,
    objectsAbsent: versions.table_present === false,
    ledgerOk: ledger.count === 158 && ledger.sha256 === LEDGER_158_SHA,
  };
}

export function buildInspectionFailure({ exitCode, stdout, stderr, error, before } = {}) {
  return {
    read_only_db: false,
    captured_at_utc: new Date().toISOString(),
    exit_code: exitCode ?? 1,
    failure_class: 'unknown_commit_outcome',
    commit_confirmed: null,
    rollback_confirmed: false,
    state_observed: null,
    inspection_error: String(error?.message ?? error ?? 'inspection unavailable'),
    labels_ok: before?.versions?.labels_ok ?? null,
    preserved_equal: null,
    settings_equal: null,
    schema_functions_equal: null,
    objects_absent: null,
    blocked: true,
    stdout_tail: String(stdout ?? '').split('\n').slice(-20),
    stderr_tail: String(stderr ?? '').split('\n').slice(-20),
  };
}

function writeArtifact(file, content) {
  const abs = path.resolve(process.cwd(), file);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf8');
  return abs;
}

function renderLogR0(report) {
  return `# F63.1 — R0 read-only
- captured_at_utc: ${report.captured_at_utc}
- container: ${report.environment.container}
- database: ${report.environment.database}
- ledger: ${report.ledger.count} / ${report.ledger.sha256}
- versions: ${report.versions.total} total, ${report.versions.drafts} rascunhos, labels_ok=${report.versions.labels_ok}
- dependencies.external_refs: ${JSON.stringify(report.dependencies.external_refs)}
- dependencies.offer_version_id: ${report.dependencies.offer_version_id}
- preserved_equal: ${report.preserved_equal}
- settings_equal: ${report.settings_equal}
- schema_functions_equal: ${report.schema_functions_equal}
- verdict: ${report.verdict}
- divergences: ${JSON.stringify(report.divergences)}
- read_only: ${report.read_only}
`;
}

export function parseArgs(argv) {
  const args = { r0: false, dryRun: false, execute: false, help: false, evidence: null, log: null, baseline: null };
  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    if (current === '--r0') args.r0 = true;
    else if (current === '--dry-run') args.dryRun = true;
    else if (current === '--execute') args.execute = true;
    else if (current === '--help' || current === '-h') args.help = true;
    else if (current === '--evidence') { args.evidence = argv[i + 1]; i += 1; }
    else if (current === '--log') { args.log = argv[i + 1]; i += 1; }
    else if (current === '--baseline') { args.baseline = argv[i + 1]; i += 1; }
    else throw new Error(`argumento desconhecido: ${current}`);
  }
  return args;
}

export function validateArgs(args) {
  if (args.help) return args;
  if (!args.baseline) throw new Error('--baseline é obrigatório');
  if (!args.r0 && !args.dryRun && !args.execute) {
    throw new Error('informe --r0, --dry-run ou --execute');
  }
  if ((args.r0 || args.execute) && (!args.evidence || !args.log)) {
    throw new Error('--r0/--execute exigem --evidence e --log');
  }
  return args;
}

function usage() {
  console.log('Uso: node scripts/f63/reconcile-f63-homolog.mjs --r0 --evidence <json> --log <md> | --dry-run --baseline <json> | --execute --baseline <json> --evidence <json> --log <md> | --help');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { usage(); return 0; }
  validateArgs(args);

  if (args.r0) {
    if (!args.evidence || !args.log) throw new Error('--r0 exige --evidence e --log');
    const report = await buildR0(args.baseline);
    writeArtifact(args.evidence, `${JSON.stringify(report, null, 2)}\n`);
    writeArtifact(args.log, renderLogR0(report));
    console.log(`R0 verdict=${report.verdict} ledger=${report.ledger.count} labels_ok=${report.versions.labels_ok}`);
    return report.verdict === 'GO' ? 0 : 1;
  }

  if (args.dryRun) {
    const report = await buildR0(args.baseline);
    console.log(`dry-run preflight verdict=${report.verdict}`);
    console.log(`ledger=${report.ledger.count} sha=${report.ledger.sha256}`);
    console.log(buildR1Sql(args.baseline));
    return report.verdict === 'GO' ? 0 : 1;
  }

  if (args.execute) {
    if (!args.evidence || !args.log) throw new Error('--execute exige --evidence e --log');
    const before = await buildR0(args.baseline);
    if (before.verdict !== 'GO') {
      const blocked = { ...before, exit_code: 1, failure_class: 'preflight_stop', blocked: true };
      writeArtifact(args.evidence, `${JSON.stringify(blocked, null, 2)}\n`);
      writeArtifact(args.log, renderLogR0(blocked));
      console.error('R0 STOP; nenhuma escrita executada.');
      return 1;
    }
    const result = runSqlInput(buildR1Sql(args.baseline));
    const stdout = String(result.stdout ?? '');
    const stderr = String(result.stderr ?? '');
    let post = null;
    let inspectionError = null;
    try {
      post = await verifyPostRemoval(args.baseline);
    } catch (error) {
      inspectionError = error;
    }
    if (post === null) {
      const evidence = buildInspectionFailure({
        exitCode: result.status,
        stdout,
        stderr,
        error: inspectionError,
        before,
      });
      writeArtifact(args.evidence, `${JSON.stringify(evidence, null, 2)}\n`);
      writeArtifact(args.log, `# F63.1 — R1 (inspeção indisponível)\n- exit_code: ${evidence.exit_code}\n- failure_class: ${evidence.failure_class}\n- state_observed: null\n- inspection_error: ${evidence.inspection_error}\n- blocked: true\n`);
      console.error('R1: leitura pós-execução falhou; estado não observado; bloqueado sem presumir rollback nem reaplicar.');
      return 1;
    }
    const commitConfirmed = post.ledgerOk && post.objectsAbsent;
    const rollbackConfirmed = result.status !== 0 && post.ledger.count === 161 && post.versions.table_present === true;
    const postChecksOk = post.preservedEqual && post.settingsEqual && post.schemaFunctionsEqual
      && post.enrollmentsEqual && post.settingsColumnsEqual && post.objectsAbsent && post.ledgerOk;
    const failed = result.status !== 0 || !postChecksOk;
    const classification = classifyFailure({
      commitConfirmed: commitConfirmed && failed,
      rollbackConfirmed: rollbackConfirmed && failed,
      stateObserved: {
        ledger_count: post.ledger.count,
        ledger_sha256: post.ledger.sha256,
        versions_table_present: post.versions.table_present,
        preserved_equal: post.preservedEqual,
        settings_equal: post.settingsEqual,
        settings_columns_equal: post.settingsColumnsEqual,
      },
    });
    const evidence = {
      read_only_db: false,
      captured_at_utc: new Date().toISOString(),
      exit_code: result.status ?? 1,
      failure_class: failed ? classification.class : null,
      commit_confirmed: commitConfirmed,
      rollback_confirmed: rollbackConfirmed,
      removed_ledger_rows: commitConfirmed ? [
        { version: '20261126223854', name: 'offer_catalog_versions' },
        { version: '20261126230735', name: 'offer_catalog_seed_v1' },
        { version: '20261126231022', name: 'offer_catalog_published_by_fix' },
      ] : [],
      ledger_after: {
        count: post.ledger.count,
        sha256: post.ledger.sha256,
        max_version: post.ledger.maxVersion,
      },
      labels_ok: before.versions.labels_ok,
      preserved_equal: post.preservedEqual,
      settings_equal: post.settingsEqual,
      schema_functions_equal: post.schemaFunctionsEqual,
      objects_absent: post.objectsAbsent,
      state_observed: {
        ledger_count: post.ledger.count,
        ledger_sha256: post.ledger.sha256,
        versions_table_present: post.versions.table_present,
        preserved_equal: post.preservedEqual,
        settings_equal: post.settingsEqual,
        enrollments_columns_equal: post.enrollmentsEqual,
        settings_columns_equal: post.settingsColumnsEqual,
      },
      stdout_tail: stdout.split('\n').slice(-20),
      stderr_tail: stderr.split('\n').slice(-20),
      blocked: failed,
    };
    writeArtifact(args.evidence, `${JSON.stringify(evidence, null, 2)}\n`);
    writeArtifact(args.log, `# F63.1 — R1\n- exit_code: ${evidence.exit_code}\n- failure_class: ${evidence.failure_class}\n- commit_confirmed: ${evidence.commit_confirmed}\n- rollback_confirmed: ${evidence.rollback_confirmed}\n- ledger_after: ${JSON.stringify(evidence.ledger_after)}\n- blocked: ${evidence.blocked}\n`);
    if (failed) {
      console.error(`R1 FAILED class=${classification.class}; estado inspecionado; nenhuma reaplicação automática.`);
      console.error(stderr.split('\n').slice(-20).join('\n'));
      return 1;
    }
    console.log(`R1 OK; ledger ${post.ledger.count} / ${post.ledger.sha256}`);
    return 0;
  }

  usage();
  throw new Error('informe --r0, --dry-run ou --execute');
}

const ENTRYPOINT = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === ENTRYPOINT) {
  main()
    .then((code) => { process.exitCode = code; })
    .catch((error) => {
      console.error(`f63 reconcile: ${error.message}`);
      process.exitCode = 1;
    });
}
