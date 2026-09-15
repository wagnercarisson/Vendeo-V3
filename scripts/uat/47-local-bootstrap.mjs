// F47 local UAT admin bootstrap + cleanup.
//
// Cria um admin temporario no Supabase LOCAL, comprova login real (com o secret
// de teste do Turnstile no Auth local) e faz cleanup COMPLETO e idempotente do
// usuario temporario, incluindo loja, campanhas, eventos, auditoria e storage.
//
// Uso:
//   node scripts/uat/47-local-bootstrap.mjs
//   node scripts/uat/47-local-bootstrap.mjs --cleanup [userId]
//
// NUNCA usar contra ambiente remoto: os endpoints sao validados e recusados.
// Nao remove seeds do catalogo F47 nem dados globais; nao usa `db reset`.

import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";

const STATE_FILE = path.join(os.tmpdir(), "vendeo-f47-uat-admin.json");
const FIXTURE_STATE_FILE = path.join(os.tmpdir(), "vendeo-f47-uat-fixtures.json");
const FIXTURES_SCRIPT = fileURLToPath(new URL("./47-local-fixtures.mjs", import.meta.url));
const F47_BUCKETS = ["campaign-images", "store-logos", "store-brand-assets", "visual-signatures"];
const CANONICAL_CATALOG_SEED_COUNT = 12;
// Triggers append-only que bloqueiam a cascata local de store/actor. Sao
// suspensos APENAS durante o cleanup local e reabilitados no finally.
const APPEND_ONLY_TRIGGERS = [
  ["public.credit_transactions", "trg_credit_transactions_immutable"],
  ["public.credit_operation_cost_audit", "trg_credit_operation_cost_audit_immutable"],
  ["public.economic_parameter_audit", "trg_economic_parameter_audit_immutable"],
  ["public.admin_audit_log", "trg_admin_audit_log_immutable"],
];
const ACTOR_AUDIT_TABLES = [
  ["public.admin_audit_log", "actor_id"],
  ["public.credit_operation_cost_audit", "actor_id"],
  ["public.economic_parameter_audit", "actor_id"],
];

function readLocalEnvOnce() {
  const command = process.platform === "win32" ? "cmd.exe" : "npx";
  const args =
    process.platform === "win32"
      ? ["/d", "/s", "/c", "npx supabase status -o env"]
      : ["supabase", "status", "-o", "env"];
  const output = execFileSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const values = {};
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^(API_URL|ANON_KEY|SERVICE_ROLE_KEY|DB_URL)="([^"]+)"$/);
    if (match) values[match[1]] = match[2];
  }
  for (const key of ["API_URL", "ANON_KEY", "SERVICE_ROLE_KEY", "DB_URL"]) {
    if (!values[key]) throw new Error(`supabase status -o env sem ${key}`);
  }
  if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(values.API_URL)) {
    throw new Error(`Recusando API remota: ${values.API_URL}`);
  }
  if (!/^postgresql:\/\/(?:[^@]+@)?(localhost|127\.0\.0\.1)(:\d+)?\//i.test(values.DB_URL)) {
    throw new Error(`Recusando DB remoto: ${values.DB_URL}`);
  }
  return values;
}

const env = readLocalEnvOnce();
const admin = createClient(env.API_URL, env.SERVICE_ROLE_KEY);

async function withDb(fn) {
  const db = new Client({ connectionString: env.DB_URL });
  await db.connect();
  try {
    return await fn(db);
  } finally {
    await db.end();
  }
}

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    return null;
  }
}

async function removeStorageObjects(storeIds, campaignIds) {
  const prefixes = [...storeIds, ...campaignIds];
  if (prefixes.length === 0) return;
  const rows = await withDb(async (db) => {
    const res = await db.query(
      "SELECT bucket_id, name FROM storage.objects WHERE bucket_id = ANY($1::text[]) AND (name = ANY($2::text[]) OR name LIKE ANY($3::text[]))",
      [F47_BUCKETS, prefixes, prefixes.map((p) => `${p}/%`)],
    );
    return res.rows;
  });
  if (rows.length === 0) return;
  const byBucket = new Map();
  for (const row of rows) {
    if (!byBucket.has(row.bucket_id)) byBucket.set(row.bucket_id, []);
    byBucket.get(row.bucket_id).push(row.name);
  }
  for (const [bucket, names] of byBucket) {
    const { error } = await admin.storage.from(bucket).remove(names);
    if (error) {
      // Fallback local: remove as linhas de storage.objects (arquivo fisico
      // orfao no volume local nao e dado visivel ao app).
      await withDb(async (db) => {
        await db.query("DELETE FROM storage.objects WHERE bucket_id = $1 AND name = ANY($2::text[])", [bucket, names]);
      });
    }
  }
}

