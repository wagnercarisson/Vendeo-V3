// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { ForbiddenError, UnauthorizedError, StoreNotFoundError } from "@/lib/auth/errors";

// Mock implementations that tests can override
const mockRequireSameOrigin = vi.fn();
const mockRequireApiUser = vi.fn();
const mockRequireOwnership = vi.fn();
const mockGetCampaign = vi.fn();
const mockValidatePublicationCopy = vi.fn();
const mockSupabaseFrom = vi.fn();
const mockListArtVersions = vi.fn();
const mockIsCampaignApprovalEnabled = vi.fn();

vi.mock("@/lib/auth/csrf", () => ({
  requireSameOrigin: vi.fn(() => mockRequireSameOrigin()),
}));

vi.mock("@/lib/auth/require-user", () => ({
  requireApiUser: vi.fn(async () => mockRequireApiUser()),
}));

vi.mock("@/lib/auth/store-ownership", () => ({
  requireOwnership: vi.fn(async (storeId: string, userId: string) =>
    mockRequireOwnership(storeId, userId),
  ),
}));

vi.mock("@/lib/campaign/persistence", () => ({
  getCampaign: vi.fn(async (id: string) => mockGetCampaign(id)),
  listArtVersions: vi.fn(async (id: string) => mockListArtVersions(id)),
}));

vi.mock("@/lib/feature-flags/feature-flag-service", () => ({
  isCampaignApprovalEnabled: vi.fn(async () => mockIsCampaignApprovalEnabled()),
}));

vi.mock("@/lib/campaign/publication-copy", () => ({
  validatePublicationCopy: vi.fn((body: unknown) => mockValidatePublicationCopy(body)),
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: {
    from: vi.fn(() => mockSupabaseFrom()),
  },
}));

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";
const ANOTHER_STORE_UUID = "660e8400-e29b-41d4-a716-446655440001";

const mockCampaign = {
  id: VALID_UUID,
  store_id: "store-123",
  status: "ready",
  publication_copy_snapshot: {
    caption: "Original",
    hashtags: ["#tag"],
    cta_post: "Compre",
  },
  publication_copy_current: null,
};

const mockValidBody = {
  caption: "Editado",
  hashtags: ["#novo"],
  cta_post: "Compre agora",
};

