import { vi, describe, it, expect, beforeEach } from "vitest";

const makeChain = () => {
  const chain: Record<string, any> = {};
  chain.upsert = vi.fn();
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.lte = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  chain.single = vi.fn();
  chain.maybeSingle = vi.fn();
  return chain;
};

const mockFrom = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: { from: mockFrom } }));

beforeEach(() => {
  vi.clearAllMocks();
  mockFrom.mockReturnValue(makeChain());
});

describe("privacy", () => {
  it("registerPrivacyAcknowledgement with valid data inserts record", async () => {
    const chain = makeChain();
    chain.upsert.mockResolvedValue({ error: null });
    mockFrom.mockReturnValue(chain);

    const { registerPrivacyAcknowledgement } = await import("../privacy");
    await registerPrivacyAcknowledgement({
      userId: "user-1",
      version: "v1.0",
      ipAddress: "127.0.0.1",
      userAgent: "test-agent",
    });

    expect(chain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "user-1" }),
      expect.objectContaining({ onConflict: "user_id" }),
    );
  });

  it("upsert idempotent on same version does not error", async () => {
    const chain = makeChain();
    chain.upsert.mockResolvedValue({ error: null });
    mockFrom.mockReturnValue(chain);

    const { registerPrivacyAcknowledgement } = await import("../privacy");
    await registerPrivacyAcknowledgement({
      userId: "user-1",
      version: "v1.0",
      ipAddress: "127.0.0.1",
      userAgent: "test-agent",
    });
    await registerPrivacyAcknowledgement({
      userId: "user-1",
      version: "v1.0",
      ipAddress: "127.0.0.1",
      userAgent: "test-agent",
    });

    expect(chain.upsert).toHaveBeenCalledTimes(2);
  });
});
