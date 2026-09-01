// 39-monthly-grant-por-raiz-verification.mjs
// -----------------------------------------------------------------------------
// Verificação SQL real da semântica POR RAIZ do grant_monthly_credits
// (alinhamento quick 260815-i9a — migration 20260815000001).
//
// DIFERENTE do 24-credit-verification.mjs (supabase-js via service role, só
// leitura de stores/credit_balances), este script mexe em auth.users e faz
// setup/cleanup transacional → driver `pg` com conexão SQL direta via
// DATABASE_URL (decisão r2-4). supabase-js não é adequado para operações
// transacionais diretas em auth.users/stores com cleanup em ordem de FK.
//
// Regra r1-7 — dados de teste: stores.user_id é UNIQUE (20260706000001:14) e há
// FK para auth.users(id) → criamos UM usuário distinto em auth.users por loja de
// teste (id gen_random_uuid() + email único), nunca reutilizando user_id.
// Cleanup em ordem de FK:
//   credit_transactions → freemium_entitlements → credit_balances → stores → auth.users
//
// Estratégia de asserts: contadores com DELTA entre baseline e pós-setup (o RPC
// agrega raízes reais do banco; o delta isola a contribuição da raiz de teste,
// assumindo ausência de cron concorrente entre as duas chamadas) + asserts SQL
// scoped (entitlement/transação/saldo da raiz de teste), que são determinísticos.
//
// USO (manual, pós-execution — NUNCA contra produção):
//   node scripts/verify/39-monthly-grant-por-raiz-verification.mjs
// Requer DATABASE_URL (connection string) em .env.local ou no ambiente.
import pg from "pg";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../../.env.local");
const envContent = readFileSync(envPath, "utf-8");
const getEnv = (key) => {
  const m = envContent.match(new RegExp(`${key}=(.+)`));
  return m ? m[1].trim() : null;
};

const databaseUrl =
  process.env.DATABASE_URL ||
  getEnv("DATABASE_URL") ||
  getEnv("POSTGRES_URL") ||
  getEnv("SUPABASE_DB_URL");
if (!databaseUrl) {
  console.error("Missing DATABASE_URL in .env.local or environment");
  console.error(
    "Adicione DATABASE_URL=<connection string Supabase> (ex.: postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres) antes de executar.",
  );
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });

const results = { pass: 0, fail: 0, tests: [] };
const assert = (name, ok, detail) => {
  ok
    ? (results.pass++, console.log(`  ✓ ${name}`))
    : (results.fail++, console.log(`  ✗ ${name} — ${detail}`));
  results.tests.push({ name, ok, detail });
};

// ── Helpers SQL ─────────────────────────────────────────────────────────────

const q = async (text, params) => (await pool.query(text, params)).rows;

const rpcCall = async (refDate, amount = 5, cap = 10, minAge = 0) => {
  const rows = await q(
    "SELECT public.grant_monthly_credits($1, $2, $3, $4::date) AS result",
    [amount, cap, minAge, refDate],
  );
  return rows[0].result;
};

const createAuthUser = async (email) => {
  const rows = await q(
    `INSERT INTO auth.users
       (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        confirmation_token, recovery_token, email_change_token_new, email_change,
        created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
        is_super_admin, is_sso_user, is_anonymous)
     VALUES
       ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
        $1, '', now(), '', '', '', '', now(), now(),
        '{}'::jsonb, '{}'::jsonb, false, false, false)
     RETURNING id`,
    [email],
  );
  return rows[0].id;
};

// created_at em TIMESTAMPTZ com offset -03 (dia civil BR preservado via
// AT TIME ZONE 'America/Sao_Paulo' dentro do RPC).
const createStore = async ({ name, userId, cnpjNormalized, rootHash, createdAt }) => {
  const rows = await q(
    `INSERT INTO public.stores
       (name, segment, user_id, cnpj_normalized, cnpj_root_hash, is_test_store, created_at)
     VALUES
       ($1, 'outros', $2, $3, $4, false, $5)
     RETURNING id`,
    [name, userId, cnpjNormalized, rootHash, createdAt],
  );
  return rows[0].id;
};

