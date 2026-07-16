// SQL Verification I1–I7 for Phase 24 Credit System
import { createClient } from "@supabase/supabase-js";
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

const supabaseUrl = getEnv("NEXT_PUBLIC_SUPABASE_URL");
const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
if (!supabaseUrl || !serviceRoleKey) { console.error("Missing credentials"); process.exit(1); }

const supabase = createClient(supabaseUrl, serviceRoleKey);
const results = { pass: 0, fail: 0, tests: [] };
const assert = (name, ok, detail) => {
  ok ? (results.pass++, console.log(`  ✅ ${name}`)) : (results.fail++, console.log(`  ❌ ${name} — ${detail}`));
  results.tests.push({ name, ok, detail });
};

async function getBalance(sid) {
  const { data } = await supabase.from("credit_balances").select("balance").eq("store_id", sid).single();
  return data?.balance ?? 0;
}

async function run() {
  const { data: stores } = await supabase.from("stores").select("id").limit(1);
  if (!stores?.length) { console.error("No stores found"); process.exit(1); }
  const storeId = stores[0].id;
  console.log(`\n🔬 Credit SQL Verification I1–I7\n`);
  console.log(`Store: ${storeId}\n`);

  // I1: grant_credits
  console.log("── I1: grant_credits ──");
  const balBefore = await getBalance(storeId);
  const { data: tx1, error: e1 } = await supabase.rpc("grant_credits", {
    p_store_id: storeId, p_amount: 10, p_reason: "I1-onboarding",
  });
  assert("I1a: grant returns UUID", !e1 && tx1, e1?.message || "no UUID");
  const balAfter1 = await getBalance(storeId);
  assert("I1b: balance +10", balAfter1 === balBefore + 10, `was ${balBefore}, now ${balAfter1}`);

  // I2: reserve_credit
  console.log("\n── I2: reserve_credit ──");
  const { data: tx2, error: e2 } = await supabase.rpc("reserve_credit", {
    p_store_id: storeId, p_amount: 3,
  });
  assert("I2a: reserve returns UUID", !e2 && tx2, e2?.message || "no UUID");
  const balAfter2 = await getBalance(storeId);
  assert("I2b: balance -3", balAfter2 === balAfter1 - 3, `was ${balAfter1}, now ${balAfter2}`);

  // I3: refund_credit
  console.log("\n── I3: refund_credit ──");
  const { data: tx3, error: e3 } = await supabase.rpc("refund_credit", {
    p_tx_id: tx2, p_reason: "I3-test-refund",
  });
  assert("I3a: refund returns UUID", !e3 && tx3, e3?.message || "no UUID");
  const balAfter3 = await getBalance(storeId);
  assert("I3b: balance +3 (restored)", balAfter3 === balAfter1, `was ${balAfter2}, now ${balAfter3}, expected ${balAfter1}`);

  // I4: insufficient balance
  console.log("\n── I4: saldo_insuficiente ──");
  const { error: e4 } = await supabase.rpc("reserve_credit", {
    p_store_id: storeId, p_amount: 999999,
  });
  assert("I4a: error raised", !!e4, "no error raised");
  if (e4) assert("I4b: message = saldo_insuficiente", e4.message.includes("saldo_insuficiente"), e4.message);

  // I5: duplicate refund
  console.log("\n── I5: duplicate refund ──");
  const { data: d5 } = await supabase.rpc("reserve_credit", {
    p_store_id: storeId, p_amount: 2, p_idempotency_key: "i5-" + Date.now(),
  });
  assert("I5-setup: deduction created", !!d5, "setup failed");
  const { data: r1 } = await supabase.rpc("refund_credit", { p_tx_id: d5, p_reason: "first" });
  const balBeforeDup = await getBalance(storeId);
  const { data: r2 } = await supabase.rpc("refund_credit", { p_tx_id: d5, p_reason: "duplicate" });
  const balAfterDup = await getBalance(storeId);
  assert("I5a: duplicate refund returns same UUID", !!r1 && r1 === r2, `${r1} !== ${r2}`);
  assert("I5b: balance unchanged after duplicate", balBeforeDup === balAfterDup, `${balBeforeDup} → ${balAfterDup}`);

  // I6: idempotency_key
  console.log("\n── I6: idempotency ──");
  const ik = "test-idem-" + Date.now();
  const { data: i1, error: ie1 } = await supabase.rpc("grant_credits", {
    p_store_id: storeId, p_amount: 1, p_reason: "idem", p_idempotency_key: ik,
  });
  assert("I6a: first call returns UUID", !ie1 && i1, ie1?.message || "no UUID");
  const { data: i2 } = await supabase.rpc("grant_credits", {
    p_store_id: storeId, p_amount: 1, p_reason: "idem", p_idempotency_key: ik,
  });
  assert("I6b: same key returns same UUID", i1 === i2, `${i1} !== ${i2}`);
  // Balance should have increased by only 1 (second call was no-op)
  const balAfterI6 = await getBalance(storeId);
  assert("I6c: balance +1 (not +2)", balAfterI6 === balAfterDup + 1, `was ${balAfterDup}, now ${balAfterI6}`);

  // I7: simultaneous reserves
  console.log("\n── I7: simultaneous reserves ──");
  const balBeforeI7 = await getBalance(storeId);
  const { data: gtx } = await supabase.rpc("grant_credits", {
    p_store_id: storeId, p_amount: 3, p_reason: "I7-setup",
  });
  assert("I7-setup: grant succeeded", !!gtx, "grant failed");
  const [rr1, rr2] = await Promise.allSettled([
    supabase.rpc("reserve_credit", { p_store_id: storeId, p_amount: 1 }),
    supabase.rpc("reserve_credit", { p_store_id: storeId, p_amount: 1 }),
  ]);
  const ok1 = rr1.status === "fulfilled" && rr1.value?.data;
  const ok2 = rr2.status === "fulfilled" && rr2.value?.data;
  assert("I7: both reserves succeed (3→1+1)", ok1 && ok2, `r1=${rr1.status} r2=${rr2.status}`);
  const balAfterI7 = await getBalance(storeId);
  assert("I7b: balance -2 after reserves", balAfterI7 === balBeforeI7 + 3 - 2, `was ${balBeforeI7}+3-2, now ${balAfterI7}`);

  console.log(`\n${"=".repeat(50)}`);
  console.log(`\nResults: ${results.pass} passed / ${results.fail} failed / ${results.tests.length} total\n`);
  if (results.fail > 0) {
    console.log("Failed:");
    results.tests.filter(t => !t.ok).forEach(t => console.log(`  - ${t.name}: ${t.detail}`));
  }
  process.exit(results.fail > 0 ? 1 : 0);
}

run().catch(console.error);
