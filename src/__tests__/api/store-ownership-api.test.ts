// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { Store } from "@/lib/store";

const mockSupabaseFrom = vi.fn(() => ({
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn().mockResolvedValue({ data: null }),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  single: vi.fn(),
  update: vi.fn().mockReturnThis(),
}));
const mockSupabaseRpc = vi.fn();
const mockGetClaims = vi.fn();
let mockRequireUserImpl = vi.fn();
let mockRequireApiUserImpl = vi.fn();
let mockGetCurrentStoreImpl = vi.fn();
let mockRequireOwnershipImpl = vi.fn();
let mockBuildStoreResponseImpl = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(async () => ({
    auth: { getClaims: mockGetClaims },
    from: mockSupabaseFrom,
  })),
  supabaseAdmin: {
    from: mockSupabaseFrom,
    rpc: mockSupabaseRpc,
  },
}));

vi.mock("@/lib/auth/require-user", () => ({
  requireUser: vi.fn(async () => mockRequireUserImpl()),
  requireApiUser: vi.fn(async () => mockRequireApiUserImpl()),
  UnauthorizedError: class UnauthorizedError extends Error {
    constructor(message = "Usuário não autenticado") {
      super(message);
      this.name = "UnauthorizedError";
    }
  },
}));

vi.mock("@/lib/auth/store-ownership", () => ({
  getCurrentStore: vi.fn(async (userId?: string) => mockGetCurrentStoreImpl(userId)),
  requireOwnership: vi.fn(async (storeId: string, userId?: string) => mockRequireOwnershipImpl(storeId, userId)),
  StoreNotFoundError: class StoreNotFoundError extends Error {
    constructor(message = "Store not found or access denied") {
      super(message);
      this.name = "StoreNotFoundError";
    }
  },
}));

vi.mock("@/lib/store-response", () => ({
  buildStoreResponse: vi.fn(async (store: Store) => mockBuildStoreResponseImpl(store)),
}));

vi.mock("@/lib/auth/csrf", () => ({
  requireSameOrigin: vi.fn(() => {}),
}));

vi.mock("@/lib/constants", () => ({
  STORE_SEGMENTS: [{ value: "variedades", label: "Variedades" }],
  STORE_SUBSEGMENTS: {},
}));

vi.mock("@/lib/cnpj/validate", () => ({
  validateCnpj: vi.fn(() => ({ normalized: "12345678000195" })),
}));

vi.mock("@/lib/cnpj/mask", () => ({
  maskCnpj: vi.fn(() => "**.***.***/0001-**"),
}));

vi.mock("@/lib/cnpj/hash", () => ({
  hashCnpjRoot: vi.fn(() => "mocked_hash_64chars"),
}));

vi.mock("@/lib/cnpj/similarity", () => ({
  compareBusinessName: vi.fn(() => ({ bestScore: 1, nameToLegal: 1, nameToFantasy: null, label: "match" })),
}));

process.env.CNPJ_PEPPER = "test_pepper_hex_64_chars";

vi.mock("@/lib/legal/document-versions", () => ({
  getCurrentVersion: vi.fn(async () => ({ version: "v1.0", effectiveAt: "2026-07-23T00:00:00Z", summary: null })),
  getVersionHistory: vi.fn(),
  isVersionCurrent: vi.fn(),
}));

