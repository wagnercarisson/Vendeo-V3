#!/usr/bin/env node
// =============================================================================
// F57.2 — prova comparativa base × novo e concorrência/atomicidade.
// =============================================================================
// Uso:
//   node scripts/f57-2/comparative-proof.mjs snapshot --url <url> --out <json>
//   node scripts/f57-2/comparative-proof.mjs emit --url <url> --side new --out <json>
//        [--concurrency-out <json>]
//   node scripts/f57-2/comparative-proof.mjs compare --base <json> --new <json>
//        --s0-before <json> --s0-after-01 <json> --s0-after-02 <json> --out-md <md>
//   node scripts/f57-2/comparative-proof.mjs seed
//        (bloqueado por política: este script não semeia dados)
//
// Alvo único: 127.0.0.1:57782/postgres. Nada é criado/alterado fora das
// fixtures `f572proof-`, que são limpas ao final. A URL é mascarada.
// =============================================================================

import fs from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { Client } from "pg";
import {
  collect,
  createUser,
  hash as proofHash,
  cnpjNormalized,
} from "./onboarding-baseline.mjs";

const ALLOWED_HOSTS = new Set(["127.0.0.1", "localhost"]);
const ALLOWED_PORTS = new Set(["57782"]);
const ALLOWED_DB = "postgres";
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

function registerFixture(kind, id) {
  const manifest = process.env.F57_2_CLEANUP_MANIFEST;
  if (!manifest) return;
  fs.appendFileSync(manifest, `${JSON.stringify({ kind, id })}\n`, "utf8");
}

function usage() {
  return `Uso:
  node scripts/f57-2/comparative-proof.mjs snapshot --url <postgresql://...> --out <json>
  node scripts/f57-2/comparative-proof.mjs emit --url <postgresql://...> --side new --out <json>
       [--concurrency-out <json>]
  node scripts/f57-2/comparative-proof.mjs compare --base <json> --new <json>
       --s0-before <json> --s0-after-01 <json> --s0-after-02 <json> --out-md <md>
  node scripts/f57-2/comparative-proof.mjs seed
       (bloqueado: não há seed neste projeto)

Alvo permitido: 127.0.0.1:57782/${ALLOWED_DB} (homolog existente).
Os modos snapshot/emit leem ou escrevem somente fixtures f572proof- com cleanup.
O modo compare é offline e não se conecta ao banco.`;
}

function fail(message) {
  console.error(`ERRO: ${message}`);
  process.exit(1);
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

function assertTarget(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    fail("--url inválida");
  }
  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") fail("--url deve usar postgresql://");
  if (!ALLOWED_HOSTS.has(url.hostname) || !ALLOWED_PORTS.has(url.port) || url.pathname !== `/${ALLOWED_DB}`) {
    fail(`alvo recusado: esperado 127.0.0.1:57782/${ALLOWED_DB}`);
  }
  return { raw: rawUrl, masked: `postgresql://***@${url.hostname}:${url.port}${url.pathname}` };
}

async function openClient(url) {
  const client = new Client({
    connectionString: url,
    ssl: false,
    connectionTimeoutMillis: 10_000,
    query_timeout: 15_000,
    statement_timeout: 15_000,
  });
  await client.connect();
  return client;
}

async function tableFingerprint(client, table) {
  const exists = await client.query("select to_regclass($1) is not null as present", [`public.${table}`]);
  if (!exists.rows[0]?.present) return { table, present: false, count: 0, md5: null };
  const rows = await client.query(
    `select count(*)::int as count,
            md5(coalesce(string_agg(to_jsonb(t)::text, '|' order by to_jsonb(t)::text), '')) as md5
       from public.${table} t`,
  );
  return { table, present: true, count: Number(rows.rows[0].count), md5: rows.rows[0].md5 };
}

async function snapshot(urlMasked, label) {
  const client = await openClient(urlMasked.raw);
  try {
    const ledger = await client.query("select version, name from supabase_migrations.schema_migrations order by version");
    const stable = ledger.rows
      .filter((row) => !String(row.name ?? "").includes("f57_2_"))
      .map((row) => `${row.version}|${row.name ?? ""}`)
      .sort();
    const tables = [];
    for (const table of TABLES) tables.push(await tableFingerprint(client, table));
    return {
      collected_at: new Date().toISOString(),
      label,
      target: urlMasked.masked,
      ledger: {
        f57_2_versions: ledger.rows
          .filter((row) => String(row.name ?? "").includes("f57_2_"))
          .map((row) => `${row.version}|${row.name}`),
        baseline_count: stable.length,
        baseline_sha256: createHash("sha256").update(stable.join("\n")).digest("hex"),
      },
      tables,
    };
  } finally {
    await client.end();
  }
}

