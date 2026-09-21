import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres" });
const stores: string[] = [];
const users: string[] = [];

async function query<T = Record<string, unknown>>(sql: string, values: unknown[] = []) {
  return (await pool.query<T>(sql, values)).rows;
}

async function rpc<T = Record<string, unknown>>(name: string, args: unknown[]) {
  const placeholders = args.map((_, index) => `$${index + 1}`).join(", ");
  return (await pool.query<{ value: T }>(`select public.${name}(${placeholders}) as value`, args)).rows[0].value;
}

async function fixture() {
  const userId = crypto.randomUUID();
  users.push(userId);
  await query("insert into auth.users (id, aud, role, email, created_at, updated_at) values ($1, 'authenticated', 'authenticated', $2, now(), now())", [userId, `${userId}@f50-11.test`]);
  const [store] = await query<{ id: string }>("insert into public.stores (name, segment, user_id) values ($1, 'outros', $2) returning id", [`f50-11-${crypto.randomUUID()}`, userId]);
  stores.push(store.id);
  return { storeId: store.id, userId };
}

async function grant(storeId: string, root = `root-${crypto.randomUUID()}`, enabled = true, amount = 10) {
  return rpc<{ granted: boolean; grant_transaction_id: string }>("grant_demo_credits", [storeId, root, amount, enabled, 168, null, null]);
}

beforeAll(async () => { await query("select 1"); });
afterAll(async () => {
  await query("set session_replication_role = replica");
  if (stores.length) await query("delete from public.stores where id = any($1::uuid[])", [stores]);
  if (users.length) await query("delete from auth.users where id = any($1::uuid[])", [users]);
  await query("set session_replication_role = origin");
  await pool.end();
});

