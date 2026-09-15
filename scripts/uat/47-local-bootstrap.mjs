import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";

function localEnv() {
  const command = process.platform === "win32" ? "cmd.exe" : "npx";
  const args = process.platform === "win32" ? ["/d", "/s", "/c", "npx supabase status -o env"] : ["supabase", "status", "-o", "env"];
  const output = execFileSync(command, args, { cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  const values = {};
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^(API_URL|ANON_KEY|SERVICE_ROLE_KEY|DB_URL)="([^"]+)"$/);
    if (match) values[match[1]] = match[2];
  }
  if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(values.API_URL ?? "")) throw new Error(`Refusing non-local API_URL: ${values.API_URL}`);
  if (!/^postgresql:\/\/(?:[^@]+@)?(localhost|127\.0\.0\.1)(:\d+)?\//i.test(values.DB_URL ?? "")) throw new Error(`Refusing non-local DB_URL: ${values.DB_URL}`);
  return values;
}

const env = localEnv();
const admin = createClient(env.API_URL, env.SERVICE_ROLE_KEY);

async function setup() {
  const email = `f47-admin-${crypto.randomUUID().slice(0, 8)}@local.invalid`;
  const password = `F47-${crypto.randomUUID()}-Aa1!`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`Could not create local admin: ${error?.message ?? "missing user"}`);
  const { error: adminError } = await admin.from("admin_users").insert({ user_id: data.user.id });
  if (adminError) {
    await admin.auth.admin.deleteUser(data.user.id);
    throw new Error(`Could not grant local admin: ${adminError.message}`);
  }
  const { error: captchaError } = await admin.from("feature_flags").update({ enabled: false }).eq("key", "captcha_enabled");
  console.log(JSON.stringify({ userId: data.user.id, email, password, captchaDisabled: !captchaError, captchaError: captchaError?.message ?? null }, null, 2));
  console.log("Use these credentials only with scripts/uat/47-local-dev.ps1. Cleanup: node scripts/uat/47-local-bootstrap.mjs --cleanup <userId>");
}

async function cleanup(userId) {
  if (!userId) throw new Error("cleanup requires userId");
  await admin.from("admin_users").delete().eq("user_id", userId);
  const db = new Client({ connectionString: env.DB_URL });
  await db.connect();
  try {
    await db.query("ALTER TABLE public.admin_audit_log DISABLE TRIGGER trg_admin_audit_log_immutable");
    await db.query("DELETE FROM public.admin_audit_log WHERE actor_id = $1", [userId]);
    await db.query("ALTER TABLE public.admin_audit_log ENABLE TRIGGER trg_admin_audit_log_immutable");
  } finally {
    await db.end();
  }
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw new Error(`Could not delete local admin: ${error.message}`);
  console.log(`Removed local admin ${userId}`);
}

const [command, userId] = process.argv.slice(2);
if (command === "--cleanup") cleanup(userId).catch((error) => { console.error(error.message); process.exit(1); });
else setup().catch((error) => { console.error(error.message); process.exit(1); });
