// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSupabaseFrom = vi.fn();
const mockStorageFrom = vi.fn();

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: {
    from: mockSupabaseFrom,
    storage: {
      from: mockStorageFrom,
    },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createCampaign", () => {
  it("generates UUID and storage_path, inserts status=generating", async () => {
    mockSupabaseFrom.mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
    });

    const { createCampaign } = await import("@/lib/campaign/persistence");
    const result = await createCampaign("store-1", {
      productName: "Test Product",
      inputSnapshot: { productName: "Test Product" },
    });

    expect(result.id).toBeDefined();
    expect(result.storagePath).toBe(`store-1/${result.id}.jpg`);
    expect(mockSupabaseFrom).toHaveBeenCalledWith("campaigns");

    const insertFn = mockSupabaseFrom.mock.results[0].value.insert;
    expect(insertFn).toHaveBeenCalledWith(
      expect.objectContaining({
        store_id: "store-1",
        status: "generating",
        product_name: "Test Product",
      })
    );
  });

  it("rejects invalid storeId (propagates Supabase error)", async () => {
    mockSupabaseFrom.mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: new Error("insert error") }),
    });

    const { createCampaign } = await import("@/lib/campaign/persistence");
    await expect(createCampaign("bad-store", {
      productName: "Test",
      inputSnapshot: {},
    })).rejects.toThrow("insert error");
  });
});

describe("dataUrlToCampaignImage", () => {
  it("accepts image/png data URL", async () => {
    const { dataUrlToCampaignImage } = await import("@/lib/campaign/persistence");
    const result = dataUrlToCampaignImage("data:image/png;base64,iVBORw0KGgo=");
    expect(result.mimeType).toBe("image/png");
    expect(result.buffer).toBeInstanceOf(Buffer);
    expect(result.buffer.length).toBeGreaterThan(0);
  });

  it("accepts image/jpeg data URL", async () => {
    const { dataUrlToCampaignImage } = await import("@/lib/campaign/persistence");
    const result = dataUrlToCampaignImage("data:image/jpeg;base64,/9j/4AAQ==");
    expect(result.mimeType).toBe("image/jpeg");
    expect(result.buffer).toBeInstanceOf(Buffer);
  });

  it("accepts image/webp data URL", async () => {
    const { dataUrlToCampaignImage } = await import("@/lib/campaign/persistence");
    const result = dataUrlToCampaignImage("data:image/webp;base64,UklGRiQ=");
    expect(result.mimeType).toBe("image/webp");
    expect(result.buffer).toBeInstanceOf(Buffer);
  });

  it("rejects unsupported MIME type", async () => {
    const { dataUrlToCampaignImage } = await import("@/lib/campaign/persistence");
    expect(() => dataUrlToCampaignImage("data:image/gif;base64,R0lGODlh")).toThrow(
      "Unsupported or malformed data URL"
    );
  });

  it("rejects empty string", async () => {
    const { dataUrlToCampaignImage } = await import("@/lib/campaign/persistence");
    expect(() => dataUrlToCampaignImage("")).toThrow(
      "Unsupported or malformed data URL"
    );
  });

  it("rejects malformed data URL", async () => {
    const { dataUrlToCampaignImage } = await import("@/lib/campaign/persistence");
    expect(() => dataUrlToCampaignImage("not-a-data-url")).toThrow(
      "Unsupported or malformed data URL"
    );
  });
});

describe("uploadCampaignImage", () => {
  it("uploads to campaign-images bucket with correct path", async () => {
    const uploadFn = vi.fn().mockResolvedValue({ error: null });
    mockStorageFrom.mockReturnValue({ upload: uploadFn });

    const { uploadCampaignImage } = await import("@/lib/campaign/persistence");
    const result = await uploadCampaignImage("store-1", "camp-123", {
      buffer: Buffer.from("fake-image-data"),
      mimeType: "image/jpeg",
    });

    expect(result.storagePath).toBe("store-1/camp-123.jpg");
    expect(mockStorageFrom).toHaveBeenCalledWith("campaign-images");
    expect(uploadFn).toHaveBeenCalledWith(
      "store-1/camp-123.jpg",
      Buffer.from("fake-image-data"),
      { contentType: "image/jpeg", upsert: false }
    );
  });

  it("uses upsert: false", async () => {
    const uploadFn = vi.fn().mockResolvedValue({ error: null });
    mockStorageFrom.mockReturnValue({ upload: uploadFn });

    const { uploadCampaignImage } = await import("@/lib/campaign/persistence");
    await uploadCampaignImage("store-1", "camp-123", {
      buffer: Buffer.from("data"),
      mimeType: "image/jpeg",
    });

    expect(uploadFn).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Buffer),
      expect.objectContaining({ upsert: false })
    );
  });

  it("uses contentType: image/jpeg", async () => {
    const uploadFn = vi.fn().mockResolvedValue({ error: null });
    mockStorageFrom.mockReturnValue({ upload: uploadFn });

    const { uploadCampaignImage } = await import("@/lib/campaign/persistence");
    await uploadCampaignImage("store-1", "camp-123", {
      buffer: Buffer.from("data"),
      mimeType: "image/jpeg",
    });

    expect(uploadFn).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Buffer),
      expect.objectContaining({ contentType: "image/jpeg" })
    );
  });

  it("rejects non-JPEG mimeType", async () => {
    const { uploadCampaignImage } = await import("@/lib/campaign/persistence");
    await expect(uploadCampaignImage("store-1", "camp-123", {
      buffer: Buffer.from("data"),
      mimeType: "image/png" as "image/jpeg",
    })).rejects.toThrow("Only JPEG images are supported");
  });
});

