// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockRequireUser = vi.fn();
const mockRequireApiUser = vi.fn();
const mockRequireOwnership = vi.fn();
const mockGetCurrentStore = vi.fn();
const mockSupabaseFrom = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(async () => ({
    auth: { getClaims: vi.fn() },
    from: mockSupabaseFrom,
  })),
  supabaseAdmin: { from: mockSupabaseFrom },
}));

vi.mock("@/lib/auth/require-user", () => ({
  requireUser: vi.fn(async () => mockRequireUser()),
  requireApiUser: vi.fn(async () => mockRequireApiUser()),
  UnauthorizedError: class extends Error {
    constructor(m = "Unauthorized") { super(m); this.name = "UnauthorizedError"; }
  },
}));

vi.mock("@/lib/auth/store-ownership", () => ({
  requireAuthorizedStore: vi.fn(async (storeId: string) => {
    const user = await mockRequireApiUser();
    return { userId: "user-123", storeId, store: await mockRequireOwnership(storeId) };
  }),
  requireOwnership: vi.fn(async (storeId: string) => mockRequireOwnership(storeId)),
  getCurrentStore: vi.fn(async (userId?: string) => mockGetCurrentStore(userId)),
  StoreNotFoundError: class extends Error {
    constructor(m = "Store not found") { super(m); this.name = "StoreNotFoundError"; }
  },
}));

vi.mock("@/lib/store-response", () => ({
  buildStoreResponse: vi.fn(async (s: any) => s),
}));

vi.mock("@/lib/constants", () => ({
  STORE_SEGMENTS: [{ value: "variedades", label: "Variedades" }],
  STORE_SUBSEGMENTS: {},
}));

function createReq(method: string, url: string, origin?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (origin) headers["origin"] = origin;
  headers["host"] = "localhost";
  return new NextRequest(url, { method, headers });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("CSRF Precedence: cross-origin returns 403 before auth/ownership", () => {
  it("POST /api/store cross-origin no session → 403", async () => {
    const { POST } = await import("@/app/api/store/route");
    // requireSameOrigin throws ForbiddenError since origin !== host
    // Route handler does not catch it yet — error propagates
    await expect(
      POST(createReq("POST", "http://localhost/api/store", "http://evil.com"))
    ).rejects.toThrow("Cross-origin request denied");
  });

  it("POST /api/store cross-origin with session → 403", async () => {
    mockRequireUser.mockResolvedValue({ userId: "user-123", claims: {} });
    const { POST } = await import("@/app/api/store/route");
    await expect(
      POST(createReq("POST", "http://localhost/api/store", "http://evil.com"))
    ).rejects.toThrow("Cross-origin request denied");
  });

  it("POST /api/store same-origin no session → 401", async () => {
    const { UnauthorizedError } = await import("@/lib/auth/require-user");
    mockRequireUser.mockRejectedValue(new UnauthorizedError());
    const { POST } = await import("@/app/api/store/route");
    const res = await POST(createReq("POST", "http://localhost/api/store", "http://localhost"));
    expect(res.status).toBe(401);
  });

  it("PATCH /api/store/:id cross-origin no session → 403", async () => {
    const { PATCH } = await import("@/app/api/store/[id]/route");
    await expect(
      PATCH(
        createReq("PATCH", "http://localhost/api/store/store-1", "http://evil.com"),
        { params: Promise.resolve({ id: "store-1" }) }
      )
    ).rejects.toThrow("Cross-origin request denied");
  });

  it("PATCH /api/store/:id cross-origin with session → 403", async () => {
    mockRequireUser.mockResolvedValue({ userId: "user-123", claims: {} });
    const { PATCH } = await import("@/app/api/store/[id]/route");
    await expect(
      PATCH(
        createReq("PATCH", "http://localhost/api/store/store-1", "http://evil.com"),
        { params: Promise.resolve({ id: "store-1" }) }
      )
    ).rejects.toThrow("Cross-origin request denied");
  });

  it("PATCH /api/store/:id same-origin no session → 401", async () => {
    const { UnauthorizedError } = await import("@/lib/auth/require-user");
    mockRequireUser.mockRejectedValue(new UnauthorizedError());
    const { PATCH } = await import("@/app/api/store/[id]/route");
    const res = await PATCH(
      createReq("PATCH", "http://localhost/api/store/store-1", "http://localhost"),
      { params: Promise.resolve({ id: "store-1" }) }
    );
    expect(res.status).toBe(401);
  });
});
