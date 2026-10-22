#!/usr/bin/env node
// F50.4 — harness de PostgreSQL DESCARTÁVEL (fail-closed).
//
// Objetivo: criar/consultar/destruir um stack Supabase efêmero e identificado
// (project_id = "f50-4-disposable-<run_id>") e aplicar as migrations do repo
// com o CLI GLOBAL 2.75.0, sem jamais tocar produção, o isolado antigo ou
// qualquer ambiente compartilhado.
//
// Subcomandos:
//   create   cria <workdir>, copia/reescreve supabase/config.toml com portas
//            únicas, sobe o stack via `supabase start --workdir <workdir>`,
//            aplica tests/sql/_harness.sql e grava a sentinela de identidade.
//   status   confere identidade mínima (Postgres real com auth.users, as três
//            roles e a sentinela). Com F50_4_EXPECT_LEDGER=1 exige ledger > 0.
//   push     executa, a partir da raiz do repo:
//            `supabase db push --yes --db-url postgresql://postgres:postgres@127.0.0.1:<porta>/postgres`
//            e valida que o ledger contém as três migrations F50.4.
//   destroy  destrói EXATAMENTE o project_id/workdir do run-id (idempotente).
//
// Guardas (antes de qualquer efeito):
//   - recusa SUPABASE_ACCESS_TOKEN, SUPABASE_DB_URL e --linked;
//   - allowlist rígida 127.0.0.1 + porta dedicada (F50_4_DB_PORT, default 54422);
//   - recusa nomes proibidos: vendeo-f562a-isolated, vendeo-homolog, f56-2b2d-restore-*;
//   - exige `supabase --version` = 2.75.0; invocar a CLI via npx é proibido;
//   - nunca imprime a connection string completa (somente host:porta e run_id).
//
// Este arquivo NÃO executa nada ao ser importado: só o bloco final roda a CLI.

import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const CLI_VERSION = "2.75.0";
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const REPO_CONFIG = path.join(REPO_ROOT, "supabase", "config.toml");
const REPO_MIGRATIONS = path.join(REPO_ROOT, "supabase", "migrations");
const HARNESS_SQL = path.join(REPO_ROOT, "tests", "sql", "_harness.sql");

const PROJECT_PREFIX = "f50-4-disposable-";
const SENTINEL_FILE = ".f50-4-harness.json";
const DATABASE = "postgres";
const ALLOWED_HOSTS = new Set(["127.0.0.1", "localhost"]);

const FORBIDDEN_PROJECTS = ["vendeo-f562a-isolated", "vendeo-homolog"];
const FORBIDDEN_PREFIXES = ["f56-2b2d-restore-"];
const FORBIDDEN_ENV = ["SUPABASE_ACCESS_TOKEN", "SUPABASE_DB_URL"];
const FORBIDDEN_FLAGS = ["--linked", "--project-ref"];

const RUN_ID_PATTERN = /^[a-z0-9][a-z0-9-]{3,40}$/;
const REQUIRED_F50_4_PREFIXES = ["20261022000001", "20261022000002", "20261022000003"];
const REQUIRED_BASE_MIGRATIONS = [
  "20261020000001_f50_2_trial_offer_settings.sql",
  "20261020000002_f50_2_trial_offer_enrollment.sql",
  "20261020000003_f50_2_trial_offer_rpcs.sql",
  "20261020000004_f50_2_trial_offer_precedence.sql",
  "20261021000001_f50_3_cnpj_alfanumerico.sql",
];

function dbPort() {
  return Number(process.env.F50_4_DB_PORT ?? 54422);
}

function shadowPort() {
  return Number(process.env.F50_4_DB_SHADOW_PORT ?? 54423);
}

function derivedPorts() {
  const base = dbPort();
  return {
    db: base,
    shadow: shadowPort(),
    api: Number(process.env.F50_4_API_PORT ?? base + 10),
    studio: Number(process.env.F50_4_STUDIO_PORT ?? base + 11),
    inbucket: Number(process.env.F50_4_INBUCKET_PORT ?? base + 12),
    analytics: Number(process.env.F50_4_ANALYTICS_PORT ?? base + 13),
  };
}

