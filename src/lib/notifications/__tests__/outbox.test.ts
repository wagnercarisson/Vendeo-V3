import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const { upsert, update } = vi.hoisted(() => ({ upsert: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: { from: vi.fn(() => ({ upsert, update })) },
}));

describe("notification outbox contract", () => {
  beforeEach(() => {
    upsert.mockReset();
    update.mockReset();
    update.mockReturnValue({ eq: () => ({ eq: () => Promise.resolve({ error: null }) }) });
    upsert.mockReturnValue({
      select: () => ({ maybeSingle: () => Promise.resolve({ data: { id: "n1" }, error: null }) }),
    });
  });

  it("uses the logical dedup key and ignores duplicate inserts", async () => {
    const { enqueueNotification } = await import("../outbox");
    await enqueueNotification({ storeId: "s1", kind: "demo_granted", dedupKey: "grant-1" });
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ store_id: "s1", kind: "demo_granted", dedup_key: "grant-1" }), {
      onConflict: "store_id,kind,dedup_key", ignoreDuplicates: true,
    });
  });

  it("fails closed for durable support notifications but fail-opens demo notifications", async () => {
    upsert.mockReturnValue({ select: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: new Error("db") }) }) });
    const { enqueueNotification } = await import("../outbox");
    await expect(enqueueNotification({ storeId: "s1", kind: "support_ack", dedupKey: "op-1" })).rejects.toThrow("db");
    await expect(enqueueNotification({ storeId: "s1", kind: "demo_expired", dedupKey: "expiration-1" })).resolves.toBeNull();
  });

  it("deduplicates expiring notices to the UTC hour", async () => {
    const { demoExpirationDedupKey } = await import("../outbox");
    expect(demoExpirationDedupKey(new Date("2026-09-21T12:34:56Z"))).toBe("2026-09-21T12:00:00.000Z");
  });

  it("keeps support notifications durable and distinct from demo suppression", async () => {
    const { enqueueNotification } = await import("../outbox");
    await enqueueNotification({ storeId: "s1", kind: "support_ack", dedupKey: "op-1", payload: { recipient_email: "a@b.test" } });
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ kind: "support_ack", payload: { recipient_email: "a@b.test" } }), expect.any(Object));
  });

  it("does not call Resend for support notifications while email is disabled or unconfigured", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("VENDEO_EMAIL_ENABLED", "false");
    vi.stubEnv("RESEND_API_KEY", "key");
    const { processClaimedEmail } = await import("@/lib/email/resend");
    await processClaimedEmail({ id: "n1", store_id: "s1", kind: "support_ack", payload: { recipient_email: "u@test" }, email_status: "processing", attempt_count: 1, next_attempt_at: null });
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it("has the atomic lease/reclaim and terminal retry contract", () => {
    const sql = readFileSync(resolve(process.cwd(), "supabase/migrations/20260924000001_f50_notification_claim.sql"), "utf8");
    const email = readFileSync(resolve(process.cwd(), "src/lib/email/resend.ts"), "utf8");
    expect(sql).toMatch(/FOR UPDATE SKIP LOCKED/);
    expect(sql).toMatch(/lease_expires_at <= p_now/);
    expect(email).toMatch(/finish\(row\.id, "failed"/);
    expect(email).toMatch(/next_attempt_at/);
    expect(email).toMatch(/!isSupport\(row\.kind\)/);
    expect(email).toMatch(/email_sent_at/);
  });
});