async function createDraftFixture(client, label, createdStores, createdUsers) {
  const userId = await createUser(client, `conc-${label}`, new Date().toISOString());
  createdUsers.push(userId);
  registerFixture("user", userId);
  const result = await client.query(
    `select public.create_store_draft(
       $1,$2,'outros','Cidade','SP',$1,'v1','v1','127.0.0.1','f572proof','#22C55E',
       null,null,null,null,null,null
     ) as value`,
    [userId, `f572proof-conc-${label}`],
  );
  const storeId = result.rows[0].value.store[0].id;
  createdStores.push(storeId);
  registerFixture("store", storeId);
  return { storeId, userId };
}

async function createEmptyStore(client, label, createdStores, createdUsers) {
  const userId = await createUser(client, `conc-${label}`, new Date().toISOString());
  createdUsers.push(userId);
  registerFixture("user", userId);
  const storeId = randomUUID();
  await client.query(
    "insert into public.stores (id,user_id,name,segment) values ($1,$2,$3,'outros')",
    [storeId, userId, `f572proof-conc-${label}`],
  );
  createdStores.push(storeId);
  registerFixture("store", storeId);
  return { storeId, userId };
}

async function cleanupFixtures(client, createdStores, createdUsers) {
  const failures = [];
  const attempt = async (table, id, sql, values) => {
    try {
      await client.query(sql, values);
    } catch (error) {
      failures.push({ table, id, error: error instanceof Error ? error.message : String(error) });
    }
  };

  for (const storeId of createdStores) {
    await attempt("store_market_settings", storeId, "delete from public.store_market_settings where store_id=$1", [storeId]);
    await attempt("store_billing_info", storeId, "delete from public.store_billing_info where store_id=$1", [storeId]);
    await attempt("legal_acceptances", storeId, "delete from public.legal_acceptances where store_id=$1", [storeId]);
    await attempt("stores", storeId, "delete from public.stores where id=$1", [storeId]);
  }
  for (const userId of createdUsers) {
    await attempt("user_preferences", userId, "delete from public.user_preferences where user_id=$1", [userId]);
    await attempt("admin_audit_log", userId, "delete from public.admin_audit_log where target_id=$1", [userId]);
    await attempt("auth.users", userId, "delete from auth.users where id=$1", [userId]);
  }

  const residue = await client.query(
    `select
       (select count(*)::int from public.stores where name like '%f572proof-%') as stores,
       (select count(*)::int from auth.users where email like '%f572proof-%') as users`,
  );
  const counts = residue.rows[0];
  if (failures.length > 0 || Number(counts.stores) !== 0 || Number(counts.users) !== 0) {
    throw new Error(
      JSON.stringify({
        failures,
        counts,
        remaining_stores: createdStores,
        remaining_users: createdUsers,
      }),
    );
  }
  createdStores.length = 0;
  createdUsers.length = 0;
}

async function settleTx(client, sql, params) {
  await client.query("begin");
  try {
    const result = await client.query(sql, params);
    await client.query("commit");
    return { status: "fulfilled", rows: result.rows };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    return { status: "rejected", error: error instanceof Error ? error.message : String(error) };
  }
}

