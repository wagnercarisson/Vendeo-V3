import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFrom = vi.fn();
const mockSelect = vi.fn();

const mockSupabase = { from: mockFrom };

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(() => mockSupabase),
}));

function chain(value: unknown) {
  const c = {
    eq: vi.fn(() => c),
    in: vi.fn(() => c),
    order: vi.fn(() => c),
    limit: vi.fn(() => c),
  };
  return Object.assign(c, {
    then: (onFulfilled: (v: unknown) => unknown) =>
      Promise.resolve(value).then(onFulfilled),
  });
}

beforeEach(() => {
  vi.clearAllMocks();

  mockFrom.mockReturnValue({ select: mockSelect });
});

describe("countCampaigns", () => {
  it("returns total (ready + error)", async () => {
    mockSelect.mockReturnValue(chain({ count: 5, error: null }));

    const { countCampaigns } = await import("@/lib/campaign/metrics");

    const result = await countCampaigns("store-1");

    expect(result).toBe(5);
    expect(mockFrom).toHaveBeenCalledWith("campaigns");
  });

  it("returns 0 when no campaigns", async () => {
    mockSelect.mockReturnValue(chain({ count: 0, error: null }));

    const { countCampaigns } = await import("@/lib/campaign/metrics");

    const result = await countCampaigns("store-1");

    expect(result).toBe(0);
  });
});

describe("countReadyCampaigns", () => {
  it("returns only ready count", async () => {
    mockSelect.mockReturnValue(chain({ count: 3, error: null }));

    const { countReadyCampaigns } = await import("@/lib/campaign/metrics");

    const result = await countReadyCampaigns("store-1");

    expect(result).toBe(3);
    expect(mockFrom).toHaveBeenCalledWith("campaigns");
  });

  it("returns 0 when no ready campaigns", async () => {
    mockSelect.mockReturnValue(chain({ count: 0, error: null }));

    const { countReadyCampaigns } = await import("@/lib/campaign/metrics");

    const result = await countReadyCampaigns("store-1");

    expect(result).toBe(0);
  });
});

describe("getCampaignSuccessRate", () => {
  it("returns 0 when total = 0", async () => {
    mockSelect
      .mockImplementationOnce(() => chain({ count: 0, error: null }))
      .mockImplementationOnce(() => chain({ count: 0, error: null }));

    const { getCampaignSuccessRate } = await import("@/lib/campaign/metrics");

    const result = await getCampaignSuccessRate("store-1");

    expect(result).toBe(0);
  });

  it("returns 100 when all campaigns are ready", async () => {
    mockSelect
      .mockImplementationOnce(() => chain({ count: 5, error: null }))
      .mockImplementationOnce(() => chain({ count: 5, error: null }));

    const { getCampaignSuccessRate } = await import("@/lib/campaign/metrics");

    const result = await getCampaignSuccessRate("store-1");

    expect(result).toBe(100);
  });

  it("returns 50 when half are ready", async () => {
    mockSelect
      .mockImplementationOnce(() => chain({ count: 4, error: null }))
      .mockImplementationOnce(() => chain({ count: 2, error: null }));

    const { getCampaignSuccessRate } = await import("@/lib/campaign/metrics");

    const result = await getCampaignSuccessRate("store-1");

    expect(result).toBe(50);
  });
});

describe("getRecentCampaigns", () => {
  it("returns N items ordered by date descending", async () => {
    const mockData = [
      { id: "c1", product_name: "Tênis Runner Pro", status: "ready", created_at: "2026-07-02T10:00:00Z" },
      { id: "c2", product_name: "Café Gourmet", status: "ready", created_at: "2026-07-01T10:00:00Z" },
      { id: "c3", product_name: "Sofá 3 Lugares", status: "error", created_at: "2026-06-30T10:00:00Z" },
    ];
    mockSelect.mockReturnValue(chain({ data: mockData, error: null }));

    const { getRecentCampaigns } = await import("@/lib/campaign/metrics");

    const result = await getRecentCampaigns("store-1", 3);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      id: "c1",
      productName: "Tênis Runner Pro",
      status: "ready",
      createdAt: "2026-07-02T10:00:00Z",
    });
  });

  it("returns empty array when no campaigns", async () => {
    mockSelect.mockReturnValue(chain({ data: [], error: null }));

    const { getRecentCampaigns } = await import("@/lib/campaign/metrics");

    const result = await getRecentCampaigns("store-1");

    expect(result).toEqual([]);
  });
});
