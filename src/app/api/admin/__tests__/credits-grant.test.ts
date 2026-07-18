import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { UnauthorizedError } from "@/lib/auth/errors";
import { ForbiddenError } from "@/lib/auth/errors";

vi.mock("server-only", () => ({}));

const mockRequireAdmin = vi.fn();
vi.mock("@/lib/admin/require-admin", () => ({
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
}));

const mockRpc = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: {
    rpc: mockRpc,
  },
}));

const mockGetBalance = vi.fn().mockResolvedValue(50);
vi.mock("@/lib/credit/credit-service", () => ({
  CreditService: function MockCreditService() {
    return {
      getBalance: mockGetBalance,
      reserveCredit: vi.fn(),
      confirmCredit: vi.fn(),
      refundCredit: vi.fn(),
      grantCredits: vi.fn(),
      getHistory: vi.fn(),
    };
  },
}));

async function postGrant(body: Record<string, unknown>) {
  const { POST } = await import("../credits/grant/route");
  const req = new NextRequest(
    new Request("http://localhost/api/admin/credits/grant", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }),
  );
  return POST(req);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue({ userId: "admin-1" });
  mockGetBalance.mockResolvedValue(50);
});

describe("POST /api/admin/credits/grant", () => {
  it("returns 200 with transaction_id, audit_id and newBalance", async () => {
    mockRpc.mockResolvedValue({
      data: {
        transaction_id: "tx-1",
        audit_id: "audit-1",
        idempotent: false,
        newBalance: 50,
      },
      error: null,
    });

    const res = await postGrant({
      storeId: "00000000-0000-0000-0000-000000000001",
      amount: 10,
      reason: "Créditos para teste do beta",
      operationId: "00000000-0000-0000-0000-000000000002",
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.transaction_id).toBe("tx-1");
    expect(body.audit_id).toBe("audit-1");
    expect(body.newBalance).toBe(50);
  });

  it("returns 400 when reason is too short", async () => {
    const res = await postGrant({
      storeId: "00000000-0000-0000-0000-000000000001",
      amount: 10,
      reason: "curto",
      operationId: "00000000-0000-0000-0000-000000000002",
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Dados inválidos");
  });

  it("returns 400 when storeId is malformed", async () => {
    const res = await postGrant({
      storeId: "not-a-uuid",
      amount: 10,
      reason: "Créditos para teste do beta",
      operationId: "00000000-0000-0000-0000-000000000002",
    });

    expect(res.status).toBe(400);
  });

  it("returns 500 when RPC returns error", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "store not found" },
    });

    const res = await postGrant({
      storeId: "00000000-0000-0000-0000-000000000001",
      amount: 10,
      reason: "Créditos para verificação de erro",
      operationId: "00000000-0000-0000-0000-000000000002",
    });

    expect(res.status).toBe(500);
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireAdmin.mockRejectedValue(new UnauthorizedError());

    const res = await postGrant({
      storeId: "00000000-0000-0000-0000-000000000001",
      amount: 10,
      reason: "Créditos para teste do beta",
      operationId: "00000000-0000-0000-0000-000000000002",
    });

    expect(res.status).toBe(401);
  });

  it("returns 403 when user is not admin", async () => {
    mockRequireAdmin.mockRejectedValue(new ForbiddenError());

    const res = await postGrant({
      storeId: "00000000-0000-0000-0000-000000000001",
      amount: 10,
      reason: "Créditos para teste do beta",
      operationId: "00000000-0000-0000-0000-000000000002",
    });

    expect(res.status).toBe(403);
  });

  it("is idempotent with same operationId", async () => {
    mockRpc.mockResolvedValue({
      data: {
        transaction_id: "tx-1",
        audit_id: "audit-1",
        idempotent: true,
        newBalance: 50,
      },
      error: null,
    });

    const res = await postGrant({
      storeId: "00000000-0000-0000-0000-000000000001",
      amount: 10,
      reason: "Créditos para teste do beta",
      operationId: "00000000-0000-0000-0000-000000000002",
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.idempotent).toBe(true);
  });
});