// Histórico freemium NO NÍVEL DA RAIZ: entitlement onboarding para o root_hash
// (alternativa a transações bonus_onboarding/bonus_monthly de qualquer loja).
const grantOnboarding = async (rootHash, storeId) => {
  await q(
    `INSERT INTO public.freemium_entitlements (store_id, root_hash, benefit_type)
     VALUES ($1, $2, 'onboarding')
     ON CONFLICT (root_hash, benefit_type, (COALESCE(cycle, '_nostring_'))) DO NOTHING`,
    [storeId, rootHash],
  );
};

const setBonus = async (storeId, bonus) => {
  await q(
    `INSERT INTO public.credit_balances (store_id, balance, bonus_balance, purchased_balance)
     VALUES ($1, $2, $2, 0)
     ON CONFLICT (store_id) DO UPDATE SET bonus_balance = EXCLUDED.bonus_balance`,
    [storeId, bonus],
  );
};

const getBonus = async (storeId) => {
  const rows = await q(
    "SELECT bonus_balance FROM public.credit_balances WHERE store_id = $1",
    [storeId],
  );
  return rows[0]?.bonus_balance ?? 0;
};

const getBalances = async (storeId) => {
  const rows = await q(
    "SELECT bonus_balance, purchased_balance FROM public.credit_balances WHERE store_id = $1",
    [storeId],
  );
  return rows[0] ?? { bonus_balance: 0, purchased_balance: 0 };
};

const countMonthlyTx = async (storeId) => {
  const rows = await q(
    "SELECT COUNT(*)::int AS cnt FROM public.credit_transactions WHERE store_id = $1 AND type = 'bonus_monthly'",
    [storeId],
  );
  return rows[0].cnt;
};

const countMonthlyEntitlements = async (rootHash, cycle) => {
  const rows = await q(
    "SELECT COUNT(*)::int AS cnt FROM public.freemium_entitlements WHERE root_hash = $1 AND benefit_type = 'monthly' AND COALESCE(cycle, '_nostring_') = $2",
    [rootHash, cycle],
  );
  return rows[0].cnt;
};

const monthlyTxStores = async (rootHash) => {
  const rows = await q(
    `SELECT ct.store_id
     FROM public.credit_transactions ct
     JOIN public.stores s ON s.id = ct.store_id
     WHERE s.cnpj_root_hash = $1 AND ct.type = 'bonus_monthly'`,
    [rootHash],
  );
  return rows.map((r) => r.store_id);
};

// Cleanup em ordem de FK (r1-7): transações → entitlements → balances → stores → users.
const cleanup = async ({ storeIds, rootHashes, userIds }) => {
  if (storeIds.length) {
    await q("DELETE FROM public.credit_transactions WHERE store_id = ANY($1::uuid[])", [storeIds]);
  }
  if (rootHashes.length) {
    await q("DELETE FROM public.freemium_entitlements WHERE root_hash = ANY($1::text[])", [rootHashes]);
  }
  if (storeIds.length) {
    await q("DELETE FROM public.credit_balances WHERE store_id = ANY($1::uuid[])", [storeIds]);
    await q("DELETE FROM public.stores WHERE id = ANY($1::uuid[])", [storeIds]);
  }
  if (userIds.length) {
    await q("DELETE FROM auth.users WHERE id = ANY($1::uuid[])", [userIds]);
  }
};

const delta = (before, after, key) => (after[key] ?? 0) - (before[key] ?? 0);

let seq = 0;
const unique = (prefix) => `${prefix}-${Date.now().toString(36)}-${(seq++).toString(36)}`;
const cnpj = (branch) => `39053347${branch}0${Math.floor(1000 + Math.random() * 9000)}`;

// ── Cenários ────────────────────────────────────────────────────────────────

