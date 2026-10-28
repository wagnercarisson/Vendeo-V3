#!/usr/bin/env node
// =============================================================================
// F57.2 — coletor READ-ONLY de evidência S0 no homolog existente.
// =============================================================================
// Uso:
//   node scripts/f57-2/homolog-snapshot.mjs snapshot --url <url> --out <json> [--label <texto>]
//   node scripts/f57-2/homolog-snapshot.mjs compare --before <json> --after <json> [--out-md <md>]
//
// Não escreve, não semeia, não limpa e não cria ambiente. Usa dados já existentes
// no homolog para provar que a migration preservou lojas, billing, créditos,
// entitlements, aceites, campanhas e auditoria. `store_market_settings` é
// excluída (nasce com a F57.2).
// =============================================================================

import fs from "node:fs";
import { createHash } from "node:crypto";
import { Client } from "pg";

const ALLOWED_HOST = "127.0.0.1";
const ALLOWED_PORT = "57782";
const ALLOWED_DB = "postgres";

function usage() {
  return `Uso:
  node scripts/f57-2/homolog-snapshot.mjs snapshot --url <postgresql://...> --out <json> [--label <texto>]
  node scripts/f57-2/homolog-snapshot.mjs compare --before <json> --after <json> [--out-md <md>]

Alvo permitido: ${ALLOWED_HOST}:${ALLOWED_PORT}/${ALLOWED_DB} (homolog existente).
Somente leitura; nenhum dado é criado, alterado ou removido.`;
}

function fail(message) {
  console.error(`ERRO: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const command = argv[0];
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

function assertTarget(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    fail("--url inválida");
  }
  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") fail("--url deve usar postgresql://");
  if (url.hostname !== ALLOWED_HOST || url.port !== ALLOWED_PORT || url.pathname !== `/${ALLOWED_DB}`) {
    fail(`alvo recusado: esperado ${ALLOWED_HOST}:${ALLOWED_PORT}/${ALLOWED_DB}`);
  }
  return rawUrl;
}

const TABLES = [
  "stores",
  "store_billing_info",
  "credit_transactions",
  "credit_balances",
  "freemium_entitlements",
  "legal_acceptances",
  "campaigns",
  "admin_audit_log",
];

async function tableFingerprint(client, table) {
  const exists = await client.query(
    "select to_regclass($1) is not null as present",
    [`public.${table}`],
  );
  if (!exists.rows[0]?.present) {
    return { table, present: false, count: 0, sha256: null };
  }
  const rows = await client.query(
    `select count(*)::int as count,
            md5(coalesce(string_agg(to_jsonb(t)::text, '|' order by to_jsonb(t)::text), '')) as md5
       from public.${table} t`,
  );
  return {
    table,
    present: true,
    count: Number(rows.rows[0].count),
    md5: rows.rows[0].md5,
  };
}

async function snapshot(client, label) {
  await client.query("begin isolation level repeatable read read only");
  try {
    const ledger = await client.query(
      "select version, name from supabase_migrations.schema_migrations order by version",
    );
    const stable = ledger.rows
      .filter((row) => !String(row.name ?? "").includes("f57_2_"))
      .map((row) => `${row.version}|${row.name ?? ""}`)
      .sort();
    const tables = [];
    for (const table of TABLES) {
      tables.push(await tableFingerprint(client, table));
    }
    const payload = {
      collected_at: new Date().toISOString(),
      label: label ?? "unlabeled",
      target: `${ALLOWED_HOST}:${ALLOWED_PORT}/${ALLOWED_DB}`,
      ledger: {
        f57_2_versions: ledger.rows
          .filter((row) => String(row.name ?? "").includes("f57_2_"))
          .map((row) => `${row.version}|${row.name}`),
        baseline_count: stable.length,
        baseline_sha256: createHash("sha256").update(stable.join("\n")).digest("hex"),
      },
      tables,
    };
    await client.query("commit");
    return payload;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  }
}

function compareSnapshots(before, after) {
  const differences = [];
  const byTable = new Map(after.tables.map((row) => [row.table, row]));
  for (const row of before.tables) {
    const next = byTable.get(row.table);
    if (!next) {
      differences.push(`${row.table}: ausente no snapshot posterior`);
      continue;
    }
    if (!row.present && !next.present) continue;
    if (row.count !== next.count || row.md5 !== next.md5) {
      differences.push(
        `${row.table}: antes(count=${row.count}, md5=${row.md5}) != depois(count=${next.count}, md5=${next.md5})`,
      );
    }
  }
  if (before.ledger.baseline_sha256 !== after.ledger.baseline_sha256) {
    differences.push(
      `ledger baseline: ${before.ledger.baseline_sha256} != ${after.ledger.baseline_sha256}`,
    );
  }
  return differences;
}

function toMarkdown(before, after, differences) {
  const lines = [
    `# S0 — preservação de dados preexistentes`,
    ``,
    `- antes: ${before.label} (${before.collected_at})`,
    `- depois: ${after.label} (${after.collected_at})`,
    `- alvo: ${after.target}`,
    `- baseline do ledger: ${before.ledger.baseline_count} (sha ${before.ledger.baseline_sha256.slice(0, 12)}…)`,
    ``,
    `| Tabela | Antes (count) | Depois (count) | MD5 igual? |`,
    `|---|---|---|---|`,
  ];
  const byTable = new Map(after.tables.map((row) => [row.table, row]));
  for (const row of before.tables) {
    const next = byTable.get(row.table);
    lines.push(`| ${row.table} | ${row.count} | ${next?.count ?? "ausente"} | ${row.md5 === next?.md5 ? "sim" : "NÃO"} |`);
  }
  lines.push("", differences.length === 0 ? "Resultado: **sem drift**." : `Resultado: **${differences.length} drift(s)**.`);
  for (const diff of differences) lines.push(`- ${diff}`);
  return lines.join("\n") + "\n";
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv[0] === "--help" || argv[0] === "help" || argv.length === 0) {
    console.log(usage());
    return;
  }
  const { command, options } = parseArgs(argv);

  if (command === "compare") {
    if (!options.before || !options.after) fail("compare exige --before e --after");
    const before = JSON.parse(fs.readFileSync(options.before, "utf8"));
    const after = JSON.parse(fs.readFileSync(options.after, "utf8"));
    const differences = compareSnapshots(before, after);
    const markdown = toMarkdown(before, after, differences);
    if (options["out-md"]) fs.writeFileSync(options["out-md"], markdown, "utf8");
    process.stdout.write(markdown);
    if (differences.length > 0) process.exit(2);
    return;
  }

  if (command !== "snapshot") fail("comando deve ser snapshot|compare");
  if (!options.url || !options.out) fail("snapshot exige --url e --out");
  const target = assertTarget(options.url);
  const client = new Client({
    connectionString: target,
    ssl: false,
    connectionTimeoutMillis: 10_000,
    query_timeout: 15_000,
    statement_timeout: 15_000,
  });
  await client.connect();
  try {
    const payload = await snapshot(client, options.label);
    fs.writeFileSync(options.out, JSON.stringify(payload, null, 2) + "\n", "utf8");
    console.log(`snapshot OK: ${options.out} (${payload.tables.map((row) => `${row.table}=${row.count}`).join(", ")})`);
  } finally {
    await client.end().catch(() => undefined);
  }
}

main().catch((error) => {
  console.error(`ERRO: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
