import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { ForbiddenError } from "@/lib/auth/errors";

vi.mock("server-only", () => ({}));

const mockRequireAdmin = vi.fn();
vi.mock("@/lib/admin/require-admin", () => ({
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
}));

const mockGetAiCosts = vi.fn();
class MockAiCostAdminUnavailableError extends Error {
  constructor(message?: string) {
    super(message ?? "Falha ao consultar custos de IA");
    this.name = "AiCostAdminUnavailableError";
  }
}
vi.mock("@/lib/ai-cost/admin-service", () => ({
  AiCostAdminService: vi.fn(function () {
    return { getAiCosts: mockGetAiCosts };
  }),
  AiCostAdminUnavailableError: MockAiCostAdminUnavailableError,
}));

async function getAiCosts(url = "http://localhost/api/admin/ai-costs") {
  const { GET } = await import("../route");
  return GET(new NextRequest(url));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue({ userId: "admin-1" });
});

describe("GET /api/admin/ai-costs (D3/D10 — agregação via RPC admin_get_ai_costs)", () => {
  it("200 com os 3 blocos (operationRuns/campaignStages/reconciliation) + filtros repassados", async () => {
    const aggregations = {
      operationRuns: [
        {
          operationRunId: "11111111-1111-4111-8111-111111111111",
          operationRunType: "campaign_delivery",
          custoUsdTotal: 0.037,
          chamadas: 4,
          chamadasSuccess: 4,
          duracaoTotalMs: 5200,
          regeneracoes: 0,
        },
      ],
      campaignStages: [
        { generationType: "campaign_copy", custoUsdTotal: 0.01, chamadas: 1 },
      ],
      reconciliation: [
        {
          operationRunId: "11111111-1111-4111-8111-111111111111",
          domain: "campaign",
          custoUsdTotal: 0.037,
          creditosDebitados: 1,
          margemEstimada: 0.963,
          etapasMaisCaras: ["campaign_image"],
          regeneracoes: 0,
        },
      ],
    };
    mockGetAiCosts.mockResolvedValue(aggregations);

    const res = await getAiCosts(
      "http://localhost/api/admin/ai-costs?store_id=22222222-2222-4222-8222-222222222222&hours=48",
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.operationRuns).toHaveLength(1);
    expect(body.campaignStages).toHaveLength(1);
    expect(body.reconciliation).toHaveLength(1);
    expect(mockGetAiCosts).toHaveBeenCalledWith({
      storeId: "22222222-2222-4222-8222-222222222222",
      userId: undefined,
      provider: undefined,
      model: undefined,
      generationType: undefined,
      operationRunId: undefined,
      campaignId: undefined,
      hours: 48,
    });
  });

  it("400 quando a query é inválida (zod)", async () => {
    const res = await getAiCosts(
      "http://localhost/api/admin/ai-costs?store_id=nao-e-um-uuid",
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Dados inválidos");
    expect(mockGetAiCosts).not.toHaveBeenCalled();
  });

  it("503 quando o serviço lança AiCostAdminUnavailableError", async () => {
    mockGetAiCosts.mockRejectedValue(
      new MockAiCostAdminUnavailableError("rpc down"),
    );
    const res = await getAiCosts();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe("ai_costs_unavailable");
  });

  it("403 sem admin (requireAdmin)", async () => {
    mockRequireAdmin.mockRejectedValue(new ForbiddenError());
    const res = await getAiCosts();
    expect(res.status).toBe(403);
    expect(mockGetAiCosts).not.toHaveBeenCalled();
  });
});