// ---------------------------------------------------------------------------
// Guardas
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const subcommand = argv[0];
  if (!subcommand || subcommand === "--help" || subcommand === "-h") {
    return { subcommand: "help", flags: new Set(argv.slice(1)) };
  }
  return { subcommand, flags: new Set(argv.slice(1)) };
}

function assertNoRemoteEnv() {
  for (const name of FORBIDDEN_ENV) {
    if (process.env[name]) {
      throw new Error(
        `Recusando execução: ${name} está definido. O harness só opera em 127.0.0.1 com porta dedicada; remova a variável.`,
      );
    }
  }
}

function assertNoForbiddenFlags(flags) {
  for (const flag of FORBIDDEN_FLAGS) {
    if (flags.has(flag)) {
      throw new Error(`Recusando flag ${flag}: o harness nunca opera em projeto remoto/vinculado.`);
    }
  }
}

function assertAllowedProjectId(projectId) {
  for (const forbidden of FORBIDDEN_PROJECTS) {
    if (projectId === forbidden) {
      throw new Error(`Recusando projeto proibido ${forbidden}: ambiente compartilhado/isolado antigo.`);
    }
  }
  for (const prefix of FORBIDDEN_PREFIXES) {
    if (projectId.startsWith(prefix)) {
      throw new Error(`Recusando projeto proibido (prefixo ${prefix}): restore/ambiente compartilhado.`);
    }
  }
  if (!projectId.startsWith(PROJECT_PREFIX) || projectId.length === PROJECT_PREFIX.length) {
    throw new Error(`Recusando project_id ${projectId}: esperado ${PROJECT_PREFIX}<run_id>.`);
  }
}

function assertLocalDatabaseUrl(rawUrl) {
  if (/^https?:\/\//i.test(rawUrl)) {
    throw new Error(`Recusando alvo HTTP: ${rawUrl}`);
  }
  if (/supabase\.(co|in)/i.test(rawUrl)) {
    throw new Error("Recusando connection string de projeto Supabase remoto");
  }

  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("F50_4_DB_URL inválida (esperado postgresql://127.0.0.1:<porta>/postgres)");
  }

  if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
    throw new Error(`Recusando protocolo ${parsed.protocol}: esperado postgresql://`);
  }
  if (!ALLOWED_HOSTS.has(parsed.hostname)) {
    throw new Error(`Recusando host ${parsed.hostname}: allowlist 127.0.0.1|localhost`);
  }
  if (parsed.port !== String(dbPort())) {
    throw new Error(
      `Recusando porta ${parsed.port || "(default)"}: esperado ${dbPort()} (F50_4_DB_PORT).`,
    );
  }
  const database = parsed.pathname.replace(/^\//, "");
  if (database !== DATABASE) {
    throw new Error(`Recusando database ${database}: esperado ${DATABASE}`);
  }
}

function redactedTarget(url) {
  const parsed = new URL(url);
  return `${parsed.hostname}:${parsed.port}${parsed.pathname}`;
}

function cliVersion() {
  const output = execFileSync("supabase", ["--version"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env },
  });
  const match = output.match(/(\d+\.\d+\.\d+)/);
  if (!match) throw new Error(`Não foi possível interpretar \`supabase --version\`: ${output.trim()}`);
  return match[1];
}

function assertCliVersion() {
  const version = cliVersion();
  if (version !== CLI_VERSION) {
    throw new Error(
      `CLI divergente: encontrado ${version}, exigido ${CLI_VERSION}. Não atualize nem troque o binário nesta fase.`,
    );
  }
  return version;
}

// ---------------------------------------------------------------------------
// Identidade / workdir / portas
// ---------------------------------------------------------------------------

function newRunId() {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  return `${stamp}-${crypto.randomBytes(3).toString("hex")}`;
}

function resolveRunId({ required = false } = {}) {
  const raw = process.env.F50_4_RUN_ID ?? "";
  if (!raw) {
    if (required) throw new Error("F50_4_RUN_ID é obrigatório para este subcomando (identidade exata).");
    return newRunId();
  }
  if (!RUN_ID_PATTERN.test(raw)) {
    throw new Error(`F50_4_RUN_ID inválido: ${raw} (permitido: [a-z0-9-], 4..41 chars).`);
  }
  return raw;
}

