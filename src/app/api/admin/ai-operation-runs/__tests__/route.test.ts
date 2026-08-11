import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { ForbiddenError } from "@/lib/auth/errors";

vi.mock("server-only", () => ({}));

const mockRequireAdmin = vi.fn();
vi.mock("@/lib/admin/require-admin", () => ({
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
}));

const mockListRuns = vi.fn();
class MockOperationRunsUnavailableError extends Error {
  constructor(message?: string) {
    super(message ?? "Falha ao consultar custos de operação");
    this.name = "OperationRunsUnavailableError";
  }
}
vi.mock("@/lib/ai-cost/operation-runs-service", () => ({
  OperationRunsService: vi.fn(function () {
    return { listRuns: mockListRuns };
  }),
  OperationRunsUnavailableError: MockOperationRunsUnavailableError,
}));

const RUN_FIXTURE = {
  operationRunId: "11111111-1111-4111-8111-111111111111",
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

const SUMMARY_FIXTURE = {
  custoUsdTotal: 0.037,
  custoBrl: 0.2035,
  creditosDebitados: 1,
  receitaOpBrl: 1.0,
  resultadoOpBrl: 0.7965,
  margemOpPct: 79.65,
  tempoMedioMs: 5200,
  p95Ms: 6100,
  totalEntregas: 1,
  entregasErro: 0,
  entregasSucesso: 1,
};

const AGGREGATIONS_FIXTURE = {
  bySegment: {
    test: {
      segment: "test",
      entregas: 1,
      custoBrl: 0.2035,
      resultadoOpBrl: 0.7965,
      margemOpPct: 79.65,
      taxaErro: 0,
    },
  },
  byDeliveryType: { campaign_delivery: 1 },
  byStage: { campaign_image: 1 },
  byProviderModel: { "openai/gpt-4.1-mini": 1 },
  byStatus: { success: 1 },
  byStore: {},
  byOwner: {},
  byHour: { 12: 1 },
};

function listResult(overrides: Record<string, unknown> = {}) {
  return {
    runs: [RUN_FIXTURE],
    summary: SUMMARY_FIXTURE,
    aggregations: AGGREGATIONS_FIXTURE,
    page: 1,
    total: 1,
    ...overrides,
  };
}

async function getRuns(url = "http://localhost/api/admin/ai-operation-runs") {
  const { GET } = await import("../route");
  return GET(new NextRequest(url));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue({ userId: "admin-1" });
});

