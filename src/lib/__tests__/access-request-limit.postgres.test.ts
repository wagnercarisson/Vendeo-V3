import { Pool } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

const pool = new Pool({
  connectionString: process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
});
const requestIds: string[] = [];
const auditTargetIds: string[] = [];
const users: string[] = [];

const query = async <T = Record<string, unknown>>(text: string, values: unknown[] = []) =>
  (await pool.query<T>(text, values)).rows;

const rpc = async <T = Record<string, unknown>>(args: unknown[]) => {
  const placeholders = args.map((_, index) => `$${index + 1}`).join(", ");
  return (await pool.query<{ value: T }>(
    `select public.admin_review_access_request(${placeholders}) as value`,
    args,
  )).rows[0].value;
};

async function actor() {
  const id = crypto.randomUUID();
  users.push(id);
  await query(
    "insert into auth.users (id, aud, role, email, created_at, updated_at) values ($1, 'authenticated', 'authenticated', $2, now(), now())",
    [id, `${id}@access-limit.test`],
  );
  return id;
}

async function pending(email: string) {
  const [row] = await query<{ id: string }>(
    "insert into public.access_requests (email, name) values ($1, 'Teste') returning id",
    [email],
  );
  requestIds.push(row.id);
  return row.id;
}

async function seedApproved(actorId: string, count: number) {
  for (let index = 0; index < count; index += 1) {
    const email = `approved-${index}-${crypto.randomUUID()}@example.test`;
    const [row] = await query<{ id: string }>(
      "insert into public.access_requests (email, status, reviewed_at, reviewed_by) values ($1, 'approved', now(), $2) returning id",
      [email, actorId],
    );
    requestIds.push(row.id);
  }
}

async function review(requestId: string, action: "approve" | "reject", actorId: string) {
  return rpc([requestId, action, actorId, null]);
}

beforeAll(async () => {
  await query("select 1");
});

async function cleanup() {
  const client = await pool.connect();
  let transactionStarted = false;
  try {
    await client.query("begin");
    transactionStarted = true;
    await client.query("set local session_replication_role = replica");
    if (auditTargetIds.length) {
      await client.query("delete from public.admin_audit_log where target_id = any($1::uuid[])", [auditTargetIds]);
    }
    if (requestIds.length) {
      await client.query("delete from public.access_requests where id = any($1::uuid[])", [requestIds]);
    }
    if (users.length) {
      await client.query("delete from auth.users where id = any($1::uuid[])", [users]);
    }
    await client.query("commit");
    transactionStarted = false;
  } finally {
    requestIds.length = 0;
    auditTargetIds.length = 0;
    users.length = 0;
    if (transactionStarted) {
      await client.query("rollback").catch(() => undefined);
    }
    client.release();
  }
}

afterEach(cleanup);

afterAll(async () => {
  await pool.end();
});

describe("admin_review_access_request beta limit", () => {
  it("approves the 50th distinct email after 49 approvals", async () => {
    const admin = await actor();
    await seedApproved(admin, 49);
    const requestId = await pending("fiftieth@example.test");
    auditTargetIds.push(requestId);

    await expect(review(requestId, "approve", admin)).resolves.toMatchObject({ status: "approved" });
    expect((await query<{ count: number }>(
      "select count(distinct lower(email))::int as count from public.access_requests where status = 'approved'",
    ))[0].count).toBe(50);
    await expect(pending("FIFTIETH@EXAMPLE.TEST")).rejects.toThrow("uq_access_requests_email_active");
  });

  it("rejects the 51st approval without changing status or audit", async () => {
    const admin = await actor();
    await seedApproved(admin, 50);
    const requestId = await pending("fifty-first@example.test");
    auditTargetIds.push(requestId);

    await expect(review(requestId, "approve", admin)).rejects.toThrow("access_limit_reached");
    expect((await query<{ status: string }>("select status from public.access_requests where id = $1", [requestId]))[0].status).toBe("pending");
    expect((await query<{ count: number }>("select count(*)::int as count from public.admin_audit_log where target_id = $1", [requestId]))[0].count).toBe(0);
  });

  it("permits rejection when the beta limit is full", async () => {
    const admin = await actor();
    await seedApproved(admin, 50);
    const requestId = await pending("reject-at-limit@example.test");
    auditTargetIds.push(requestId);

    await expect(review(requestId, "reject", admin)).resolves.toMatchObject({ status: "rejected" });
    expect((await query<{ status: string }>("select status from public.access_requests where id = $1", [requestId]))[0].status).toBe("rejected");
    expect((await query<{ count: number }>("select count(*)::int as count from public.admin_audit_log where target_id = $1", [requestId]))[0].count).toBe(1);
  });

  it("enforces case-insensitive identity for active requests", async () => {
    const admin = await actor();
    await seedApproved(admin, 49);
    const rejectedId = await pending("CASE-LIMIT-TARGET@EXAMPLE.TEST");
    auditTargetIds.push(rejectedId);
    await expect(review(rejectedId, "reject", admin)).resolves.toMatchObject({ status: "rejected" });
    const requestId = await pending("case-limit-target@example.test");
    auditTargetIds.push(requestId);

    await expect(review(requestId, "approve", admin)).resolves.toMatchObject({ status: "approved" });
    expect((await query<{ count: number }>(
      "select count(distinct lower(email))::int as count from public.access_requests where status = 'approved'",
    ))[0].count).toBe(50);
  });

  it("serializes concurrent approvals at 49 distinct approved emails", async () => {
    const admin = await actor();
    await seedApproved(admin, 49);
    const first = await pending("concurrent-one@example.test");
    const second = await pending("concurrent-two@example.test");
    auditTargetIds.push(first, second);

    const results = await Promise.allSettled([
      review(first, "approve", admin),
      review(second, "approve", admin),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected" && result.reason.message.includes("access_limit_reached"))).toHaveLength(1);
    expect((await query<{ count: number }>(
      "select count(distinct lower(email))::int as count from public.access_requests where status = 'approved'",
    ))[0].count).toBe(50);
  });

  it("keeps the audit trigger enabled and rejects direct deletion", async () => {
    const admin = await actor();
    const requestId = await pending("audit-trigger@example.test");
    auditTargetIds.push(requestId);
    await expect(review(requestId, "reject", admin)).resolves.toMatchObject({ status: "rejected" });

    const [trigger] = await query<{ tgenabled: string }>(
      "select tgenabled from pg_trigger where tgrelid = 'public.admin_audit_log'::regclass and tgname = 'trg_admin_audit_log_immutable'",
    );
    expect(trigger.tgenabled).toBe("O");
    await expect(query(
      "delete from public.admin_audit_log where target_id = $1",
      [requestId],
    )).rejects.toThrow("append-only");
  });
});