function projectIdFor(runId) {
  const projectId = `${PROJECT_PREFIX}${runId}`;
  assertAllowedProjectId(projectId);
  return projectId;
}

function workdirFor(projectId) {
  const candidate = path.join(os.tmpdir(), projectId);
  const resolved = path.resolve(candidate);
  if (path.basename(resolved) !== projectId) {
    throw new Error(`Recusando workdir fora do padrão exato: ${resolved}`);
  }
  return resolved;
}

function assertPortFree(port, label) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", (error) => {
      if (error.code === "EADDRINUSE") {
        reject(new Error(`Porta ${port} (${label}) já está em uso; abortando antes de subir o stack.`));
        return;
      }
      reject(error);
    });
    server.listen({ host: "127.0.0.1", port, exclusive: true }, () => {
      server.close(() => resolve(port));
    });
  });
}

async function assertPortsFree(ports) {
  const unique = [...new Set(Object.values(ports))];
  if (unique.length !== Object.keys(ports).length) {
    throw new Error(`Portas derivadas colidem: ${JSON.stringify(ports)}`);
  }
  for (const [label, port] of Object.entries(ports)) {
    await assertPortFree(port, label);
  }
}

function dbUrl() {
  return `postgresql://postgres:postgres@127.0.0.1:${dbPort()}/${DATABASE}`;
}

// ---------------------------------------------------------------------------
// config.toml — reescrita de project_id e de TODAS as portas expostas
// ---------------------------------------------------------------------------

function setKeyInSection(lines, section, key, value) {
  let current = "";
  let changed = false;
  for (let index = 0; index < lines.length; index += 1) {
    const header = lines[index].match(/^\s*\[([^\]]+)\]\s*$/);
    if (header) {
      current = header[1];
      continue;
    }
    if (current === section && new RegExp(`^\\s*${key}\\s*=`).test(lines[index])) {
      lines[index] = `${key} = ${value}`;
      changed = true;
    }
  }
  if (!changed) throw new Error(`supabase/config.toml sem [${section}] ${key}`);
  return lines;
}

function rewriteConfig(source, { projectId, ports }) {
  let text = source;
  if (!/^project_id\s*=/m.test(text)) throw new Error("supabase/config.toml sem project_id");
  text = text.replace(/^project_id\s*=\s*".*"\s*$/m, `project_id = "${projectId}"`);

  let lines = text.split(/\r?\n/);
  lines = setKeyInSection(lines, "api", "port", ports.api);
  lines = setKeyInSection(lines, "db", "port", ports.db);
  lines = setKeyInSection(lines, "db", "shadow_port", ports.shadow);
  lines = setKeyInSection(lines, "studio", "port", ports.studio);
  lines = setKeyInSection(lines, "inbucket", "port", ports.inbucket);
  lines = setKeyInSection(lines, "analytics", "port", ports.analytics);
  text = lines.join("\n");
  if (!text.endsWith("\n")) text += "\n";
  return text;
}

// ---------------------------------------------------------------------------
// Migrations esperadas (fail-closed)
// ---------------------------------------------------------------------------

function repoMigrationsExpectation() {
  const files = readdirSync(REPO_MIGRATIONS).filter((name) => name.endsWith(".sql"));
  if (files.length < 1) {
    throw new Error("supabase/migrations não contém nenhuma migration; create falha fechado.");
  }
  for (const prefix of REQUIRED_F50_4_PREFIXES) {
    const found = files.some((name) => name.startsWith(prefix) && name.includes("f50_4"));
    if (!found) {
      throw new Error(`Migration F50.4 ausente: ${prefix}_f50_4_*.sql (create falha fechado).`);
    }
  }
  for (const name of REQUIRED_BASE_MIGRATIONS) {
    if (!files.includes(name)) {
      throw new Error(`Migration de base ausente: ${name} (create falha fechado).`);
    }
  }
  return {
    migrationsDir: REPO_MIGRATIONS,
    migrationsExpected: files.length,
    files,
  };
}

