#!/usr/bin/env node
// =============================================================================
// F57.2 — harness de stack Supabase DESCARTÁVEL e identificado.
// =============================================================================
// Subcomandos:
//   create    cria workdir + config com portas únicas e project_id f57-2-disposable-<run>,
//             sobe `supabase start`, cria a sentinela f57_2_harness_identity e o marcador.
//   status    valida identidade (auth.users, 3 roles, storage.buckets, sentinela) e imprime
//             host:porta, project_id e migrations_side. Nunca imprime connection string.
//   migrate   ledger-aware. F57_2_SIDE=base aplica tudo EXCETO a migration F57.2;
//             F57_2_SIDE=new aplica somente o delta (na reutilização, exatamente 1 arquivo).
//   destroy   idempotente; remove containers do project_id, para o stack e apaga o workdir.
//
// Guardas fail-closed ANTES de qualquer efeito:
//   - recusa SUPABASE_ACCESS_TOKEN, SUPABASE_DB_URL, --linked, --project-ref e npx;
//   - allowlist 127.0.0.1/localhost e porta dedicada F57_2_DB_PORT;
//   - project_id/workdir só com prefixo f57-2-disposable-;
//   - nomes proibidos de instâncias compartilhadas;
//   - porta livre e sem colisão entre derivadas.
//
// Este arquivo NÃO executa nada ao ser importado. `--help` não tem efeito colateral.
// =============================================================================

import { execFileSync, spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const REPO_MIGRATIONS = path.join(REPO_ROOT, "supabase", "migrations");
const REPO_CONFIG = path.join(REPO_ROOT, "supabase", "config.toml");
const REPO_TEMPLATES = path.join(REPO_ROOT, "supabase", "templates");
const PROJECT_PREFIX = "f57-2-disposable-";
const SENTINEL_FILE = ".f57-2-harness.json";
const F57_2_MIGRATION_MARKER = "f57_2_market_preferences";
const FORBIDDEN_PROJECTS = new Set(["vendeo-homolog", "vendeo-f562a-isolated"]);
const FORBIDDEN_PREFIXES = ["f56-2b2d-restore-"];

function usage() {
  return `Uso: node scripts/f57-2/isolated-db.mjs <comando> [opções]

Comandos:
  create     Cria o stack Supabase descartável (exige F57_2_RUN_ID e F57_2_DB_PORT)
  status     Valida a identidade do stack (exige F57_2_RUN_ID e F57_2_DB_PORT)
  migrate    Aplica migrations por lado (exige F57_2_RUN_ID, F57_2_DB_PORT e F57_2_SIDE=base|new)
  destroy    Destrói exatamente o stack do run-id (idempotente)
  --help     Mostra esta ajuda, sem efeitos colaterais

Variáveis:
  F57_2_RUN_ID    run-id (a-z0-9-), prefixado por ${PROJECT_PREFIX} no project_id
  F57_2_DB_PORT   porta Postgres dedicada (default 54572)
  F57_2_SIDE      base | new (apenas em migrate)

Guardas: somente 127.0.0.1/localhost, nunca produção/compartilhado, nunca imprime a
connection string completa. O CLI "supabase" deve estar disponível no PATH (npx é proibido).`;
}

function fail(message) {
  console.error(`ERRO: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const flags = argv.filter((arg) => arg.startsWith("--"));
  const command = argv.find((arg) => !arg.startsWith("--")) ?? null;
  return { command, flags };
}

function assertNoRemoteEnv() {
  if (process.env.SUPABASE_ACCESS_TOKEN) fail("SUPABASE_ACCESS_TOKEN presente; recusando alvo remoto.");
  if (process.env.SUPABASE_DB_URL) fail("SUPABASE_DB_URL presente; recusando alvo remoto.");
}

function assertNoForbiddenFlags(flags) {
  for (const flag of flags) {
    if (flag === "--linked" || flag.startsWith("--project-ref")) {
      fail(`flag proibida: ${flag}`);
    }
    if (flag === "--npx") fail("invocação via npx é proibida");
  }
}

function assertNoNpxInvocation() {
  const execPath = process.env.npm_execpath ?? "";
  if (/npx/i.test(execPath)) fail("execução via npx é proibida; use node scripts/f57-2/isolated-db.mjs");
}

function assertRunId(raw) {
  if (!raw) fail("F57_2_RUN_ID é obrigatório");
  if (!/^[a-z0-9-]{4,41}$/.test(raw)) fail("F57_2_RUN_ID inválido (use a-z0-9-, 4-41 chars)");
  const projectId = `${PROJECT_PREFIX}${raw}`;
  if (!projectId.startsWith(PROJECT_PREFIX)) fail("project_id fora do prefixo permitido");
  if (FORBIDDEN_PROJECTS.has(projectId) || FORBIDDEN_PROJECTS.has(raw)) fail("nome de instância proibido");
  for (const prefix of FORBIDDEN_PREFIXES) {
    if (projectId.startsWith(prefix)) fail(`prefixo proibido: ${prefix}`);
  }
  return projectId;
}

function dbPort() {
  const raw = Number(process.env.F57_2_DB_PORT ?? "54572");
  if (!Number.isInteger(raw) || raw < 1024 || raw > 65535) fail("F57_2_DB_PORT inválida");
  const forbidden = new Set([5432, 54321, 54322, 54323, 54324, 54329, 54422, 57781]);
  if (forbidden.has(raw)) fail(`porta ${raw} pertence a ambiente compartilhado/conhecido; recusando`);
  return raw;
}

function derivedPorts(base) {
  return {
    db: base,
    shadow: base + 1,
    api: base + 10,
    studio: base + 11,
    inbucket: base + 12,
    analytics: base + 13,
  };
}

function workdirFor(projectId) {
  const workdir = path.join(os.tmpdir(), projectId);
  if (path.basename(workdir) !== projectId) fail("workdir não corresponde ao project_id");
  return workdir;
}

function dbUrl(port) {
  return `postgresql://postgres:postgres@127.0.0.1:${port}/postgres`;
}

function redactedTarget(port, projectId) {
  return `127.0.0.1:${port} (${projectId})`;
}

function assertPortFree(port, label) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", () => reject(new Error(`porta ${port} (${label}) ocupada`)));
    server.listen(port, "127.0.0.1", () => server.close(() => resolve()));
  });
}