describe("GET /api/admin/ai-operation-runs (D4/D9 — lista de entregas)", () => {
  it("200 com runs/summary/aggregations/page/total e query vazia", async () => {
    mockListRuns.mockResolvedValue(listResult());

    const res = await getRuns();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.runs).toHaveLength(1);
    expect(body.runs[0]).toMatchObject({
      operationRunId: RUN_FIXTURE.operationRunId,
      custoUsdTotal: 0.037,
      custoBrl: 0.2035,
      creditosDebitados: 1,
      receitaOpBrl: 1.0,
      resultadoOpBrl: 0.7965,
      margemOpPct: 79.65,
      badge: "provider_reported",
      segment: "test",
    });
    expect(body.summary).toMatchObject(SUMMARY_FIXTURE);
    expect(body.aggregations).toHaveProperty("bySegment");
    expect(body.aggregations).toHaveProperty("byStage");
    expect(body.page).toBe(1);
    expect(body.total).toBe(1);
    expect(mockListRuns).toHaveBeenCalledWith({
      periodStart: undefined,
      periodEnd: undefined,
      storeId: undefined,
      operationRunType: undefined,
      status: undefined,
      provider: undefined,
      model: undefined,
      generationType: undefined,
      operationRunId: undefined,
      segment: undefined,
      page: 1,
      pageSize: 25,
    });
  });

  it("400 zod quando janela > 365 dias e quando store_id não é uuid", async () => {
    const longWindow =
      "period_start=2025-01-01T00:00:00.000Z&period_end=2026-08-01T00:00:00.000Z";
    const resLong = await getRuns(
      `http://localhost/api/admin/ai-operation-runs?${longWindow}`,
    );
    expect(resLong.status).toBe(400);
    const bodyLong = await resLong.json();
    expect(bodyLong.error).toBe("Dados inválidos");
    expect(JSON.stringify(bodyLong.details)).toContain("365");

    const resUuid = await getRuns(
      "http://localhost/api/admin/ai-operation-runs?store_id=nao-e-um-uuid",
    );
    expect(resUuid.status).toBe(400);
    expect(mockListRuns).not.toHaveBeenCalled();
  });

  it("403 sem admin (requireAdmin lança ForbiddenError)", async () => {
    mockRequireAdmin.mockRejectedValue(new ForbiddenError());
    const res = await getRuns();
    expect(res.status).toBe(403);
    expect(mockListRuns).not.toHaveBeenCalled();
  });

  it("503 fail-closed quando o service lança OperationRunsUnavailableError", async () => {
    mockListRuns.mockRejectedValue(
      new MockOperationRunsUnavailableError("rpc down"),
    );
    const res = await getRuns();
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe("operation_runs_unavailable");
  });

  it("repassa todos os filtros ao service (período, loja, tipo, status, provider, model, gen_type, run_id)", async () => {
    mockListRuns.mockResolvedValue(listResult());

    const res = await getRuns(
      `http://localhost/api/admin/ai-operation-runs?${[
        "period_start=2026-07-01T00:00:00.000Z",
        "period_end=2026-07-31T00:00:00.000Z",
        "store_id=22222222-2222-4222-8222-222222222222",
        "operation_run_type=visual_signature",
        "status=failed",
        "provider=openai",
        "model=gpt-image-2",
        "generation_type=campaign_image",
        "operation_run_id=55555555-5555-4555-8555-555555555555",
      ].join("&")}`,
    );
    expect(res.status).toBe(200);
    expect(mockListRuns).toHaveBeenCalledWith({
      periodStart: "2026-07-01T00:00:00.000Z",
      periodEnd: "2026-07-31T00:00:00.000Z",
      storeId: "22222222-2222-4222-8222-222222222222",
      operationRunType: "visual_signature",
      status: "failed",
      provider: "openai",
      model: "gpt-image-2",
      generationType: "campaign_image",
      operationRunId: "55555555-5555-4555-8555-555555555555",
      segment: undefined,
      page: 1,
      pageSize: 25,
    });
  });

  it("paginação com page/total — page e page_size repassados e refletidos", async () => {
    const runs = Array.from({ length: 25 }, (_, i) => ({
      ...RUN_FIXTURE,
      operationRunId: `66666666-6666-4666-8666-${String(i).padStart(12, "0")}`,
    }));
    mockListRuns.mockResolvedValue(
      listResult({ runs, page: 2, total: 60 }),
    );

    const res = await getRuns(
      "http://localhost/api/admin/ai-operation-runs?page=2&page_size=25",
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.page).toBe(2);
    expect(body.total).toBe(60);
    expect(body.runs).toHaveLength(25);
    expect(mockListRuns).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, pageSize: 25 }),
    );
  });

  it("summary/aggregations refletem o conjunto filtrado inteiro (não a página)", async () => {
    // page=2, mas summary.totalEntregas=60 → o service deriva sobre os 60
    mockListRuns.mockResolvedValue(
      listResult({
        runs: Array.from({ length: 25 }, (_, i) => ({
          ...RUN_FIXTURE,
          operationRunId: `77777777-7777-4777-8777-${String(i).padStart(12, "0")}`,
        })),
        summary: { ...SUMMARY_FIXTURE, totalEntregas: 60 },
        aggregations: {
          ...AGGREGATIONS_FIXTURE,
          bySegment: {
            test: {
              segment: "test",
              entregas: 60,
              custoBrl: 12.21,
              resultadoOpBrl: 47.79,
              margemOpPct: 79.65,
              taxaErro: 0,
            },
          },
        },
        page: 2,
        total: 60,
      }),
    );

    const res = await getRuns(
      "http://localhost/api/admin/ai-operation-runs?page=2",
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.summary.totalEntregas).toBe(60);
    expect(body.aggregations.bySegment.test.entregas).toBe(60);
  });

  it("margemOpPct null quando receita é 0 (sem divisão por zero)", async () => {
    mockListRuns.mockResolvedValue(
      listResult({
        runs: [
          {
            ...RUN_FIXTURE,
            creditosDebitados: 0,
            receitaOpBrl: 0,
            resultadoOpBrl: -0.037,
            margemOpPct: null,
          },
        ],
        summary: {
          ...SUMMARY_FIXTURE,
          creditosDebitados: 0,
          receitaOpBrl: 0,
          resultadoOpBrl: -0.037,
          margemOpPct: null,
        },
        aggregations: {
          ...AGGREGATIONS_FIXTURE,
          bySegment: {
            test: {
              segment: "test",
              entregas: 1,
              custoBrl: 0.2035,
              resultadoOpBrl: -0.037,
              margemOpPct: null,
              taxaErro: 0,
            },
          },
        },
      }),
    );

    const res = await getRuns();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.runs[0].margemOpPct).toBeNull();
    expect(body.summary.margemOpPct).toBeNull();
    expect(body.aggregations.bySegment.test.margemOpPct).toBeNull();
  });

  it("segment=test é repassado ao service (filtro antes de paginar — total consistente)", async () => {
    // 60 runs base, 12 de teste → o service retorna total 12 (conjunto segmento-filtrado)
    const testRuns = Array.from({ length: 12 }, (_, i) => ({
      ...RUN_FIXTURE,
      operationRunId: `44444444-4444-4444-8444-${String(i).padStart(12, "0")}`,
    }));
    mockListRuns.mockResolvedValue(
      listResult({
        runs: testRuns.slice(0, 10),
        summary: { ...SUMMARY_FIXTURE, totalEntregas: 12 },
        page: 1,
        total: 12,
      }),
    );

    const res = await getRuns(
      "http://localhost/api/admin/ai-operation-runs?segment=test&page_size=10",
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(12);
    expect(body.runs).toHaveLength(10);
    expect(mockListRuns).toHaveBeenCalledWith(
      expect.objectContaining({ segment: "test", pageSize: 10 }),
    );
  });
});
