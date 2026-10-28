#!/usr/bin/env node
// =============================================================================
// F57.2 — produtor do baseline S1–S9 no homolog existente.
// =============================================================================
// Uso:
//   node scripts/f57-2/onboarding-baseline.mjs emit --url <url> --out <json>
//        [--side base|new] [--label <texto>]
//
// Cada cenário roda em transação própria com ROLLBACK ao final. Nada é
// semeado, commitado ou removido. O JSON é comparável entre o lado `base`
// (antes da segunda migration) e `new` (depois dela).
//
// Não imprime credenciais; a URL é mascarada na saída.
// =============================================================================

import fs from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { Client } from "pg";

const ALLOWED_HOSTS = new Set(["127.0.0.1", "localhost"]);
const ALLOWED_PORTS = new Set(["57782"]);
const ALLOWED_DB = "postgres";

function usage() {
  return `Uso:
  node scripts/f57-2/onboarding-baseline.mjs emit --url <postgresql://...> --out <json>
       [--side base|new] [--label <texto>]

Alvo permitido: 127.0.0.1:57782/${ALLOWED_DB} (homolog existente).
Cenários S1–S9 em transação com rollback; nenhum dado é persistido.`;
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

function hash(label) {
  return createHash("sha256").update(label).digest("hex");
}

function cnpjNormalized(label) {
  // Formato canônico F50.3: 12 alfanuméricos + 2 dígitos.
  const hex = hash(`f572proof-cnpj-${label}`).toUpperCase();
  return `${hex.slice(0, 12)}90`;
}

function scenarioName(id) {
  return `f572proof-${id}`;
}

function userEmail(id) {
  return `f572proof-${id}@local.test`;
}

async function createUser(client, id, createdAt) {
  const userId = randomUUID();
  await client.query(
    "insert into auth.users (id, aud, role, email, created_at, updated_at) values ($1,'authenticated','authenticated',$2,$3,$3)",
    [userId, userEmail(id), createdAt ?? new Date().toISOString()],
  );
  return userId;
}

async function createDraft(client) {
  const userId = await createUser(client, "draft", new Date().toISOString());
  const result = await client.query(
    `select public.create_store_draft(
       $1,$2,'outros','Cidade','SP',$1,'v1','v1','127.0.0.1','f572proof','#22C55E',
       null,null,null,null,null,null
     ) as value`,
    [userId, scenarioName("draft")],
  );
  return { storeId: result.rows[0].value.store[0].id, userId, value: result.rows[0].value };
}

async function createWithCnpj(client, id, status, demo, createdAt) {
  const userId = await createUser(client, id, createdAt);
  const normalized = cnpjNormalized(id);
  const rootHash = hash(`f572proof-root-${id}`);
  const result = await client.query(
    `select public.create_store_with_cnpj(
       $1,$2,$3,$4,'outros',$3,'v1','v1','127.0.0.1','f572proof',
       'Cidade','SP','#22C55E',null,null,null,null,null,null,
       null,'Empresa','Fantasia',$5,null,null,null,$6
     ) as value`,
    [normalized, rootHash, userId, scenarioName(id), status, demo],
  );
  return { storeId: result.rows[0].value.store[0].id, userId, rootHash, value: result.rows[0].value };
}

async function launchAt(client) {
  const result = await client.query(
    "select launch_at from public.trial_offer_settings where offer_key='trial_28d_v1'",
  );
  return result.rows[0]?.launch_at ?? null;
}

function legacyCreatedAt(launch) {
  if (!launch) return new Date().toISOString();
  return new Date(new Date(launch).getTime() - 86_400_000).toISOString();
}

async function tablePresent(client, name) {
  const result = await client.query("select to_regclass($1) is not null as present", [`public.${name}`]);
  return result.rows[0]?.present === true;
}

async function fingerprint(client, storeId, settingsPresent) {
  const store = await client.query(
    `select name, segment, verification_status,
            cnpj_normalized ~ '^[A-Z0-9]{12}[0-9]{2}$' as cnpj_valid,
            razao_social is not null as razao_present,
            coalesce(cnpj_root_hash, '') <> '' as root_present
       from public.stores where id=$1`,
    [storeId],
  );
  const transactions = await client.query(
    `select type, amount, balance_before, balance_after
       from public.credit_transactions where store_id=$1
      order by type, amount, balance_before, balance_after`,
    [storeId],
  );
  const balances = await client.query(
    `select balance, demo_balance, bonus_balance, purchased_balance,
            (demo_expires_at is not null) as demo_expiry_present,
            (origin_demo_grant_tx_id is not null) as origin_present
       from public.credit_balances where store_id=$1`,
    [storeId],
  );
  const entitlements = await client.query(
    `select benefit_type, reason, cycle, (grant_transaction_id is not null) as grant_present
       from public.freemium_entitlements where store_id=$1
      order by benefit_type, coalesce(cycle, ''), coalesce(reason, '')`,
    [storeId],
  );
  const legal = await client.query(
    `select document_type, document_version
       from public.legal_acceptances where store_id=$1 order by document_type`,
    [storeId],
  );
  const billing = await client.query(
    `select billing_address_country, billing_address_city
       from public.store_billing_info where store_id=$1`,
    [storeId],
  );
  const campaigns = await client.query(
    `select status, count(*)::int as count
       from public.campaigns where store_id=$1
      group by status order by status`,
    [storeId],
  );
  const audit = await client.query(
    `select action, target_type
       from public.admin_audit_log
      where metadata->>'storeName' = (select name from public.stores where id=$1)
      order by action, target_type`,
    [storeId],
  );
  const settings = settingsPresent
    ? (
        await client.query(
          `select country_code, country_source,
                  default_campaign_market, default_campaign_market_source,
                  default_content_locale, default_content_locale_source,
                  default_currency, default_currency_source,
                  time_zone, time_zone_source, context_version, settings_version
             from public.store_market_settings where store_id=$1`,
          [storeId],
        )
      ).rows[0] ?? null
    : null;

  return {
    store: store.rows[0] ?? null,
    credit_transactions: transactions.rows,
    credit_balances: balances.rows,
    freemium_entitlements: entitlements.rows,
    legal_acceptances: legal.rows,
    store_billing_info: billing.rows[0] ?? null,
    campaigns_by_status: campaigns.rows,
    campaigns_ready: Number(campaigns.rows.find((row) => row.status === "ready")?.count ?? 0),
    admin_audit_log: audit.rows,
    store_market_settings: settings,
  };
}

async function inScenario(client, id, fn) {
  await client.query("begin");
  try {
    const result = await fn();
    await client.query("rollback");
    return { id, status: "ok", ...result };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw new Error(`${id}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function runScenario(client, id, settingsPresent, launch, fn) {
  return inScenario(client, id, async () => {
    const fixture = await fn(launch);
    const fingerprintValue = await fingerprint(client, fixture.storeId, settingsPresent);
    return {
      result: fixture.result ?? null,
      fingerprint: fingerprintValue,
    };
  });
}

async function collect(client, side) {
  const settingsPresent = await tablePresent(client, "store_market_settings");
  const launch = await launchAt(client);
  const ledger = await client.query("select version, name from supabase_migrations.schema_migrations order by version");
  const stable = ledger.rows
    .filter((row) => !String(row.name ?? "").includes("f57_2_"))
    .map((row) => `${row.version}|${row.name ?? ""}`)
    .sort();

  const scenarios = {};
  const fingerprints = {};

  const record = async (id, runner) => {
    const outcome = await runner();
    scenarios[id] = outcome.result;
    fingerprints[id] = outcome.fingerprint;
  };

  await record("S1", () =>
    runScenario(client, "S1", settingsPresent, launch, async () => {
      const draft = await createDraft(client);
      return { storeId: draft.storeId, result: { onboardingGranted: draft.value.onboardingGranted } };
    }),
  );

  await record("S2", () =>
    runScenario(client, "S2", settingsPresent, launch, async () => {
      const fixture = await createWithCnpj(client, "S2", "unverified", false, new Date().toISOString());
      return { storeId: fixture.storeId, result: { onboardingGranted: fixture.value.onboardingGranted } };
    }),
  );

  await record("S3", () =>
    runScenario(client, "S3", settingsPresent, launch, async (launchAtValue) => {
      const fixture = await createWithCnpj(client, "S3", "approved", true, legacyCreatedAt(launchAtValue));
      return { storeId: fixture.storeId, result: { onboardingGranted: fixture.value.onboardingGranted } };
    }),
  );

  await record("S4", () =>
    runScenario(client, "S4", settingsPresent, launch, async () => {
      const fixture = await createWithCnpj(client, "S4", "approved", false, new Date().toISOString());
      return { storeId: fixture.storeId, result: { onboardingGranted: fixture.value.onboardingGranted } };
    }),
  );

  await record("S5", () =>
    runScenario(client, "S5", settingsPresent, launch, async () => {
      const userId = await createUser(client, "S5", new Date().toISOString());
      const result = await client.query(
        "select public.create_store_with_initial_grant($1,'outros',$2) as value",
        [scenarioName("S5"), userId],
      );
      return { storeId: result.rows[0].value.id, result: { balance: result.rows[0].value.balance } };
    }),
  );

  await record("S6", () =>
    runScenario(client, "S6", settingsPresent, launch, async () => {
      const adminId = await createUser(client, "S6-admin", new Date().toISOString());
      const targetId = await createUser(client, "S6-target", new Date().toISOString());
      const result = await client.query(
        "select public.admin_create_store_for_user($1,$2,$3,'outros') as value",
        [adminId, targetId, scenarioName("S6")],
      );
      return { storeId: result.rows[0].value.id, result: { balance: result.rows[0].value.balance } };
    }),
  );

  await record("S8", () =>
    runScenario(client, "S8", settingsPresent, launch, async (launchAtValue) => {
      const userId = await createUser(client, "S8", legacyCreatedAt(launchAtValue));
      const draft = await client.query(
        `select public.create_store_draft(
           $1,$2,'outros','Cidade','SP',$1,'v1','v1','127.0.0.1','f572proof','#22C55E',
           null,null,null,null,null,null
         ) as value`,
        [userId, scenarioName("S8")],
      );
      const storeId = draft.rows[0].value.store[0].id;
      await client.query(
        "insert into public.credit_transactions (store_id, type, amount, balance_before, balance_after) values ($1,'bonus_onboarding',5,0,5)",
        [storeId],
      );
      const result = await client.query(
        `select public.update_store_cnpj($1,$2,$3,'Empresa','Fantasia',null,'approved',null,null,null,true) as value`,
        [storeId, cnpjNormalized("S8-update"), hash("S8-update")],
      );
      return { storeId, result: { onboardingGranted: result.rows[0].value.onboardingGranted } };
    }),
  );

  await record("S9", () =>
    runScenario(client, "S9", settingsPresent, launch, async (launchAtValue) => {
      const userId = await createUser(client, "S9", legacyCreatedAt(launchAtValue));
      const draft = await client.query(
        `select public.create_store_draft(
           $1,$2,'outros','Cidade','SP',$1,'v1','v1','127.0.0.1','f572proof','#22C55E',
           null,null,null,null,null,null
         ) as value`,
        [userId, scenarioName("S9")],
      );
      const storeId = draft.rows[0].value.store[0].id;
      const result = await client.query(
        `select public.update_store_cnpj($1,$2,$3,'Empresa','Fantasia',null,'approved',null,null,null,true) as value`,
        [storeId, cnpjNormalized("S9-update"), hash("S9-update")],
      );
      return { storeId, result: { onboardingGranted: result.rows[0].value.onboardingGranted } };
    }),
  );

  await record("S7", () =>
    runScenario(client, "S7", settingsPresent, launch, async () => {
      const userId = await createUser(client, "S7", new Date().toISOString());
      const draft = await client.query(
        `select public.create_store_draft(
           $1,$2,'outros','Cidade','SP',$1,'v1','v1','127.0.0.1','f572proof','#22C55E',
           null,null,null,null,null,null
         ) as value`,
        [userId, scenarioName("S7")],
      );
      const storeId = draft.rows[0].value.store[0].id;
      if (!settingsPresent) {
        throw new Error("S7 exige store_market_settings (migration 01 aplicada)");
      }
      // Materializa a mesma linha nos dois lados ANTES do override explícito.
      await client.query("select public.ensure_store_market_settings($1,'BR','assumed_default')", [storeId]);
      const override = await client.query(
        "update public.store_market_settings set default_currency='PYG', default_currency_source='explicit' where store_id=$1",
        [storeId],
      );
      if (override.rowCount !== 1) {
        throw new Error(`S7: override de moeda afetou ${override.rowCount ?? 0} linhas (esperado 1)`);
      }
      const result = await client.query(
        `select public.update_store_cnpj($1,$2,$3,'Empresa','Fantasia',null,'unverified',null,null,null,false) as value`,
        [storeId, cnpjNormalized("S7-update"), hash("S7-update")],
      );
      return {
        storeId,
        result: {
          onboardingGranted: result.rows[0].value.onboardingGranted,
          settings_present: true,
        },
      };
    }),
  );

  const counts = settingsPresent
    ? (await client.query("select count(*)::int as count from public.store_market_settings")).rows[0].count
    : 0;

  return {
    collected_at: new Date().toISOString(),
    side,
    target: "127.0.0.1:57782/postgres",
    table_present: settingsPresent,
    counts_store_market_settings: Number(counts),
    ledger: {
      baseline_count: stable.length,
      baseline_sha256: createHash("sha256").update(stable.join("\n")).digest("hex"),
    },
    scenarios,
    fingerprints,
  };
}

async function main() {
  const { command, options } = parseArgs(process.argv.slice(2));
  if (command !== "emit") fail(`comando desconhecido: ${command}`);
  if (!options.url) fail("--url é obrigatório");
  if (!options.out) fail("--out é obrigatório");
  const target = assertTarget(options.url);
  const side = options.side ?? "unknown";
  if (!["base", "new", "unknown"].includes(side)) fail("--side deve ser base, new ou unknown");

  const client = new Client({ connectionString: target.raw, ssl: false });
  await client.connect();
  try {
    const payload = await collect(client, side);
    payload.label = options.label ?? "unlabeled";
    payload.target = target.masked;
    fs.writeFileSync(options.out, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    console.log(`S1–S9 (${side}) gravados em ${options.out}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