async function concurrencyProof(url, outPath) {
  const client = await openClient(url.raw);
  const createdStores = [];
  const createdUsers = [];
  const blocks = {};
  try {
    // (a) linha existente: duas escritas da mesma versão.
    {
      const { storeId } = await createDraftFixture(client, "existing", createdStores, createdUsers);
      const c1 = await openClient(url.raw);
      const c2 = await openClient(url.raw);
      try {
        const a1 = settleTx(
          c1,
          `select public.write_store_market_settings($1,'BR','explicit','pt-BR','explicit','BRL','explicit','America/Sao_Paulo','explicit','BR','assumed_default',1,1)`,
          [storeId],
        );
        const a2 = settleTx(
          c2,
          `select public.write_store_market_settings($1,'BR','explicit','pt-BR','explicit','PYG','explicit','America/Sao_Paulo','explicit','BR','assumed_default',1,1)`,
          [storeId],
        );
        const settled = await Promise.all([a1, a2]);
        const version = await client.query(
          "select settings_version::int, default_currency from public.store_market_settings where store_id=$1",
          [storeId],
        );
        const rejected = settled.filter((entry) => entry.status === "rejected");
        blocks.a = {
          status: settled.filter((entry) => entry.status === "fulfilled").length === 1 && rejected.length === 1 && /settings_version_conflict/.test(rejected[0]?.error ?? "") ? "pass" : "fail",
          results: settled,
          version: version.rows[0],
        };
        if (blocks.a.status === "pass") {
          const current = version.rows[0].default_currency;
          const repeat = await settleTx(
            c1,
            `select public.write_store_market_settings($1,'BR','explicit','pt-BR','explicit',$2,'explicit','America/Asuncion','explicit','BR','assumed_default',1,$3)`,
            [storeId, current, version.rows[0].settings_version],
          );
          const after = await client.query(
            "select settings_version::int, default_currency, time_zone from public.store_market_settings where store_id=$1",
            [storeId],
          );
          blocks.a.repeat = {
            status: repeat.status,
            accepted_field_preserved: after.rows[0].default_currency === current,
            after: after.rows[0],
          };
          if (repeat.status !== "fulfilled" || !blocks.a.repeat.accepted_field_preserved || after.rows[0].settings_version !== 3) {
            blocks.a.status = "fail";
          }
        }
      } finally {
        await c1.end().catch(() => undefined);
        await c2.end().catch(() => undefined);
      }
    }

    // (b) linha ausente: loja e preferência de usuário com expected=0.
    {
      const { storeId } = await createEmptyStore(client, "absent", createdStores, createdUsers);
      const c1 = await openClient(url.raw);
      const c2 = await openClient(url.raw);
      try {
        const settled = await Promise.all([
          settleTx(
            c1,
            `select public.write_store_market_settings($1,'BR','legacy_br','pt-BR','legacy_br','BRL','legacy_br','America/Sao_Paulo','legacy_br','BR','legacy_br',1,0)`,
            [storeId],
          ),
          settleTx(
            c2,
            `select public.write_store_market_settings($1,'BR','legacy_br','pt-BR','legacy_br','BRL','legacy_br','America/Sao_Paulo','legacy_br','BR','legacy_br',1,0)`,
            [storeId],
          ),
        ]);
        const version = await client.query(
          "select settings_version::int from public.store_market_settings where store_id=$1",
          [storeId],
        );
        blocks.b = {
          status: settled.filter((entry) => entry.status === "fulfilled").length === 1 && settled.filter((entry) => entry.status === "rejected").length === 1 && /settings_version_conflict/.test(settled.find((entry) => entry.status === "rejected")?.error ?? "") && version.rows[0]?.settings_version === 1 ? "pass" : "fail",
          results: settled,
          version: version.rows[0],
        };
      } finally {
        await c1.end().catch(() => undefined);
        await c2.end().catch(() => undefined);
      }
    }

    // (c) fiscal × PATCH nas duas ordens.
    {
      const first = await createDraftFixture(client, "fiscal-first", createdStores, createdUsers);
      await client.query(
        `select public.write_store_market_settings($1,'BR','explicit','pt-BR','explicit','BRL','explicit','America/Sao_Paulo','explicit','BR','assumed_default',1,1)`,
        [first.storeId],
      );
      await client.query(
        `select public.update_store_cnpj($1,$2,$3,'Empresa','Fantasia',null,'unverified',null,null,null,false)`,
        [first.storeId, cnpjNormalized("conc-first"), proofHash("conc-first")],
      );
      const firstRow = await client.query(
        "select settings_version::int, default_campaign_market_source from public.store_market_settings where store_id=$1",
        [first.storeId],
      );

      const second = await createDraftFixture(client, "patch-first", createdStores, createdUsers);
      await client.query(
        `select public.update_store_cnpj($1,$2,$3,'Empresa','Fantasia',null,'unverified',null,null,null,false)`,
        [second.storeId, cnpjNormalized("conc-second"), proofHash("conc-second")],
      );
      const stale = await settleTx(
        client,
        `select public.write_store_market_settings($1,'PY','explicit','es-PY','explicit','PYG','explicit','America/Asuncion','explicit','BR','assumed_default',1,1)`,
        [second.storeId],
      );
      const secondRow = await client.query(
        "select settings_version::int, country_source from public.store_market_settings where store_id=$1",
        [second.storeId],
      );
      blocks.c = {
        status:
          firstRow.rows[0]?.settings_version === 3 &&
          firstRow.rows[0]?.default_campaign_market_source === "explicit" &&
          secondRow.rows[0]?.settings_version === 2 &&
          secondRow.rows[0]?.country_source === "fiscal_confirmation" &&
          stale.status === "rejected" &&
          /settings_version_conflict/.test(stale.error ?? "")
            ? "pass"
            : "fail",
        patch_then_fiscal: { version: firstRow.rows[0] },
        fiscal_then_stale_patch: { result: stale, version: secondRow.rows[0] },
      };
    }

    // (d) atomicidade: criação + erro forçado antes do commit.
    {
      await client.query("begin");
      let storeId;
      try {
        const userId = await createUser(client, "atomic", new Date().toISOString());
        createdUsers.push(userId);
        const result = await client.query(
          `select public.create_store_draft(
             $1,$2,'outros','Cidade','SP',$1,'v1','v1','127.0.0.1','f572proof','#22C55E',
             null,null,null,null,null,null
           ) as value`,
          [userId, "f572proof-conc-atomic"],
        );
        storeId = result.rows[0].value.store[0].id;
        throw new Error("atomicidade forçada");
      } catch (error) {
        await client.query("rollback");
        if (!(error instanceof Error) || error.message !== "atomicidade forçada") throw error;
        const counts = await client.query(
          `select
             (select count(*)::int from public.stores where id=$1) as stores,
             (select count(*)::int from public.legal_acceptances where store_id=$1) as legal,
             (select count(*)::int from public.store_market_settings where store_id=$1) as settings`,
          [storeId ?? "00000000-0000-0000-0000-000000000000"],
        );
        const row = counts.rows[0];
        blocks.d = {
          status:
            error.message === "atomicidade forçada" &&
            Number(row.stores) === 0 &&
            Number(row.legal) === 0 &&
            Number(row.settings) === 0
              ? "pass"
              : "fail",
          forced_error: error.message,
          counts: row,
        };
      }
    }
  } finally {
    try {
      await cleanupFixtures(client, createdStores, createdUsers);
    } finally {
      await client.end().catch(() => undefined);
    }
  }
  const failures = ["a", "b", "c", "d"].filter((key) => blocks[key]?.status !== "pass");
  fs.writeFileSync(
    outPath,
    `${JSON.stringify({ side: "new", generated_at: new Date().toISOString(), blocks, failures }, null, 2)}\n`,
    "utf8",
  );
  if (failures.length > 0) throw new Error(`blocos de concorrência/atomicidade falharam: ${failures.join(",")}`);
  return blocks;
}