const mockStore: Store = {
  id: "store-1",
  user_id: "user-123",
  name: "Minha Loja",
  segment: "variedades",
  city: null,
  state: null,
  brand_color: null,
  logo_url: null,
  subsegment: null,
  tone_of_voice: null,
  positioning: null,
  short_description: null,
  slogan: null,
  logo_status: null,
  identity_state: null,
  text_only_origin: null,
  manual_color_override: false,
  previous_identity_snapshot: null,
  visual_signature_attempts: 0,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const mockEnrichedStore = {
  ...mockStore,
  identity: {} as any,
  visual_signature_url: null,
  logo_url: null,
  has_archived_signatures: false,
};

beforeEach(() => {
  vi.restoreAllMocks();
  mockRequireUserImpl = vi.fn();
  mockRequireApiUserImpl = vi.fn();
  mockGetCurrentStoreImpl = vi.fn();
  mockRequireOwnershipImpl = vi.fn();
  mockBuildStoreResponseImpl = vi.fn();
});

function createReq(method: string, body?: unknown, url = "http://localhost/api/store"): NextRequest {
  return new NextRequest(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("POST /api/store", () => {
  it("returns 201 with store when authenticated", async () => {
    mockRequireUserImpl.mockResolvedValue({ userId: "user-123", claims: { sub: "user-123" } });
    mockSupabaseRpc.mockResolvedValue({ data: { ...mockStore, user_id: "user-123" }, error: null });

    const { POST } = await import("@/app/api/store/route");
    const res = await POST(createReq("POST", { name: "Minha Loja", segment: "variedades", cnpj: "12.345.678/0001-95", acceptedTerms: true }));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.user_id).toBe("user-123");
  });

  it("returns 401 when not authenticated", async () => {
    const { UnauthorizedError } = await import("@/lib/auth/require-user");
    mockRequireUserImpl.mockRejectedValue(new UnauthorizedError());

    const { POST } = await import("@/app/api/store/route");
    const res = await POST(createReq("POST", { name: "Minha Loja", segment: "variedades" }));
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 409 on UNIQUE violation", async () => {
    mockRequireUserImpl.mockResolvedValue({ userId: "user-123", claims: { sub: "user-123" } });
    mockSupabaseRpc.mockResolvedValue({ data: null, error: { code: "23505", message: "duplicate key" } });

    const { POST } = await import("@/app/api/store/route");
    const res = await POST(createReq("POST", { name: "Outra Loja", segment: "variedades", cnpj: "12.345.678/0001-95", acceptedTerms: true }));
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toBe("Usuário já possui uma loja");
  });

  it("ignores user_id in body", async () => {
    mockRequireUserImpl.mockResolvedValue({ userId: "user-123", claims: { sub: "user-123" } });
    let capturedParams: any = null;
    mockSupabaseRpc.mockImplementation((_rpcName: string, params: any) => {
      capturedParams = params;
      return Promise.resolve({ data: { ...mockStore, user_id: "user-123" }, error: null });
    });

    const { POST } = await import("@/app/api/store/route");
    await POST(createReq("POST", { name: "Minha Loja", segment: "variedades", cnpj: "12.345.678/0001-95", acceptedTerms: true, user_id: "hacker-id" }));
    expect(capturedParams.p_user_id).toBe("user-123");
  });
});

describe("GET /api/store (atalho)", () => {
  it("returns 200 with store when authenticated and store exists", async () => {
    mockRequireApiUserImpl.mockResolvedValue({ userId: "user-123", claims: { sub: "user-123" } });
    mockGetCurrentStoreImpl.mockResolvedValue(mockStore);
    mockBuildStoreResponseImpl.mockResolvedValue(mockEnrichedStore);

    const { GET } = await import("@/app/api/store/route");
    const res = await GET(createReq("GET"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe("store-1");
    expect(data.identity).toBeDefined();
  });

  it("returns 404 when store not found", async () => {
    mockRequireApiUserImpl.mockResolvedValue({ userId: "user-123", claims: { sub: "user-123" } });
    mockGetCurrentStoreImpl.mockResolvedValue(null);

    const { GET } = await import("@/app/api/store/route");
    const res = await GET(createReq("GET"));
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe("Store not found");
  });

  it("returns 401 when not authenticated", async () => {
    const { UnauthorizedError } = await import("@/lib/auth/require-user");
    mockRequireApiUserImpl.mockRejectedValue(new UnauthorizedError());

    const { GET } = await import("@/app/api/store/route");
    const res = await GET(createReq("GET"));
    expect(res.status).toBe(401);
  });
});

describe("GET /api/store/:id", () => {
  it("returns 200 when owner requests own store", async () => {
    mockRequireUserImpl.mockResolvedValue({ userId: "user-123", claims: { sub: "user-123" } });
    mockRequireOwnershipImpl.mockResolvedValue(mockStore);
    mockBuildStoreResponseImpl.mockResolvedValue(mockEnrichedStore);

    const { GET } = await import("@/app/api/store/[id]/route");
    const res = await GET(createReq("GET"), { params: Promise.resolve({ id: "store-1" }) });
    expect(res.status).toBe(200);
  });

  it("returns 404 when store belongs to another user", async () => {
    const { StoreNotFoundError } = await import("@/lib/auth/store-ownership");
    mockRequireUserImpl.mockResolvedValue({ userId: "user-999", claims: { sub: "user-999" } });
    mockRequireOwnershipImpl.mockRejectedValue(new StoreNotFoundError());

    const { GET } = await import("@/app/api/store/[id]/route");
    const res = await GET(createReq("GET"), { params: Promise.resolve({ id: "store-1" }) });
    expect(res.status).toBe(404);
  });

  it("returns 404 for non-existent store", async () => {
    const { StoreNotFoundError } = await import("@/lib/auth/store-ownership");
    mockRequireUserImpl.mockResolvedValue({ userId: "user-123", claims: { sub: "user-123" } });
    mockRequireOwnershipImpl.mockRejectedValue(new StoreNotFoundError());

    const { GET } = await import("@/app/api/store/[id]/route");
    const res = await GET(createReq("GET"), { params: Promise.resolve({ id: "nonexistent" }) });
    expect(res.status).toBe(404);
  });

  it("returns 401 when not authenticated", async () => {
    const { UnauthorizedError } = await import("@/lib/auth/require-user");
    mockRequireUserImpl.mockRejectedValue(new UnauthorizedError());

    const { GET } = await import("@/app/api/store/[id]/route");
    const res = await GET(createReq("GET"), { params: Promise.resolve({ id: "store-1" }) });
    expect(res.status).toBe(401);
  });
});

describe("PATCH /api/store/:id", () => {
  it("returns 200 when owner patches own store", async () => {
    mockRequireUserImpl.mockResolvedValue({ userId: "user-123", claims: { sub: "user-123" } });
    mockRequireOwnershipImpl.mockResolvedValue(mockStore);
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn(),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(async () => ({ data: mockStore, error: null })),
          })),
        })),
      })),
    } as ReturnType<typeof mockSupabaseFrom>);

    const { PATCH } = await import("@/app/api/store/[id]/route");
    const res = await PATCH(createReq("PATCH", { name: "Loja Atualizada" }), { params: Promise.resolve({ id: "store-1" }) });
    expect(res.status).toBe(200);
  });

  it("returns 404 when patching another user's store", async () => {
    const { StoreNotFoundError } = await import("@/lib/auth/store-ownership");
    mockRequireUserImpl.mockResolvedValue({ userId: "user-999", claims: { sub: "user-999" } });
    mockRequireOwnershipImpl.mockRejectedValue(new StoreNotFoundError());

    const { PATCH } = await import("@/app/api/store/[id]/route");
    const res = await PATCH(createReq("PATCH", { name: "Updated" }), { params: Promise.resolve({ id: "store-1" }) });
    expect(res.status).toBe(404);
  });

  it("returns 404 for non-existent store", async () => {
    const { StoreNotFoundError } = await import("@/lib/auth/store-ownership");
    mockRequireUserImpl.mockResolvedValue({ userId: "user-123", claims: { sub: "user-123" } });
    mockRequireOwnershipImpl.mockRejectedValue(new StoreNotFoundError());

    const { PATCH } = await import("@/app/api/store/[id]/route");
    const res = await PATCH(createReq("PATCH", { name: "Updated" }), { params: Promise.resolve({ id: "nonexistent" }) });
    expect(res.status).toBe(404);
  });

  it("returns 401 when not authenticated", async () => {
    const { UnauthorizedError } = await import("@/lib/auth/require-user");
    mockRequireUserImpl.mockRejectedValue(new UnauthorizedError());

    const { PATCH } = await import("@/app/api/store/[id]/route");
    const res = await PATCH(createReq("PATCH", { name: "Updated" }), { params: Promise.resolve({ id: "store-1" }) });
    expect(res.status).toBe(401);
  });
});