describe("updateCampaignReady", () => {
  it("sets status=ready and persists snapshots", async () => {
    const eqFn = vi.fn().mockResolvedValue({ error: null });
    const updateFn = vi.fn().mockReturnValue({ eq: eqFn });
    mockSupabaseFrom.mockReturnValue({ update: updateFn });

    const { updateCampaignReady } = await import("@/lib/campaign/persistence");
    await updateCampaignReady("camp-123", {
      generationMetadata: { provider: "test" },
      renderSnapshot: { format: "jpeg" },
      publicationCopySnapshot: { title: "Test" },
    });

    expect(mockSupabaseFrom).toHaveBeenCalledWith("campaigns");
    expect(updateFn).toHaveBeenCalledWith({
      status: "ready",
      generation_metadata: { provider: "test" },
      render_snapshot: { format: "jpeg" },
      publication_copy_snapshot: { title: "Test" },
      error_message: null,
    });
    expect(eqFn).toHaveBeenCalledWith("id", "camp-123");
  });

  it("sets error_message=null", async () => {
    const eqFn = vi.fn().mockResolvedValue({ error: null });
    const updateFn = vi.fn().mockReturnValue({ eq: eqFn });
    mockSupabaseFrom.mockReturnValue({ update: updateFn });

    const { updateCampaignReady } = await import("@/lib/campaign/persistence");
    await updateCampaignReady("camp-123", {
      generationMetadata: {},
      renderSnapshot: {},
      publicationCopySnapshot: {},
    });

    expect(updateFn).toHaveBeenCalledWith(
      expect.objectContaining({ error_message: null })
    );
  });
});

describe("updateCampaignError", () => {
  it("sets status=error with message", async () => {
    const eqFn = vi.fn().mockResolvedValue({ error: null });
    const updateFn = vi.fn().mockReturnValue({ eq: eqFn });
    mockSupabaseFrom.mockReturnValue({ update: updateFn });

    const { updateCampaignError } = await import("@/lib/campaign/persistence");
    await updateCampaignError("camp-123", "Something went wrong");

    expect(mockSupabaseFrom).toHaveBeenCalledWith("campaigns");
    expect(updateFn).toHaveBeenCalledWith({
      status: "error",
      error_message: "Something went wrong",
    });
  });

  it("rejects empty message", async () => {
    const { updateCampaignError } = await import("@/lib/campaign/persistence");
    await expect(updateCampaignError("camp-123", "")).rejects.toThrow(
      "errorMessage must not be empty"
    );
    await expect(updateCampaignError("camp-123", "   ")).rejects.toThrow(
      "errorMessage must not be empty"
    );
  });
});

describe("getCampaign", () => {
  it("returns CampaignRecord when campaign exists", async () => {
    const mockRecord = { id: "camp-123", store_id: "store-1", status: "ready" };
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: mockRecord, error: null }),
    });

    const { getCampaign } = await import("@/lib/campaign/persistence");
    const result = await getCampaign("camp-123");

    expect(result).toEqual(mockRecord);
    expect(mockSupabaseFrom).toHaveBeenCalledWith("campaigns");
  });

  it("returns null when campaign does not exist", async () => {
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    const { getCampaign } = await import("@/lib/campaign/persistence");
    const result = await getCampaign("non-existent-id");

    expect(result).toBeNull();
  });
});

describe("deleteCampaignImage", () => {
  it("removes object from campaign-images bucket", async () => {
    const removeFn = vi.fn().mockResolvedValue({ error: null });
    mockStorageFrom.mockReturnValue({ remove: removeFn });

    const { deleteCampaignImage } = await import("@/lib/campaign/persistence");
    await deleteCampaignImage("store-1/camp-123.jpg");

    expect(mockStorageFrom).toHaveBeenCalledWith("campaign-images");
    expect(removeFn).toHaveBeenCalledWith(["store-1/camp-123.jpg"]);
  });
});