// ---------------------------------------------------------------------------
// Sentinela / pós-condições
// ---------------------------------------------------------------------------

async function assertDisposableIdentity(client) {
  const { rows } = await client.query(`
    SELECT
      (SELECT count(*)::int FROM public.f50_4_harness_identity WHERE purpose = 'disposable') AS sentinels,
      to_regclass('auth.users') IS NOT NULL AS has_auth_users,
      (SELECT count(*)::int FROM pg_roles
        WHERE rolname IN ('anon', 'authenticated', 'service_role')) AS roles
  `);
  const row = rows[0] ?? {};
  if (row.sentinels < 1) throw new Error("Sentinela f50_4_harness_identity ausente ou purpose != 'disposable'.");
  if (row.has_auth_users !== true) throw new Error("auth.users ausente: o alvo não é um stack Supabase real.");
  if (row.roles !== 3) throw new Error("Roles anon/authenticated/service_role ausentes no alvo.");
  return row;
}

async function assertHarnessPostconditions(client, expectation) {
  await assertDisposableIdentity(client);
  if (!Number.isInteger(expectation.migrationsExpected) || expectation.migrationsExpected < 1) {
    throw new Error("migrations_expected < 1; create falha fechado.");
  }
  const { rows } = await client.query(
    `SELECT migrations_expected, migrations_dir
       FROM public.f50_4_harness_identity
      WHERE purpose = 'disposable'
      ORDER BY created_at DESC
      LIMIT 1`,
  );
  const recorded = rows[0];
  if (!recorded) throw new Error("Sentinela f50_4_harness_identity ausente após aplicação.");
  if (recorded.migrations_expected !== expectation.migrationsExpected) {
    throw new Error(
      `migrations_expected divergente: registrado=${recorded.migrations_expected} esperado=${expectation.migrationsExpected}`,
    );
  }
}

// ---------------------------------------------------------------------------
// create
// ---------------------------------------------------------------------------

async function partialDestroy(projectId, workdir) {
  try {
    stopProject(projectId, workdir);
  } catch {
    // melhor esforço: o create já falhou; não mascarar o erro original
  }
}