async function cleanFixtureMarkersIfPresent() {
  const present = await withDb(async (db) => {
    const a = await db.query("SELECT 1 FROM public.ai_model_catalog WHERE model = 'uat-no-pricing-copy' LIMIT 1");
    const b = await db.query("SELECT 1 FROM public.ai_model_selection WHERE model = 'uat-missing-image-model' LIMIT 1");
    return a.rowCount > 0 || b.rowCount > 0;
  });
  if (!present) return;
  await withDb(async (db) => {
    await db.query("DELETE FROM public.ai_model_selection WHERE model = 'uat-missing-image-model'");
    await db.query("DELETE FROM public.ai_model_catalog WHERE model = 'uat-no-pricing-copy'");
    await db.query(
      "UPDATE public.ai_model_catalog SET status = 'active' WHERE capability = 'campaign_copy' AND provider = 'openai' AND model = 'gpt-4o' AND protocol = 'chat-completions'",
    );
  });
}

async function assertNoResidue({ userId, storeIds, campaignIds }) {
  const failures = [];
  await withDb(async (db) => {
    const count = async (label, sql, params) => {
      const res = await db.query(sql, params);
      const n = Number(res.rows[0].n);
      if (n !== 0) failures.push(`${label}=${n}`);
    };
    await count("auth_user", "SELECT COUNT(*)::int AS n FROM auth.users WHERE id = $1", [userId]);
    await count("admin_users", "SELECT COUNT(*)::int AS n FROM public.admin_users WHERE user_id = $1", [userId]);
    await count("stores", "SELECT COUNT(*)::int AS n FROM public.stores WHERE user_id = $1", [userId]);
    if (storeIds.length > 0) {
      await count("campaigns", "SELECT COUNT(*)::int AS n FROM public.campaigns WHERE store_id = ANY($1::uuid[])", [storeIds]);
      await count("generation_events", "SELECT COUNT(*)::int AS n FROM public.generation_events WHERE store_id = ANY($1::uuid[])", [storeIds]);
    }
    await count("actor_audit", "SELECT COUNT(*)::int AS n FROM public.admin_audit_log WHERE actor_id = $1", [userId]);
    const prefixes = [...storeIds, ...campaignIds];
    if (prefixes.length > 0) {
      await count(
        "storage_objects",
        "SELECT COUNT(*)::int AS n FROM storage.objects WHERE bucket_id = ANY($1::text[]) AND (name = ANY($2::text[]) OR name LIKE ANY($3::text[]))",
        [F47_BUCKETS, prefixes, prefixes.map((p) => `${p}/%`)],
      );
    }
    await count("fixture_catalog", "SELECT COUNT(*)::int AS n FROM public.ai_model_catalog WHERE model = 'uat-no-pricing-copy'", []);
    await count("fixture_selection", "SELECT COUNT(*)::int AS n FROM public.ai_model_selection WHERE model = 'uat-missing-image-model'", []);
    await count(
      "copy_seed_active",
      "SELECT (CASE WHEN COUNT(*) = 1 THEN 0 ELSE 1 END)::int AS n FROM public.ai_model_catalog WHERE capability = 'campaign_copy' AND provider = 'openai' AND model = 'gpt-4o' AND protocol = 'chat-completions' AND status = 'active'",
      [],
    );
    const seeds = await db.query("SELECT COUNT(*)::int AS n FROM public.ai_model_catalog");
    if (Number(seeds.rows[0].n) !== CANONICAL_CATALOG_SEED_COUNT) {
      failures.push(`catalog_seeds=${seeds.rows[0].n}`);
    }
  });
  if (fs.existsSync(FIXTURE_STATE_FILE)) failures.push("fixture_state_file=present");
  if (failures.length > 0) throw new Error(`Residuos detectados: ${failures.join(", ")}`);
}

