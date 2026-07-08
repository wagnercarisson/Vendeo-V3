// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockSupabaseFrom = vi.fn();
const mockRequireUser = vi.fn();
const mockRequireApiUser = vi.fn();
const mockRequireOwnership = vi.fn();
const mockGetCurrentStore = vi.fn();

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
    constructor(m = "Usuário não autenticado") { super(m); this.name = "UnauthorizedError"; }
  },
}));

vi.mock("@/lib/auth/store-ownership", () => ({
  requireAuthorizedStore: vi.fn(async (storeId: string) => {
    await mockRequireApiUser();
    return { userId: "user-123", storeId, store: await mockRequireOwnership(storeId, "user-123") };
  }),
  requireOwnership: vi.fn(async (storeId: string) => mockRequireOwnership(storeId)),
  getCurrentStore: vi.fn(async (userId?: string) => mockGetCurrentStore(userId)),
  StoreNotFoundError: class extends Error {
    constructor(m = "Store not found") { super(m); this.name = "StoreNotFoundError"; }
  },
  AuthorizedStoreContext: Object,
}));

vi.mock("@/lib/auth/csrf", () => ({
  requireSameOrigin: vi.fn(() => {}),
}));

vi.mock("@/lib/auth/api-handler", () => ({
  apiHandler: (fn: any) => fn,
}));

vi.mock("@/lib/store-response", () => ({
  buildStoreResponse: vi.fn(async (s: any) => s),
}));

function mockSupabaseSelect(result: unknown) {
  mockSupabaseFrom.mockReturnValue({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: result, error: null })),
            })),
            maybeSingle: vi.fn(async () => ({ data: result, error: null })),
          })),
          maybeSingle: vi.fn(async () => ({ data: result, error: null })),
        })),
        maybeSingle: vi.fn(async () => ({ data: result, error: null })),
      })),
      single: vi.fn(async () => ({ data: result, error: null })),
      order: vi.fn(() => ({
        limit: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data: result, error: null })),
        })),
        maybeSingle: vi.fn(async () => ({ data: result, error: null })),
        order: vi.fn(async () => ({ data: [result], error: null })),
      })),
    })),
  });
}

function createReq(method: string, url: string): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { origin: "http://localhost", host: "localhost" },
  });
}

interface TestCase {
  name: string;
  status: number;
  mockAuth: "valid" | "unauth" | "alien";
}

const authCases: TestCase[] = [
  { name: "owner access", status: 200, mockAuth: "valid" },
  { name: "no session", status: 401, mockAuth: "unauth" },
  { name: "alien store", status: 404, mockAuth: "alien" },
];

const errorCases: Omit<TestCase, "status">[] = [
  { name: "no session", mockAuth: "unauth" },
  { name: "alien store", mockAuth: "alien" },
];

beforeEach(() => {
  vi.restoreAllMocks();
});

async function setupMock(mockAuth: "valid" | "unauth" | "alien") {
  if (mockAuth === "unauth") {
    const { UnauthorizedError } = await import("@/lib/auth/require-user");
    mockRequireUser.mockRejectedValue(new UnauthorizedError());
    mockRequireApiUser.mockRejectedValue(new UnauthorizedError());
  } else if (mockAuth === "alien") {
    mockRequireUser.mockResolvedValue({ userId: "user-999", claims: {} });
    mockRequireApiUser.mockResolvedValue({ userId: "user-999", claims: {} });
    const { StoreNotFoundError } = await import("@/lib/auth/store-ownership");
    mockRequireOwnership.mockRejectedValue(new StoreNotFoundError());
  } else {
    mockRequireUser.mockResolvedValue({ userId: "user-123", claims: {} });
    mockRequireApiUser.mockResolvedValue({ userId: "user-123", claims: {} });
    mockRequireOwnership.mockResolvedValue({ id: "store-1", name: "Loja" });
    mockSupabaseSelect({ id: "store-1", name: "Loja" });
  }
}

describe("GET /api/store/:id", () => {
  it.each(authCases)("returns $status for $name", async ({ status, mockAuth }) => {
    await setupMock(mockAuth);
    if (mockAuth === "valid") mockSupabaseSelect({ id: "store-1", name: "Loja" });

    const { GET } = await import("@/app/api/store/[id]/route");
    const res = await GET(createReq("GET", "http://localhost/api/store/store-1"), {
      params: Promise.resolve({ id: "store-1" }),
    });
    expect(res.status).toBe(status);
  });
});

describe("PATCH /api/store/:id (error cases only)", () => {
  it.each(errorCases)("returns $status for $name", async ({ mockAuth }) => {
    await setupMock(mockAuth);

    const { PATCH } = await import("@/app/api/store/[id]/route");
    const res = await PATCH(
      createReq("PATCH", "http://localhost/api/store/store-1"),
      { params: Promise.resolve({ id: "store-1" }) },
    );
    if (mockAuth === "unauth") expect(res.status).toBe(401);
    else expect(res.status).toBe(404);
  });
});
