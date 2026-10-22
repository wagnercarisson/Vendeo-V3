#!/usr/bin/env node
// F50.4 — runner de fixtures SQL contra o PostgreSQL DESCARTÁVEL.
//
// Alvo fixo e fail-closed:
//   F50_4_DB_URL = postgresql://postgres:postgres@127.0.0.1:<F50_4_DB_PORT>/postgres
//   (F50_4_DB_PORT default 54422)
//
// Qualquer URL remota, protocolo não-postgres ou host fora de 127.0.0.1|localhost
// aborta ANTES de abrir conexão. O banco precisa conter a sentinela
// public.f50_4_harness_identity com purpose='disposable'.
//
// Uso:
//   node scripts/f50-4/run-sql-tests.mjs                       # padrão: f50_4_m* e *matrix*
//   node scripts/f50-4/run-sql-tests.mjs tests/sql/a.sql ...   # arquivos explícitos
//
// statement_timeout = 120s em cada sessão. Exit 1 se qualquer arquivo falhar.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SQL_DIR = path.join(REPO_ROOT, "tests", "sql");
const DATABASE = "postgres";
const ALLOWED_HOSTS = new Set(["127.0.0.1", "localhost"]);
const DEFAULT_FILES = [/^f50_4_m.*\.sql$/i, /^f50_4_.*matrix.*\.sql$/i];

function dbPort() {
  return String(process.env.F50_4_DB_PORT ?? 54422);
}

function assertLocalDatabaseUrl(rawUrl) {
  if (!rawUrl) {
    throw new Error("F50_4_DB_URL é obrigatório (o runner nunca usa alvo implícito).");
  }
  if (/^https?:\/\//i.test(rawUrl)) throw new Error("Recusando alvo HTTP.");
  if (/supabase\.(co|in)/i.test(rawUrl)) throw new Error("Recusando host de projeto Supabase remoto.");

  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("F50_4_DB_URL inválida (esperado postgresql://127.0.0.1:<porta>/postgres).");
  }
  if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
    throw new Error(`Recusando protocolo ${parsed.protocol}: esperado postgresql://`);
  }
  if (!ALLOWED_HOSTS.has(parsed.hostname)) {
    throw new Error(`Recusando host ${parsed.hostname}: allowlist 127.0.0.1|localhost`);
  }
  if (parsed.port !== dbPort()) {
    throw new Error(`Recusando porta ${parsed.port || "(default)"}: esperado ${dbPort()} (F50_4_DB_PORT).`);
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

function defaultFiles() {
  if (!existsSync(SQL_DIR)) throw new Error(`Diretório ausente: ${SQL_DIR}`);
  return readdirSync(SQL_DIR)
    .filter((name) => DEFAULT_FILES.some((pattern) => pattern.test(name)))
    .sort()
    .map((name) => path.join(SQL_DIR, name));
}

function expandArgs(argv) {
  if (argv.length === 0) return defaultFiles();

  const files = [];
  for (const arg of argv) {
    if (arg.includes("*")) {
      // glob simples no diretório tests/sql (sem subdiretórios)
      const pattern = new RegExp(`^${arg.split(/[\\/]/).pop().replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`);
      const matches = readdirSync(SQL_DIR).filter((name) => pattern.test(name)).sort();
      if (matches.length === 0) throw new Error(`Nenhum arquivo casou com o padrão ${arg}`);
      files.push(...matches.map((name) => path.join(SQL_DIR, name)));
      continue;
    }
    const resolved = path.resolve(REPO_ROOT, arg);
    if (!existsSync(resolved)) throw new Error(`Arquivo SQL não encontrado: ${arg}`);
    files.push(resolved);
  }
  return files;
}

async function assertHarnessSentinel(client) {
  const { rows } = await client.query(`
    SELECT run_id, purpose, migrations_expected
      FROM public.f50_4_harness_identity
     WHERE purpose = 'disposable'
     ORDER BY created_at DESC
     LIMIT 1
  `);
  if (rows.length < 1) {
    throw new Error(
      "Sentinela f50_4_harness_identity (purpose='disposable') ausente: alvo não é o harness descartável.",
    );
  }
  return rows[0];
}

async function main() {
  const files = expandArgs(process.argv.slice(2));
  if (files.length === 0) throw new Error("Nenhum arquivo SQL selecionado.");

  const url = process.env.F50_4_DB_URL ?? "";
  assertLocalDatabaseUrl(url);

  const client = new Client({ connectionString: url, application_name: "f50_4_sql_runner" });
  await client.connect();

  const failures = [];
  try {
    await client.query("SET statement_timeout = '120s'");
    const sentinel = await assertHarnessSentinel(client);
    console.log(
      `\nF50.4 SQL runner — ${redactedTarget(url)} (run_id=${sentinel.run_id}, migrations_expected=${sentinel.migrations_expected})\n`,
    );

    for (const file of files) {
      const name = path.relative(REPO_ROOT, file);
      const startedAt = Date.now();
      try {
        await client.query(readFileSync(file, "utf8"));
        console.log(`PASS ${name} (${Date.now() - startedAt}ms)`);
      } catch (error) {
        failures.push({ name, error });
        console.log(
          `FAIL ${name} (${Date.now() - startedAt}ms) — code=${error.code ?? "?"} message=${error.message}`,
        );
      }
    }
  } finally {
    await client.end();
  }

  console.log(`\nResults: ${files.length - failures.length} passed / ${failures.length} failed / ${files.length} total`);
  if (failures.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`\nBLOCKED/FAILED: ${error.message}`);
  process.exitCode = 1;
});
