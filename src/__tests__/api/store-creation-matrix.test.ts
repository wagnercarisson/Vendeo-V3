// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockRequireUser = vi.fn();
const mockSupabaseFrom = vi.fn();
const mockSupabaseRpc = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(async () => ({
    auth: { getClaims: vi.fn() },
    from: mockSupabaseFrom,
  })),
  supabaseAdmin: { from: mockSupabaseFrom, rpc: mockSupabaseRpc },
}));

vi.mock("@/lib/auth/require-user", () => ({
  requireUser: vi.fn(async () => mockRequireUser()),
  UnauthorizedError: class extends Error {
    constructor(m = "Unauthorized") { super(m); this.name = "UnauthorizedError"; }
  },
}));

vi.mock("@/lib/auth/csrf", () => ({
  requireSameOrigin: vi.fn(() => {}),
}));

vi.mock("@/lib/constants", () => ({
  STORE_SEGMENTS: [{ value: "variedades", label: "Variedades" }],
  STORE_SUBSEGMENTS: {},
}));

vi.mock("@/lib/store-response", () => ({
  buildStoreResponse: vi.fn(async (s: any) => s),
}));

function createReq(method: string, body: unknown, origin = "http://localhost"): NextRequest {
  return new NextRequest("http://localhost/api/store", {
    method,
    headers: { origin, host: "localhost", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/store", () => {
  it("returns 201 when authenticated and valid", async () => {
    mockRequireUser.mockResolvedValue({ userId: "user-123", claims: {} });
    mockSupabaseRpc.mockResolvedValue({ data: { id: "store-1", name: "Loja", user_id: "user-123" }, error: null });

    const { POST } = await import("@/app/api/store/route");
    const res = await POST(createReq("POST", { name: "Minha Loja", segment: "variedades" }));
    expect(res.status).toBe(201);
  });

  it("returns 401 when not authenticated (same origin)", async () => {
    const { UnauthorizedError } = await import("@/lib/auth/require-user");
    mockRequireUser.mockRejectedValue(new UnauthorizedError());

    const { POST } = await import("@/app/api/store/route");
    const res = await POST(createReq("POST", { name: "Minha Loja", segment: "variedades" }));
    expect(res.status).toBe(401);
  });

  it("returns 409 on duplicate store (UNIQUE violation)", async () => {
    mockRequireUser.mockResolvedValue({ userId: "user-123", claims: {} });
    mockSupabaseRpc.mockResolvedValue({ data: null, error: { code: "23505", message: "duplicate key" } });

    const { POST } = await import("@/app/api/store/route");
    const res = await POST(createReq("POST", { name: "Outra Loja", segment: "variedades" }));
    expect(res.status).toBe(409);
  });

  it("ignores user_id in body (uses claims.sub)", async () => {
    mockRequireUser.mockResolvedValue({ userId: "user-123", claims: { sub: "user-123" } });
    let capturedParams: any = null;
    mockSupabaseRpc.mockImplementation((_rpcName: string, params: any) => {
      capturedParams = params;
      return Promise.resolve({ data: { id: "store-1", user_id: "user-123" }, error: null });
    });

    const { POST } = await import("@/app/api/store/route");
    await POST(createReq("POST", { name: "Minha Loja", segment: "variedades", user_id: "hacker-id" }));
    expect(capturedParams.p_user_id).toBe("user-123");
  });
});
