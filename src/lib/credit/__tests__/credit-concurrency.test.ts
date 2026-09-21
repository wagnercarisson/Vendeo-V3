import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres" });
const stores: string[] = [];
const users: string[] = [];

async function query<T = Record<string, unknown>>(text: string, values: unknown[] = []) {
  return (await pool.query<T>(text, values)).rows;
}

async function fixture() {
  const userId = crypto.randomUUID();
  users.push(userId);
  await pool.query("insert into auth.users (id, aud, role, email, created_at, updated_at) values ($1, 'authenticated', 'authenticated', $2, now(), now())", [userId, `${userId}@f50.test`]);
  const [store] = await query<{ id: string }>(
    "insert into public.stores (name, segment, user_id) values ($1, 'outros', $2) returning id",
    [`f50-${crypto.randomUUID()}`, userId],
  );
  stores.push(store.id);
  return store.id;
}

async function rpc<T>(name: string, args: unknown[]) {
  const placeholders = args.map((_, i) => `$${i + 1}`).join(", ");
  return (await pool.query<{ value: T }>(`select public.${name}(${placeholders}) as value`, args)).rows[0].value;
}

beforeAll(async () => { await pool.query("select 1"); });

afterAll(async () => {
  await pool.query("set session_replication_role = replica");
  if (stores.length) await pool.query("delete from public.stores where id = any($1::uuid[])", [stores]);
  if (users.length) await pool.query("delete from auth.users where id = any($1::uuid[])", [users]);
  await pool.query("set session_replication_role = origin");
  await pool.end();
});

describe("F50 real PostgreSQL concurrency and temporal rules", () => {
  it("serializes concurrent demo grants to one entitlement and one transaction", async () => {
    const store = await fixture();
    const root = `race-${crypto.randomUUID()}`;
    const results = await Promise.all(Array.from({ length: 2 }, () => rpc<{ granted: boolean }>("grant_demo_credits", [store, root, 10, true, 168, `grant-${root}`, null])));
    expect(results.filter((value: { granted: boolean }) => value.granted)).toHaveLength(1);
    expect((await query("select count(*)::int as count from credit_transactions where store_id = $1 and type = 'demo'", [store]))[0].count).toBe(1);
  });

  it("serializes expiration and reserves without a negative balance", async () => {
    const store = await fixture();
    const grant = await rpc<{ granted: boolean; grant_transaction_id: string }>("grant_demo_credits", [store, `root-${store}`, 2, true, 168, null, null]);
    await query("update credit_balances set demo_expires_at = now() - interval '1 second' where store_id = $1", [store]);
    const expirations = await Promise.all([
      rpc<{ expired: boolean }>("materialize_demo_expiration", [store]),
      rpc<{ expired: boolean }>("materialize_demo_expiration", [store]),
    ]);
    expect(expirations.filter((result) => result.expired)).toHaveLength(1);
    expect((await query<{ count: number }>("select count(*)::int as count from credit_transactions where store_id = $1 and type = 'expiration'", [store]))[0].count).toBe(1);
    const activeStore = await fixture();
    await rpc<{ granted: boolean }>("grant_demo_credits", [activeStore, `root-active-${activeStore}`, 2, true, 168, null, null]);
    const results = await Promise.allSettled([
      rpc("reserve_credit", [activeStore, 1, null, `r-${activeStore}-1`, {}]),
      rpc("reserve_credit", [activeStore, 1, null, `r-${activeStore}-2`, {}]),
      rpc("reserve_credit", [activeStore, 1, null, `r-${activeStore}-3`, {}]),
    ]);
    expect(results.every((result) => result.status === "fulfilled")).toBe(true);
    expect(results.filter((result) => result.status === "fulfilled" && result.value !== null)).toHaveLength(2);
    expect(results.filter((result) => result.status === "fulfilled" && result.value === null)).toHaveLength(1);
    expect((await query<{ balance: number }>("select balance from credit_balances where store_id = $1", [activeStore]))[0].balance).toBe(0);
    expect((await query<{ count: number }>("select count(*)::int as count from credit_transactions where store_id = $1 and type = 'deduction'", [activeStore]))[0].count).toBe(2);
    expect(grant.granted).toBe(true);
  });
});