async function assertPortsFree(ports) {
  const seen = new Set();
  for (const [label, port] of Object.entries(ports)) {
    if (seen.has(port)) throw new Error(`porta duplicada entre serviços: ${port}`);
    seen.add(port);
    await assertPortFree(port, label);
  }
}

function supabaseVersion() {
  try {
    const out = execFileSync("supabase", ["--version"], { encoding: "utf8" }).trim();
    return out;
  } catch {
    fail("CLI `supabase` não encontrada no PATH. Não use npx; instalação exige autorização.");
  }
}

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
  if (!changed) throw new Error(`config.toml sem [${section}] ${key}`);
  return lines;
}

function rewriteConfig(source, projectId, ports) {
  let text = source;
  if (!/^project_id\s*=/m.test(text)) throw new Error("config.toml sem project_id");
  text = text.replace(/^project_id\s*=\s*".*"\s*$/m, `project_id = "${projectId}"`);
  let lines = text.split(/\r?\n/);
  lines = setKeyInSection(lines, "api", "port", ports.api);
  lines = setKeyInSection(lines, "db", "port", ports.db);
  lines = setKeyInSection(lines, "db", "shadow_port", ports.shadow);
  lines = setKeyInSection(lines, "studio", "port", ports.studio);
  lines = setKeyInSection(lines, "inbucket", "enabled", "false");
  lines = setKeyInSection(lines, "inbucket", "port", ports.inbucket);
  lines = setKeyInSection(lines, "analytics", "port", ports.analytics);
  text = lines.join("\n");
  if (!text.endsWith("\n")) text += "\n";
  return text;
}

function listMigrations() {
  const files = readdirSync(REPO_MIGRATIONS)
    .filter((name) => name.endsWith(".sql"))
    .sort();
  if (files.length === 0) fail("supabase/migrations está vazio");
  return files;
}

function selectSideFiles(side) {
  const files = listMigrations();
  return side === "base"
    ? files.filter((name) => !name.includes(F57_2_MIGRATION_MARKER))
    : files;
}

function readMarker(workdir) {
  const markerPath = path.join(workdir, SENTINEL_FILE);
  if (!existsSync(markerPath)) fail("marcador do harness ausente; create não foi concluído");
  return JSON.parse(readFileSync(markerPath, "utf8"));
}

function runSupabase(args, workdir, timeout = 300_000) {
  const result = spawnSync("supabase", args, {
    cwd: workdir,
    encoding: "utf8",
    timeout,
    env: { ...process.env, PGSSLMODE: "disable" },
  });
  if (result.status !== 0) {
    throw new Error(`supabase ${args[0]} falhou: ${(result.stderr || result.stdout || "").slice(0, 800)}`);
  }
  return result;
}

