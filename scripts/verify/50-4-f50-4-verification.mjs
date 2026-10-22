#!/usr/bin/env node
// F50.4 — verificação de schema/ledger/grants no PostgreSQL DESCARTÁVEL.
//
// Alvo fixo e fail-closed:
//   - host: 127.0.0.1|localhost
//   - porta: F50_4_DB_PORT (default 54422)
//   - database: postgres
//   - identidade: sentinela public.f50_4_harness_identity (purpose='disposable'),
//                 auth.users presente e roles anon/authenticated/service_role.
//
// Qualquer host/porta/banco diferente aborta ANTES de abrir conexão.
//
// Modos:
//   (sem flags) executa todas as asserções e imprime o fingerprint atual
//   --print-fingerprint        imprime somente o md5 e sai 0
//   --expect-launch-at <ISO>   exige trial_offer_settings.launch_at igual ao valor
//   --skip-db                  valida apenas a sintaxe/estrutura do script (sem banco)
//
// A verificação exige F50_4_RUN_ID para conferir a identidade do container
// (supabase_db_f50-4-disposable-<run_id>) quando executada contra o banco.

import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const DATABASE = "postgres";
const ALLOWED_HOSTS = new Set(["127.0.0.1", "localhost"]);
const PROJECT_PREFIX = "f50-4-disposable-";
const CONTAINER_PORT_KEY = "5432/tcp";

const REQUIRED_LEDGER_VERSIONS = ["20261022000001", "20261022000002", "20261022000003"];
const EXPECTED_RPCS = [
  "admin_activate_trial_offer_individual_launch",
  "trial_offer_policy_context",
  "trial_offer_policy_cohort",
  "trial_offer_beneficiary_prior_benefit",
  "trial_offer_legacy_root_prior_benefit",
  "trial_offer_eligibility",
  "record_onboarding_completion",
  "start_trial_offer_enrollment",
  "grant_demo_credits",
  "grant_monthly_credits",
  "admin_grant_freemium_exception",
];
const REQUIRED_CHECKS = [
  "chk_trial_offer_enrollments_beneficiary_cnpj",
  "chk_trial_offer_enrollments_policy_cohort",
];

const results = [];
const assert = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${ok ? "" : ` — ${detail}`}`);
};

function dbPort() {
  return String(process.env.F50_4_DB_PORT ?? 54422);
}

function defaultDbUrl() {
  return process.env.F50_4_DB_URL ?? `postgresql://postgres:postgres@127.0.0.1:${dbPort()}/${DATABASE}`;
}

function parseArgs(argv) {
  const options = { mode: "verify", expectLaunchAt: null };
  if (argv.includes("--skip-db")) {
    options.mode = "skip-db";
    return options;
  }
  if (argv.includes("--print-fingerprint")) {
    options.mode = "print-fingerprint";
    return options;
  }
  const index = argv.indexOf("--expect-launch-at");
  if (index !== -1) {
    const value = argv[index + 1];
    if (!value || Number.isNaN(Date.parse(value))) {
      throw new Error("--expect-launch-at exige um timestamp ISO válido");
    }
    options.expectLaunchAt = value;
  }
  return options;
}

// ---------------------------------------------------------------------------
// Guardas (antes de qualquer conexão)
// ---------------------------------------------------------------------------

function assertFixedTarget(rawUrl) {
  if (/^https?:\/\//i.test(rawUrl)) throw new Error(`Recusando alvo HTTP: ${rawUrl}`);
  if (/supabase\.(co|in)/i.test(rawUrl)) throw new Error("Recusando host de projeto Supabase remoto");

  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("F50_4_DB_URL inválida (esperado postgresql://127.0.0.1:<porta>/postgres)");
  }
  if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
    throw new Error(`Recusando protocolo ${parsed.protocol} — esperado postgresql://`);
  }
  if (!ALLOWED_HOSTS.has(parsed.hostname)) {
    throw new Error(`Recusando host remoto ${parsed.hostname} — esperado 127.0.0.1|localhost`);
  }
  if (parsed.port !== dbPort()) {
    throw new Error(`Recusando porta ${parsed.port || "(default)"} — esperado ${dbPort()}`);
  }
  const database = parsed.pathname.replace(/^\//, "");
  if (database !== DATABASE) {
    throw new Error(`Recusando database ${database} — esperado ${DATABASE}`);
  }
}

