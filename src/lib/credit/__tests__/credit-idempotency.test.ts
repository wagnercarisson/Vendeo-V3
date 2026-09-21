import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres" });
const stores: string[] = [];
const users: string[] = [];
async function q<T = Record<string, unknown>>(sql: string, values: unknown[] = []) { return (await pool.query<T>(sql, values)).rows; }
async function rpc<T>(name: string, args: unknown[]) { return (await pool.query<{ value: T }>(`select public.${name}(${args.map((_, i) => `$${i + 1}`).join(", ")}) as value`, args)).rows[0].value; }
async function fixture() {
  const userId = crypto.randomUUID(); users.push(userId);
  await pool.query("insert into auth.users (id, aud, role, email, created_at, updated_at) values ($1, 'authenticated', 'authenticated', $2, now(), now())", [userId, `${userId}@f50.test`]);
  const store = (await q<{ id: string }>("insert into stores (name, segment, user_id) values ($1, 'outros', $2) returning id", [`f50-idem-${crypto.randomUUID()}`, userId]))[0].id;
  stores.push(store); return store;
}
beforeAll(async () => { await q("select 1"); });
afterAll(async () => { await pool.query("set session_replication_role = replica"); if (stores.length) await pool.query("delete from stores where id = any($1::uuid[])", [stores]); if (users.length) await pool.query("delete from auth.users where id = any($1::uuid[])", [users]); await pool.query("set session_replication_role = origin"); await pool.end(); });

describe("F50 PostgreSQL idempotency, permissions, eligibility and wrappers", () => {
  it("handles disabled, onboarding, duplicate, TTL and expiration idempotently", async () => {
    const store = await fixture(); const root = `root-${store}`;
    expect(await rpc("grant_demo_credits", [store, root, 10, false, 168, null, null])).toMatchObject({ granted: false, reason: "disabled" });
    await q("insert into freemium_entitlements (store_id, root_hash, benefit_type) values ($1, $2, 'onboarding')", [store, root]);
    expect(await rpc("grant_demo_credits", [store, root, 10, true, 168, null, null])).toMatchObject({ granted: false, reason: "onboarding_consumed" });
    await q("delete from freemium_entitlements where store_id = $1", [store]);
    const first = await rpc<{ granted: boolean; grant_transaction_id: string; demo_expires_at: string }>("grant_demo_credits", [store, root, 10, true, 168, "same", null]);
    expect(first.granted).toBe(true); expect(new Date(first.demo_expires_at).getTime() - Date.now()).toBeGreaterThan(167 * 3600_000);
    expect(await rpc("grant_demo_credits", [store, root, 10, true, 168, "same-2", null])).toMatchObject({ granted: false, reason: "already_granted" });
    await q("update credit_balances set demo_expires_at = now() - interval '1 second' where store_id = $1", [store]);
    expect((await rpc<{ expired: boolean }>("materialize_demo_expiration", [store])).expired).toBe(true);
    expect((await rpc<{ expired: boolean }>("materialize_demo_expiration", [store])).expired).toBe(false);
  });

  it("deduplicates notification/event writes and enforces service-role-only RPCs", async () => {
    const store = await fixture();
    await q("insert into credit_notifications (store_id, kind, dedup_key) values ($1, 'demo_granted', 'same') on conflict do nothing", [store]);
    await q("insert into credit_notifications (store_id, kind, dedup_key) values ($1, 'demo_granted', 'same') on conflict do nothing", [store]);
    expect((await q("select count(*)::int as count from credit_notifications where store_id = $1", [store]))[0].count).toBe(1);
    await q("insert into product_events (store_id, user_id, event_type, dedup_key, properties) values ($1, (select user_id from stores where id = $1), 'demo_granted', 'same', '{}') on conflict do nothing", [store]);
    await q("insert into product_events (store_id, user_id, event_type, dedup_key, properties) values ($1, (select user_id from stores where id = $1), 'demo_granted', 'same', '{}') on conflict do nothing", [store]);
    expect((await q("select count(*)::int as count from product_events where store_id = $1 and event_type = 'demo_granted' and dedup_key = 'same'", [store]))[0].count).toBe(1);
    expect((await q("select has_function_privilege('anon', 'public.grant_demo_credits(uuid,text,integer,boolean,integer,text,uuid)', 'execute') as allowed"))[0].allowed).toBe(false);
  });
});
