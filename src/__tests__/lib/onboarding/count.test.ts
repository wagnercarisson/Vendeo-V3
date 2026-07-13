import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockIn = vi.fn();

const mockSupabase = {
  from: mockFrom,
};

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(() => mockSupabase),
}));

beforeEach(() => {
  vi.clearAllMocks();

  mockFrom.mockReturnValue({ select: mockSelect });
  mockSelect.mockReturnValue({ eq: mockEq });
  mockEq.mockReturnValue({ in: mockIn });
});

describe("countCampaigns", () => {
  it("returns count when campaigns exist", async () => {
    mockIn.mockResolvedValue({ count: 3, error: null });

    const { countCampaigns } = await import("@/lib/onboarding/count");

    const result = await countCampaigns("store-456");

    expect(result).toBe(3);
    expect(mockFrom).toHaveBeenCalledWith("campaigns");
    expect(mockSelect).toHaveBeenCalledWith("*", {
      count: "exact",
      head: true,
    });
    expect(mockEq).toHaveBeenCalledWith("store_id", "store-456");
    expect(mockIn).toHaveBeenCalledWith("status", ["ready", "error"]);
  });

  it("returns 0 when no campaigns", async () => {
    mockIn.mockResolvedValue({ count: 0, error: null });

    const { countCampaigns } = await import("@/lib/onboarding/count");

    const result = await countCampaigns("store-456");

    expect(result).toBe(0);
  });

  it("throws Error when query fails", async () => {
    mockIn.mockResolvedValue({
      count: null,
      error: { message: "DB error" },
    });

    const { countCampaigns } = await import("@/lib/onboarding/count");

    await expect(countCampaigns("store-456")).rejects.toThrow("DB error");
  });
});
