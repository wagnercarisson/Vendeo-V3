import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

const { mockFrom, mockSelect, mockEq, mockOrder, mockRange, mockIn } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockSelect: vi.fn(),
  mockEq: vi.fn(),
  mockOrder: vi.fn(),
  mockRange: vi.fn(),
  mockIn: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: { from: mockFrom, rpc: vi.fn() },
  createServerClient: vi.fn(),
}));

vi.mock("@/lib/admin/require-admin", () => ({
  requireAdmin: vi.fn(() => Promise.resolve({ userId: "admin-1" })),
}));

vi.mock("@/lib/auth/api-handler", () => ({
  apiHandler: vi.fn((handler) => handler),
}));

vi.mock("@/lib/cnpj/mask", () => ({
  maskCnpj: vi.fn(() => "**.***.***/0001-**"),
}));

import { GET as ListReviews } from "../route";

function setupChain(data: unknown[]) {
  const chain = {
    select: mockSelect,
    eq: mockEq,
    order: mockOrder,
    range: mockRange,
    contains: vi.fn().mockReturnThis(),
  };
  mockSelect.mockReturnValue(chain);
  mockEq.mockReturnValue(chain);
  mockOrder.mockReturnValue(chain);
  mockRange.mockResolvedValue({ data, error: null, count: data.length });

  mockFrom.mockImplementation((table: string) => {
    if (table === "stores") return chain;
    return {
      select: vi.fn().mockReturnThis(),
      in: mockIn.mockResolvedValue({ data: [], error: null }),
    };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/admin/reviews", () => {
  it("lists stores by status", async () => {
    setupChain([
      { id: "store-1", name: "Loja 1", user_id: "user-1", created_at: "2026-07-28", verification_status: "review", verification_reasons: ["nome_divergente"], verification_data: null, cnpj_normalized: "12345678000190", cnpj_official_data: null },
    ]);

    const req = new NextRequest("http://localhost/api/admin/reviews?status=review");
    const res = await ListReviews(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].reasons).toContain("nome_divergente");
  });

  it("lists deferred stores", async () => {
    setupChain([
      { id: "store-2", name: "Loja Defer", user_id: "user-2", created_at: "2026-07-28", verification_status: "defer", verification_reasons: ["api_unavailable"], verification_data: null, cnpj_normalized: null, cnpj_official_data: null },
    ]);

    const req = new NextRequest("http://localhost/api/admin/reviews?status=defer");
    const res = await ListReviews(req);

    expect(res.status).toBe(200);
    expect((await res.json()).data[0].name).toBe("Loja Defer");
  });

  it("lists rejected stores (empty)", async () => {
    setupChain([]);

    const req = new NextRequest("http://localhost/api/admin/reviews?status=rejected");
    const res = await ListReviews(req);

    expect(res.status).toBe(200);
  });

  it("returns 400 for invalid status", async () => {
    const req = new NextRequest("http://localhost/api/admin/reviews?status=invalid");
    const res = await ListReviews(req);

    expect(res.status).toBe(400);
  });
});
