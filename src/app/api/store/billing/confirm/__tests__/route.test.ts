import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const STORE_ID = "550e8400-e29b-41d4-a716-446655440000";

const mockUpsertStoreBillingInfo = vi.fn();

vi.mock("@/lib/billing/store-billing-info", () => ({
  upsertStoreBillingInfo: mockUpsertStoreBillingInfo,
}));

vi.mock("@/lib/auth/require-user", () => ({
  requireUser: vi.fn(async () => ({ userId: "user-123" })),
  requireApiUser: vi.fn(async () => ({ userId: "user-123" })),
  UnauthorizedError: class UnauthorizedError extends Error {
    constructor(message = "Usuário não autenticado") { super(message); this.name = "UnauthorizedError"; }
  },
}));

class MockStoreNotFoundError extends Error {
  constructor(message = "Store not found or access denied") { super(message); this.name = "StoreNotFoundError"; }
}

vi.mock("@/lib/auth/store-ownership", () => ({
  StoreNotFoundError: MockStoreNotFoundError,
  requireOwnership: vi.fn(),
}));

describe("POST /api/store/billing/confirm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates to upsertStoreBillingInfo with confirm=true when confirmed=true", async () => {
    mockUpsertStoreBillingInfo.mockResolvedValue({
      id: "billing-1",
      store_id: STORE_ID,
      billing_email: "loja@test.com",
      billing_data_confirmed_at: new Date().toISOString(),
    });

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
    expect(mockUpsertStoreBillingInfo).toHaveBeenCalledWith(
      STORE_ID,
      "user-123",
      { billing_email: "loja@test.com" },
      { confirm: true },
    );
  });

  it("delegates to upsertStoreBillingInfo with confirm=false when confirmed=false", async () => {
    mockUpsertStoreBillingInfo.mockResolvedValue({
      id: "billing-1",
      store_id: STORE_ID,
      billing_email: "loja@test.com",
      billing_data_confirmed_at: null,
    });

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
    expect(mockUpsertStoreBillingInfo).toHaveBeenCalledWith(
      STORE_ID,
      "user-123",
      { billing_email: "loja@test.com" },
      { confirm: false },
    );
  });

  it("returns 404 when upsertStoreBillingInfo throws StoreNotFoundError", async () => {
    mockUpsertStoreBillingInfo.mockRejectedValue(new MockStoreNotFoundError());

    const { POST } = await import("../route");
    const req = new NextRequest(`http://localhost/api/store/billing/confirm`, {
      method: "POST",
      body: JSON.stringify({ storeId: STORE_ID, billingData: {}, confirmed: true }),
    });
    const res = await POST(req);

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Loja não encontrada ou acesso negado");
  });

  it("passes billing_data_source through to upsertStoreBillingInfo", async () => {
    mockUpsertStoreBillingInfo.mockResolvedValue({
      id: "billing-1",
      store_id: STORE_ID,
      billing_data_source: "manual",
      billing_data_confirmed_at: null,
    });

    const { POST } = await import("../route");
    const req = new NextRequest(`http://localhost/api/store/billing/confirm`, {
      method: "POST",
      body: JSON.stringify({
        storeId: STORE_ID,
        billingData: { billing_email: "loja@test.com", billing_data_source: "manual" },
        confirmed: false,
      }),
    });
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(mockUpsertStoreBillingInfo).toHaveBeenCalledWith(
      STORE_ID,
      "user-123",
      { billing_email: "loja@test.com", billing_data_source: "manual" },
      { confirm: false },
    );
  });
});