// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CampaignRecord } from "@/lib/campaign/types";

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

vi.mock("@/lib/image-generation/config", () => ({
  IMAGE_GENERATION_GLOBAL_TIMEOUT_MS: 300_000,
}));

const mockCampaign: CampaignRecord = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  store_id: "store-123",
  status: "ready",
  product_name: "Produto Teste",
  input_snapshot: null,
  identity_snapshot: null,
  generation_metadata: null,
  render_snapshot: null,
  publication_copy_snapshot: { caption: "Texto", hashtags: ["#tag"], cta_post: "Compre" },
  publication_copy_current: null,
  storage_path: "store-123/550e8400-e29b-41d4-a716-446655440000.jpg",
  error_message: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getCampaignForDisplay", () => {
  it("returns CampaignRecord for owner", async () => {
    mockCreateServerClient.mockResolvedValue({
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: mockCampaign, error: null }),
    });

    const { getCampaignForDisplay } = await import("@/lib/campaign/display");
    const result = await getCampaignForDisplay(mockCampaign.id);

    expect(result).toEqual(mockCampaign);
    expect(mockCreateServerClient).toHaveBeenCalled();
  });

  it("returns null for non-owner (RLS filters)", async () => {
    mockCreateServerClient.mockResolvedValue({
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    const { getCampaignForDisplay } = await import("@/lib/campaign/display");
    const result = await getCampaignForDisplay(mockCampaign.id);

    expect(result).toBeNull();
  });

  it("returns null for non-existent ID", async () => {
    mockCreateServerClient.mockResolvedValue({
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    const { getCampaignForDisplay } = await import("@/lib/campaign/display");
    const result = await getCampaignForDisplay("550e8400-e29b-41d4-a716-446655440001");

    expect(result).toBeNull();
  });

  it("returns null for invalid UUID without calling from()", async () => {
    const { getCampaignForDisplay } = await import("@/lib/campaign/display");
    const result = await getCampaignForDisplay("not-a-uuid");

    expect(result).toBeNull();
    expect(mockCreateServerClient).not.toHaveBeenCalled();
  });
});

describe("generateSignedPreviewUrl", () => {
  it("returns signed URL for valid path", async () => {
    const createSignedUrlFn = vi.fn().mockResolvedValue({
      data: { signedUrl: "https://example.com/signed-url" },
      error: null,
    });
    mockStorageFrom.mockReturnValue({ createSignedUrl: createSignedUrlFn });

    const { generateSignedPreviewUrl } = await import("@/lib/campaign/display");
    const result = await generateSignedPreviewUrl("store-123/camp-123.jpg");

    expect(result).toBe("https://example.com/signed-url");
    expect(mockStorageFrom).toHaveBeenCalledWith("campaign-images");
    expect(createSignedUrlFn).toHaveBeenCalledWith("store-123/camp-123.jpg", 3600);
  });

  it("returns null for empty path", async () => {
    const { generateSignedPreviewUrl } = await import("@/lib/campaign/display");
    const result = await generateSignedPreviewUrl("");

    expect(result).toBeNull();
    expect(mockStorageFrom).not.toHaveBeenCalled();
  });
});

describe("computeDisplayStatus", () => {
  it("returns ready when status is ready", async () => {
    const { computeDisplayStatus } = await import("@/lib/campaign/display");
    const result = computeDisplayStatus({
      status: "ready",
      updated_at: new Date().toISOString(),
    });
    expect(result).toBe("ready");
  });

  it("returns generating when recent", async () => {
    const { computeDisplayStatus } = await import("@/lib/campaign/display");
    const result = computeDisplayStatus({
      status: "generating",
      updated_at: new Date().toISOString(),
    });
    expect(result).toBe("generating");
  });

  it("returns stale when timed out", async () => {
    const { computeDisplayStatus } = await import("@/lib/campaign/display");
    const staleDate = new Date(Date.now() - 600_000).toISOString();
    const result = computeDisplayStatus({
      status: "generating",
      updated_at: staleDate,
    });
    expect(result).toBe("stale");
  });

  it("returns error when status is error", async () => {
    const { computeDisplayStatus } = await import("@/lib/campaign/display");
    const result = computeDisplayStatus({
      status: "error",
      updated_at: new Date().toISOString(),
    });
    expect(result).toBe("error");
  });
});

describe("getEffectivePublicationCopy", () => {
  it("returns current when it exists and is valid", async () => {
    const { getEffectivePublicationCopy } = await import("@/lib/campaign/display");
    const result = getEffectivePublicationCopy({
      id: "550e8400-e29b-41d4-a716-446655440000",
      store_id: "store-123",
      status: "ready",
      product_name: "Produto Teste",
      input_snapshot: null,
      identity_snapshot: null,
      generation_metadata: null,
      render_snapshot: null,
      publication_copy_snapshot: {
        caption: "Texto original da IA",
        hashtags: ["#original"],
        cta_post: "Compre original",
      },
      publication_copy_current: {
        caption: "Texto editado pelo usuário",
        hashtags: ["#editado", "#promocao"],
        cta_post: "Compre agora editado",
      },
      storage_path: "store-123/camp.jpg",
      error_message: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    expect(result.caption).toBe("Texto editado pelo usuário");
    expect(result.hashtags).toEqual(["#editado", "#promocao"]);
    expect(result.cta_post).toBe("Compre agora editado");
  });

  it("returns snapshot when current is null", async () => {
    const { getEffectivePublicationCopy } = await import("@/lib/campaign/display");
    const result = getEffectivePublicationCopy({
      id: "550e8400-e29b-41d4-a716-446655440000",
      store_id: "store-123",
      status: "ready",
      product_name: "Produto Teste",
      input_snapshot: null,
      identity_snapshot: null,
      generation_metadata: null,
      render_snapshot: null,
      publication_copy_snapshot: {
        caption: "Texto original da IA",
        hashtags: ["#original"],
        cta_post: "Compre original",
      },
      publication_copy_current: null,
      storage_path: "store-123/camp.jpg",
      error_message: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    expect(result.caption).toBe("Texto original da IA");
    expect(result.hashtags).toEqual(["#original"]);
    expect(result.cta_post).toBe("Compre original");
  });

  it("returns snapshot when current has missing fields", async () => {
    const { getEffectivePublicationCopy } = await import("@/lib/campaign/display");
    const result = getEffectivePublicationCopy({
      id: "550e8400-e29b-41d4-a716-446655440000",
      store_id: "store-123",
      status: "ready",
      product_name: "Produto Teste",
      input_snapshot: null,
      identity_snapshot: null,
      generation_metadata: null,
      render_snapshot: null,
      publication_copy_snapshot: {
        caption: "Texto original da IA",
        hashtags: ["#original"],
        cta_post: "Compre original",
      },
      publication_copy_current: { caption: "only" }, // missing hashtags and cta_post
      storage_path: "store-123/camp.jpg",
      error_message: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    expect(result.caption).toBe("Texto original da IA");
    expect(result.hashtags).toEqual(["#original"]);
    expect(result.cta_post).toBe("Compre original");
  });

  it("returns empty when both current and snapshot are null", async () => {
    const { getEffectivePublicationCopy } = await import("@/lib/campaign/display");
    const result = getEffectivePublicationCopy({
      id: "550e8400-e29b-41d4-a716-446655440000",
      store_id: "store-123",
      status: "ready",
      product_name: "Produto Teste",
      input_snapshot: null,
      identity_snapshot: null,
      generation_metadata: null,
      render_snapshot: null,
      publication_copy_snapshot: null,
      publication_copy_current: null,
      storage_path: "store-123/camp.jpg",
      error_message: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    expect(result).toEqual({ caption: "", hashtags: [], cta_post: "" });
  });
});
