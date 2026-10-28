#!/usr/bin/env node
// =============================================================================
// F57.2 — comandos Node do orquestrador de provas (status/preflight/cleanup).
// =============================================================================
// Uso:
//   node scripts/f57-2/proofs-tool.mjs status --expected-count 149 --expected-sha256 <sha>
//   node scripts/f57-2/proofs-tool.mjs preflight
//   node scripts/f57-2/proofs-tool.mjs cleanup --registry <jsonl> --manifest-out <json>
//
// Lê TEST_DATABASE_URL do ambiente. Não imprime credenciais. Os limites de
// conexão/consulta impedem espera indefinida sem interferir nas provas de
// concorrência (que têm seus próprios limites controlados).
// =============================================================================

import fs from "node:fs";
import { createHash } from "node:crypto";
import { Client } from "pg";

const ALLOWED_HOSTS = new Set(["127.0.0.1", "localhost"]);
const ALLOWED_PORTS = new Set(["57782"]);
const ALLOWED_DB = "postgres";
const CONNECT_TIMEOUT_MS = 10_000;
const QUERY_TIMEOUT_MS = 15_000;

function usage() {
  return `Uso:
  node scripts/f57-2/proofs-tool.mjs status --expected-count <n> --expected-sha256 <sha>
  node scripts/f57-2/proofs-tool.mjs preflight
  node scripts/f57-2/proofs-tool.mjs cleanup --registry <jsonl> --manifest-out <json>`;
}

function fail(message, code = 1) {
  console.error(`ERRO: ${message}`);
  process.exit(code);
}

function parseArgs(argv) {
  const command = argv[0];
  if (!command || command === "--help" || command === "-h") {
    console.log(usage());
    process.exit(0);
  }
  const options = {};
  for (let index = 1; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith("--")) fail(`argumento inesperado: ${key}`);
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) fail(`faltou valor para ${key}`);
    options[key.slice(2)] = value;
    index += 1;
  }
  return { command, options };
}

function parseTarget(rawUrl) {
  if (!rawUrl) fail("TEST_DATABASE_URL ausente");
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    fail("TEST_DATABASE_URL inválida");
  }
  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") fail("URL deve usar postgresql://");
  if (!ALLOWED_HOSTS.has(url.hostname) || !ALLOWED_PORTS.has(url.port) || url.pathname !== `/${ALLOWED_DB}`) {
    fail(`alvo recusado: esperado 127.0.0.1:57782/${ALLOWED_DB}`);
  }
  return { rawUrl, masked: `postgresql://***@${url.hostname}:${url.port}${url.pathname}` };
}

function ledgerFingerprint(rows) {
  const stable = rows
    .filter((row) => !String(row.name ?? "").includes("f57_2_"))
    .map((row) => `${row.version}|${row.name ?? ""}`)
    .sort();
  return {
    count: stable.length,
    sha256: createHash("sha256").update(stable.join("\n")).digest("hex"),
    f57_2: rows.filter((row) => String(row.name ?? "").includes("f57_2_")).map((row) => `${row.version}|${row.name}`),
  };
}

async function open(target) {
  const client = new Client({
    connectionString: target.rawUrl,
    ssl: false,
    connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
    query_timeout: QUERY_TIMEOUT_MS,
    statement_timeout: QUERY_TIMEOUT_MS,
  });
  await client.connect();
  return client;
}

async function status(target, options) {
  const expectedCount = Number(options["expected-count"]);
  const expectedSha = String(options["expected-sha256"] ?? "").trim();
  if (!Number.isSafeInteger(expectedCount) || expectedCount < 0 || !/^[0-9a-f]{64}$/.test(expectedSha)) {
    fail("status exige --expected-count inteiro e --expected-sha256 válido");
  }
  const client = await open(target);
  try {
    const identity = await client.query(
      "select current_database() as db, to_regclass('auth.users') is not null as auth",
    );
    if (identity.rows[0]?.db !== ALLOWED_DB || identity.rows[0]?.auth !== true) {
      fail("identidade do alvo divergiu");
    }
    const roles = await client.query(
      "select rolname from pg_roles where rolname in ('anon','authenticated','service_role') order by rolname",
    );
    if ((roles.rows.map((row) => row.rolname).join(",")) !== "anon,authenticated,service_role") {
      fail("roles esperadas ausentes");
    }
    const ledger = await client.query("select version, name from supabase_migrations.schema_migrations order by version");
    const fingerprint = ledgerFingerprint(ledger.rows);
    if (fingerprint.count !== expectedCount || fingerprint.sha256 !== expectedSha) {
      fail(`fingerprint do ledger divergiu (count=${fingerprint.count}, sha=${fingerprint.sha256})`, 2);
    }
    process.stdout.write(
      `${JSON.stringify({
        database: identity.rows[0].db,
        auth: identity.rows[0].auth,
        roles: roles.rows.map((row) => row.rolname),
        ledger_count: fingerprint.count,
        ledger_sha256: fingerprint.sha256,
        f57_2: fingerprint.f57_2,
        target: target.masked,
      })}\n`,
    );
  } finally {
    await client.end();
  }
}