function stopProject(projectId, workdir) {
  assertAllowedProjectId(projectId);

  const containers = execFileSync(
    "docker",
    ["ps", "-aq", "--filter", `label=com.supabase.cli.project=${projectId}`],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  )
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (containers.length > 0) {
    execFileSync("docker", ["rm", "-f", ...containers], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  }

  if (existsSync(path.join(workdir, "supabase", "config.toml")) && existsSync(path.join(workdir, SENTINEL_FILE))) {
    const config = readFileSync(path.join(workdir, "supabase", "config.toml"), "utf8");
    const match = config.match(/^project_id\s*=\s*"(.*)"\s*$/m);
    if (!match || match[1] !== projectId) {
      throw new Error(`Recusando stop: project_id do workdir (${match?.[1] ?? "?"}) != ${projectId}`);
    }
    spawnSync("supabase", ["stop", "--workdir", workdir, "--no-backup"], {
      cwd: workdir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  }
}

export async function createDisposable(argv = []) {
  const { flags } = parseArgs(argv);
  assertNoRemoteEnv();
  assertNoForbiddenFlags(flags);

  const runId = resolveRunId();
  const projectId = projectIdFor(runId);
  const ports = derivedPorts();
  const workdir = workdirFor(projectId);

  if (existsSync(path.join(workdir, SENTINEL_FILE))) {
    throw new Error(`Workdir já inicializado para ${projectId}; use destroy antes de recriar.`);
  }

  const expectation = repoMigrationsExpectation();
  const version = assertCliVersion();

  await assertPortsFree(ports);

  mkdirSync(path.join(workdir, "supabase", "migrations"), { recursive: true });
  const sourceConfig = readFileSync(REPO_CONFIG, "utf8");
  writeFileSync(
    path.join(workdir, "supabase", "config.toml"),
    rewriteConfig(sourceConfig, { projectId, ports }),
    "utf8",
  );

  // bootstrap: `supabase start --workdir <workdir>` provisiona auth.users,
  // schema auth e as roles anon/authenticated/service_role.
  const start = spawnSync("supabase", ["start", "--workdir", workdir], {
    cwd: workdir,
    encoding: "utf8",
    stdio: "inherit",
    env: { ...process.env },
    timeout: 300_000,
  });
  if (start.status !== 0) {
    await partialDestroy(projectId, workdir);
    throw new Error(`supabase start falhou (exit ${start.status ?? "?"}); destruição parcial executada.`);
  }

  const client = new Client({ connectionString: dbUrl(), application_name: "f50_4_harness" });
  try {
    await client.connect();
    await client.query("SET statement_timeout = '120s'");
    await client.query(readFileSync(HARNESS_SQL, "utf8"));
    await client.query(
      `INSERT INTO public.f50_4_harness_identity
         (run_id, purpose, migrations_dir, migrations_expected)
       VALUES ($1, 'disposable', $2, $3)
       ON CONFLICT (run_id) DO UPDATE
         SET migrations_dir = EXCLUDED.migrations_dir,
             migrations_expected = EXCLUDED.migrations_expected`,
      [runId, expectation.migrationsDir, expectation.migrationsExpected],
    );
    await assertHarnessPostconditions(client, expectation);
  } catch (error) {
    await client.end().catch(() => {});
    await partialDestroy(projectId, workdir);
    throw error;
  }
  await client.end();

  writeFileSync(
    path.join(workdir, SENTINEL_FILE),
    `${JSON.stringify(
      {
        run_id: runId,
        project_id: projectId,
        workdir,
        ports,
        cli_version: version,
        migrations_expected: expectation.migrationsExpected,
        created_at: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  console.log(`created ${projectId} (127.0.0.1:${ports.db}, cli ${version}, migrations_expected=${expectation.migrationsExpected})`);
  return { runId, projectId, workdir, ports, migrationsExpected: expectation.migrationsExpected };
}

// ---------------------------------------------------------------------------
// status
// ---------------------------------------------------------------------------

export async function statusDisposable(argv = []) {
  const { flags } = parseArgs(argv);
  assertNoRemoteEnv();
  assertNoForbiddenFlags(flags);

  const runId = resolveRunId({ required: true });
  const projectId = projectIdFor(runId);
  const workdir = workdirFor(projectId);
  if (!existsSync(path.join(workdir, SENTINEL_FILE))) {
    throw new Error(`Workdir não inicializado para ${projectId}; create ausente.`);
  }

  assertLocalDatabaseUrl(dbUrl());
  const client = new Client({ connectionString: dbUrl(), application_name: "f50_4_status" });
  await client.connect();
  try {
    const identity = await client.query(
      "SELECT current_database() AS database, current_setting('server_version') AS version",
    );
    if (identity.rows[0]?.database !== DATABASE) {
      throw new Error(`database inesperado: ${identity.rows[0]?.database}`);
    }
    await assertDisposableIdentity(client);

    if (process.env.F50_4_EXPECT_LEDGER === "1") {
      const ledger = await client.query(
        `SELECT count(*)::int AS total FROM supabase_migrations.schema_migrations`,
      );
      if ((ledger.rows[0]?.total ?? 0) < 1) {
        throw new Error("F50_4_EXPECT_LEDGER=1, mas supabase_migrations.schema_migrations está vazio.");
      }
    }

    console.log(
      `status ${projectId} OK (${redactedTarget(dbUrl())}, PostgreSQL ${identity.rows[0]?.version})`,
    );
  } finally {
    await client.end();
  }
}

// ---------------------------------------------------------------------------
// push
// ---------------------------------------------------------------------------

export async function pushDisposable(argv = []) {
  const { flags } = parseArgs(argv);
  assertNoRemoteEnv();
  assertNoForbiddenFlags(flags);

  const runId = resolveRunId({ required: true });
  const projectId = projectIdFor(runId);
  const workdir = workdirFor(projectId);
  if (!existsSync(path.join(workdir, SENTINEL_FILE))) {
    throw new Error(`Workdir não inicializado para ${projectId}; create ausente.`);
  }

  const expectation = repoMigrationsExpectation();
  const version = assertCliVersion();
  const url = dbUrl();
  assertLocalDatabaseUrl(url);

  console.log(`supabase ${version} — db push --yes --db-url ${redactedTarget(url)}`);
  const push = spawnSync("supabase", ["db", "push", "--yes", "--db-url", url], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    stdio: "inherit",
    env: { ...process.env },
  });
  if (push.status !== 0) {
    throw new Error(`supabase db push falhou (exit ${push.status ?? "?"}); nunca tratar como sucesso.`);
  }

  const client = new Client({ connectionString: url, application_name: "f50_4_push_check" });
  await client.connect();
  try {
    const ledger = await client.query(
      `SELECT version FROM supabase_migrations.schema_migrations ORDER BY version`,
    );
    const versions = ledger.rows.map((row) => String(row.version));
    if (versions.length < 1) {
      throw new Error("Ledger vazio após db push; nunca tratar 'zero migrations' como sucesso.");
    }
    for (const prefix of REQUIRED_F50_4_PREFIXES) {
      if (!versions.some((value) => value.startsWith(prefix))) {
        throw new Error(`Ledger sem a migration ${prefix} após db push.`);
      }
    }
    console.log(`push OK — ledger com ${versions.length} versões (migrations_expected=${expectation.migrationsExpected}).`);
  } finally {
    await client.end();
  }
}

// ---------------------------------------------------------------------------
// destroy
// ---------------------------------------------------------------------------

export async function destroyDisposable(argv = []) {
  const { flags } = parseArgs(argv);
  assertNoForbiddenFlags(flags);

  const runId = resolveRunId({ required: true });
  const projectId = projectIdFor(runId);
  const workdir = workdirFor(projectId);
  const sentinelPath = path.join(workdir, SENTINEL_FILE);

  if (existsSync(sentinelPath)) {
    const sentinel = JSON.parse(readFileSync(sentinelPath, "utf8"));
    if (sentinel.project_id !== projectId || sentinel.run_id !== runId) {
      throw new Error(
        `Recusando destroy: sentinela (${sentinel.project_id}/${sentinel.run_id}) != ${projectId}/${runId}.`,
      );
    }
  }

  stopProject(projectId, workdir);

  if (existsSync(workdir)) {
    if (path.basename(workdir) !== projectId) {
      throw new Error(`Recusando remoção de workdir fora do padrão exato: ${workdir}`);
    }
    rmSync(workdir, { recursive: true, force: true });
  }

  console.log(`destroyed ${projectId}`);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function usage() {
  console.log(`F50.4 disposable-db (CLI ${CLI_VERSION})

Uso:
  node scripts/f50-4/disposable-db.mjs create   [F50_4_RUN_ID=...] [F50_4_DB_PORT=54422]
  node scripts/f50-4/disposable-db.mjs status   [F50_4_EXPECT_LEDGER=1]
  node scripts/f50-4/disposable-db.mjs push
  node scripts/f50-4/disposable-db.mjs destroy

Alvo permitido: 127.0.0.1:<F50_4_DB_PORT>/${DATABASE} (projeto ${PROJECT_PREFIX}<run_id>).
Proibido: --linked, SUPABASE_ACCESS_TOKEN, SUPABASE_DB_URL, host remoto e invocação da CLI via npx.`);
}

async function main() {
  const { subcommand } = parseArgs(process.argv.slice(2));
  const argv = process.argv.slice(2);
  switch (subcommand) {
    case "create":
      await createDisposable(argv);
      break;
    case "status":
      await statusDisposable(argv);
      break;
    case "push":
      await pushDisposable(argv);
      break;
    case "destroy":
      await destroyDisposable(argv);
      break;
    case "help":
      usage();
      break;
    default:
      usage();
      process.exitCode = 2;
  }
}

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (invokedDirectly) {
  main().catch((error) => {
    console.error(`BLOCKED/FAILED: ${error.message}`);
    process.exitCode = 1;
  });
}