async function removeUserFully(userId) {
  const storeIds = [];
  const campaignIds = [];
  await withDb(async (db) => {
    const stores = await db.query("SELECT id FROM public.stores WHERE user_id = $1", [userId]);
    for (const row of stores.rows) storeIds.push(row.id);
    if (storeIds.length > 0) {
      const campaigns = await db.query("SELECT id FROM public.campaigns WHERE store_id = ANY($1::uuid[])", [storeIds]);
      for (const row of campaigns.rows) campaignIds.push(row.id);
    }
  });

  await removeStorageObjects(storeIds, campaignIds);

  await withDb(async (db) => {
    for (const [table, trigger] of APPEND_ONLY_TRIGGERS) {
      await db.query(`ALTER TABLE ${table} DISABLE TRIGGER ${trigger}`);
    }
    try {
      for (const storeId of storeIds) {
        await db.query("DELETE FROM public.generation_events WHERE store_id = $1", [storeId]);
        await db.query(
          "DELETE FROM public.campaign_correction_submissions WHERE report_id IN (SELECT id FROM public.campaign_correction_reports WHERE store_id = $1)",
          [storeId],
        );
        await db.query("DELETE FROM public.campaign_correction_reports WHERE store_id = $1", [storeId]);
      }
      for (const campaignId of campaignIds) {
        await db.query("DELETE FROM public.campaign_art_versions WHERE campaign_id = $1", [campaignId]);
      }
      for (const storeId of storeIds) {
        await db.query("DELETE FROM public.campaigns WHERE store_id = $1", [storeId]);
        await db.query("DELETE FROM public.stores WHERE id = $1", [storeId]);
      }
      for (const [table, column] of ACTOR_AUDIT_TABLES) {
        await db.query(`DELETE FROM ${table} WHERE ${column} = $1`, [userId]);
      }
    } finally {
      for (const [table, trigger] of APPEND_ONLY_TRIGGERS) {
        await db.query(`ALTER TABLE ${table} ENABLE TRIGGER ${trigger}`);
      }
    }
  });

  const { error: adminDelErr } = await admin.from("admin_users").delete().eq("user_id", userId);
  if (adminDelErr) throw new Error(`delete admin_users falhou: ${adminDelErr.message}`);
  const { error: userDelErr } = await admin.auth.admin.deleteUser(userId);
  if (userDelErr) throw new Error(`delete auth user falhou: ${userDelErr.message}`);

  if (fs.existsSync(FIXTURE_STATE_FILE)) {
    execFileSync(process.execPath, [FIXTURES_SCRIPT, "--cleanup"], { cwd: process.cwd(), stdio: "inherit" });
  }
  await cleanFixtureMarkersIfPresent();

  await assertNoResidue({ userId, storeIds, campaignIds });
}

async function verifyLocalLogin(email, password) {
  const response = await fetch(`${env.API_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: env.ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password,
      gotrue_meta_security: { captcha_token: "XXXX.DUMMY.TOKEN" },
    }),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`login local falhou (${response.status}): ${text.slice(0, 200)}`);
  }
  const data = JSON.parse(text);
  if (!data.access_token) throw new Error("login local sem access_token");
  return true;
}

async function setup() {
  const previous = readState();
  if (previous?.userId) {
    // Idempotencia: cleanup completo do admin anterior deste script.
    await removeUserFully(previous.userId);
    fs.rmSync(STATE_FILE, { force: true });
  }

  const email = `f47-admin-${crypto.randomUUID().slice(0, 8)}@local.invalid`;
  const password = `F47-${crypto.randomUUID()}-Aa1!`;

  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data?.user) throw new Error(`createUser falhou: ${error?.message ?? "usuario ausente"}`);
  const userId = data.user.id;

  try {
    const { error: adminError } = await admin.from("admin_users").insert({ user_id: userId });
    if (adminError) throw new Error(`insert admin_users falhou: ${adminError.message}`);

    const loginVerified = await verifyLocalLogin(email, password);

    fs.writeFileSync(STATE_FILE, JSON.stringify({ userId }, null, 2));
    console.log(
      JSON.stringify(
        { userId, email, password, loginVerified, note: "local-only; nunca commitar estas credenciais" },
        null,
        2,
      ),
    );
  } catch (err) {
    // Rollback: nunca deixar usuario/admin/auditoria orfaos se algo falhar.
    try {
      await removeUserFully(userId);
      fs.rmSync(STATE_FILE, { force: true });
    } catch (rollbackError) {
      // Preserva { userId } para permitir cleanup manual — nao apagar o state file.
      fs.writeFileSync(STATE_FILE, JSON.stringify({ userId }, null, 2));
      console.error(`rollback apos falha tambem falhou: ${rollbackError.message}`);
      console.error(`State preservado para cleanup manual: node scripts/uat/47-local-bootstrap.mjs --cleanup ${userId}`);
    }
    throw err;
  }
}

async function cleanup(userIdArg) {
  const state = readState();
  const userId = userIdArg ?? state?.userId;
  if (!userId) {
    console.log("Nada para limpar (sem state file e sem userId).");
    return;
  }
  try {
    await removeUserFully(userId);
  } catch (err) {
    console.error(err.message);
    console.error(`State preservado: ${STATE_FILE}`);
    console.error(`Repetir cleanup: node scripts/uat/47-local-bootstrap.mjs --cleanup ${userId}`);
    throw err;
  }
  fs.rmSync(STATE_FILE, { force: true });
  console.log(`Admin local removido sem residuos: ${userId}`);
}

const [command, userIdArg] = process.argv.slice(2);
if (command === "--cleanup") {
  cleanup(userIdArg).catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
} else {
  setup().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
