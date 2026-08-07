import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { UnauthorizedError, ForbiddenError } from "@/lib/auth/errors";

vi.mock("server-only", () => ({}));

const mockRequireAdmin = vi.fn();
vi.mock("@/lib/admin/require-admin", () => ({
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
}));

const mockRpc = vi.fn();
const mockFrom = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: {
    rpc: mockRpc,
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

const mockGetAllCosts = vi.fn();
class MockOperationCostUnavailableError extends Error {
  constructor(message?: string) {
    super(message ?? "Falha ao ler custos de operação");
    this.name = "OperationCostUnavailableError";
  }
}
vi.mock("@/lib/credit/operation-cost-service", () => ({
  OperationCostService: vi.fn(function () {
    return { getAllCosts: mockGetAllCosts };
  }),
  OperationCostUnavailableError: MockOperationCostUnavailableError,
  DEFAULT_OPERATION_COSTS: {
    campaign_generation: { costCredits: 1, enabled: true },
    visual_signature_generation: { costCredits: 1, enabled: true },
  },
}));

async function getCosts() {
  const { GET } = await import("../route");
  return GET(
    new NextRequest(new Request("http://localhost/api/admin/operation-costs")),
  );
}

async function putCosts(body: Record<string, unknown>) {
  const { PUT } = await import("../route");
  return PUT(
    new NextRequest(
      new Request("http://localhost/api/admin/operation-costs", {
        method: "PUT",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue({ userId: "admin-1" });
  mockFrom.mockImplementation((table: string) => {
    if (table === "users") {
      return {
        select: () => ({
          in: () =>
            Promise.resolve({
              data: [{ id: "admin-1", email: "admin@vendeo.com" }],
              error: null,
            }),
        }),
      };
    }
    return {};
  });
});

describe("GET /api/admin/operation-costs", () => {
  it("200 com operations + email join", async () => {
    mockGetAllCosts.mockResolvedValue([
      {
        operationKey: "campaign_generation",
        costCredits: 2,
        enabled: true,
        updatedByUserId: "admin-1",
        updatedAt: "2026-08-07T12:00:00.000Z",
        source: "table",
      },
      {
        operationKey: "visual_signature_generation",
        costCredits: 1,
        enabled: true,
        updatedByUserId: null,
        updatedAt: null,
        source: "fallback",
      },
    ]);

    const res = await getCosts();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.operations).toHaveLength(2);
    expect(body.operations[0].updatedBy).toBe("admin@vendeo.com");
    expect(body.operations[1].updatedBy).toBeNull();
    expect(body.operations[0].source).toBe("table");
  });

  it("503 quando getAllCosts lança OperationCostUnavailableError", async () => {
    mockGetAllCosts.mockRejectedValue(
      new MockOperationCostUnavailableError("down"),
    );
    const res = await getCosts();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe("operation_cost_unavailable");
  });

  it("403 quando requireAdmin lança ForbiddenError", async () => {
    mockRequireAdmin.mockRejectedValue(new ForbiddenError());
    const res = await getCosts();
    expect(res.status).toBe(403);
  });

  it("401 quando requireAdmin lança UnauthorizedError", async () => {
    mockRequireAdmin.mockRejectedValue(new UnauthorizedError());
    const res = await getCosts();
    expect(res.status).toBe(401);
  });
});

describe("PUT /api/admin/operation-costs", () => {
  it("200 sucesso + payload RPC correto", async () => {
    mockRpc.mockResolvedValue({
      data: {
        operation_key: "campaign_generation",
        cost_credits: 2,
        enabled: true,
        audit_id: "audit-1",
        updated_at: "2026-08-07T12:00:00.000Z",
        idempotent: false,
      },
      error: null,
    });

    const res = await putCosts({
      operationKey: "campaign_generation",
      costCredits: 2,
      reason: "ajuste beta",
      operationId: "00000000-0000-0000-0000-000000000099",
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.audit_id).toBe("audit-1");
    expect(body.operation_key).toBe("campaign_generation");
    expect(mockRpc).toHaveBeenCalledWith("admin_update_operation_cost", {
      p_actor_id: "admin-1",
      p_operation_key: "campaign_generation",
      p_cost_credits: 2,
      p_enabled: null,
      p_reason: "ajuste beta",
      p_operation_id: "00000000-0000-0000-0000-000000000099",
    });
  });

  it("200 passthrough idempotent true", async () => {
    mockRpc.mockResolvedValue({
      data: {
        operation_key: "campaign_generation",
        cost_credits: 2,
        enabled: true,
        audit_id: "audit-1",
        updated_at: "2026-08-07T12:00:00.000Z",
        idempotent: true,
      },
      error: null,
    });

    const res = await putCosts({
      operationKey: "campaign_generation",
      costCredits: 2,
      reason: "retry",
      operationId: "00000000-0000-0000-0000-000000000099",
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.idempotent).toBe(true);
  });

  it("400 zod — ambos os campos (XOR)", async () => {
    const res = await putCosts({
      operationKey: "campaign_generation",
      costCredits: 2,
      enabled: false,
      reason: "x",
    });
    expect(res.status).toBe(400);
  });

  it("400 zod — nenhum dos campos", async () => {
    const res = await putCosts({
      operationKey: "campaign_generation",
      reason: "x",
    });
    expect(res.status).toBe(400);
  });

  it("400 zod — reason vazio", async () => {
    const res = await putCosts({
      operationKey: "campaign_generation",
      costCredits: 2,
      reason: "",
    });
    expect(res.status).toBe(400);
  });

  it("500 erro do RPC", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "db down" },
    });
    const res = await putCosts({
      operationKey: "campaign_generation",
      costCredits: 2,
      reason: "x",
    });
    expect(res.status).toBe(500);
  });

  it("403 ForbiddenError", async () => {
    mockRequireAdmin.mockRejectedValue(new ForbiddenError());
    const res = await putCosts({
      operationKey: "campaign_generation",
      costCredits: 2,
      reason: "x",
    });
    expect(res.status).toBe(403);
  });
});
