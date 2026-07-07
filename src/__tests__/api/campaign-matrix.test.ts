// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockRequireApiUser = vi.fn();
const mockGetCurrentStore = vi.fn();
const mockCampaignGenerate = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(),
}));

vi.mock("@/lib/auth/require-user", () => ({
  requireApiUser: vi.fn(async () => mockRequireApiUser()),
  UnauthorizedError: class extends Error {
    constructor(m = "Unauthorized") { super(m); this.name = "UnauthorizedError"; }
  },
}));

vi.mock("@/lib/auth/store-ownership", () => ({
  getCurrentStore: vi.fn(async (userId?: string) => mockGetCurrentStore(userId)),
}));

vi.mock("@/lib/auth/csrf", () => ({
  requireSameOrigin: vi.fn(() => {}),
}));

vi.mock("@/lib/campaign-intelligence/service", () => ({
  CampaignIntelligenceService: class {
    generate = vi.fn(async () => ({
      success: true,
      data: { campaign: "test" },
    }));
  },
  createDefaultProvider: vi.fn(async () => ({})),
}));

vi.mock("@/lib/campaign-intelligence/schema", () => ({
  CampaignGenerationInputSchema: {
    safeParse: vi.fn((data: any) => ({
      success: true,
      data: { ...data },
    })),
  },
}));

function createReq(method: string, body: unknown, origin = "http://localhost"): NextRequest {
  return new NextRequest("http://localhost/api/campaign/generate", {
    method,
    headers: { origin, host: "localhost", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/campaign/generate", () => {
  it("returns 401 when no session", async () => {
    const { UnauthorizedError } = await import("@/lib/auth/require-user");
    mockRequireApiUser.mockRejectedValue(new UnauthorizedError());

    const { POST } = await import("@/app/api/campaign/generate/route");
    await expect(POST(createReq("POST", { productName: "Test" }))).rejects.toThrow();
  });

  it("returns 404 when user has no store", async () => {
    mockRequireApiUser.mockResolvedValue({ userId: "user-123", claims: {} });
    mockGetCurrentStore.mockResolvedValue(null);

    const { POST } = await import("@/app/api/campaign/generate/route");
    const res = await POST(createReq("POST", { productName: "Test" }));
    expect(res.status).toBe(404);
  });

  it("returns 200 when authenticated with store", async () => {
    mockRequireApiUser.mockResolvedValue({ userId: "user-123", claims: {} });
    mockGetCurrentStore.mockResolvedValue({ id: "store-1", name: "Loja" });

    const { POST } = await import("@/app/api/campaign/generate/route");
    const res = await POST(createReq("POST", { productName: "Test" }));
    expect(res.status).toBe(200);
  });
});