function stripSettings(fingerprint) {
  const clone = JSON.parse(JSON.stringify(fingerprint));
  delete clone.store_market_settings;
  return clone;
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stable(value[key])]),
    );
  }
  return value;
}

const REQUIRED_FINGERPRINT_KEYS = [
  "store",
  "credit_transactions",
  "credit_balances",
  "freemium_entitlements",
  "legal_acceptances",
  "store_billing_info",
  "campaigns_by_status",
  "campaigns_ready",
  "admin_audit_log",
  "store_market_settings",
];
const REQUIRED_SCENARIOS = ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9"];

function validateFingerprints(document, label) {
  const fingerprints = document.fingerprints;
  if (!fingerprints || typeof fingerprints !== "object" || Array.isArray(fingerprints)) {
    fail(`${label}: fingerprints ausente ou inválido`);
  }
  const keys = Object.keys(fingerprints).sort();
  if (JSON.stringify(keys) !== JSON.stringify(REQUIRED_SCENARIOS)) {
    fail(`${label}: fingerprints incompletos (${keys.join(",")})`);
  }
  for (const scenario of REQUIRED_SCENARIOS) {
    const fingerprint = fingerprints[scenario];
    if (!fingerprint || typeof fingerprint !== "object" || Array.isArray(fingerprint)) {
      fail(`${label}: fingerprint ${scenario} inválido`);
    }
    for (const required of REQUIRED_FINGERPRINT_KEYS) {
      if (!(required in fingerprint)) fail(`${label}: fingerprint ${scenario} sem ${required}`);
    }
    if (!Array.isArray(fingerprint.credit_transactions)) fail(`${label}: ${scenario}.credit_transactions inválido`);
    if (!Array.isArray(fingerprint.freemium_entitlements)) fail(`${label}: ${scenario}.freemium_entitlements inválido`);
    if (!Array.isArray(fingerprint.legal_acceptances)) fail(`${label}: ${scenario}.legal_acceptances inválido`);
  }
  const scenarios = document.scenarios;
  if (!scenarios || typeof scenarios !== "object" || Array.isArray(scenarios)) {
    fail(`${label}: scenarios ausente ou inválido`);
  }
  const scenarioKeys = Object.keys(scenarios).sort();
  if (JSON.stringify(scenarioKeys) !== JSON.stringify(REQUIRED_SCENARIOS)) {
    fail(`${label}: scenarios incompletos (${scenarioKeys.join(",")})`);
  }
}

