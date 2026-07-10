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

describe("listCampaigns", () => {
  it("returns campaigns for owner store", async () => {
    const mockRows = [
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

    const limitFn = vi.fn().mockResolvedValue({ data: mockRows, error: null });
    const orderFn = vi.fn().mockReturnValue({ limit: limitFn });
    const inFn = vi.fn().mockReturnValue({ order: orderFn });
    const eqFn = vi.fn().mockReturnValue({ in: inFn });
    const selectFn = vi.fn().mockReturnValue({ eq: eqFn });
    const fromFn = vi.fn().mockReturnValue({ select: selectFn });

    mockCreateServerClient.mockResolvedValue({ from: fromFn });

    const createSignedUrlFn = vi.fn().mockResolvedValue({
      data: { signedUrl: "https://example.com/thumb-1.jpg" },
      error: null,
    });
    mockStorageFrom.mockReturnValue({ createSignedUrl: createSignedUrlFn });

    const { listCampaigns } = await import("@/lib/campaign/list");
    const result = await listCampaigns("store-123");

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("id-1");
    expect(result[0].productName).toBe("Produto 1");
    expect(result[0].status).toBe("ready");
    expect(result[0].thumbnailUrl).toBe("https://example.com/thumb-1.jpg");
    expect(result[1].id).toBe("id-2");
    expect(result[1].productName).toBe("Produto 2");
    expect(result[1].status).toBe("error");
    expect(mockCreateServerClient).toHaveBeenCalled();
    expect(fromFn).toHaveBeenCalledWith("campaigns");
  });

  it("filters by status IN ('ready', 'error') via .in() call", async () => {
    const mockRows = [
      {
        id: "id-1",
        product_name: "Ready Product",
        status: "ready",
        created_at: "2026-07-10T12:00:00Z",
        storage_path: "store-123/id-1.jpg",
      },
      {
        id: "id-2",
        product_name: "Error Product",
        status: "error",
        created_at: "2026-07-09T12:00:00Z",
        storage_path: "store-123/id-2.jpg",
      },
    ];

    let capturedInArgs: [string, string[]] | null = null;

    const limitFn = vi.fn().mockResolvedValue({ data: mockRows, error: null });
    const orderFn = vi.fn().mockReturnValue({ limit: limitFn });
    const inFn = vi
      .fn()
      .mockImplementation((field: string, values: string[]) => {
        capturedInArgs = [field, values];
        return { order: orderFn };
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
    const limitFn = vi.fn().mockResolvedValue({ data: [], error: null });
    const orderFn = vi.fn().mockReturnValue({ limit: limitFn });
    const inFn = vi.fn().mockReturnValue({ order: orderFn });
    const eqFn = vi.fn().mockReturnValue({ in: inFn });
    const selectFn = vi.fn().mockReturnValue({ eq: eqFn });
    const fromFn = vi.fn().mockReturnValue({ select: selectFn });

    mockCreateServerClient.mockResolvedValue({ from: fromFn });

    const { listCampaigns } = await import("@/lib/campaign/list");
    const result = await listCampaigns("store-empty");

    expect(result).toEqual([]);
  });

  it("returns [] for cross-tenant (RLS filters)", async () => {
    const limitFn = vi.fn().mockResolvedValue({ data: [], error: null });
    const orderFn = vi.fn().mockReturnValue({ limit: limitFn });
    const inFn = vi.fn().mockReturnValue({ order: orderFn });
    const eqFn = vi.fn().mockReturnValue({ in: inFn });
    const selectFn = vi.fn().mockReturnValue({ eq: eqFn });
    const fromFn = vi.fn().mockReturnValue({ select: selectFn });

    mockCreateServerClient.mockResolvedValue({ from: fromFn });

    const { listCampaigns } = await import("@/lib/campaign/list");
    const result = await listCampaigns("other-store");

    expect(result).toEqual([]);
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
