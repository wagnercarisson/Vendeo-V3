// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockSupabaseFrom = vi.fn();
const mockCreateSignedUrl = vi.fn();
let mockRequireApiUserImpl = vi.fn();
let mockRequireOwnershipImpl = vi.fn();
let mockGetCampaignImpl = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: {
    from: mockSupabaseFrom,
    storage: {
      from: vi.fn(() => ({
        createSignedUrl: mockCreateSignedUrl,
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
}));

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";
const ANOTHER_STORE_UUID = "660e8400-e29b-41d4-a716-446655440001";

function createRequest(url: string): NextRequest {
  return new NextRequest(url);
}

beforeEach(() => {
  vi.clearAllMocks();
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

  it("returns 302 with signed URL for own campaign", async () => {
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
    mockCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://supabase.co/storage/v1/object/signed/campaign-images/store-1/camp-123.jpg?token=abc" },
      error: null,
    });

    const { GET } = await import(
      "@/app/api/campaign/[id]/download/route"
    );
    const response = await GET(createRequest(`http://localhost:3000/api/campaign/${VALID_UUID}/download`), {
      params: Promise.resolve({ id: VALID_UUID }),
    });

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe(
      "https://supabase.co/storage/v1/object/signed/campaign-images/store-1/camp-123.jpg?token=abc"
    );
  });

  it("returns 502 when createSignedUrl fails", async () => {
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
    mockCreateSignedUrl.mockResolvedValue({
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
    expect(body.error).toBe("Failed to generate download URL");
  });
});
