// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToString } from "react-dom/server";

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

// Componentes client mockados — a página é Server Component: os mocks
// permitem verificar os props passados (runs/summary/aggregations/filters).
vi.mock("../kpis-grid", () => ({
  KpisGrid: ({ summary }: { summary: unknown }) => (
    <div data-testid="kpis-grid" data-summary={JSON.stringify(summary)} />
  ),
}));
vi.mock("../operation-runs-table", () => ({
  OperationRunsTable: ({ runs }: { runs: unknown[] }) => (
    <div data-testid="operation-runs-table" data-runs={JSON.stringify(runs)} />
  ),
}));
vi.mock("../segment-aggregations", () => ({
  SegmentAggregations: ({ aggregations }: { aggregations: unknown }) => (
    <div
      data-testid="segment-aggregations"
      data-aggregations={JSON.stringify(aggregations)}
    />
  ),
}));
vi.mock("../ai-operation-costs-filters", () => ({
  AiOperationCostsFilters: ({ filters }: { filters: unknown }) => (
    <div data-testid="filters" data-filters={JSON.stringify(filters)} />
  ),
}));
vi.mock("../run-detail-dialog", () => ({
  RunDetailDialog: () => <div data-testid="run-detail-dialog" />,
}));

/** Fixture de entrega derivada (contrato D4/D9 do OperationRunsService — 38-2-05). */
function makeRun(overrides: Record<string, unknown> = {}) {
  return {
    operationRunId: "11111111-1111-4111-8111-111111111111",
    operationRunType: "campaign_delivery",
    storeId: "store-1",
    storeName: "Loja Teste",
    ownerId: "owner-1",
    createdAt: "2026-08-01T12:00:00.000Z",
    deliveryStatus: "success",
    custoUsdTotal: 10,
    custoBrl: 50,
    creditosDebitados: 20,
    receitaOpBrl: 20,
    resultadoOpBrl: -30,
    margemOpPct: -150,
    duracaoTotalMs: 1000,
    chamadas: 2,
    chamadasSuccess: 2,
    regeneracoes: 0,
    provider: "openai",
    model: "gpt-4o",
    costSource: "pricing_table",
    badge: "estimated",
    segment: "freemium/promotional",
    segmentConfidence: "high",
    ...overrides,
  };
}

/** Resultado de listRuns com summary + aggregations (contrato D3/D4/D9). */
function makeListResult(overrides: Record<string, unknown> = {}) {
  const runs = (overrides.runs as unknown[] | undefined) ?? [makeRun()];
  return {
    runs,
    summary: {
      custoUsdTotal: 10,
      custoBrl: 50,
      creditosDebitados: 20,
      receitaOpBrl: 20,
      resultadoOpBrl: -30,
      margemOpPct: -150,
      tempoMedioMs: 1000,
      p95Ms: 1200,
      totalEntregas: 1,
      entregasErro: 0,
      entregasSucesso: 1,
    },
    aggregations: {
      bySegment: {
        "freemium/promotional": {
          segment: "freemium/promotional",
          entregas: 1,
          custoBrl: 50,
          resultadoOpBrl: -30,
          margemOpPct: -150,
          taxaErro: 0,
        },
      },
      byDeliveryType: { campaign_delivery: 1 },
      byStage: { campaign_image: 1 },
      byProviderModel: { "openai/gpt-4o": 1 },
      byStatus: { success: 1 },
      byStore: { "store-1": { storeName: "Loja Teste", entregas: 1, custoBrl: 50 } },
      byOwner: { "owner-1": { ownerId: "owner-1", entregas: 1, custoBrl: 50 } },
      byHour: { 12: 1 },
    },
    page: 1,
    total: 1,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue({ userId: "admin-1" });
});

describe("AdminAiOperationCostsPage — Custos de Operação (D3/D9)", () => {
  it("com dados → renderiza KPIs + tabela + agregados + título 'Custos de Operação'", async () => {
    mockListRuns.mockResolvedValue(makeListResult());

    const { default: Page } = await import("../page");
    const html = renderToString(
      await Page({ searchParams: Promise.resolve({}) }),
    );

    expect(html).toContain("Custos de Operação");
    expect(html).toContain("data-testid=\"kpis-grid\"");
    expect(html).toContain("data-testid=\"operation-runs-table\"");
    expect(html).toContain("data-testid=\"segment-aggregations\"");
    // A página repassa summary/aggregations do service — NUNCA recalcula KPIs.
    expect(html).toContain('data-testid="kpis-grid" data-summary=');
    expect(mockListRuns).toHaveBeenCalledWith(expect.any(Object));
  });

  it("OperationRunsUnavailableError → 503 fail-closed 'Serviço indisponível no momento'", async () => {
    mockListRuns.mockRejectedValue(
      new MockOperationRunsUnavailableError("down"),
    );

    const { default: Page } = await import("../page");
    const html = renderToString(
      await Page({ searchParams: Promise.resolve({}) }),
    );

    expect(html).toContain("Serviço indisponível no momento");
    expect(html).not.toContain("data-testid=\"kpis-grid\"");
  });

  it("sem runs → EmptyState 'aguardando dados de geração'", async () => {
    mockListRuns.mockResolvedValue(makeListResult({ runs: [] }));

    const { default: Page } = await import("../page");
    const html = renderToString(
      await Page({ searchParams: Promise.resolve({}) }),
    );

    expect(html).toContain("Aguardando dados de geração");
    expect(html).not.toContain("data-testid=\"kpis-grid\"");
  });

  it("filtros dos searchParams são repassados ao service (D3/D9)", async () => {
    mockListRuns.mockResolvedValue(makeListResult());

    const { default: Page } = await import("../page");
    await Page({
      searchParams: Promise.resolve({
        periodStart: "2026-07-25",
        periodEnd: "2026-08-01",
        storeId: "store-1",
        operationRunType: "campaign_delivery",
        status: "success",
        provider: "openai",
        model: "gpt-4o",
        generationType: "campaign_image",
        operationRunId: "11111111-1111-4111-8111-111111111111",
        segment: "freemium/promotional",
        page: "2",
      }),
    });

    expect(mockListRuns).toHaveBeenCalledWith(
      expect.objectContaining({
        periodStart: "2026-07-25",
        periodEnd: "2026-08-01",
        storeId: "store-1",
        operationRunType: "campaign_delivery",
        status: "success",
        provider: "openai",
        model: "gpt-4o",
        generationType: "campaign_image",
        operationRunId: "11111111-1111-4111-8111-111111111111",
        segment: "freemium/promotional",
        page: 2,
      }),
    );
  });

  it("filtros são repassados ao AiOperationCostsFilters (a UI não recalcula)", async () => {
    mockListRuns.mockResolvedValue(makeListResult());

    const { default: Page } = await import("../page");
    const html = renderToString(
      await Page({
        searchParams: Promise.resolve({ segment: "paid", status: "failed" }),
      }),
    );

    expect(html).toContain('data-testid="filters"');
    // JSON serializado no atributo → aspas viram &quot; (entidades HTML).
    expect(html).toContain("&quot;segment&quot;:&quot;paid&quot;");
    expect(html).toContain("&quot;status&quot;:&quot;failed&quot;");
  });
});