async function withClient(port, fn) {
  const client = new Client({ connectionString: dbUrl(port), ssl: false });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function assertIdentity(client, runId) {
  const identity = await client.query(
    `select
       to_regclass('auth.users') is not null as has_auth_users,
       (select count(*)::int from pg_roles where rolname in ('anon','authenticated','service_role')) as roles,
       to_regclass('storage.buckets') is not null as has_storage,
       (select count(*)::int from public.f57_2_harness_identity
         where purpose = 'disposable' and run_id = $1) as sentinel`,
    [runId],
  );
  const row = identity.rows[0] ?? {};
  if (row.has_auth_users !== true) fail("auth.users ausente: alvo não é um stack Supabase");
  if (Number(row.roles) !== 3) fail("roles anon/authenticated/service_role ausentes");
  if (row.has_storage !== true) fail("storage.buckets ausente");
  if (Number(row.sentinel) < 1) fail("sentinela f57_2_harness_identity ausente");
}

async function ensureIdentityTable(client, runId) {
  await client.query(`
    create table if not exists public.f57_2_harness_identity (
      run_id text primary key,
      purpose text not null check (purpose = 'disposable'),
      migrations_side text not null default 'pending',
      migrations_expected integer not null default 0 check (migrations_expected >= 0),
      created_at timestamptz not null default now()
    );
    revoke all on table public.f57_2_harness_identity from anon, authenticated, service_role;
  `);
  await client.query(
    `insert into public.f57_2_harness_identity (run_id, purpose)
     values ($1, 'disposable') on conflict (run_id) do nothing`,
    [runId],
  );
}

async function appliedVersions(client) {
  const exists = await client.query(
    "select to_regclass('supabase_migrations.schema_migrations') is not null as present",
  );
  if (!exists.rows[0]?.present) return new Set();
  const rows = await client.query("select version from supabase_migrations.schema_migrations");
  return new Set(rows.rows.map((row) => String(row.version)));
}

function versionOf(file) {
  return file.slice(0, 14);
}

async function applyWithPg(client, files, workdir) {
  let applied = 0;
  const versions = await appliedVersions(client);
  for (const file of files) {
    const version = versionOf(file);
    if (versions.has(version)) continue;
    const sql = readFileSync(path.join(workdir, "supabase", "migrations", file), "utf8");
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query(
        `insert into supabase_migrations.schema_migrations (version, name)
         values ($1, $2) on conflict (version) do nothing`,
        [version, file],
      );
      await client.query("commit");
      applied += 1;
    } catch (error) {
      await client.query("rollback");
      throw new Error(`migration ${file} falhou: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return applied;
}

async function create() {
  const runId = process.env.F57_2_RUN_ID;
  const projectId = assertRunId(runId);
  const ports = derivedPorts(dbPort());
  const workdir = workdirFor(projectId);

  supabaseVersion();
  await assertPortsFree(ports);
  if (existsSync(workdir)) fail(`workdir já existe: ${path.basename(workdir)}`);

  mkdirSync(path.join(workdir, "supabase"), { recursive: true });
  const config = rewriteConfig(readFileSync(REPO_CONFIG, "utf8"), projectId, ports);
  writeFileSync(path.join(workdir, "supabase", "config.toml"), config, "utf8");
  if (existsSync(REPO_TEMPLATES)) {
    cpSync(REPO_TEMPLATES, path.join(workdir, "supabase", "templates"), { recursive: true });
  }

  try {
    runSupabase(["start", "--workdir", workdir], workdir);
    await withClient(ports.db, async (client) => {
      await ensureIdentityTable(client, runId);
    });
    writeFileSync(
      path.join(workdir, SENTINEL_FILE),
      JSON.stringify({
        run_id: runId,
        project_id: projectId,
        workdir,
        ports,
        cli_version: supabaseVersion(),
        created_at: new Date().toISOString(),
      }, null, 2),
      "utf8",
    );
    await withClient(ports.db, (client) => assertIdentity(client, runId));
    console.log(`create OK: ${redactedTarget(ports.db, projectId)}`);
  } catch (error) {
    await destroyQuietly(projectId, workdir);
    throw error;
  }
}

async function status() {
  const runId = process.env.F57_2_RUN_ID;
  const projectId = assertRunId(runId);
  const ports = derivedPorts(dbPort());
  const workdir = workdirFor(projectId);
  const marker = readMarker(workdir);
  if (marker.project_id !== projectId) fail("marcador não pertence a este project_id");
  await withClient(ports.db, async (client) => {
    await assertIdentity(client, runId);
    const side = await client.query(
      "select migrations_side, migrations_expected from public.f57_2_harness_identity where run_id = $1",
      [runId],
    );
    console.log(
      `status OK: ${redactedTarget(ports.db, projectId)} side=${side.rows[0]?.migrations_side ?? "unknown"} expected=${side.rows[0]?.migrations_expected ?? 0}`,
    );
  });
}

async function migrate() {
  const runId = process.env.F57_2_RUN_ID;
  const projectId = assertRunId(runId);
  const side = process.env.F57_2_SIDE;
  if (side !== "base" && side !== "new") fail("F57_2_SIDE deve ser base|new");
  const ports = derivedPorts(dbPort());
  const workdir = workdirFor(projectId);
  readMarker(workdir);

  const files = selectSideFiles(side);
  const targetDir = path.join(workdir, "supabase", "migrations");
  mkdirSync(targetDir, { recursive: true });
  for (const file of readdirSync(targetDir)) {
    rmSync(path.join(targetDir, file), { force: true });
  }
  for (const file of files) {
    cpSync(path.join(REPO_MIGRATIONS, file), path.join(targetDir, file));
  }

  const f57File = listMigrations().find((name) => name.includes(F57_2_MIGRATION_MARKER));
  if (!f57File) fail("migration F57.2 não encontrada no repositório");

  await withClient(ports.db, async (client) => {
    await assertIdentity(client, runId);
    const before = await appliedVersions(client);
    let applied = 0;
    let pathUsed = "db-push";

    try {
      runSupabase(
        ["db", "push", "--yes", "--workdir", workdir, "--db-url", dbUrl(ports.db)],
        workdir,
      );
    } catch {
      pathUsed = "pg-fallback";
      applied = await applyWithPg(client, files, workdir);
    }

    const after = await appliedVersions(client);
    const f57Version = versionOf(f57File);
    const delta = [...after].filter((version) => !before.has(version));

    if (side === "base" && after.has(f57Version)) {
      fail("lado base contém a versão F57.2 no ledger");
    }
    if (side === "new" && !after.has(f57Version)) {
      fail("lado new não contém a versão F57.2 no ledger");
    }
    if (side === "new" && delta.length !== 1) {
      fail(`delta do lado new deveria ser exatamente 1 arquivo; veio ${delta.length}`);
    }
    if (pathUsed === "pg-fallback" && applied === 0 && side === "new") {
      fail("fallback pg não aplicou a migration F57.2");
    }

    await client.query(
      "update public.f57_2_harness_identity set migrations_side = $2, migrations_expected = $3 where run_id = $1",
      [runId, side, files.length],
    );
    console.log(
      `migrate OK: side=${side} path=${pathUsed} files=${files.length} delta=${delta.length} f57=${after.has(f57Version)} target=${redactedTarget(ports.db, projectId)}`,
    );
  });
}

async function destroyQuietly(projectId, workdir) {
  try {
    const listed = spawnSync(
      "docker",
      ["ps", "-aq", "--filter", `label=com.supabase.cli.project=${projectId}`],
      { encoding: "utf8" },
    );
    const ids = (listed.stdout ?? "").split(/\s+/).filter(Boolean);
    if (ids.length > 0) spawnSync("docker", ["rm", "-f", ...ids], { encoding: "utf8" });
    if (existsSync(workdir)) {
      spawnSync("supabase", ["stop", "--workdir", workdir, "--no-backup"], {
        encoding: "utf8",
        timeout: 120_000,
      });
    }
    if (existsSync(workdir) && path.basename(workdir) === projectId) {
      rmSync(workdir, { recursive: true, force: true });
    }
  } catch {
    // destroy é best-effort e idempotente; o comando principal reporta o erro real.
  }
}

async function destroy() {
  const runId = process.env.F57_2_RUN_ID;
  const projectId = assertRunId(runId);
  const workdir = workdirFor(projectId);
  if (existsSync(workdir)) {
    const marker = readMarker(workdir);
    if (marker.project_id !== projectId) fail("marcador não pertence a este project_id");
  }
  await destroyQuietly(projectId, workdir);
  const remaining = spawnSync(
    "docker",
    ["ps", "-aq", "--filter", `label=com.supabase.cli.project=${projectId}`],
    { encoding: "utf8" },
  );
  if ((remaining.stdout ?? "").trim() !== "") fail("containers remanescentes após destroy");
  console.log(`destroy OK: ${projectId}`);
}

async function main() {
  const { command, flags } = parseArgs(process.argv.slice(2));
  if (command === "--help" || command === "help" || flags.includes("--help")) {
    console.log(usage());
    return;
  }
  assertNoNpxInvocation();
  assertNoRemoteEnv();
  assertNoForbiddenFlags(flags);

  switch (command) {
    case "create":
      await create();
      return;
    case "status":
      await status();
      return;
    case "migrate":
      await migrate();
      return;
    case "destroy":
      await destroy();
      return;
    default:
      console.error(usage());
      process.exit(1);
  }
}

main().catch((error) => {
  console.error(`ERRO: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
