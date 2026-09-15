// F47 local UAT admin bootstrap.
//
// Cria um admin temporario no Supabase LOCAL, comprova login real (com o secret
// de teste do Turnstile no Auth local) e permite cleanup completo.
//
// Uso:
//   node scripts/uat/47-local-bootstrap.mjs
//   node scripts/uat/47-local-bootstrap.mjs --cleanup [userId]
//
// NUNCA usar contra ambiente remoto: os endpoints sao validados e recusados.

import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";

const STATE_FILE = path.join(os.tmpdir(), "vendeo-f47-uat-admin.json");

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

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    return null;
  }
}

async function assertNoResidue(userId) {
  const { data: adminRow, error: adminErr } = await admin
    .from("admin_users")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (adminErr) throw new Error(`residue check admin_users falhou: ${adminErr.message}`);
  if (adminRow) throw new Error(`residuo: admin_users ainda contem ${userId}`);

  const db = new Client({ connectionString: env.DB_URL });
  await db.connect();
  try {
    const audit = await db.query("SELECT COUNT(*)::int AS n FROM public.admin_audit_log WHERE actor_id = $1", [userId]);
    if (audit.rows[0].n !== 0) throw new Error(`residuo: admin_audit_log tem ${audit.rows[0].n} linhas do actor`);
  } finally {
    await db.end();
  }
}

async function removeUser(userId) {
  const { error: adminDelErr } = await admin.from("admin_users").delete().eq("user_id", userId);
  if (adminDelErr) throw new Error(`delete admin_users falhou: ${adminDelErr.message}`);

  const db = new Client({ connectionString: env.DB_URL });
  await db.connect();
  try {
    await db.query("ALTER TABLE public.admin_audit_log DISABLE TRIGGER trg_admin_audit_log_immutable");
    try {
      const del = await db.query("DELETE FROM public.admin_audit_log WHERE actor_id = $1", [userId]);
      if (del.rowCount === null) throw new Error("delete admin_audit_log sem rowCount");
    } finally {
      await db.query("ALTER TABLE public.admin_audit_log ENABLE TRIGGER trg_admin_audit_log_immutable");
    }
  } finally {
    await db.end();
  }

  const { error: userDelErr } = await admin.auth.admin.deleteUser(userId);
  if (userDelErr) throw new Error(`delete auth user falhou: ${userDelErr.message}`);

  await assertNoResidue(userId);
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
    // Idempotencia: remove admin anterior deste script antes de criar outro.
    await removeUser(previous.userId);
    fs.rmSync(STATE_FILE, { force: true });
  }

  const email = `f47-admin-${crypto.randomUUID().slice(0, 8)}@local.invalid`;
  const password = `F47-${crypto.randomUUID()}-Aa1!`;

  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data?.user) throw new Error(`createUser falhou: ${error?.message ?? "usuario ausente"}`);
  const userId = data.user.id;

  const { error: adminError } = await admin.from("admin_users").insert({ user_id: userId });
  if (adminError) {
    await admin.auth.admin.deleteUser(userId);
    throw new Error(`insert admin_users falhou: ${adminError.message}`);
  }

  const loginVerified = await verifyLocalLogin(email, password);

  fs.writeFileSync(STATE_FILE, JSON.stringify({ userId }, null, 2));
  console.log(
    JSON.stringify(
      { userId, email, password, loginVerified, note: "local-only; nunca commitar estas credenciais" },
      null,
      2,
    ),
  );
}

async function cleanup(userIdArg) {
  const state = readState();
  const userId = userIdArg ?? state?.userId;
  if (!userId) {
    console.log("Nada para limpar (sem state file e sem userId).");
    return;
  }
  await removeUser(userId);
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
