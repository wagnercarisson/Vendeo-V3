import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres" });
const users: string[] = [];
const requests: string[] = [];
const operations: string[] = [];
const query = async <T = Record<string, unknown>>(text: string, values: unknown[] = []) => (await pool.query<T>(text, values)).rows;
const rpc = async <T>(name: string, args: unknown[]) => (await pool.query<{ value: T }>(`select public.${name}(${args.map((_, i) => `$${i + 1}`).join(", ")}) as value`, args)).rows[0].value;

async function user() {
  const id = crypto.randomUUID();
  users.push(id);
  await pool.query("insert into auth.users (id, aud, role, email, created_at, updated_at) values ($1, 'authenticated', 'authenticated', $2, now(), now())", [id, `${id}@dsr.test`]);
  return id;
}

beforeAll(async () => { await pool.query("select 1"); });
afterAll(async () => {
  await pool.query("set session_replication_role = replica");
  if (requests.length) await pool.query("delete from public.data_subject_requests where id = any($1::uuid[])", [requests]);
  if (operations.length) await pool.query("delete from public.admin_audit_log where operation_id = any($1::uuid[])", [operations]);
  if (users.length) await pool.query("delete from auth.users where id = any($1::uuid[])", [users]);
  await pool.query("set session_replication_role = origin");
  await pool.end();
});

describe("data_subject_requests PostgreSQL atomic contract", () => {
  it("registers concurrently and idempotently with one audit", async () => {
    const actor = await user(); const operation = crypto.randomUUID();
    operations.push(operation);
    const args = [actor, operation, "access", actor, null, "a@b.test", "export", {}, false];
    const results = await Promise.all([rpc<Record<string, unknown>>("admin_register_data_subject_request", args), rpc<Record<string, unknown>>("admin_register_data_subject_request", args)]);
    requests.push(results[0].id as string);
    expect(new Set(results.map((r) => r.id)).size).toBe(1);
    expect((await query("select count(*)::int as count from admin_audit_log where operation_id = $1", [operation]))[0].count).toBe(1);
  });

  it("enforces lifecycle, persists audit, and rejects cancellation after start", async () => {
    const actor = await user(); const operation = crypto.randomUUID();
    operations.push(operation);
    const row = await rpc<Record<string, unknown>>("admin_register_data_subject_request", [actor, operation, "closure", actor, null, "a@b.test", "close", {}, false]);
    requests.push(row.id as string);
    await rpc("admin_transition_data_subject_request", [actor, row.id, crypto.randomUUID(), "in_progress", null]);
    const rejected = await rpc<{ rejected: boolean }>("admin_transition_data_subject_request", [actor, row.id, crypto.randomUUID(), "cancelled", null]);
    expect(rejected.rejected).toBe(true);
    const current = (await query<{ status: string; deletion_due_at: string | null }>("select status, deletion_due_at from data_subject_requests where id = $1", [row.id]))[0];
    expect(current.status).toBe("in_progress"); expect(current.deletion_due_at).not.toBeNull();
    await expect(rpc("admin_transition_data_subject_request", [actor, row.id, crypto.randomUUID(), "completed", { exported: true }])).resolves.toBeDefined();
    expect((await query<{ status: string; completed_at: string | null }>("select status, completed_at from data_subject_requests where id = $1", [row.id]))[0]).toMatchObject({ status: "completed" });
    expect((await query("select count(*)::int as count from admin_audit_log where target_id = $1", [row.id]))[0].count).toBe(4);
  });

  it("rolls back registration when audit insertion fails", async () => {
    const operation = crypto.randomUUID();
    await expect(rpc("admin_register_data_subject_request", [crypto.randomUUID(), operation, "access", null, null, "a@b.test", "x", {}, false])).rejects.toThrow();
    expect((await query("select count(*)::int as count from data_subject_requests where operation_id = $1", [operation]))[0].count).toBe(0);
  });

  it("rolls back a transition when its audit insertion fails", async () => {
    const actor = await user(); const operation = crypto.randomUUID(); operations.push(operation);
    const row = await rpc<Record<string, unknown>>("admin_register_data_subject_request", [actor, operation, "access", actor, null, "a@b.test", "transition", {}, false]);
    requests.push(row.id as string);
    await expect(rpc("admin_transition_data_subject_request", [crypto.randomUUID(), row.id, crypto.randomUUID(), "in_progress", null])).rejects.toThrow();
    expect((await query<{ status: string }>("select status from data_subject_requests where id = $1", [row.id]))[0].status).toBe("received");
  });
});
