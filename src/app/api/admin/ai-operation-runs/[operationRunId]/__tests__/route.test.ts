import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { ForbiddenError } from "@/lib/auth/errors";

vi.mock("server-only", () => ({}));

const mockRequireAdmin = vi.fn();
vi.mock("@/lib/admin/require-admin", () => ({
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
}));

const mockGetRunDetail = vi.fn();
class MockOperationRunsUnavailableError extends Error {
  constructor(message?: string) {
    super(message ?? "Falha ao consultar custos de operação");
    this.name = "OperationRunsUnavailableError";
  }
}
vi.mock("@/lib/ai-cost/operation-runs-service", () => ({
  OperationRunsService: vi.fn(function () {
    return { getRunDetail: mockGetRunDetail };
  }),
  OperationRunsUnavailableError: MockOperationRunsUnavailableError,
}));

const RUN_ID = "11111111-1111-4111-8111-111111111111";

const DETAIL_RUN_FIXTURE = {
  operationRunId: RUN_ID,
  operationRunType: "campaign_delivery",
  storeId: "22222222-2222-4222-8222-222222222222",
  storeName: "Loja Teste",
  ownerId: "33333333-3333-4333-8333-333333333333",
  createdAt: "2026-08-01T12:00:00.000Z",
  deliveryStatus: "success",
  custoUsdTotal: 0.037,
  custoBrl: 0.2035,
  creditosDebitados: 1,
  receitaOpBrl: 1.0,
  resultadoOpBrl: 0.7965,
  margemOpPct: 79.65,
  duracaoTotalMs: 5200,
  chamadas: 4,
  chamadasSuccess: 4,
  regeneracoes: 0,
  provider: "openai",
  model: "gpt-4.1-mini",
  costSource: "provider_reported",
  badge: "provider_reported",
  segment: "test",
  segmentConfidence: "high",
};

const EVENT_FIXTURE = {
  generationType: "campaign_image",
  provider: "openai",
  model: "gpt-image-2",
  status: "success",
  errorType: null,
  attemptNumber: 1,
  durationMs: 2800,
  promptTokens: 1200,
  completionTokens: 0,
  totalTokens: 1200,
  cachedInputTokens: 0,
  imageTokens: 1200,
  estimatedCostUsd: 0.032,
  estimatedCostBrl: 0.176,
  textComponentUsd: 0.002,
  imageToolComponentUsd: 0.03,
  costSource: "pricing_table",
  costFormulaVersion: "responses_image_generation_v2",
  costEstimationNote: "provisional_image_tool_unit_cost_until_provider_reconciliation",
  metadata: {},
  badge: "provisional image tool estimate",
};

const DETAIL_FIXTURE = {
  run: DETAIL_RUN_FIXTURE,
  events: [EVENT_FIXTURE],
};

async function getDetail(
  operationRunId = RUN_ID,
  url = `http://localhost/api/admin/ai-operation-runs/${operationRunId}`,
) {
  const { GET } = await import("../route");
  return GET(new NextRequest(url), {
    params: Promise.resolve({ operationRunId }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue({ userId: "admin-1" });
});

describe("GET /api/admin/ai-operation-runs/[operationRunId] (D4 — detalhe call-level)", () => {
  it("200 com { run, events } quando o uuid é válido", async () => {
    mockGetRunDetail.mockResolvedValue(DETAIL_FIXTURE);

    const res = await getDetail();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.run.operationRunId).toBe(RUN_ID);
    expect(body.run.custoBrl).toBe(0.2035);
    expect(body.events).toHaveLength(1);
    expect(body.events[0]).toMatchObject({
      generationType: "campaign_image",
      estimatedCostUsd: 0.032,
      estimatedCostBrl: 0.176,
      textComponentUsd: 0.002,
      imageToolComponentUsd: 0.03,
      badge: "provisional image tool estimate",
    });
    expect(mockGetRunDetail).toHaveBeenCalledWith(RUN_ID);
  });

  it("400 quando operationRunId não é uuid válido", async () => {
    const res = await getDetail("nao-e-um-uuid");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Dados inválidos");
    expect(mockGetRunDetail).not.toHaveBeenCalled();
  });

  it("403 sem admin (requireAdmin lança ForbiddenError)", async () => {
    mockRequireAdmin.mockRejectedValue(new ForbiddenError());
    const res = await getDetail();
    expect(res.status).toBe(403);
    expect(mockGetRunDetail).not.toHaveBeenCalled();
  });

  it("503 fail-closed quando o service lança OperationRunsUnavailableError", async () => {
    mockGetRunDetail.mockRejectedValue(
      new MockOperationRunsUnavailableError("rpc down"),
    );
    const res = await getDetail();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe("operation_runs_unavailable");
  });
});