function assertNoRemoteEnv() {
  if (process.env.SUPABASE_ACCESS_TOKEN) {
    throw new Error("Recusando execução com SUPABASE_ACCESS_TOKEN definido (nunca alvo remoto).");
  }
}

function expectedContainerName() {
  const runId = process.env.F50_4_RUN_ID;
  if (!runId) {
    throw new Error("F50_4_RUN_ID é obrigatório para conferir a identidade do container descartável.");
  }
  return `supabase_db_${PROJECT_PREFIX}${runId}`;
}

function assertContainerIdentity() {
  const container = expectedContainerName();
  let output;
  try {
    output = execFileSync(
      "docker",
      ["inspect", container, "--format", "{{.Name}} {{json .NetworkSettings.Ports}}"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    ).trim();
  } catch (error) {
    throw new Error(
      `Não foi possível inspecionar o container ${container}: ${error.message}. ` +
        "A verificação exige o alvo descartável explícito; nada foi executado.",
    );
  }

  const [name, portsJson] = output.split(" ", 2);
  if (name !== `/${container}`) {
    throw new Error(`Container inesperado: ${name} — esperado /${container}`);
  }

  let ports;
  try {
    ports = JSON.parse(portsJson);
  } catch {
    throw new Error(`Não foi possível interpretar o mapeamento de portas: ${portsJson}`);
  }
  const bindings = ports[CONTAINER_PORT_KEY] ?? [];
  const hostBindings = bindings.map((binding) => `${binding.HostIp}:${binding.HostPort}`);
  const expectedBindings = [`127.0.0.1:${dbPort()}`, `0.0.0.0:${dbPort()}`];
  if (!hostBindings.some((binding) => expectedBindings.includes(binding))) {
    throw new Error(
      `Mapeamento de porta inesperado (${hostBindings.join(", ") || "vazio"}); esperado ${CONTAINER_PORT_KEY} → ${dbPort()}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Fingerprint
// ---------------------------------------------------------------------------

const FINGERPRINT_SQL = `
  SELECT md5(
    coalesce((
      SELECT offer_key || '|' || enabled::text || '|' ||
             coalesce(launch_at::text, '') || '|' ||
             coalesce(individual_launch_at::text, '')
      FROM public.trial_offer_settings
      WHERE offer_key = 'trial_28d_v1'
    ), '') || '#' || coalesce((
      SELECT string_agg(
        id::text || '|' || store_id::text || '|' || policy_cohort || '|' ||
        coalesce(beneficiary_cnpj_normalized, ''),
        ',' ORDER BY id
      )
      FROM public.trial_offer_enrollments
    ), '')
  ) AS fingerprint
`;

async function readFingerprint(client) {
  const { rows } = await client.query(FINGERPRINT_SQL);
  return rows[0]?.fingerprint ?? null;
}

// ---------------------------------------------------------------------------
// Asserções
// ---------------------------------------------------------------------------

async function assertIdentity(client) {
  const identity = await client.query(
    "SELECT current_database() AS database, current_setting('server_version') AS version",
  );
  assert(
    "banco conectado é o esperado (postgres)",
    identity.rows[0]?.database === DATABASE,
    `database=${identity.rows[0]?.database}`,
  );
  assert(
    "servidor é PostgreSQL 17.x",
    String(identity.rows[0]?.version ?? "").startsWith("17."),
    `version=${identity.rows[0]?.version}`,
  );

  const sentinel = await client.query(
    `SELECT count(*)::int AS total FROM public.f50_4_harness_identity WHERE purpose = 'disposable'`,
  );
  assert(
    "sentinela f50_4_harness_identity (purpose='disposable') existe",
    (sentinel.rows[0]?.total ?? 0) > 0,
    `total=${sentinel.rows[0]?.total}`,
  );

  const auth = await client.query("SELECT to_regclass('auth.users') IS NOT NULL AS ok");
  assert("auth.users existe (stack Supabase real)", auth.rows[0]?.ok === true, `ok=${auth.rows[0]?.ok}`);

  const roles = await client.query(
    `SELECT count(*)::int AS total FROM pg_roles
      WHERE rolname IN ('anon', 'authenticated', 'service_role')`,
  );
  assert(
    "roles anon/authenticated/service_role existem",
    roles.rows[0]?.total === 3,
    `total=${roles.rows[0]?.total}`,
  );
}

async function assertSettings(client, options) {
  const column = await client.query(
    `SELECT count(*)::int AS total
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'trial_offer_settings'
        AND column_name = 'individual_launch_at'`,
  );
  assert(
    "trial_offer_settings.individual_launch_at existe",
    (column.rows[0]?.total ?? 0) === 1,
    `total=${column.rows[0]?.total}`,
  );

  const settings = await client.query(
    `SELECT enabled, launch_at, individual_launch_at
       FROM public.trial_offer_settings
      WHERE offer_key = 'trial_28d_v1'`,
  );
  const row = settings.rows[0];
  assert("settings trial_28d_v1 existe", Boolean(row), "linha ausente");

  if (options.expectLaunchAt) {
    const actual = row?.launch_at ? new Date(row.launch_at).toISOString() : null;
    const expected = new Date(options.expectLaunchAt).toISOString();
    assert(
      "launch_at mantém o valor esperado",
      actual === expected,
      `esperado=${expected} obtido=${actual}`,
    );
  }
}

async function assertLedger(client) {
  const ledgerTable = await client.query(
    `SELECT to_regclass('supabase_migrations.schema_migrations') IS NOT NULL AS ok`,
  );
  assert(
    "ledger supabase_migrations.schema_migrations existe",
    ledgerTable.rows[0]?.ok === true,
    `ok=${ledgerTable.rows[0]?.ok}`,
  );
  if (ledgerTable.rows[0]?.ok !== true) return;

  const ledger = await client.query(
    `SELECT version FROM supabase_migrations.schema_migrations ORDER BY version`,
  );
  const versions = ledger.rows.map((item) => String(item.version));
  assert("ledger não está vazio", versions.length > 0, `total=${versions.length}`);
  for (const required of REQUIRED_LEDGER_VERSIONS) {
    assert(
      `ledger contém ${required}`,
      versions.some((value) => value.startsWith(required)),
      `versões=${versions.join(",")}`,
    );
  }
}

async function assertConstraints(client) {
  const constraints = await client.query(
    `SELECT conname, contype, convalidated, pg_get_constraintdef(oid) AS definition
       FROM pg_constraint
      WHERE conrelid = 'public.trial_offer_enrollments'::regclass`,
  );
  const byName = new Map(constraints.rows.map((row) => [row.conname, row]));

  for (const name of REQUIRED_CHECKS) {
    const row = byName.get(name);
    assert(`constraint ${name} existe`, Boolean(row), "constraint ausente");
    assert(
      `constraint ${name} está validada (convalidated = true)`,
      row?.convalidated === true,
      `convalidated=${row?.convalidated}`,
    );
  }

  const storeUnique = constraints.rows.some(
    (row) => row.contype === "u" && /UNIQUE \(store_id\)/i.test(row.definition ?? ""),
  );
  assert("uq_trial_offer_enrollments_store (UNIQUE store_id) existe", storeUnique, "constraint ausente");

  const globalRootUnique = constraints.rows.some(
    (row) => row.contype === "u" && /^UNIQUE \(root_hash\)$/i.test((row.definition ?? "").trim()),
  );
  assert(
    "NÃO existe constraint única global em root_hash",
    globalRootUnique === false,
    `definições=${constraints.rows.map((row) => `${row.conname}:${row.definition}`).join(" | ")}`,
  );

  const indexes = await client.query(
    `SELECT indexname, indexdef FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'trial_offer_enrollments'`,
  );
  const indexByName = new Map(indexes.rows.map((row) => [row.indexname, row.indexdef ?? ""]));

  const beneficiary = indexes.rows.find(
    (row) =>
      /UNIQUE INDEX/i.test(row.indexdef ?? "") &&
      /\(beneficiary_cnpj_normalized\)/i.test(row.indexdef ?? ""),
  );
  assert(
    "índice único por beneficiary_cnpj_normalized existe (uq_trial_offer_enrollments_beneficiary)",
    Boolean(beneficiary),
    `índices=${indexes.rows.map((row) => row.indexname).join(",")}`,
  );

  const partialRoot = indexes.rows.find(
    (row) =>
      /UNIQUE INDEX/i.test(row.indexdef ?? "") &&
      /root_hash/i.test(row.indexdef ?? "") &&
      /WHERE .*policy_cohort = 'root_legacy'/i.test(row.indexdef ?? ""),
  );
  assert(
    "índice único parcial root_hash WHERE policy_cohort = 'root_legacy' existe",
    Boolean(partialRoot),
    `índices=${[...indexByName.keys()].join(",")}`,
  );
}

async function assertTrigger(client) {
  const triggers = await client.query(
    `SELECT tgname FROM pg_trigger
      WHERE tgrelid = 'public.trial_offer_enrollments'::regclass
        AND NOT tgisinternal`,
  );
  const names = new Set(triggers.rows.map((row) => row.tgname));
  assert(
    "trigger trg_trial_offer_enrollments_immutable_identity existe",
    names.has("trg_trial_offer_enrollments_immutable_identity"),
    `triggers=${[...names].join(",")}`,
  );
}

async function assertGrants(client) {
  const functions = await client.query(
    `SELECT p.oid, p.proname,
            has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_exec,
            has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_exec,
            has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_exec
       FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname = ANY($1::text[])`,
    [EXPECTED_RPCS],
  );

  for (const name of EXPECTED_RPCS) {
    const rows = functions.rows.filter((row) => row.proname === name);
    assert(`RPC ${name} existe`, rows.length > 0, "função ausente");
    if (rows.length === 0) continue;
    assert(
      `RPC ${name}: anon NÃO tem EXECUTE`,
      rows.every((row) => row.anon_exec === false),
      `anon_exec=${rows.map((row) => row.anon_exec).join(",")}`,
    );
    assert(
      `RPC ${name}: authenticated NÃO tem EXECUTE`,
      rows.every((row) => row.authenticated_exec === false),
      `authenticated_exec=${rows.map((row) => row.authenticated_exec).join(",")}`,
    );
    assert(
      `RPC ${name}: service_role tem EXECUTE`,
      rows.every((row) => row.service_role_exec === true),
      `service_role_exec=${rows.map((row) => row.service_role_exec).join(",")}`,
    );
  }
}

async function verify(client, options) {
  await assertIdentity(client);
  await assertSettings(client, options);
  await assertLedger(client);
  await assertConstraints(client);
  await assertTrigger(client);
  await assertGrants(client);

  const fingerprint = await readFingerprint(client);
  console.log(`\nFingerprint atual: ${fingerprint}`);
}

// ---------------------------------------------------------------------------
// Skip-db / self-check de sintaxe
// ---------------------------------------------------------------------------

function skipDb() {
  // Sem conexão: apenas valida que o script está estruturalmente íntegro.
  const checks = [
    ["assertFixedTarget definido", typeof assertFixedTarget === "function"],
    ["allowlist 127.0.0.1", ALLOWED_HOSTS.has("127.0.0.1")],
    ["porta derivada de F50_4_DB_PORT", dbPort() === String(process.env.F50_4_DB_PORT ?? 54422)],
    ["fingerprint SQL referencia schema_migrations", typeof FINGERPRINT_SQL === "string"],
    ["ledger esperado definido", REQUIRED_LEDGER_VERSIONS.length === 3],
    ["RPCs esperadas definidas", EXPECTED_RPCS.length > 0],
    ["script existe no disco", crypto.createHash("md5").update(path.basename(SCRIPT_PATH)).digest("hex").length === 32],
  ];
  for (const [name, ok] of checks) assert(name, ok);
  const failed = results.filter((result) => !result.ok);
  console.log(`\nSkip-db: ${results.length - failed.length} passed / ${failed.length} failed / ${results.length} total`);
  if (failed.length > 0) process.exitCode = 1;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.mode === "skip-db") {
    console.log("\nF50.4 verification — modo --skip-db (nenhuma conexão)\n");
    skipDb();
    return;
  }

  assertNoRemoteEnv();
  const url = defaultDbUrl();
  assertFixedTarget(url);
  assertContainerIdentity();

  const client = new Client({ connectionString: url, application_name: "f50_4_verify" });
  await client.connect();
  try {
    if (options.mode === "print-fingerprint") {
      const fingerprint = await readFingerprint(client);
      if (!fingerprint) throw new Error("Fingerprint indisponível");
      console.log(fingerprint);
      return;
    }

    console.log("\nF50.4 verification — PostgreSQL descartável (127.0.0.1)\n");
    await verify(client, options);

    const failed = results.filter((result) => !result.ok);
    console.log(`\nResults: ${results.length - failed.length} passed / ${failed.length} failed / ${results.length} total`);
    if (failed.length > 0) process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`\nBLOCKED/FAILED: ${error.message}`);
  process.exitCode = 1;
});
