import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const STORE_ID = "550e8400-e29b-41d4-a716-446655440000";

const { mockFrom, mockUpsert, mockSelect } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockUpsert: vi.fn(),
  mockSelect: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(),
  supabaseAdmin: {
    from: mockFrom,
  },
}));

vi.mock("@/lib/auth/require-user", () => ({
  requireUser: vi.fn(async () => ({ userId: "user-123" })),
  requireApiUser: vi.fn(async () => ({ userId: "user-123" })),
  UnauthorizedError: class UnauthorizedError extends Error {
    constructor(message = "Usuário não autenticado") { super(message); this.name = "UnauthorizedError"; }
  },
}));

import { StoreNotFoundError } from "@/lib/auth/store-ownership";

vi.mock("@/lib/auth/store-ownership", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth/store-ownership")>("@/lib/auth/store-ownership");
  return {
    ...actual,
    requireOwnership: vi.fn(),
  };
});

import { requireOwnership } from "@/lib/auth/store-ownership";

describe("POST /api/store/billing/confirm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const single = vi.fn().mockResolvedValue({ data: null, error: null });
    mockSelect.mockReturnValue({ single });
    mockUpsert.mockReturnValue({ select: mockSelect });
    mockFrom.mockReturnValue({ upsert: mockUpsert });
  });

  it("returns 200 with confirmed_at when confirmed=true", async () => {
    vi.mocked(requireOwnership).mockResolvedValue({ id: STORE_ID } as any);
    const now = new Date().toISOString();
    const single = vi.fn().mockResolvedValue({
      data: { id: "billing-1", store_id: STORE_ID, billing_email: "loja@test.com", billing_data_confirmed_at: now },
      error: null,
    });
    mockSelect.mockReturnValue({ single });
    mockUpsert.mockReturnValue({ select: mockSelect });

    const { POST } = await import("../route");
    const req = new NextRequest(`http://localhost/api/store/billing/confirm`, {
      method: "POST",
      body: JSON.stringify({ storeId: STORE_ID, billingData: { billing_email: "loja@test.com" }, confirmed: true }),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.billingInfo.billing_data_confirmed_at).toBeTruthy();
  });

  it("returns 200 with null confirmed_at when confirmed=false", async () => {
    vi.mocked(requireOwnership).mockResolvedValue({ id: STORE_ID } as any);
    const single = vi.fn().mockResolvedValue({
      data: { id: "billing-1", store_id: STORE_ID, billing_email: "loja@test.com", billing_data_confirmed_at: null },
      error: null,
    });
    mockSelect.mockReturnValue({ single });
    mockUpsert.mockReturnValue({ select: mockSelect });

    const { POST } = await import("../route");
    const req = new NextRequest(`http://localhost/api/store/billing/confirm`, {
      method: "POST",
      body: JSON.stringify({ storeId: STORE_ID, billingData: { billing_email: "loja@test.com" }, confirmed: false }),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.billingInfo.billing_data_confirmed_at).toBeNull();
  });

  it("returns 404 when ownership violated", async () => {
    vi.mocked(requireOwnership).mockRejectedValue(new StoreNotFoundError());

    const { POST } = await import("../route");
    const req = new NextRequest(`http://localhost/api/store/billing/confirm`, {
      method: "POST",
      body: JSON.stringify({ storeId: STORE_ID, billingData: {}, confirmed: true }),
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });
});