function createRequest(url: string, body?: unknown): NextRequest {
  return new NextRequest(url, {
    method: "PATCH",
    headers: {
      origin: "http://localhost:3000",
      host: "localhost:3000",
      "content-type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockIsCampaignApprovalEnabled.mockResolvedValue(false);
  mockListArtVersions.mockResolvedValue([]);
});

describe("PATCH /api/campaign/[id]/publication-copy", () => {
  it("returns 200 with updated data on success", async () => {
    mockRequireSameOrigin.mockReturnValue(undefined);
    mockRequireApiUser.mockResolvedValue({ userId: "user-123", claims: { sub: "user-123" } });
    mockGetCampaign.mockResolvedValue(mockCampaign);
    mockRequireOwnership.mockResolvedValue({ id: "store-123" });
    mockValidatePublicationCopy.mockReturnValue({ valid: true, data: mockValidBody });

    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    mockSupabaseFrom.mockReturnValue({ update: mockUpdate });

    const { PATCH } = await import(
      "@/app/api/campaign/[id]/publication-copy/route"
    );
    const response = await PATCH(
      createRequest(`http://localhost:3000/api/campaign/${VALID_UUID}/publication-copy`, mockValidBody),
      { params: Promise.resolve({ id: VALID_UUID }) },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.publication_copy_current).toEqual(mockValidBody);
  });

  it("returns 400 with validation issues", async () => {
    mockRequireSameOrigin.mockReturnValue(undefined);
    mockRequireApiUser.mockResolvedValue({ userId: "user-123", claims: { sub: "user-123" } });
    mockGetCampaign.mockResolvedValue(mockCampaign);
    mockRequireOwnership.mockResolvedValue({ id: "store-123" });
    mockValidatePublicationCopy.mockReturnValue({
      valid: false,
      issues: [{ field: "caption", message: "Too short", code: "too_short" }],
    });

    const { PATCH } = await import(
      "@/app/api/campaign/[id]/publication-copy/route"
    );
    const response = await PATCH(
      createRequest(`http://localhost:3000/api/campaign/${VALID_UUID}/publication-copy`, { caption: "" }),
      { params: Promise.resolve({ id: VALID_UUID }) },
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Validation failed");
    expect(body.issues).toHaveLength(1);
    expect(body.issues[0].field).toBe("caption");
  });

  it("returns 404 for invalid UUID", async () => {
    mockRequireSameOrigin.mockReturnValue(undefined);
    mockRequireApiUser.mockResolvedValue({ userId: "user-123", claims: { sub: "user-123" } });

    const { PATCH } = await import(
      "@/app/api/campaign/[id]/publication-copy/route"
    );
    const response = await PATCH(
      createRequest("http://localhost:3000/api/campaign/invalid-uuid/publication-copy", mockValidBody),
      { params: Promise.resolve({ id: "invalid-uuid" }) },
    );

    expect(response.status).toBe(404);
    // Should not have called getCampaign (short-circuits before DB query)
    expect(mockGetCampaign).not.toHaveBeenCalled();
  });

  it("returns 404 for non-existent campaign", async () => {
    mockRequireSameOrigin.mockReturnValue(undefined);
    mockRequireApiUser.mockResolvedValue({ userId: "user-123", claims: { sub: "user-123" } });
    mockGetCampaign.mockResolvedValue(null);

    const { PATCH } = await import(
      "@/app/api/campaign/[id]/publication-copy/route"
    );
    const response = await PATCH(
      createRequest(`http://localhost:3000/api/campaign/${VALID_UUID}/publication-copy`, mockValidBody),
      { params: Promise.resolve({ id: VALID_UUID }) },
    );

    expect(response.status).toBe(404);
  });

  it("returns 404 for cross-tenant campaign", async () => {
    mockRequireSameOrigin.mockReturnValue(undefined);
    mockRequireApiUser.mockResolvedValue({ userId: "user-456", claims: { sub: "user-456" } });
    mockGetCampaign.mockResolvedValue({
      ...mockCampaign,
      store_id: "store-other",
    });

    // requireOwnership throws StoreNotFoundError for cross-tenant
    mockRequireOwnership.mockRejectedValue(
      new StoreNotFoundError("Store not found or access denied"),
    );

    const { PATCH } = await import(
      "@/app/api/campaign/[id]/publication-copy/route"
    );
    const response = await PATCH(
      createRequest(`http://localhost:3000/api/campaign/${ANOTHER_STORE_UUID}/publication-copy`, mockValidBody),
      { params: Promise.resolve({ id: ANOTHER_STORE_UUID }) },
    );

    expect(response.status).toBe(404);
  });

  it("returns 200 with restored snapshot on restore: true", async () => {
    mockRequireSameOrigin.mockReturnValue(undefined);
    mockRequireApiUser.mockResolvedValue({ userId: "user-123", claims: { sub: "user-123" } });
    mockGetCampaign.mockResolvedValue(mockCampaign);
    mockRequireOwnership.mockResolvedValue({ id: "store-123" });
    mockValidatePublicationCopy.mockReturnValue({ valid: true, data: { restore: true } });

    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    mockSupabaseFrom.mockReturnValue({ update: mockUpdate });

    const { PATCH } = await import(
      "@/app/api/campaign/[id]/publication-copy/route"
    );
    const response = await PATCH(
      createRequest(`http://localhost:3000/api/campaign/${VALID_UUID}/publication-copy`, { restore: true }),
      { params: Promise.resolve({ id: VALID_UUID }) },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.restored).toBe(true);
    expect(body.publication_copy_snapshot).toEqual({
      caption: "Original",
      hashtags: ["#tag"],
      cta_post: "Compre",
    });
  });

  it("returns 403 for CSRF violation", async () => {
    mockRequireSameOrigin.mockImplementation(() => {
      throw new ForbiddenError("Cross-origin request denied");
    });

    const { PATCH } = await import(
      "@/app/api/campaign/[id]/publication-copy/route"
    );
    const response = await PATCH(
      createRequest(`http://localhost:3000/api/campaign/${VALID_UUID}/publication-copy`, mockValidBody),
      { params: Promise.resolve({ id: VALID_UUID }) },
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe("Cross-origin request denied");
  });

  it("returns 401 for unauthenticated request", async () => {
    mockRequireSameOrigin.mockReturnValue(undefined);
    mockRequireApiUser.mockRejectedValue(
      new UnauthorizedError("Usuário não autenticado"),
    );

    const { PATCH } = await import(
      "@/app/api/campaign/[id]/publication-copy/route"
    );
    const response = await PATCH(
      createRequest(`http://localhost:3000/api/campaign/${VALID_UUID}/publication-copy`, mockValidBody),
      { params: Promise.resolve({ id: VALID_UUID }) },
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Usuário não autenticado");
  });

  // ── F37.1 (D2/decisão 4): gate de aprovação no publication-copy ─────

  const mockV1Pending = {
    id: "version-1",
    campaign_id: VALID_UUID,
    version_number: 1,
    status: "pending",
    storage_path: "store-123/camp-123.jpg",
    asset_status: "active",
    asset_deleted_at: null,
    brief_snapshot: {},
    render_snapshot: null,
    generation_metadata: null,
    rejection_reason: null,
    correction_in_progress: false,
    created_at: "2026-09-01T10:00:00Z",
  };

  it("16.4 — pending + flag on → 403 e update NÃO chamado (nada persistido)", async () => {
    mockRequireSameOrigin.mockReturnValue(undefined);
    mockRequireApiUser.mockResolvedValue({ userId: "user-123", claims: { sub: "user-123" } });
    mockGetCampaign.mockResolvedValue(mockCampaign);
    mockRequireOwnership.mockResolvedValue({ id: "store-123" });
    mockIsCampaignApprovalEnabled.mockResolvedValue(true);
    mockListArtVersions.mockResolvedValue([mockV1Pending]);

    const mockUpdate = vi.fn();
    mockSupabaseFrom.mockReturnValue({ update: mockUpdate });

    const { PATCH } = await import(
      "@/app/api/campaign/[id]/publication-copy/route"
    );
    const response = await PATCH(
      createRequest(`http://localhost:3000/api/campaign/${VALID_UUID}/publication-copy`, mockValidBody),
      { params: Promise.resolve({ id: VALID_UUID }) },
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe("Campaign pending approval");
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("16.4 — após aprovação + flag on → 200 (edição normal)", async () => {
    mockRequireSameOrigin.mockReturnValue(undefined);
    mockRequireApiUser.mockResolvedValue({ userId: "user-123", claims: { sub: "user-123" } });
    mockGetCampaign.mockResolvedValue({
      ...mockCampaign,
      approval_status: "approved",
      approved_version_id: "version-1",
      approved_at: "2026-09-01T10:00:00Z",
    });
    mockRequireOwnership.mockResolvedValue({ id: "store-123" });
    mockIsCampaignApprovalEnabled.mockResolvedValue(true);
    mockListArtVersions.mockResolvedValue([{ ...mockV1Pending, status: "approved" }]);
    mockValidatePublicationCopy.mockReturnValue({ valid: true, data: mockValidBody });

    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    mockSupabaseFrom.mockReturnValue({ update: mockUpdate });

    const { PATCH } = await import(
      "@/app/api/campaign/[id]/publication-copy/route"
    );
    const response = await PATCH(
      createRequest(`http://localhost:3000/api/campaign/${VALID_UUID}/publication-copy`, mockValidBody),
      { params: Promise.resolve({ id: VALID_UUID }) },
    );

    expect(response.status).toBe(200);
  });

  it("16.4 — legacy (flag on + zero versões) → 200 (edição)", async () => {
    mockRequireSameOrigin.mockReturnValue(undefined);
    mockRequireApiUser.mockResolvedValue({ userId: "user-123", claims: { sub: "user-123" } });
    mockGetCampaign.mockResolvedValue(mockCampaign);
    mockRequireOwnership.mockResolvedValue({ id: "store-123" });
    mockIsCampaignApprovalEnabled.mockResolvedValue(true);
    mockListArtVersions.mockResolvedValue([]);
    mockValidatePublicationCopy.mockReturnValue({ valid: true, data: mockValidBody });

    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    mockSupabaseFrom.mockReturnValue({ update: mockUpdate });

    const { PATCH } = await import(
      "@/app/api/campaign/[id]/publication-copy/route"
    );
    const response = await PATCH(
      createRequest(`http://localhost:3000/api/campaign/${VALID_UUID}/publication-copy`, mockValidBody),
      { params: Promise.resolve({ id: VALID_UUID }) },
    );

    expect(response.status).toBe(200);
  });

  it("16.5 — flag off → 200 (edição e restore como hoje)", async () => {
    mockRequireSameOrigin.mockReturnValue(undefined);
    mockRequireApiUser.mockResolvedValue({ userId: "user-123", claims: { sub: "user-123" } });
    mockGetCampaign.mockResolvedValue(mockCampaign);
    mockRequireOwnership.mockResolvedValue({ id: "store-123" });
    mockIsCampaignApprovalEnabled.mockResolvedValue(false);
    mockListArtVersions.mockResolvedValue([mockV1Pending]);
    mockValidatePublicationCopy.mockReturnValue({ valid: true, data: mockValidBody });

    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    mockSupabaseFrom.mockReturnValue({ update: mockUpdate });

    const { PATCH } = await import(
      "@/app/api/campaign/[id]/publication-copy/route"
    );
    const response = await PATCH(
      createRequest(`http://localhost:3000/api/campaign/${VALID_UUID}/publication-copy`, mockValidBody),
      { params: Promise.resolve({ id: VALID_UUID }) },
    );

    expect(response.status).toBe(200);
  });
});