async function run() {
  console.log(`\n🔬 39-monthly-grant-por-raiz SQL Verification (por raiz + limiar)\n`);

  // ── C1: day-31 → mês curto ────────────────────────────────────────────────
  console.log("🧪 C1: aniversário dia 31 → clamp no último dia do mês curto (2026-04)");
  let c1 = { storeIds: [], rootHashes: [], userIds: [] };
  try {
    const tag = unique("c1");
    const before15 = await rpcCall("2026-04-15");
    const before30 = await rpcCall("2026-04-30");

    const u1 = await createAuthUser(`${tag}-a@verify.local`);
    const store1 = await createStore({
      name: "Verify C1 Loja",
      userId: u1,
      cnpjNormalized: cnpj("0001"),
      rootHash: `root_${tag}`,
      createdAt: "2025-03-31T12:00:00-03:00", // dia civil BR = 31
    });
    await grantOnboarding(`root_${tag}`, store1);
    c1 = { storeIds: [store1], rootHashes: [`root_${tag}`], userIds: [u1] };

    // Dia 15 de abril (mês de 30 dias): dia 31 → clamp 30 → NÃO concedida.
    const after15 = await rpcCall("2026-04-15");
    assert(
      "C1a: 2026-04-15 não concede (raiz fora do dia de aniversário → skipped_not_due)",
      delta(before15, after15, "granted") === 0 && delta(before15, after15, "skipped_not_due") === 1,
      `grantedΔ=${delta(before15, after15, "granted")} skipped_not_dueΔ=${delta(before15, after15, "skipped_not_due")}`,
    );
    assert("C1a: eligible não inclui a raiz (eligibleΔ=0)", delta(before15, after15, "eligible") === 0, `eligibleΔ=${delta(before15, after15, "eligible")}`);
    assert("C1a: sem entitlement monthly nem transação", (await countMonthlyEntitlements(`root_${tag}`, "2026-04")) === 0 && (await countMonthlyTx(store1)) === 0 && (await getBonus(store1)) === 0, "entitlement/tx/bonus != 0");

    // Dia 30 de abril (último dia do mês curto): clamp → concedida.
    const after30 = await rpcCall("2026-04-30");
    assert("C1b: 2026-04-30 concede (clamp para último dia)", delta(before30, after30, "granted") === 1, `grantedΔ=${delta(before30, after30, "granted")}`);
    assert("C1b: eligible inclui a raiz (eligibleΔ=1)", delta(before30, after30, "eligible") === 1, `eligibleΔ=${delta(before30, after30, "eligible")}`);
    assert("C1b: entitlement + transação + bonus 5", (await countMonthlyEntitlements(`root_${tag}`, "2026-04")) === 1 && (await countMonthlyTx(store1)) === 1 && (await getBonus(store1)) === 5, `ent=${await countMonthlyEntitlements(`root_${tag}`, "2026-04")} tx=${await countMonthlyTx(store1)} bonus=${await getBonus(store1)}`);
  } finally {
    await cleanup(c1);
  }

  // ── C2: fevereiro ─────────────────────────────────────────────────────────
  console.log("\n🧪 C2: fevereiro — LEAST(31, 28) concede em 28, não em 27");
  let c2 = { storeIds: [], rootHashes: [], userIds: [] };
  try {
    const tag = unique("c2");
    const before27 = await rpcCall("2026-02-27");
    const before28 = await rpcCall("2026-02-28");

    const u2 = await createAuthUser(`${tag}-a@verify.local`);
    const store2 = await createStore({
      name: "Verify C2 Loja",
      userId: u2,
      cnpjNormalized: cnpj("0001"),
      rootHash: `root_${tag}`,
      createdAt: "2025-03-31T12:00:00-03:00", // aniversário dia 31
    });
    await grantOnboarding(`root_${tag}`, store2);
    c2 = { storeIds: [store2], rootHashes: [`root_${tag}`], userIds: [u2] };

    const after27 = await rpcCall("2026-02-27");
    assert("C2a: 2026-02-27 não concede", delta(before27, after27, "granted") === 0 && delta(before27, after27, "skipped_not_due") === 1, `grantedΔ=${delta(before27, after27, "granted")} notDueΔ=${delta(before27, after27, "skipped_not_due")}`);

    const after28 = await rpcCall("2026-02-28");
    assert("C2b: 2026-02-28 concede (LEAST(31,28)=28)", delta(before28, after28, "granted") === 1, `grantedΔ=${delta(before28, after28, "granted")}`);
    assert("C2b: entitlement + transação + bonus 5", (await countMonthlyEntitlements(`root_${tag}`, "2026-02")) === 1 && (await countMonthlyTx(store2)) === 1 && (await getBonus(store2)) === 5, `ent=${await countMonthlyEntitlements(`root_${tag}`, "2026-02")} tx=${await countMonthlyTx(store2)} bonus=${await getBonus(store2)}`);
  } finally {
    await cleanup(c2);
  }

  // ── C3: limiar 9 → grant integral +5 → 14 (NÃO 10) ───────────────────────
  console.log("\n🧪 C3: limiar — bonus 9 → grant INTEGRAL +5 → 14 (não partial)");
  let c3 = { storeIds: [], rootHashes: [], userIds: [] };
  try {
    const tag = unique("c3");
    const before = await rpcCall("2026-01-15");

    const u3 = await createAuthUser(`${tag}-a@verify.local`);
    const store3 = await createStore({
      name: "Verify C3 Loja",
      userId: u3,
      cnpjNormalized: cnpj("0001"),
      rootHash: `root_${tag}`,
      createdAt: "2025-01-15T12:00:00-03:00", // aniversário dia 15
    });
    await grantOnboarding(`root_${tag}`, store3);
    await setBonus(store3, 9);
    c3 = { storeIds: [store3], rootHashes: [`root_${tag}`], userIds: [u3] };

    const after = await rpcCall("2026-01-15");
    assert("C3a: concede (grantedΔ=1, eligibleΔ=1)", delta(before, after, "granted") === 1 && delta(before, after, "eligible") === 1, `grantedΔ=${delta(before, after, "granted")} eligibleΔ=${delta(before, after, "eligible")}`);
    assert("C3b: bonus 9 → 14 (grant integral, NÃO partial 10)", (await getBonus(store3)) === 14, `bonus=${await getBonus(store3)} (esperado 14)`);
    assert("C3c: transação bonus_monthly amount=5", (await countMonthlyTx(store3)) === 1, `tx=${await countMonthlyTx(store3)}`);
  } finally {
    await cleanup(c3);
  }

  // ── C4: limiar 10 → NENHUM grant no ciclo ─────────────────────────────────
  console.log("\n🧪 C4: limiar — bonus 10 → skipped_bonus_threshold, sem grant");
  let c4 = { storeIds: [], rootHashes: [], userIds: [] };
  try {
    const tag = unique("c4");
    const before = await rpcCall("2026-02-15");

    const u4 = await createAuthUser(`${tag}-a@verify.local`);
    const store4 = await createStore({
      name: "Verify C4 Loja",
      userId: u4,
      cnpjNormalized: cnpj("0001"),
      rootHash: `root_${tag}`,
      createdAt: "2025-02-15T12:00:00-03:00", // aniversário dia 15
    });
    await grantOnboarding(`root_${tag}`, store4);
    await setBonus(store4, 10);
    c4 = { storeIds: [store4], rootHashes: [`root_${tag}`], userIds: [u4] };

    const after = await rpcCall("2026-02-15");
    assert("C4a: sem grant (grantedΔ=0)", delta(before, after, "granted") === 0, `grantedΔ=${delta(before, after, "granted")}`);
    assert("C4b: skipped_bonus_thresholdΔ=1 (raiz passou gates, falhou limiar)", delta(before, after, "skipped_bonus_threshold") === 1, `thresholdΔ=${delta(before, after, "skipped_bonus_threshold")}`);
    assert("C4c: eligible inclui a raiz (eligibleΔ=1)", delta(before, after, "eligible") === 1, `eligibleΔ=${delta(before, after, "eligible")}`);
    assert("C4d: bonus permanece 10, sem entitlement nem transação", (await getBonus(store4)) === 10 && (await countMonthlyEntitlements(`root_${tag}`, "2026-02")) === 0 && (await countMonthlyTx(store4)) === 0, `bonus=${await getBonus(store4)} ent=${await countMonthlyEntitlements(`root_${tag}`, "2026-02")} tx=${await countMonthlyTx(store4)}`);
  } finally {
    await cleanup(c4);
  }

  // ── C5: matriz + filiais (r1-1) — matriz cadastrada DEPOIS, sem transação ─
  console.log("\n🧪 C5: matriz + filial — recipiente = MATRIZ (mesmo sem transação própria)");
  let c5 = { storeIds: [], rootHashes: [], userIds: [] };
  try {
    const tag = unique("c5");
    const before = await rpcCall("2026-06-10");

    // Filial ANTIGA (recebeu onboarding) + matriz CADASTRADA DEPOIS (sem transação bônus própria).
    const uFilial = await createAuthUser(`${tag}-filial@verify.local`);
    const uMatriz = await createAuthUser(`${tag}-matriz@verify.local`);
    const filial = await createStore({
      name: "Verify C5 Filial",
      userId: uFilial,
      cnpjNormalized: cnpj("0002"),
      rootHash: `root_${tag}`,
      createdAt: "2025-01-10T12:00:00-03:00", // mais antiga
    });
    const matriz = await createStore({
      name: "Verify C5 Matriz",
      userId: uMatriz,
      cnpjNormalized: cnpj("0001"), // matriz (substring 9,4 = '0001')
      rootHash: `root_${tag}`,
      createdAt: "2025-06-10T12:00:00-03:00", // cadastrada depois
    });
    await grantOnboarding(`root_${tag}`, filial); // histórico freemium NO NÍVEL DA RAIZ
    c5 = { storeIds: [filial, matriz], rootHashes: [`root_${tag}`], userIds: [uFilial, uMatriz] };

    const after = await rpcCall("2026-06-10");
    const grantedStores = await monthlyTxStores(`root_${tag}`);
    assert("C5a: 1 grant por raiz (grantedΔ=1)", delta(before, after, "granted") === 1, `grantedΔ=${delta(before, after, "granted")}`);
    assert("C5b: recipiente = MATRIZ (não a filial com onboarding)", grantedStores.length === 1 && grantedStores[0] === matriz, `stores=${grantedStores.join(",")} esperado=${matriz}`);
    const entRows = await q(
      "SELECT store_id FROM public.freemium_entitlements WHERE root_hash = $1 AND benefit_type = 'monthly'",
      [`root_${tag}`],
    );
    assert("C5c: entitlement mensal aponta para a matriz", entRows.length === 1 && entRows[0].store_id === matriz, `ent=${entRows.map((r) => r.store_id).join(",")} esperado=${matriz}`);
  } finally {
    await cleanup(c5);
  }

  // ── C6: sem matriz → filial mais antiga (created_at ASC) ──────────────────
  console.log("\n🧪 C6: sem matriz → filial mais antiga recebe o grant");
  let c6 = { storeIds: [], rootHashes: [], userIds: [] };
  try {
    const tag = unique("c6");
    const before = await rpcCall("2026-01-05");

    const uA = await createAuthUser(`${tag}-a@verify.local`);
    const uB = await createAuthUser(`${tag}-b@verify.local`);
    const older = await createStore({
      name: "Verify C6 A",
      userId: uA,
      cnpjNormalized: cnpj("0002"),
      rootHash: `root_${tag}`,
      createdAt: "2025-01-05T12:00:00-03:00", // mais antiga
    });
    const newer = await createStore({
      name: "Verify C6 B",
      userId: uB,
      cnpjNormalized: cnpj("0003"),
      rootHash: `root_${tag}`,
      createdAt: "2025-06-05T12:00:00-03:00", // mais nova
    });
    await grantOnboarding(`root_${tag}`, older);
    c6 = { storeIds: [older, newer], rootHashes: [`root_${tag}`], userIds: [uA, uB] };

    const after = await rpcCall("2026-01-05");
    const grantedStores = await monthlyTxStores(`root_${tag}`);
    assert("C6a: 1 grant por raiz (grantedΔ=1)", delta(before, after, "granted") === 1, `grantedΔ=${delta(before, after, "granted")}`);
    assert("C6b: recipiente = filial mais antiga (created_at ASC)", grantedStores.length === 1 && grantedStores[0] === older, `stores=${grantedStores.join(",")} esperado=${older}`);
  } finally {
    await cleanup(c6);
  }

  // ── C7: dupla execução no mesmo ciclo → idempotência raiz+cycle ───────────
  console.log("\n🧪 C7: idempotência — 2ª execução no mesmo ciclo não duplica grant");
  let c7 = { storeIds: [], rootHashes: [], userIds: [] };
  try {
    const tag = unique("c7");

    const u7 = await createAuthUser(`${tag}-a@verify.local`);
    const store7 = await createStore({
      name: "Verify C7 Loja",
      userId: u7,
      cnpjNormalized: cnpj("0001"),
      rootHash: `root_${tag}`,
      createdAt: "2025-03-15T12:00:00-03:00", // aniversário dia 15
    });
    await grantOnboarding(`root_${tag}`, store7);
    c7 = { storeIds: [store7], rootHashes: [`root_${tag}`], userIds: [u7] };

    const run1 = await rpcCall("2026-03-15");
    assert("C7a: 1ª execução concede (granted=1)", run1.granted === 1 && (await getBonus(store7)) === 5, `granted=${run1.granted} bonus=${await getBonus(store7)}`);

    const run2 = await rpcCall("2026-03-15");
    assert("C7b: 2ª execução NÃO concede (grantedΔ<=0)", run2.granted - run1.granted <= 0, `granted2=${run2.granted} granted1=${run1.granted}`);
    assert("C7c: exatamente 1 entitlement + 1 transação + bonus 5 (não duplicou)", (await countMonthlyEntitlements(`root_${tag}`, "2026-03")) === 1 && (await countMonthlyTx(store7)) === 1 && (await getBonus(store7)) === 5, `ent=${await countMonthlyEntitlements(`root_${tag}`, "2026-03")} tx=${await countMonthlyTx(store7)} bonus=${await getBonus(store7)}`);
  } finally {
    await cleanup(c7);
  }

  // ── C8: consumo bônus primeiro ─────────────────────────────────────────────
  console.log("\n🧪 C8: reserve_credit deduz bônus antes de purchased");
  let c8 = { storeIds: [], rootHashes: [], userIds: [] };
  try {
    const tag = unique("c8");
    const before = await rpcCall("2026-04-15");

    const u8 = await createAuthUser(`${tag}-a@verify.local`);
    const store8 = await createStore({
      name: "Verify C8 Loja",
      userId: u8,
      cnpjNormalized: cnpj("0001"),
      rootHash: `root_${tag}`,
      createdAt: "2025-04-15T12:00:00-03:00", // aniversário dia 15
    });
    await grantOnboarding(`root_${tag}`, store8);
    c8 = { storeIds: [store8], rootHashes: [`root_${tag}`], userIds: [u8] };

    // Grant mensal integral (bonus 0 → 5).
    await rpcCall("2026-04-15");
    assert("C8-setup: grant mensal aplicado (bonus=5)", delta(before, await rpcCall("2026-04-15"), "granted") === 0 && (await getBonus(store8)) === 5, `bonus=${await getBonus(store8)}`);

    // Compra +3 → purchased=3 (grant_credits bucket purchase).
    await q(
      `SELECT public.grant_credits($1, 3, 'verify-purchase', 'verify_purchase_' || $1::text, '{}'::jsonb, 'purchase')`,
      [store8],
    );
    assert("C8-setup: purchased=3 após compra", (await getBalances(store8)).purchased_balance === 3, `bal=${JSON.stringify(await getBalances(store8))}`);

    // Reserva de 6: bonus 5 + purchased 1 → metadata bonus_amount=5, purchased_amount=1.
    await q(`SELECT public.reserve_credit($1, 6, NULL, 'verify_reserve_' || $1::text, '{}'::jsonb)`, [store8]);
    const dedRows = await q(
      `SELECT metadata FROM public.credit_transactions WHERE store_id = $1 AND type = 'deduction' ORDER BY created_at DESC LIMIT 1`,
      [store8],
    );
    const meta = dedRows[0]?.metadata ?? {};
    assert("C8a: deduction deduz bônus primeiro (bonus_amount=5, purchased_amount=1)", meta.bonus_amount === 5 && meta.purchased_amount === 1, `metadata=${JSON.stringify(meta)}`);
    const bal = await getBalances(store8);
    assert("C8b: saldo final bonus=0, purchased=2", bal.bonus_balance === 0 && bal.purchased_balance === 2, `bal=${JSON.stringify(bal)}`);
  } finally {
    await cleanup(c8);
  }

  // ── Resumo ────────────────────────────────────────────────────────────────
  console.log(`\n${"=".repeat(50)}`);
  console.log(`\nResults: ${results.pass} passed / ${results.fail} failed / ${results.tests.length} total\n`);
  if (results.fail > 0) {
    console.log("Failed:");
    results.tests.filter((t) => !t.ok).forEach((t) => console.log(`  - ${t.name}: ${t.detail}`));
  }
  await pool.end();
  process.exit(results.fail > 0 ? 1 : 0);
}

run().catch(async (err) => {
  console.error(err);
  try {
    await pool.end();
  } catch {
    /* ignore */
  }
  process.exit(1);
});