function normalizeS0(file) {
  const payload = JSON.parse(fs.readFileSync(file, "utf8"));
  const tables = Array.isArray(payload.tables) ? payload.tables : [];
  if (tables.length !== TABLES.length) {
    fail(`${file}: S0 deve conter exatamente as oito tabelas`);
  }
  const seen = new Set();
  const byName = {};
  for (const row of tables) {
    if (!row || typeof row.table !== "string") fail(`${file}: linha S0 sem nome de tabela`);
    if (seen.has(row.table)) fail(`${file}: tabela duplicada em S0: ${row.table}`);
    seen.add(row.table);
    if (row.present !== true) fail(`${file}: tabela obrigatória ausente em S0: ${row.table}`);
    if (typeof row.count !== "number" || !Number.isSafeInteger(row.count) || row.count < 0) {
      fail(`${file}: count inválido em ${row.table}`);
    }
    const digest = row.md5 ?? row.sha256;
    if (typeof digest !== "string" || !/^[0-9a-f]{32}$|^[0-9a-f]{64}$/.test(digest)) {
      fail(`${file}: hash inválido em ${row.table}`);
    }
    byName[row.table] = row;
  }
  const expected = [...TABLES].sort();
  const keys = Object.keys(byName).sort();
  if (JSON.stringify(keys) !== JSON.stringify(expected)) {
    fail(`${file}: S0 deve conter exatamente as oito tabelas (${keys.join(",")})`);
  }
  const normalized = {};
  for (const table of TABLES) {
    const row = byName[table];
    normalized[table] = { count: row.count, md5: row.md5 ?? row.sha256 };
  }
  return normalized;
}

