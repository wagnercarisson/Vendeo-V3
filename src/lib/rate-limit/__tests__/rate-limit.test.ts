import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockFrom } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: { from: mockFrom },
}));

import { checkRateLimit, recordGenerationAttempt } from "../rate-limit";

beforeEach(() => {
  vi.clearAllMocks();

  // Default: supabaseAdmin.from returns select chain
  mockFrom.mockImplementation((table: string) => {
    if (table === "generation_rate_events") {
      const selectChain = {
        eq: vi.fn(() => selectChain),
        gte: vi.fn(() => Promise.resolve({ data: null, count: 0, error: null })),
        insert: vi.fn(() => Promise.resolve({ error: null })),
      };
      return {
        select: vi.fn(() => selectChain),
        insert: vi.fn(() => Promise.resolve({ error: null })),
      };
    }
    return {};
  });
});

const storeId = "00000000-0000-0000-0000-000000000001";
const userId = "00000000-0000-0000-0000-000000000002";

describe("checkRateLimit", () => {
  it("allows when both windows are below limit", async () => {
    const result = await checkRateLimit(storeId);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBeDefined();
    expect(result.remaining!.hourly).toBeGreaterThanOrEqual(0);
    expect(result.remaining!.daily).toBeGreaterThanOrEqual(0);
  });

  it("blocks when hourly limit exceeded (>= 10)", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "generation_rate_events") {
        const selectChain = {
          eq: vi.fn(() => selectChain),
          gte: vi.fn(() => Promise.resolve({ data: null, count: 10, error: null })),
          insert: vi.fn(() => Promise.resolve({ error: null })),
        };
        return {
          select: vi.fn(() => selectChain),
          insert: vi.fn(() => Promise.resolve({ error: null })),
        };
      }
      return {};
    });

    const result = await checkRateLimit(storeId);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("hourly_limit_exceeded");
  });

  it("blocks when daily limit exceeded (>= 30)", async () => {
    let gteCallCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === "generation_rate_events") {
        const selectChain = {
          eq: vi.fn(() => selectChain),
          gte: vi.fn(() => {
            gteCallCount++;
            const count = gteCallCount === 1 ? 5 : 30;
            return Promise.resolve({ data: null, count, error: null });
          }),
          insert: vi.fn(() => Promise.resolve({ error: null })),
        };
        return {
          select: vi.fn(() => selectChain),
          insert: vi.fn(() => Promise.resolve({ error: null })),
        };
      }
      return {};
    });

    const result = await checkRateLimit(storeId);
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("daily_limit_exceeded");
  });
});

describe("recordGenerationAttempt", () => {
  it("inserts with campaign_id = null", async () => {
    const insertFn = vi.fn(() => Promise.resolve({ error: null }));

    mockFrom.mockImplementation((table: string) => {
      if (table === "generation_rate_events") {
        const selectChain = {
          eq: vi.fn(() => selectChain),
          gte: vi.fn(() => Promise.resolve({ data: null, count: 0, error: null })),
        };
        return {
          select: vi.fn(() => selectChain),
          insert: insertFn,
        };
      }
      return {};
    });

    await recordGenerationAttempt(storeId, userId);
    expect(insertFn).toHaveBeenCalledWith(
      expect.objectContaining({
        store_id: storeId,
        user_id: userId,
        campaign_id: null,
      })
    );
  });

  it("inserts with campaign_id when provided", async () => {
    const insertFn = vi.fn(() => Promise.resolve({ error: null }));
    const campaignId = "00000000-0000-0000-0000-000000000003";

    mockFrom.mockImplementation((table: string) => {
      if (table === "generation_rate_events") {
        const selectChain = {
          eq: vi.fn(() => selectChain),
          gte: vi.fn(() => Promise.resolve({ data: null, count: 0, error: null })),
        };
        return {
          select: vi.fn(() => selectChain),
          insert: insertFn,
        };
      }
      return {};
    });

    await recordGenerationAttempt(storeId, userId, campaignId);
    expect(insertFn).toHaveBeenCalledWith(
      expect.objectContaining({
        store_id: storeId,
        user_id: userId,
        campaign_id: campaignId,
      })
    );
  });

  it("event persists even if generation fails later", async () => {
    const insertFn = vi.fn(() => Promise.resolve({ error: null }));

    mockFrom.mockImplementation((table: string) => {
      if (table === "generation_rate_events") {
        const selectChain = {
          eq: vi.fn(() => selectChain),
          gte: vi.fn(() => Promise.resolve({ data: null, count: 0, error: null })),
        };
        return {
          select: vi.fn(() => selectChain),
          insert: insertFn,
        };
      }
      return {};
    });

    await recordGenerationAttempt(storeId, userId);
    expect(insertFn).toHaveBeenCalledTimes(1);

    // Simulate failure — record is not removed
    expect(insertFn).toHaveBeenCalledWith(
      expect.objectContaining({ store_id: storeId })
    );
  });
});
