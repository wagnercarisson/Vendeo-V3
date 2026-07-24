import { vi, describe, it, expect, beforeEach } from "vitest";

const makeChain = () => {
  const chain: Record<string, any> = {};
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

describe("document-versions", () => {
  it("getCurrentVersion returns version when published", async () => {
    const chain = makeChain();
    chain.maybeSingle.mockResolvedValue({
      data: { version: "v1.0", effective_at: "2026-07-23T00:00:00Z", summary: "Initial version" },
      error: null,
    });
    mockFrom.mockReturnValue(chain);

    const { getCurrentVersion } = await import("../document-versions");
    const result = await getCurrentVersion("terms_of_service");
    expect(result?.version).toBe("v1.0");
  });

  it("getCurrentVersion returns null when no version", async () => {
    const chain = makeChain();
    chain.maybeSingle.mockResolvedValue({ data: null, error: null });
    mockFrom.mockReturnValue(chain);

    const { getCurrentVersion } = await import("../document-versions");
    const result = await getCurrentVersion("privacy_policy");
    expect(result).toBeNull();
  });

  it("getVersionHistory returns ordered array", async () => {
    const chain = makeChain();
    chain.order.mockResolvedValue({
      data: [
        { version: "v1.0", effective_at: "2026-07-23T00:00:00Z", summary: "First" },
        { version: "v0.9", effective_at: "2026-06-01T00:00:00Z", summary: "Earlier" },
      ],
      error: null,
    });
    mockFrom.mockReturnValue(chain);

    const { getVersionHistory } = await import("../document-versions");
    const result = await getVersionHistory("terms_of_service");
    expect(result).toHaveLength(2);
  });
});
