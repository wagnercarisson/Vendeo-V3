// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSupabaseFrom = vi.fn();
const mockStorageFrom = vi.fn();
const mockCreateServerClient = vi.fn();

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: mockCreateServerClient,
  supabaseAdmin: {
    from: vi.fn(),
    storage: {
      from: mockStorageFrom,
    },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const mockReadyItem = {
  id: "id-1",
  status: "ready" as const,
  storagePath: "store-123/id-1.jpg",
};

const mockErrorItem = {
  id: "id-2",
  status: "error" as const,
  storagePath: "store-123/id-2.jpg",
};

function buildChain(
  resolveData: { id: string; product_name: string; status: string; created_at: string; storage_path: string }[],
  totalCount: number = 0,
) {
  const lteFn = vi.fn().mockReturnThis();
  const gteFn = vi.fn().mockReturnThis();
  const ilikeFn = vi.fn().mockReturnThis();
  const rangeFn = vi.fn().mockReturnThis();
  const orderFn = vi.fn().mockReturnValue({ range: rangeFn });
  const inFn = vi.fn().mockReturnValue({ ilike: ilikeFn, gte: gteFn, lte: lteFn, order: orderFn });
  const eqFn = vi.fn().mockReturnValue({ in: inFn });
  const selectFn = vi.fn().mockReturnValue({ eq: eqFn });
  const fromFn = vi.fn().mockReturnValue({ select: selectFn });

  const resolvedQuery = {
    data: resolveData,
    error: null,
    count: totalCount || resolveData.length,
  };

  rangeFn.mockResolvedValue(resolvedQuery);

  const createSignedUrlFn = vi.fn().mockResolvedValue({
    data: { signedUrl: "https://example.com/thumb.jpg" },
    error: null,
  });
  mockStorageFrom.mockReturnValue({ createSignedUrl: createSignedUrlFn });
  mockCreateServerClient.mockResolvedValue({ from: fromFn });

  return { fromFn, selectFn, eqFn, inFn, ilikeFn, gteFn, lteFn, orderFn, rangeFn };
}

function mockDefaultRows() {
  return [
    {
      id: "id-1",
      product_name: "Produto 1",
      status: "ready",
      created_at: "2026-07-10T12:00:00Z",
      storage_path: "store-123/id-1.jpg",
    },
    {
      id: "id-2",
      product_name: "Produto 2",
      status: "error",
      created_at: "2026-07-09T12:00:00Z",
      storage_path: "store-123/id-2.jpg",
    },
  ];
}

describe("listCampaigns", () => {
  it("returns campaigns for owner store", async () => {
    const rows = mockDefaultRows();
    const { rangeFn } = buildChain(rows);

    const { listCampaigns } = await import("@/lib/campaign/list");
    const result = await listCampaigns("store-123");

    expect(result.items).toHaveLength(2);
    expect(result.items[0].id).toBe("id-1");
    expect(result.items[0].productName).toBe("Produto 1");
    expect(result.items[0].status).toBe("ready");
    expect(result.items[0].thumbnailUrl).toBe("https://example.com/thumb.jpg");
    expect(result.items[1].id).toBe("id-2");
    expect(result.items[1].productName).toBe("Produto 2");
    expect(result.items[1].status).toBe("error");
    expect(result.total).toBe(2);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(10);
    expect(result.totalPages).toBe(1);
    expect(rangeFn).toHaveBeenCalledWith(0, 9);
  });

  it("filters by status IN ('ready', 'error') via .in() call", async () => {
    const rows = mockDefaultRows();
    let capturedInArgs: [string, string[]] | null = null;

    const lteFn = vi.fn().mockReturnThis();
    const gteFn = vi.fn().mockReturnThis();
    const ilikeFn = vi.fn().mockReturnThis();
    const rangeFn = vi.fn().mockResolvedValue({ data: rows, error: null, count: 2 });
    const orderFn = vi.fn().mockReturnValue({ range: rangeFn });
    const inFn = vi.fn().mockImplementation((field: string, values: string[]) => {
      capturedInArgs = [field, values];
      return { ilike: ilikeFn, gte: gteFn, lte: lteFn, order: orderFn };
    });
    const eqFn = vi.fn().mockReturnValue({ in: inFn });
    const selectFn = vi.fn().mockReturnValue({ eq: eqFn });
    const fromFn = vi.fn().mockReturnValue({ select: selectFn });

    mockCreateServerClient.mockResolvedValue({ from: fromFn });
    const createSignedUrlFn = vi.fn().mockResolvedValue({
      data: { signedUrl: "https://example.com/thumb.jpg" },
      error: null,
    });
    mockStorageFrom.mockReturnValue({ createSignedUrl: createSignedUrlFn });

    const { listCampaigns } = await import("@/lib/campaign/list");
    await listCampaigns("store-123");

    expect(capturedInArgs).toEqual(["status", ["ready", "error"]]);
  });

  it("returns [] for store with no campaigns", async () => {
    const { rangeFn } = buildChain([], 0);
    rangeFn.mockResolvedValue({ data: [], error: null, count: 0 });

    const { listCampaigns } = await import("@/lib/campaign/list");
    const result = await listCampaigns("store-empty");

    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });

  it("returns [] for cross-tenant (RLS filters)", async () => {
    const { rangeFn } = buildChain([], 0);
    rangeFn.mockResolvedValue({ data: [], error: null, count: 0 });

    const { listCampaigns } = await import("@/lib/campaign/list");
    const result = await listCampaigns("other-store");

    expect(result.items).toEqual([]);
  });

  it("applies .eq('store_id', storeId) explicitly", async () => {
    const rows = mockDefaultRows();
    const { eqFn, rangeFn } = buildChain(rows);

    const { listCampaigns } = await import("@/lib/campaign/list");
    await listCampaigns("store-abc");

    expect(eqFn).toHaveBeenCalledWith("store_id", "store-abc");
  });

  it("with page=2 returns items from page 2 (.range(10, 19))", async () => {
    const rows = mockDefaultRows();
    const { rangeFn } = buildChain(rows);

    const { listCampaigns } = await import("@/lib/campaign/list");
    await listCampaigns("store-123", { page: 2 });

    expect(rangeFn).toHaveBeenCalledWith(10, 19);
  });

  it("with search applies ILIKE filter on product_name", async () => {
    const rows = mockDefaultRows();
    const { ilikeFn } = buildChain(rows);

    const { listCampaigns } = await import("@/lib/campaign/list");
    await listCampaigns("store-123", { search: "tenis" });

    expect(ilikeFn).toHaveBeenCalledWith("product_name", "%tenis%");
  });

  it("with status filter applies .in('status', ['ready'])", async () => {
    const rows = mockDefaultRows();
    let capturedInArgs: [string, string[]] | null = null;

    const lteFn = vi.fn().mockReturnThis();
    const gteFn = vi.fn().mockReturnThis();
    const ilikeFn = vi.fn().mockReturnThis();
    const rangeFn = vi.fn().mockResolvedValue({ data: rows, error: null, count: 1 });
    const orderFn = vi.fn().mockReturnValue({ range: rangeFn });
    const inFn = vi.fn().mockImplementation((field: string, values: string[]) => {
      capturedInArgs = [field, values];
      return { ilike: ilikeFn, gte: gteFn, lte: lteFn, order: orderFn };
    });
    const eqFn = vi.fn().mockReturnValue({ in: inFn });
    const selectFn = vi.fn().mockReturnValue({ eq: eqFn });
    const fromFn = vi.fn().mockReturnValue({ select: selectFn });

    mockCreateServerClient.mockResolvedValue({ from: fromFn });
    const createSignedUrlFn = vi.fn().mockResolvedValue({
      data: { signedUrl: "https://example.com/thumb.jpg" },
      error: null,
    });
    mockStorageFrom.mockReturnValue({ createSignedUrl: createSignedUrlFn });

    const { listCampaigns } = await import("@/lib/campaign/list");
    await listCampaigns("store-123", { status: ["ready"] });

    expect(capturedInArgs).toEqual(["status", ["ready"]]);
  });

  it("with dateFrom/dateTo applies gte/lte", async () => {
    const rows = mockDefaultRows();
    const { gteFn, lteFn } = buildChain(rows);

    const { listCampaigns } = await import("@/lib/campaign/list");
    await listCampaigns("store-123", {
      dateFrom: "2026-01-01",
      dateTo: "2026-12-31",
    });

    expect(gteFn).toHaveBeenCalledWith("created_at", "2026-01-01");
    expect(lteFn).toHaveBeenCalledWith("created_at", "2026-12-31");
  });

  it("with sortBy=product_name asc applies .order('product_name', { ascending: true })", async () => {
    const rows = mockDefaultRows();
    const { orderFn } = buildChain(rows);

    const { listCampaigns } = await import("@/lib/campaign/list");
    await listCampaigns("store-123", {
      sortBy: "product_name",
      sortOrder: "asc",
    });

    expect(orderFn).toHaveBeenCalledWith("product_name", { ascending: true });
  });

  it("returns ListCampaignsResult with correct total, page, totalPages", async () => {
    const rows = mockDefaultRows();
    const { rangeFn } = buildChain(rows, 15);

    const { listCampaigns } = await import("@/lib/campaign/list");
    const result = await listCampaigns("store-123", { page: 2 });

    expect(result.total).toBe(15);
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(10);
    expect(result.totalPages).toBe(2);
  });

  it("with page beyond total returns empty items", async () => {
    const { rangeFn } = buildChain([], 5);
    rangeFn.mockResolvedValue({ data: [], error: null, count: 5 });

    const { listCampaigns } = await import("@/lib/campaign/list");
    const result = await listCampaigns("store-123", { page: 999 });

    expect(result.items).toEqual([]);
    expect(result.total).toBe(5);
  });

  it("throws on supabase error", async () => {
    const lteFn = vi.fn().mockReturnThis();
    const gteFn = vi.fn().mockReturnThis();
    const ilikeFn = vi.fn().mockReturnThis();
    const rangeFn = vi.fn().mockResolvedValue({ data: null, error: { message: "DB error" }, count: null });
    const orderFn = vi.fn().mockReturnValue({ range: rangeFn });
    const inFn = vi.fn().mockReturnValue({ ilike: ilikeFn, gte: gteFn, lte: lteFn, order: orderFn });
    const eqFn = vi.fn().mockReturnValue({ in: inFn });
    const selectFn = vi.fn().mockReturnValue({ eq: eqFn });
    const fromFn = vi.fn().mockReturnValue({ select: selectFn });

    mockCreateServerClient.mockResolvedValue({ from: fromFn });
    const createSignedUrlFn = vi.fn().mockResolvedValue({
      data: { signedUrl: "https://example.com/thumb.jpg" },
      error: null,
    });
    mockStorageFrom.mockReturnValue({ createSignedUrl: createSignedUrlFn });

    const { listCampaigns } = await import("@/lib/campaign/list");
    await expect(listCampaigns("store-123")).rejects.toThrow("DB error");
  });

  it("uses defaults when no params provided", async () => {
    const rows = mockDefaultRows();
    const { rangeFn, orderFn } = buildChain(rows);

    const { listCampaigns } = await import("@/lib/campaign/list");
    const result = await listCampaigns("store-123");

    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(10);
    expect(orderFn).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(rangeFn).toHaveBeenCalledWith(0, 9);
  });
});

describe("countCampaignsFiltered", () => {
  it("returns count with search filter", async () => {
    const headSelectFn = vi.fn().mockReturnThis();
    const countEqFn = vi.fn().mockReturnThis();
    const countInFn = vi.fn().mockReturnThis();
    const countIlIkeFn = vi.fn().mockResolvedValue({ count: 3, error: null });
    const countLteFn = vi.fn().mockReturnThis();
    const countGteFn = vi.fn().mockReturnThis();

    countInFn.mockReturnValue({ ilike: countIlIkeFn, gte: countGteFn, lte: countLteFn });
    countEqFn.mockReturnValue({ in: countInFn });
    headSelectFn.mockReturnValue({ eq: countEqFn });

    const fromFn = vi.fn().mockReturnValue({ select: headSelectFn });
    mockCreateServerClient.mockResolvedValue({ from: fromFn });

    const { countCampaignsFiltered } = await import("@/lib/campaign/list");
    const result = await countCampaignsFiltered("store-123", { search: "tenis" });

    expect(result).toBe(3);
    expect(headSelectFn).toHaveBeenCalledWith("*", { count: "exact", head: true });
    expect(countEqFn).toHaveBeenCalledWith("store_id", "store-123");
    expect(countIlIkeFn).toHaveBeenCalledWith("product_name", "%tenis%");
  });

  it("returns total without filters", async () => {
    const countInFn = vi.fn().mockReturnValue(Promise.resolve({ count: 10, error: null }));
    const countEqFn = vi.fn().mockReturnValue({ in: countInFn });
    const headSelectFn = vi.fn().mockReturnValue({ eq: countEqFn });
    const fromFn = vi.fn().mockReturnValue({ select: headSelectFn });
    mockCreateServerClient.mockResolvedValue({ from: fromFn });

    const { countCampaignsFiltered } = await import("@/lib/campaign/list");
    const result = await countCampaignsFiltered("store-123");

    expect(result).toBe(10);
  });

  it("applies .eq('store_id', storeId) explicitly", async () => {
    const headSelectFn = vi.fn().mockReturnThis();
    const countEqFn = vi.fn().mockReturnThis();
    const countInFn = vi.fn().mockReturnThis();
    const countIlIkeFn = vi.fn().mockReturnThis();
    const countLteFn = vi.fn().mockReturnThis();
    const countGteFn = vi.fn().mockReturnThis();
    const lteFn = vi.fn().mockResolvedValue({ count: 5, error: null });

    countInFn.mockReturnValue({ ilike: countIlIkeFn, gte: countGteFn, lte: countLteFn });
    countEqFn.mockReturnValue({ in: countInFn });
    headSelectFn.mockReturnValue({ eq: countEqFn });

    countIlIkeFn.mockReturnThis();
    countGteFn.mockReturnThis();
    countLteFn.mockReturnValue(lteFn);

    const fromFn = vi.fn().mockReturnValue({ select: headSelectFn });
    mockCreateServerClient.mockResolvedValue({ from: fromFn });

    const { countCampaignsFiltered } = await import("@/lib/campaign/list");
    await countCampaignsFiltered("store-xyz");

    expect(countEqFn).toHaveBeenCalledWith("store_id", "store-xyz");
  });

  it("returns 0 when count is null", async () => {
    const headSelectFn = vi.fn().mockReturnThis();
    const countEqFn = vi.fn().mockReturnThis();
    const countInFn = vi.fn().mockReturnThis();
    const countIlIkeFn = vi.fn().mockReturnThis();
    const countLteFn = vi.fn().mockReturnThis();
    const countGteFn = vi.fn().mockReturnThis();
    const lteFn = vi.fn().mockResolvedValue({ count: null, error: null });

    countInFn.mockReturnValue({ ilike: countIlIkeFn, gte: countGteFn, lte: countLteFn });
    countEqFn.mockReturnValue({ in: countInFn });
    headSelectFn.mockReturnValue({ eq: countEqFn });

    countIlIkeFn.mockReturnThis();
    countGteFn.mockReturnThis();
    countLteFn.mockReturnValue(lteFn);

    const fromFn = vi.fn().mockReturnValue({ select: headSelectFn });
    mockCreateServerClient.mockResolvedValue({ from: fromFn });

    const { countCampaignsFiltered } = await import("@/lib/campaign/list");
    const result = await countCampaignsFiltered("store-123");

    expect(result).toBe(0);
  });
});

describe("generateBatchThumbnailUrls", () => {
  it("generates URLs for ready campaigns", async () => {
    const createSignedUrlFn = vi.fn().mockResolvedValue({
      data: { signedUrl: "https://example.com/thumb-1.jpg" },
      error: null,
    });
    mockStorageFrom.mockReturnValue({ createSignedUrl: createSignedUrlFn });

    const { generateBatchThumbnailUrls } = await import("@/lib/campaign/list");
    const result = await generateBatchThumbnailUrls([
      mockReadyItem,
      { ...mockReadyItem, id: "id-3", storagePath: "store-123/id-3.jpg" },
    ]);

    expect(Object.keys(result)).toHaveLength(2);
    expect(result["id-1"]).toBe("https://example.com/thumb-1.jpg");
    expect(result["id-3"]).toBe("https://example.com/thumb-1.jpg");
    expect(mockStorageFrom).toHaveBeenCalledWith("campaign-images");
  });

  it("does NOT generate URLs for error campaigns", async () => {
    const createSignedUrlFn = vi.fn().mockResolvedValue({
      data: { signedUrl: "https://example.com/thumb.jpg" },
      error: null,
    });
    mockStorageFrom.mockReturnValue({ createSignedUrl: createSignedUrlFn });

    const { generateBatchThumbnailUrls } = await import("@/lib/campaign/list");
    const result = await generateBatchThumbnailUrls([mockReadyItem, mockErrorItem]);

    expect(result["id-1"]).toBe("https://example.com/thumb.jpg");
    expect(result).not.toHaveProperty("id-2");
    expect(createSignedUrlFn).toHaveBeenCalledTimes(1);
  });

  it("handles partial failure with placeholder", async () => {
    const createSignedUrlFn = vi
      .fn()
      .mockResolvedValueOnce({
        data: { signedUrl: "https://example.com/thumb-1.jpg" },
        error: null,
      })
      .mockRejectedValueOnce(new Error("Storage error"));

    mockStorageFrom.mockReturnValue({ createSignedUrl: createSignedUrlFn });

    const { generateBatchThumbnailUrls } = await import("@/lib/campaign/list");
    const result = await generateBatchThumbnailUrls([
      mockReadyItem,
      { ...mockReadyItem, id: "id-3", storagePath: "store-123/id-3.jpg" },
    ]);

    expect(result["id-1"]).toBe("https://example.com/thumb-1.jpg");
    expect(result["id-3"]).toBeNull();
  });
});

describe("parseCampaignListSearchParams", () => {
  it("page=0 defaults to 1", async () => {
    const { parseCampaignListSearchParams } = await import("@/lib/campaign/search-params");
    const result = parseCampaignListSearchParams({ page: "0" });
    expect(result.page).toBe(1);
  });

  it("page=abc defaults to 1", async () => {
    const { parseCampaignListSearchParams } = await import("@/lib/campaign/search-params");
    const result = parseCampaignListSearchParams({ page: "abc" });
    expect(result.page).toBe(1);
  });

  it("status=generating is ignored (defaults to ready,error)", async () => {
    const { parseCampaignListSearchParams } = await import("@/lib/campaign/search-params");
    const result = parseCampaignListSearchParams({ status: "generating" });
    expect(result.status).toEqual(["ready", "error"]);
  });

  it("date=invalid defaults to all (dateFrom/dateTo undefined)", async () => {
    const { parseCampaignListSearchParams } = await import("@/lib/campaign/search-params");
    const result = parseCampaignListSearchParams({ date: "invalid" });
    expect(result.dateFrom).toBeUndefined();
    expect(result.dateTo).toBeUndefined();
  });

  it("sort=status is rejected (defaults to created_at)", async () => {
    const { parseCampaignListSearchParams } = await import("@/lib/campaign/search-params");
    const result = parseCampaignListSearchParams({ sort: "status" });
    expect(result.sortBy).toBe("created_at");
  });

  it("q empty becomes undefined", async () => {
    const { parseCampaignListSearchParams } = await import("@/lib/campaign/search-params");
    const result = parseCampaignListSearchParams({ q: "" });
    expect(result.q).toBeUndefined();
  });

  it("q with 200 chars is truncated to 100", async () => {
    const { parseCampaignListSearchParams } = await import("@/lib/campaign/search-params");
    const long = "a".repeat(200);
    const result = parseCampaignListSearchParams({ q: long });
    expect(result.q).toBe("a".repeat(100));
  });

  it("q with spaces is trimmed", async () => {
    const { parseCampaignListSearchParams } = await import("@/lib/campaign/search-params");
    const result = parseCampaignListSearchParams({ q: "  tenis  " });
    expect(result.q).toBe("tenis");
  });
});
