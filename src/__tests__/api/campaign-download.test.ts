// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockSupabaseFrom = vi.fn();
const mockDownload = vi.fn();
let mockRequireApiUserImpl = vi.fn();
let mockRequireOwnershipImpl = vi.fn();
let mockGetCampaignImpl = vi.fn();
let mockListArtVersionsImpl = vi.fn();
let mockIsCampaignApprovalEnabledImpl = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: {
    from: mockSupabaseFrom,
    storage: {
      from: vi.fn(() => ({
        download: mockDownload,
      })),
    },
  },
}));

vi.mock("@/lib/auth/errors", () => {
  class UnauthorizedError extends Error {
    constructor(message = "Unauthorized") {
      super(message);
      this.name = "UnauthorizedError";
    }
  }
  class StoreNotFoundError extends Error {
    constructor(message = "Store not found or access denied") {
      super(message);
      this.name = "StoreNotFoundError";
    }
  }
  class ForbiddenError extends Error {
    constructor(message = "Forbidden") {
      super(message);
      this.name = "ForbiddenError";
    }
  }
  return { UnauthorizedError, StoreNotFoundError, ForbiddenError };
});

vi.mock("@/lib/auth/require-user", () => ({
  requireApiUser: vi.fn(async () => mockRequireApiUserImpl()),
  UnauthorizedError: class UnauthorizedError extends Error {
    constructor(message = "Usuário não autenticado") {
      super(message);
      this.name = "UnauthorizedError";
    }
  },
}));

vi.mock("@/lib/auth/store-ownership", () => ({
  requireOwnership: vi.fn(async (storeId: string, userId: string) =>
    mockRequireOwnershipImpl(storeId, userId)
  ),
  StoreNotFoundError: class StoreNotFoundError extends Error {
    constructor(message = "Store not found or access denied") {
      super(message);
      this.name = "StoreNotFoundError";
    }
  },
}));

vi.mock("@/lib/campaign/persistence", () => ({
  getCampaign: vi.fn(async (id: string) => mockGetCampaignImpl(id)),
  listArtVersions: vi.fn(async (id: string) => mockListArtVersionsImpl(id)),
}));

vi.mock("@/lib/feature-flags/feature-flag-service", () => ({
  isCampaignApprovalEnabled: vi.fn(async () => mockIsCampaignApprovalEnabledImpl()),
}));

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";
const ANOTHER_STORE_UUID = "660e8400-e29b-41d4-a716-446655440001";

function createRequest(url: string): NextRequest {
  return new NextRequest(url);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockIsCampaignApprovalEnabledImpl.mockResolvedValue(false);
  mockListArtVersionsImpl.mockResolvedValue([]);
});