describe("F50-11 real PostgreSQL integration", () => {
  it("refunds within the original episode without extending its expiry", async () => {
    const { storeId } = await fixture();
    await grant(storeId);
    const before = (await query<{ demo_expires_at: string; demo_cycle_id: string }>("select demo_expires_at, demo_cycle_id from credit_balances where store_id = $1", [storeId]))[0];
    const deduction = await rpc<string>("reserve_credit", [storeId, 2, null, `deduct-${crypto.randomUUID()}`, {}]);
    const first = await rpc<string>("refund_credit", [deduction, "test", `refund-${crypto.randomUUID()}`, {}]);
    const second = await rpc<string>("refund_credit", [deduction, "test", `refund-retry-${crypto.randomUUID()}`, {}]);
    expect(second).toBe(first);
    const balance = (await query<{ demo_balance: number; demo_cycle_id: string; demo_expires_at: string }>("select demo_balance, demo_cycle_id, demo_expires_at from credit_balances where store_id = $1", [storeId]))[0];
    expect(balance.demo_balance).toBe(10);
    expect(balance.demo_cycle_id).toBeTruthy();
    expect(balance.demo_cycle_id).toBe(before.demo_cycle_id);
    expect(new Date(balance.demo_expires_at).getTime()).toBe(new Date(before.demo_expires_at).getTime());
    expect((await query("select count(*)::int as count from credit_transactions where store_id = $1 and type = 'refund'", [storeId]))[0].count).toBe(1);
  });

  it("materializes remaining credit before refund and opens a traceable 24-hour grace episode after expiry", async () => {
    const { storeId } = await fixture();
    const grantTx = await grant(storeId);
    const deduction = await rpc<string>("reserve_credit", [storeId, 1, null, `deduct-${crypto.randomUUID()}`, {}]);
    await query("update credit_balances set demo_expires_at = now() - interval '1 second' where store_id = $1", [storeId]);
    await rpc("refund_credit", [deduction, "expired", `refund-${crypto.randomUUID()}`, {}]);
    const balance = (await query<{ demo_balance: number; origin_demo_grant_tx_id: string; demo_expires_at: string; demo_contributing_tx_ids: string[] }>("select demo_balance, origin_demo_grant_tx_id, demo_expires_at, demo_contributing_tx_ids from credit_balances where store_id = $1", [storeId]))[0];
    expect(balance.demo_balance).toBe(1);
    expect(balance.origin_demo_grant_tx_id).toBe(grantTx.grant_transaction_id);
    expect(new Date(balance.demo_expires_at).getTime() - Date.now()).toBeGreaterThan(23 * 3600_000);
    expect(balance.demo_contributing_tx_ids.length).toBeGreaterThanOrEqual(2);
  });

  it("reserves demo, bonus, and purchased buckets in order with complete metadata", async () => {
    const { storeId } = await fixture();
    const grantTx = await grant(storeId, `root-${crypto.randomUUID()}`, true, 3);
    const bonusTx = await rpc<string>("grant_credits", [storeId, 5, "bonus", `bonus-${crypto.randomUUID()}`, {}, "admin_grant", null]);
    const purchasedTx = await rpc<string>("grant_credits", [storeId, 10, "purchase", `purchase-${crypto.randomUUID()}`, {}, "purchase", null]);
    const deductionId = await rpc<string>("reserve_credit", [storeId, 18, null, `deduct-${crypto.randomUUID()}`, { source: "mixed-buckets" }]);
    const deduction = (await query<{ metadata: Record<string, unknown>; amount: number }>("select metadata, amount from credit_transactions where id = $1", [deductionId]))[0];
    expect(deduction.amount).toBe(-18);
    expect(deduction.metadata).toMatchObject({
      demo_amount: 3,
      bonus_amount: 5,
      purchased_amount: 10,
      demo_before: 3,
      demo_after: 0,
      demo_cycle_id: expect.any(String),
      origin_demo_grant_tx_id: grantTx.grant_transaction_id,
    });
    expect(deduction.metadata.demo_cycle_id).toBeTruthy();
    expect(bonusTx).toBeTruthy();
    expect(purchasedTx).toBeTruthy();
  });

  it("materializes an expired demo during reserve and returns saldo_insuficiente without deduction", async () => {
    const { storeId } = await fixture();
    await grant(storeId);
    await query("update credit_balances set demo_expires_at = now() - interval '1 second' where store_id = $1", [storeId]);
    expect(await rpc("reserve_credit", [storeId, 1, null, `deduct-${crypto.randomUUID()}`, {}])).toBeNull();
    expect((await query<{ demo_balance: number; demo_expires_at: string | null }>("select demo_balance, demo_expires_at from credit_balances where store_id = $1", [storeId]))[0]).toMatchObject({ demo_balance: 0, demo_expires_at: null });
    expect((await query<{ count: number }>("select count(*)::int as count from credit_transactions where store_id = $1 and type = 'deduction'", [storeId]))[0].count).toBe(0);
  });

  it("materializes one exact expiration with cycle, origin, contributors, and zeroed episode fields", async () => {
    const { storeId } = await fixture();
    const grantTx = await grant(storeId);
    const cycle = (await query<{ demo_cycle_id: string }>("select demo_cycle_id from credit_balances where store_id = $1", [storeId]))[0].demo_cycle_id;
    await query("update credit_balances set demo_expires_at = now() - interval '1 second' where store_id = $1", [storeId]);
    const result = await rpc<{ expired: boolean; expiration_tx_id: string }>("materialize_demo_expiration", [storeId]);
    const balance = (await query<{ demo_balance: number; demo_expires_at: string | null; demo_cycle_id: string | null; origin_demo_grant_tx_id: string; demo_contributing_tx_ids: string[] }>("select demo_balance, demo_expires_at, demo_cycle_id, origin_demo_grant_tx_id, demo_contributing_tx_ids from credit_balances where store_id = $1", [storeId]))[0];
    const expiration = (await query<{ reference: string; amount: number; metadata: Record<string, unknown> }>("select reference, amount, metadata from credit_transactions where id = $1", [result.expiration_tx_id]))[0];
    expect(result.expired).toBe(true);
    expect(expiration).toMatchObject({ reference: cycle, amount: -10 });
    expect(expiration.metadata).toMatchObject({
      cycle_id: cycle,
      origin_demo_grant_tx_id: grantTx.grant_transaction_id,
      contributing_tx_ids: [grantTx.grant_transaction_id],
    });
    expect(balance).toMatchObject({ demo_balance: 0, demo_expires_at: null, demo_cycle_id: null, origin_demo_grant_tx_id: grantTx.grant_transaction_id, demo_contributing_tx_ids: [] });
  });

  it("uses GREATEST for active grace, preserves exhausted episodes, and restores bonus and purchased buckets", async () => {
    const { storeId } = await fixture();
    await grant(storeId);
    await rpc<string>("grant_credits", [storeId, 5, "bonus", `bonus-${crypto.randomUUID()}`, {}, "admin_grant", null]);
    await rpc<string>("grant_credits", [storeId, 10, "purchase", `purchase-${crypto.randomUUID()}`, {}, "purchase", null]);
    const deductionId = await rpc<string>("reserve_credit", [storeId, 18, null, `deduct-${crypto.randomUUID()}`, {}]);
    const original = (await query<{ demo_expires_at: string; demo_cycle_id: string }>("select demo_expires_at, demo_cycle_id from credit_balances where store_id = $1", [storeId]))[0];
    await rpc("refund_credit", [deductionId, "active-grace", `refund-${crypto.randomUUID()}`, {}]);
    const active = (await query<{ demo_expires_at: string; demo_cycle_id: string; demo_balance: number; bonus_balance: number; purchased_balance: number }>("select demo_expires_at, demo_cycle_id, demo_balance, bonus_balance, purchased_balance from credit_balances where store_id = $1", [storeId]))[0];
    expect(active.demo_cycle_id).toBe(original.demo_cycle_id);
    expect(new Date(active.demo_expires_at).getTime()).toBe(new Date(original.demo_expires_at).getTime());
    expect(active).toMatchObject({ demo_balance: 10, bonus_balance: 5, purchased_balance: 10 });

    const exhausted = await rpc<string>("reserve_credit", [storeId, 10, null, `deduct-${crypto.randomUUID()}`, {}]);
    await query("update credit_balances set demo_expires_at = now() - interval '1 second' where store_id = $1", [storeId]);
    await rpc("refund_credit", [exhausted, "expired-before-refund", `refund-${crypto.randomUUID()}`, {}]);
    const grace = (await query<{ demo_balance: number; demo_expires_at: string; demo_cycle_id: string; origin_demo_grant_tx_id: string }>("select demo_balance, demo_expires_at, demo_cycle_id, origin_demo_grant_tx_id from credit_balances where store_id = $1", [storeId]))[0];
    expect(grace.demo_balance).toBe(10);
    expect(new Date(grace.demo_expires_at).getTime() - Date.now()).toBeGreaterThan(23 * 3600_000);
    expect(grace.demo_cycle_id).not.toBe(original.demo_cycle_id);
    expect(grace.origin_demo_grant_tx_id).toBeTruthy();

    const graceDeduction = await rpc<string>("reserve_credit", [storeId, 2, null, `deduct-${crypto.randomUUID()}`, {}]);
    const graceBeforeRefund = (await query<{ demo_expires_at: string; demo_cycle_id: string }>("select demo_expires_at, demo_cycle_id from credit_balances where store_id = $1", [storeId]))[0];
    await rpc("refund_credit", [graceDeduction, "active-grace", `refund-${crypto.randomUUID()}`, {}]);
    const graceAfterRefund = (await query<{ demo_expires_at: string; demo_cycle_id: string }>("select demo_expires_at, demo_cycle_id from credit_balances where store_id = $1", [storeId]))[0];
    expect(graceAfterRefund.demo_cycle_id).toBe(graceBeforeRefund.demo_cycle_id);
    expect(new Date(graceAfterRefund.demo_expires_at).getTime()).toBeGreaterThanOrEqual(new Date(graceBeforeRefund.demo_expires_at).getTime());
    expect(new Date(graceAfterRefund.demo_expires_at).getTime()).toBeGreaterThanOrEqual(Date.now() + 23 * 3600_000);
  });

  it("restores an exhausted demo in the original episode before expiry", async () => {
    const { storeId } = await fixture();
    await grant(storeId);
    const deduction = await rpc<string>("reserve_credit", [storeId, 10, null, `deduct-${crypto.randomUUID()}`, {}]);
    const before = (await query<{ demo_expires_at: string; demo_cycle_id: string }>("select demo_expires_at, demo_cycle_id from credit_balances where store_id = $1", [storeId]))[0];
    await rpc("refund_credit", [deduction, "exhausted", `refund-${crypto.randomUUID()}`, {}]);
    const balance = (await query<{ demo_balance: number; demo_expires_at: string; demo_cycle_id: string }>("select demo_balance, demo_expires_at, demo_cycle_id from credit_balances where store_id = $1", [storeId]))[0];
    expect(balance.demo_balance).toBe(10);
    expect(balance.demo_cycle_id).toBe(before.demo_cycle_id);
    expect(new Date(balance.demo_expires_at).getTime()).toBe(new Date(before.demo_expires_at).getTime());
  });

  it("keeps wrapper signatures unique, service-role-only, and admin exception roots distinct", async () => {
    const names = ["create_store_with_cnpj", "update_store_cnpj", "admin_approve_store_verification", "admin_exception_store_verification", "create_store_with_initial_grant", "admin_create_store_for_user"];
    const signatures = await query<{ proname: string; count: number }>("select p.proname, count(*)::int as count from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = any($1::text[]) group by p.proname", [names]);
    expect(signatures).toHaveLength(names.length);
    expect(new Set(signatures.map((row) => row.proname))).toEqual(new Set(names));
    expect(signatures.every((row: { count: number }) => row.count === 1)).toBe(true);
    for (const name of names) {
      expect((await query<{ anon: boolean; authenticated: boolean; service: boolean }>("select has_function_privilege('anon', p.oid, 'execute') as anon, has_function_privilege('authenticated', p.oid, 'execute') as authenticated, has_function_privilege('service_role', p.oid, 'execute') as service from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = $1", [name]))[0]).toMatchObject({ anon: false, authenticated: false, service: true });
    }

    const first = await fixture();
    const second = await fixture();
    const adminId = first.userId;
    const one = await rpc<{ onboardingGranted: boolean }>("admin_exception_store_verification", [first.storeId, adminId, "reason"]);
    const retry = await rpc<{ onboardingGranted: boolean }>("admin_exception_store_verification", [first.storeId, adminId, "retry"]);
    await rpc("admin_exception_store_verification", [second.storeId, adminId, "reason"]);
    expect(one.onboardingGranted).toBe(true);
    expect(retry.onboardingGranted).toBe(false);
    expect((await query<{ count: number }>("select count(*)::int as count from freemium_entitlements where benefit_type = 'admin_exception' and store_id in ($1, $2)", [first.storeId, second.storeId]))[0].count).toBe(2);
    expect((await query<{ count: number }>("select count(*)::int as count from credit_transactions where type = 'admin_grant' and store_id = $1", [first.storeId]))[0].count).toBe(1);

    const beforeCnpj = (await query<{ count: number }>("select count(*)::int as count from credit_transactions where type = 'demo' and store_id = $1", [second.storeId]))[0].count;
    await rpc("update_store_cnpj", [second.storeId, "12345678000199", "root-admin-exception", null, null, {}, "approved", {}, {}, [], true]);
    const afterCnpj = (await query<{ count: number }>("select count(*)::int as count from credit_transactions where type = 'demo' and store_id = $1", [second.storeId]))[0].count;
    expect(afterCnpj).toBe(beforeCnpj);
  });

  it("fails closed without the demo flag and rolls back support request on an intermediate notification failure", async () => {
    const { storeId } = await fixture();
    const disabled = await grant(storeId, `disabled-${crypto.randomUUID()}`, false);
    expect(disabled.granted).toBe(false);
    expect((await query<{ count: number }>("select count(*)::int as count from credit_transactions where store_id = $1 and type = 'demo'", [storeId]))[0].count).toBe(0);

    const operationId = crypto.randomUUID();
    await query("insert into credit_notifications (store_id, user_id, kind, dedup_key, payload) values ($1, $2, 'support_ack', $3, '{}')", [storeId, (await query<{ user_id: string }>("select user_id from stores where id = $1", [storeId]))[0].user_id, operationId]);
    await expect(query("select public.create_support_credit_request($1::uuid, $2::uuid, $3::uuid, $4::text, '{}'::jsonb, 'support@f50.test')", [operationId, storeId, (await query<{ user_id: string }>("select user_id from stores where id = $1", [storeId]))[0].user_id, "rollback@f50.test"])).rejects.toThrow();
    expect((await query<{ count: number }>("select count(*)::int as count from support_credit_requests where operation_id = $1", [operationId]))[0].count).toBe(0);
    expect((await query<{ count: number }>("select count(*)::int as count from credit_notifications where dedup_key = $1 and kind = 'support_notice'", [operationId]))[0].count).toBe(0);
  });

  it("creates an admin store without credits and support request is atomic/idempotent", async () => {
    const adminFixture = await fixture();
    const targetUserId = crypto.randomUUID();
    users.push(targetUserId);
    await query("insert into auth.users (id, aud, role, email, created_at, updated_at) values ($1, 'authenticated', 'authenticated', $2, now(), now())", [targetUserId, `${targetUserId}@f50-11.test`]);
    const created = await rpc<{ id: string; balance: number }>("admin_create_store_for_user", [adminFixture.userId, targetUserId, `admin-${crypto.randomUUID()}`, "outros"]);
    expect(created.balance).toBe(0);
    expect((await query<{ count: number }>("select count(*)::int as count from credit_balances where store_id = $1", [created.id]))[0].count).toBe(0);
    const operationId = crypto.randomUUID();
    const callSupport = async (snapshot: object) => (await query<{ value: { protocol: string } }>("select public.create_support_credit_request($1::uuid, $2::uuid, $3::uuid, $4::text, $5::jsonb, $6::text) as value", [operationId, created.id, targetUserId, `${targetUserId}@f50-11.test`, JSON.stringify(snapshot), "support@f50.test"]))[0].value;
    const first = await callSupport({ reason: "test" });
    const retry = await callSupport({ reason: "changed" });
    expect(retry.protocol).toBe(first.protocol);
    expect((await query<{ count: number }>("select count(*)::int as count from support_credit_requests where operation_id = $1", [operationId]))[0].count).toBe(1);
    expect((await query<{ count: number }>("select count(*)::int as count from credit_notifications where dedup_key = $1 and kind in ('support_ack', 'support_notice')", [operationId]))[0].count).toBe(2);
  });
});