export function compare(baseFile, newFile, s0Before, s0After01, s0After02, outMd) {
  const files = [baseFile, newFile, s0Before, s0After01, s0After02];
  for (const file of files) if (!fs.existsSync(file)) fail(`arquivo ausente: ${file}`);

  const base = JSON.parse(fs.readFileSync(baseFile, "utf8"));
  const next = JSON.parse(fs.readFileSync(newFile, "utf8"));
  if (base.side !== "base") fail(`base inválido: side=${base.side ?? "ausente"}`);
  if (next.side !== "new") fail(`novo inválido: side=${next.side ?? "ausente"}`);
  if (typeof base.table_present !== "boolean" || typeof next.table_present !== "boolean") {
    fail("documento sem table_present booleano");
  }
  if (
    typeof base.counts_store_market_settings !== "number" ||
    !Number.isSafeInteger(base.counts_store_market_settings) ||
    base.counts_store_market_settings < 0 ||
    typeof next.counts_store_market_settings !== "number" ||
    !Number.isSafeInteger(next.counts_store_market_settings) ||
    next.counts_store_market_settings < 0
  ) {
    fail("documento sem counts_store_market_settings inteiro válido");
  }
  validateFingerprints(base, "base");
  validateFingerprints(next, "novo");

  const s0a = normalizeS0(s0Before);
  const s0b = normalizeS0(s0After01);
  const s0c = normalizeS0(s0After02);
  const s0Equal = JSON.stringify(s0a) === JSON.stringify(s0b) && JSON.stringify(s0b) === JSON.stringify(s0c);
  if (!s0Equal) fail("S0 divergiu entre os três snapshots");

  const baseKeys = Object.keys(base.fingerprints).sort();
  const nextKeys = Object.keys(next.fingerprints).sort();
  if (JSON.stringify(baseKeys) !== JSON.stringify(nextKeys)) fail("conjunto de cenários difere entre base e novo");

  const rows = [];
  let mismatch = false;
  for (const key of baseKeys) {
    const same = JSON.stringify(stable(stripSettings(base.fingerprints[key]))) === JSON.stringify(stable(stripSettings(next.fingerprints[key])));
    if (!same) mismatch = true;
    rows.push(`| ${key} | ${same ? "igual" : "DIVERGIU"} |`);
  }
  const scenariosEqual = JSON.stringify(stable(base.scenarios)) === JSON.stringify(stable(next.scenarios));
  if (!scenariosEqual) mismatch = true;
  const md = [
    "# F57.2 — prova comparativa base × novo",
    "",
    `- base: ${baseFile}`,
    `- novo: ${newFile}`,
    `- S0: ${s0Equal ? "sem drift" : "com drift"}`,
    "- store_market_settings excluída da comparação de fingerprints (linha nova da F57.2).",
    "",
    "## S0",
    "",
    "| Tabela | before | after-01 | after-02 |",
    "|---|---|---|---|",
    ...Object.keys(s0a).map((table) => `| ${table} | ${s0a[table].count}/${s0a[table].md5} | ${s0b[table].count}/${s0b[table].md5} | ${s0c[table].count}/${s0c[table].md5} |`),
    "",
    "## Cenários",
    "",
    "| Cenário | Fingerprint (sem configurações) |",
    "|---|---|",
    ...rows,
    "",
    `Resultados dos cenários: **${scenariosEqual ? "iguais" : "DIVERGIRAM"}**.`,
    "",
    "S8: `legacy_pre_f32_onboarding_consumed`, sem grant.",
    "S9: demo condicional.",
    "Linhas pré-existentes são preservadas; fixtures usam o prefixo `f572proof-`.",
    "",
    `Resultado: **${mismatch ? "DIVERGENTE" : "sem divergência"}**.`,
    "",
  ].join("\n");
  fs.writeFileSync(outMd, md, "utf8");
  if (mismatch) process.exitCode = 1;
  return { ok: !mismatch, md };
}

async function main() {
  const { command, options } = parseArgs(process.argv.slice(2));
  if (command === "seed") fail("seed bloqueado: este script não semeia dados");
  if (command === "snapshot") {
    if (!options.url || !options.out) fail("snapshot exige --url e --out");
    const target = assertTarget(options.url);
    const payload = await snapshot(target, options.label ?? "snapshot");
    fs.writeFileSync(options.out, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    console.log(`snapshot gravado em ${options.out} (${target.masked})`);
    return;
  }
  if (command === "emit") {
    if (!options.url || !options.out) fail("emit exige --url e --out");
    const target = assertTarget(options.url);
    const side = options.side ?? "new";
    if (!["base", "new"].includes(side)) fail("--side deve ser base ou new");
    const client = await openClient(target.raw);
    let payload;
    try {
      payload = await collect(client, side);
    } finally {
      await client.end();
    }
    payload.label = options.label ?? side;
    payload.target = target.masked;
    fs.writeFileSync(options.out, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    if (options["concurrency-out"]) {
      if (side !== "new") fail("--concurrency-out só é permitido com --side new");
      await concurrencyProof(target, options["concurrency-out"]);
    }
    console.log(`emit (${side}) gravado em ${options.out}`);
    return;
  }
  if (command === "compare") {
    for (const key of ["base", "new", "s0-before", "s0-after-01", "s0-after-02", "out-md"]) {
      if (!options[key]) fail(`compare exige --${key}`);
    }
    compare(options.base, options.new, options["s0-before"], options["s0-after-01"], options["s0-after-02"], options["out-md"]);
    console.log(`comparação gravada em ${options["out-md"]}`);
    return;
  }
  fail(`comando desconhecido: ${command}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
}