describe("GET /api/campaign/[id]/download", () => {
  it("returns 401 when not authenticated", async () => {
    const { UnauthorizedError } = await import("@/lib/auth/errors");
    mockRequireApiUserImpl.mockRejectedValue(
      new UnauthorizedError("Usuário não autenticado")
    );

    const { GET } = await import(
      "@/app/api/campaign/[id]/download/route"
    );
    const response = await GET(createRequest("http://localhost:3000/api/campaign/550e8400-e29b-41d4-a716-446655440000/download"), {
      params: Promise.resolve({ id: VALID_UUID }),
    });

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Usuário não autenticado");
  });

  it("returns 400 when [id] is not a valid UUID v4", async () => {
    mockRequireApiUserImpl.mockResolvedValue({
      userId: "user-123",
      claims: { sub: "user-123" },
    });

    const { GET } = await import(
      "@/app/api/campaign/[id]/download/route"
    );
    const response = await GET(createRequest("http://localhost:3000/api/campaign/invalid-id/download"), {
      params: Promise.resolve({ id: "invalid-id" }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Invalid campaign ID");
  });

  it("returns 404 when campaign does not exist", async () => {
    mockRequireApiUserImpl.mockResolvedValue({
      userId: "user-123",
      claims: { sub: "user-123" },
    });
    mockGetCampaignImpl.mockResolvedValue(null);

    const { GET } = await import(
      "@/app/api/campaign/[id]/download/route"
    );
    const response = await GET(createRequest(`http://localhost:3000/api/campaign/${VALID_UUID}/download`), {
      params: Promise.resolve({ id: VALID_UUID }),
    });

    expect(response.status).toBe(404);
  });

  it("returns 404 when campaign belongs to another store (ownership mismatch)", async () => {
    const { StoreNotFoundError } = await import("@/lib/auth/errors");
    mockRequireApiUserImpl.mockResolvedValue({
      userId: "user-123",
      claims: { sub: "user-123" },
    });
    mockGetCampaignImpl.mockResolvedValue({
      id: VALID_UUID,
      store_id: "store-other",
      status: "ready",
    });
    mockRequireOwnershipImpl.mockRejectedValue(
      new StoreNotFoundError("Store not found or access denied")
    );

    const { GET } = await import(
      "@/app/api/campaign/[id]/download/route"
    );
    const response = await GET(createRequest(`http://localhost:3000/api/campaign/${VALID_UUID}/download`), {
      params: Promise.resolve({ id: VALID_UUID }),
    });

    expect(response.status).toBe(404);
  });

  it("returns 200 with image data for own campaign", async () => {
    mockRequireApiUserImpl.mockResolvedValue({
      userId: "user-123",
      claims: { sub: "user-123" },
    });
    mockGetCampaignImpl.mockResolvedValue({
      id: VALID_UUID,
      store_id: "store-1",
      status: "ready",
      storage_path: "store-1/camp-123.jpg",
      product_name: "Produto Teste",
      created_at: "2026-07-10T12:00:00Z",
    });
    mockRequireOwnershipImpl.mockResolvedValue({ id: "store-1" });
    const fakeBlob = new Blob(["fake-image-data"], { type: "image/jpeg" });
    mockDownload.mockResolvedValue({
      data: fakeBlob,
      error: null,
    });

    const { GET } = await import(
      "@/app/api/campaign/[id]/download/route"
    );
    const response = await GET(createRequest(`http://localhost:3000/api/campaign/${VALID_UUID}/download`), {
      params: Promise.resolve({ id: VALID_UUID }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/jpeg");
    expect(response.headers.get("Content-Disposition")).toContain('attachment; filename="');
  });

  it("returns 502 when download fails", async () => {
    mockRequireApiUserImpl.mockResolvedValue({
      userId: "user-123",
      claims: { sub: "user-123" },
    });
    mockGetCampaignImpl.mockResolvedValue({
      id: VALID_UUID,
      store_id: "store-1",
      status: "ready",
      storage_path: "store-1/camp-123.jpg",
    });
    mockRequireOwnershipImpl.mockResolvedValue({ id: "store-1" });
    mockDownload.mockResolvedValue({
      data: null,
      error: new Error("Storage error"),
    });

    const { GET } = await import(
      "@/app/api/campaign/[id]/download/route"
    );
    const response = await GET(createRequest(`http://localhost:3000/api/campaign/${VALID_UUID}/download`), {
      params: Promise.resolve({ id: VALID_UUID }),
    });

    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.error).toBe("Failed to download image");
  });

  // ── F37.1 (D2/decisão 4): gate de aprovação no download ────────────

  const baseReadyCampaign = {
    id: VALID_UUID,
    store_id: "store-1",
    status: "ready",
    storage_path: "store-1/camp-123.jpg",
    product_name: "Produto Teste",
    created_at: "2026-07-10T12:00:00Z",
    approval_status: "pending_approval",
    rejection_count: 0,
    approved_version_id: null,
    approved_at: null,
  };

  const v1Pending = {
    id: "version-1",
    campaign_id: VALID_UUID,
    version_number: 1,
    status: "pending",
    storage_path: "store-1/camp-123.jpg",
    asset_status: "active",
    asset_deleted_at: null,
    brief_snapshot: {},
    render_snapshot: null,
    generation_metadata: null,
    rejection_reason: null,
    correction_in_progress: false,
    created_at: "2026-09-01T10:00:00Z",
  };

  const fakeBlob = new Blob(["fake-image-data"], { type: "image/jpeg" });

  it("16.1 — pending + flag on → 403 { error: 'Campaign pending approval' }", async () => {
    mockRequireApiUserImpl.mockResolvedValue({ userId: "user-123", claims: { sub: "user-123" } });
    mockGetCampaignImpl.mockResolvedValue(baseReadyCampaign);
    mockRequireOwnershipImpl.mockResolvedValue({ id: "store-1" });
    mockIsCampaignApprovalEnabledImpl.mockResolvedValue(true);
    mockListArtVersionsImpl.mockResolvedValue([v1Pending]);

    const { GET } = await import("@/app/api/campaign/[id]/download/route");
    const response = await GET(createRequest(`http://localhost:3000/api/campaign/${VALID_UUID}/download`), {
      params: Promise.resolve({ id: VALID_UUID }),
    });

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe("Campaign pending approval");
    expect(mockDownload).not.toHaveBeenCalled();
  });

  it("16.2 — após aprovação (approved_version_id) + flag on → 200 servindo o arquivo", async () => {
    mockRequireApiUserImpl.mockResolvedValue({ userId: "user-123", claims: { sub: "user-123" } });
    mockGetCampaignImpl.mockResolvedValue({
      ...baseReadyCampaign,
      approval_status: "approved",
      approved_version_id: "version-1",
      approved_at: "2026-09-01T10:00:00Z",
    });
    mockRequireOwnershipImpl.mockResolvedValue({ id: "store-1" });
    mockIsCampaignApprovalEnabledImpl.mockResolvedValue(true);
    mockListArtVersionsImpl.mockResolvedValue([{ ...v1Pending, status: "approved" }]);
    mockDownload.mockResolvedValue({ data: fakeBlob, error: null });

    const { GET } = await import("@/app/api/campaign/[id]/download/route");
    const response = await GET(createRequest(`http://localhost:3000/api/campaign/${VALID_UUID}/download`), {
      params: Promise.resolve({ id: VALID_UUID }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/jpeg");
  });

  it("16.3 — legacy (flag on + zero versões) → 200", async () => {
    mockRequireApiUserImpl.mockResolvedValue({ userId: "user-123", claims: { sub: "user-123" } });
    mockGetCampaignImpl.mockResolvedValue(baseReadyCampaign);
    mockRequireOwnershipImpl.mockResolvedValue({ id: "store-1" });
    mockIsCampaignApprovalEnabledImpl.mockResolvedValue(true);
    mockListArtVersionsImpl.mockResolvedValue([]);
    mockDownload.mockResolvedValue({ data: fakeBlob, error: null });

    const { GET } = await import("@/app/api/campaign/[id]/download/route");
    const response = await GET(createRequest(`http://localhost:3000/api/campaign/${VALID_UUID}/download`), {
      params: Promise.resolve({ id: VALID_UUID }),
    });

    expect(response.status).toBe(200);
  });

  it("16.5 — flag off → 200 (mesmo com v1 pendente em banco; fast path sem gate)", async () => {
    mockRequireApiUserImpl.mockResolvedValue({ userId: "user-123", claims: { sub: "user-123" } });
    mockGetCampaignImpl.mockResolvedValue(baseReadyCampaign);
    mockRequireOwnershipImpl.mockResolvedValue({ id: "store-1" });
    mockIsCampaignApprovalEnabledImpl.mockResolvedValue(false);
    mockListArtVersionsImpl.mockResolvedValue([v1Pending]);
    mockDownload.mockResolvedValue({ data: fakeBlob, error: null });

    const { GET } = await import("@/app/api/campaign/[id]/download/route");
    const response = await GET(createRequest(`http://localhost:3000/api/campaign/${VALID_UUID}/download`), {
      params: Promise.resolve({ id: VALID_UUID }),
    });

    expect(response.status).toBe(200);
  });
});
