import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc, update } = vi.hoisted(() => ({ rpc: vi.fn(), update: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: { rpc, from: vi.fn(() => ({ update })) },
}));

describe("Resend notification claim", () => {
  beforeEach(() => {
    rpc.mockReset();
    update.mockReset();
    update.mockReturnValue({ eq: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })) });
    vi.stubEnv("VENDEO_EMAIL_ENABLED", "false");
  });

  it("handles SETOF rows and an empty claim without a fallback query", async () => {
    rpc.mockResolvedValueOnce({ data: [{ id: "n1", attempt_count: 1 }], error: null });
    const { claimEmailNotification } = await import("../resend");
    await expect(claimEmailNotification()).resolves.toMatchObject({ id: "n1" });
    rpc.mockResolvedValueOnce({ data: [], error: null });
    await expect(claimEmailNotification()).resolves.toBeNull();
  });

  it("does not increment the claim attempt a second time on retry", async () => {
    vi.stubEnv("VENDEO_EMAIL_ENABLED", "true");
    vi.stubEnv("RESEND_API_KEY", "key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({ message: "down" }) }));
    const { processClaimedEmail } = await import("../resend");
    await processClaimedEmail({ id: "n1", store_id: "s1", kind: "demo_granted", payload: { recipient_email: "a@b.test" }, email_status: "processing", attempt_count: 2, next_attempt_at: null });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ attempt_count: 2, email_status: "pending" }));
  });
});