async function preflight(target) {
  const client = await open(target);
  try {
    const result = await client.query(
      `select
         (select count(*)::int from public.stores where name like '%f572test-%' or name like '%f572proof-%') as stores,
         (select count(*)::int from auth.users where email like '%f572test-%' or email like '%f572proof-%') as users,
         (select count(*)::int from public.store_market_settings s join public.stores st on st.id=s.store_id where st.name like '%f572test-%' or st.name like '%f572proof-%') as settings,
         (select count(*)::int from public.user_preferences p join auth.users u on u.id=p.user_id where u.email like '%f572test-%' or u.email like '%f572proof-%') as preferences,
         (select coalesce(jsonb_agg(id), '[]'::jsonb) from public.stores where name like '%f572test-%' or name like '%f572proof-%') as store_ids,
         (select coalesce(jsonb_agg(id), '[]'::jsonb) from auth.users where email like '%f572test-%' or email like '%f572proof-%') as user_ids`,
    );
    process.stdout.write(`${JSON.stringify({ ...result.rows[0], target: target.masked })}\n`);
  } finally {
    await client.end();
  }
}

function readRegistry(path) {
  if (!path || !fs.existsSync(path)) fail("registry de fixtures ausente", 2);
  return fs
    .readFileSync(path, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch {
        fail(`registry inválido na linha ${index + 1}`, 2);
      }
    });
}

async function cleanup(target, options) {
  const registryPath = options.registry;
  const manifestOut = options["manifest-out"];
  if (!registryPath || !manifestOut) fail("cleanup exige --registry e --manifest-out");
  const entries = readRegistry(registryPath);
  const storeIds = [...new Set(entries.filter((entry) => entry.kind === "store").map((entry) => entry.id))];
  const userIds = [...new Set(entries.filter((entry) => entry.kind === "user").map((entry) => entry.id))];
  // Persiste o manifesto ANTES de excluir qualquer linha.
  fs.writeFileSync(
    manifestOut,
    `${JSON.stringify({ stores: storeIds, users: userIds }, null, 2)}\n`,
    "utf8",
  );

  const client = await open(target);
  const failures = [];
  let deletedStores = 0;
  let deletedUsers = 0;
  try {
    for (const id of storeIds) {
      try {
        await client.query("delete from public.store_market_settings where store_id=$1", [id]);
        await client.query("delete from public.store_billing_info where store_id=$1", [id]);
        await client.query("delete from public.legal_acceptances where store_id=$1", [id]);
        await client.query("delete from public.stores where id=$1", [id]);
        deletedStores += 1;
      } catch (error) {
        failures.push({ table: "stores", id, error: error instanceof Error ? error.message : String(error) });
      }
    }
    for (const id of userIds) {
      try {
        await client.query("delete from public.user_preferences where user_id=$1", [id]);
        await client.query("delete from public.admin_audit_log where target_id=$1", [id]);
        await client.query("delete from auth.users where id=$1", [id]);
        deletedUsers += 1;
      } catch (error) {
        failures.push({ table: "auth.users", id, error: error instanceof Error ? error.message : String(error) });
      }
    }
    const residue = await client.query(
      `select
         (select count(*)::int from public.stores where name like '%f572test-%' or name like '%f572proof-%') as stores,
         (select count(*)::int from auth.users where email like '%f572test-%' or email like '%f572proof-%') as users,
         (select count(*)::int from public.store_market_settings s join public.stores st on st.id=s.store_id where st.name like '%f572test-%' or st.name like '%f572proof-%') as settings,
         (select count(*)::int from public.user_preferences p join auth.users u on u.id=p.user_id where u.email like '%f572test-%' or u.email like '%f572proof-%') as preferences`,
    );
    const payload = {
      ...residue.rows[0],
      registered_store_ids: storeIds,
      registered_user_ids: userIds,
      deleted_stores: deletedStores,
      deleted_users: deletedUsers,
      failures,
      target: target.masked,
    };
    process.stdout.write(`${JSON.stringify(payload)}\n`);
    if (failures.length > 0 || Number(residue.rows[0].stores) !== 0 || Number(residue.rows[0].users) !== 0) {
      process.exit(2);
    }
  } finally {
    await client.end();
  }
}

async function main() {
  const { command, options } = parseArgs(process.argv.slice(2));
  const target = parseTarget(process.env.TEST_DATABASE_URL);
  if (command === "status") return status(target, options);
  if (command === "preflight") return preflight(target);
  if (command === "cleanup") return cleanup(target, options);
  fail(`comando desconhecido: ${command}`);
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
