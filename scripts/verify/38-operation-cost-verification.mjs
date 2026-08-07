// F38 SQL Verification I1–I6a: credit_operation_costs + audit + RPC
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../../.env.local");
const envContent = readFileSync(envPath, "utf-8");
const getEnv = (key) => {
  const m = envContent.match(new RegExp(`${key}=(.+)`));
  return m ? m[1].trim() : null;
};

const supabaseUrl = getEnv("NEXT_PUBLIC_SUPABASE_URL");
const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
const anonKey = getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
if (!supabaseUrl || !serviceRoleKey || !anonKey) {
  console.error("Missing credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);
const anonClient = createClient(supabaseUrl, anonKey);

const results = { pass: 0, fail: 0, tests: [] };
const assert = (name, ok, detail) => {
  ok
    ? (results.pass++, console.log(`  ✓ ${name}`))
    : (results.fail++, console.log(`  ✗ ${name} — ${detail}`));
  results.tests.push({ name, ok, detail });
};

const reason = "38-08-verification";

async function run() {
  console.log(`\n🔍 F38 Operation Cost Verification I1–I6a\n`);

  // Resolve real actor (FK auth.users)
  const { data: userList, error: userListError } = await supabase.auth.admin.listUsers({ perPage: 1 });
  if (userListError || !userList?.users?.length) {
    console.error("No real auth user found to use as verification actor");
    process.exit(1);
  }
  const actorId = userList.users[0].id;
  console.log(`Actor: ${actorId}\n`);

  // ── I6a: seeds presentes ──────────────────────────────────────────
  console.log("🧪 I6a: seeds credit_operation_costs");
  const { data: seedRows, error: seedError } = await supabase
    .from("credit_operation_costs")
    .select("operation_key, cost_credits, enabled")
    .order("operation_key", { ascending: true });
  assert(
    "I6a: 2 rows present",
    !seedError && seedRows?.length === 2,
    seedError?.message || `rows=${seedRows?.length}`,
  );
  const cg = seedRows?.find((r) => r.operation_key === "campaign_generation");
  const vs = seedRows?.find((r) => r.operation_key === "visual_signature_generation");
  assert(
    "I6a: campaign_generation seed = 1/true",
    cg?.cost_credits === 1 && cg?.enabled === true,
    JSON.stringify(cg),
  );
  assert(
    "I6a: visual_signature_generation seed = 1/true",
    vs?.cost_credits === 1 && vs?.enabled === true,
    JSON.stringify(vs),
  );

  // ── I1: RPC real atualiza + audit ─────────────────────────────────
  console.log("\n🧪 I1: RPC update + audit append");
  const operationId1 = crypto.randomUUID();
  const { data: i1, error: e1 } = await supabase.rpc(
    "admin_update_operation_cost",
    {
      p_actor_id: actorId,
      p_operation_key: "campaign_generation",
      p_cost_credits: 2,
      p_reason: reason,
      p_operation_id: operationId1,
    },
  );
  assert("I1: RPC success", !e1 && !!i1?.audit_id, e1?.message || "no audit_id");
  assert("I1: idempotent false", i1?.idempotent === false, JSON.stringify(i1));

  const { data: auditRows, error: auditError } = await supabase
    .from("credit_operation_cost_audit")
    .select("action, old_cost_credits, new_cost_credits, actor_id, operation_id")
    .eq("operation_id", operationId1)
    .single();
  assert(
    "I1: audit row action=update_cost old=1 new=2",
    !auditError &&
      auditRows?.action === "update_cost" &&
      auditRows?.old_cost_credits === 1 &&
      auditRows?.new_cost_credits === 2 &&
      auditRows?.actor_id === actorId &&
      auditRows?.operation_id === operationId1,
    auditError?.message || JSON.stringify(auditRows),
  );

  // ── I2: operation_id repetido → no-op ─────────────────────────────
  console.log("\n🧪 I2: operation_id idempotency");
  const { data: i2, error: e2 } = await supabase.rpc(
    "admin_update_operation_cost",
    {
      p_actor_id: actorId,
      p_operation_key: "campaign_generation",
      p_cost_credits: 3,
      p_reason: reason,
      p_operation_id: operationId1,
    },
  );
  assert("I2: idempotent true", !e2 && i2?.idempotent === true, e2?.message || JSON.stringify(i2));
  assert("I2: same audit_id", i2?.audit_id === i1?.audit_id, `${i2?.audit_id} !== ${i1?.audit_id}`);

  const { data: auditCountRows, error: countError } = await supabase
    .from("credit_operation_cost_audit")
    .select("id")
    .eq("operation_id", operationId1);
  assert(
    "I2: exactly 1 audit row",
    !countError && auditCountRows?.length === 1,
    countError?.message || `count=${auditCountRows?.length}`,
  );

  // ── Reverter campaign_generation para seed antes de I3 ───────────
  console.log("\n🧹 Reverting campaign_generation to seed before I3");
  const { data: revertI2, error: revertI2Error } = await supabase.rpc(
    "admin_update_operation_cost",
    {
      p_actor_id: actorId,
      p_operation_key: "campaign_generation",
      p_cost_credits: 1,
      p_reason: "38-08-revert-before-i3",
      p_operation_id: crypto.randomUUID(),
    },
  );
  assert(
    "Revert-before-I3: success",
    !revertI2Error && !!revertI2?.audit_id,
    revertI2Error?.message,
  );

  // ── I3: cost_credits=0 rejeitado ───────────────────────────────────
  console.log("\n🧪 I3: cost_credits=0 rejected");
  const { data: i3, error: e3 } = await supabase.rpc(
    "admin_update_operation_cost",
    {
      p_actor_id: actorId,
      p_operation_key: "campaign_generation",
      p_cost_credits: 0,
      p_reason: reason,
      p_operation_id: crypto.randomUUID(),
    },
  );
  assert("I3: RPC error", !!e3 && !i3, e3?.message || "expected error");
  assert(
    "I3: operation_cost_invalid",
    e3?.message?.includes("operation_cost_invalid") ?? false,
    e3?.message,
  );
  const { data: afterInvalid } = await supabase
    .from("credit_operation_costs")
    .select("cost_credits")
    .eq("operation_key", "campaign_generation")
    .single();
  assert("I3: cost unchanged at 1", afterInvalid?.cost_credits === 1, JSON.stringify(afterInvalid));

  // ── I4: anon não lê ───────────────────────────────────────────────
  console.log("\n🧪 I4: anon/RLS no read");
  const { data: anonData, error: anonError } = await anonClient
    .from("credit_operation_costs")
    .select("*")
    .limit(5);
  assert(
    "I4: anon blocked or empty",
    !!anonError || (Array.isArray(anonData) && anonData.length === 0),
    `error=${anonError?.message} data=${JSON.stringify(anonData)}`,
  );

  // ── I5: audit imutável ────────────────────────────────────────────
  console.log("\n🧪 I5: audit append-only trigger");
  const { data: auditFirst, error: auditFirstError } = await supabase
    .from("credit_operation_cost_audit")
    .select("id, reason")
    .limit(1)
    .single();
  assert("I5: audit row found", !auditFirstError && !!auditFirst, auditFirstError?.message);

  const { error: updateError } = await supabase
    .from("credit_operation_cost_audit")
    .update({ reason: "hacked" })
    .eq("id", auditFirst.id);
  assert("I5: UPDATE blocked", !!updateError, updateError?.message || "expected error");

  const { error: deleteError } = await supabase
    .from("credit_operation_cost_audit")
    .delete()
    .eq("id", auditFirst.id);
  assert("I5: DELETE blocked", !!deleteError, deleteError?.message || "expected error");

  const { data: auditStill, error: auditStillError } = await supabase
    .from("credit_operation_cost_audit")
    .select("id, reason")
    .eq("id", auditFirst.id)
    .single();
  assert(
    "I5: row unchanged",
    !auditStillError && auditStill?.reason === auditFirst.reason,
    auditStillError?.message || `${auditStill?.reason} !== ${auditFirst.reason}`,
  );

  // ── Verificar seed final ──────────────────────────────────────────
  console.log("\n🧹 Verifying final seed state (cost 1)");
  const { data: finalSeed } = await supabase
    .from("credit_operation_costs")
    .select("cost_credits, enabled")
    .eq("operation_key", "campaign_generation")
    .single();
  assert(
    "Final seed: cost=1 enabled=true",
    finalSeed?.cost_credits === 1 && finalSeed?.enabled === true,
    JSON.stringify(finalSeed),
  );

  console.log(`\n${"=".repeat(50)}`);
  console.log(`\nResults: ${results.pass} passed / ${results.fail} failed / ${results.tests.length} total\n`);
  process.exit(results.fail > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
