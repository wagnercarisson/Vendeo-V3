// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

import { CostBadge, CostBadgeLegend } from "../cost-badge";
import { KpisGrid } from "../kpis-grid";
import { OperationRunsTable } from "../operation-runs-table";
import { AiOperationCostsFilters } from "../ai-operation-costs-filters";
import { RunDetailDialog } from "../run-detail-dialog";
import { SegmentAggregations } from "../segment-aggregations";
import type {
  OperationRun,
  OperationRunsSummary,
} from "@/lib/ai-cost/operation-runs-service";

/** Entrega derivada (contrato D4/D9 do service — 38-2-05). */
function makeRun(overrides: Record<string, unknown> = {}): OperationRun {
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
    creditosEstornados: 0,
    creditosLiquidos: 20,
    receitaEstimadaBrl: 20,
    resultadoEstimadoBrl: -30,
    margemEstimadaPct: -150,
    // Snapshot econômico captured (D8) — default quando o cenário não diverge
    usdBrlRateAtGeneration: 5,
    creditValueBrlAtGeneration: 1,
    usdBrlRateSource: "captured_at_generation",
    creditValueSource: "captured_at_generation",
    revenueEstimationNote: null,
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

const SUMMARY: OperationRunsSummary = {
  custoUsdTotal: 10,
  custoBrl: 50,
  creditosDebitados: 20,
  creditosEstornados: 0,
  creditosLiquidos: 20,
  receitaEstimadaBrl: 20,
  resultadoEstimadoBrl: -30,
  margemEstimadaPct: -150,
  usdBrlRateSource: "captured_at_generation",
  creditValueSource: "captured_at_generation",
  revenueEstimationNote: null,
  tempoMedioMs: 1000,
  p95Ms: 1200,
  totalEntregas: 1,
  entregasErro: 0,
  entregasSucesso: 1,
};

const AGGREGATIONS = {
  bySegment: {
    "freemium/promotional": {
      segment: "freemium/promotional",
      entregas: 2,
      custoBrl: 50,
      resultadoEstimadoBrl: -30,
      margemEstimadaPct: -150,
      taxaErro: 0.5,
    },
  },
  byDeliveryType: { campaign_delivery: 1 },
  byStage: { campaign_image: 1 },
  byProviderModel: { "openai/gpt-4o": 1 },
  byStatus: { success: 1 },
  byStore: { "store-1": { storeName: "Loja Teste", entregas: 1, custoBrl: 50 } },
  byOwner: { "owner-1": { ownerId: "owner-1", entregas: 1, custoBrl: 50 } },
  byHour: { 12: 1 },
} as const;

const mockFetch = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CostBadge (D5)", () => {
  it("renderiza o rótulo correto para cada badge de confiança", () => {
    const cases: Array<[OperationRun["badge"], string]> = [
      ["provider_reported", "Custo reportado pelo provider"],
      ["provisional image tool estimate", "Estimativa provisória de ferramenta de imagem"],
      ["partial", "Estimativa parcial"],
      ["estimated", "Estimado"],
      ["not_available", "Custo não disponível"],
    ];
    for (const [badge, label] of cases) {
      const { unmount } = render(<CostBadge badge={badge} />);
      expect(screen.getByText(label)).toBeInTheDocument();
      unmount();
    }
  });

  it("legend 'estimativas operacionais, não custo financeiro reconciliado' visível", () => {
    render(<CostBadgeLegend />);
    expect(
      screen.getByText(
        /Estimativas operacionais — não custo financeiro reconciliado/,
      ),
    ).toBeInTheDocument();
  });
});

describe("KpisGrid (D3)", () => {
  it("renderiza custo USD/BRL, créditos, receita, resultado, margem, tempo médio, P95, entregas, erros/sucessos", () => {
    render(<KpisGrid summary={SUMMARY} />);
    expect(screen.getByText("Custo estimado total (USD)")).toBeInTheDocument();
    expect(screen.getByText("US$ 10,00")).toBeInTheDocument();
    expect(screen.getByText("Custo estimado total (BRL)")).toBeInTheDocument();
    expect(screen.getByText("R$ 50,00")).toBeInTheDocument();
    expect(screen.getByText("Créditos brutos")).toBeInTheDocument();
    expect(screen.getByText("Estornos")).toBeInTheDocument();
    expect(screen.getByText("Créditos líquidos")).toBeInTheDocument();
    expect(screen.getByText("Receita estimada (BRL)")).toBeInTheDocument();
    expect(
      screen.getByText("Resultado estimado (BRL)"),
    ).toBeInTheDocument();
    expect(screen.getByText("Margem estimada")).toBeInTheDocument();
    expect(screen.getByText("Tempo médio")).toBeInTheDocument();
    expect(screen.getByText("1.0s")).toBeInTheDocument();
    expect(screen.getByText("Tempo P95 (95% das entregas)")).toBeInTheDocument();
    expect(screen.getByText("Total de entregas")).toBeInTheDocument();
    expect(screen.getByText("Entregas com erro")).toBeInTheDocument();
    expect(screen.getByText("Entregas com sucesso")).toBeInTheDocument();
  });

  it("origem do valor (D8): fallback → badge 'estimado de parâmetro atual'; backfilled → 'reconstruído de histórico'", () => {
    const fallbackSummary: OperationRunsSummary = {
      ...SUMMARY,
      usdBrlRateSource: "economic_parameter_fallback",
      creditValueSource: "economic_parameter_fallback",
      revenueEstimationNote: "estimated_from_admin_credit_value",
    };
    const { unmount } = render(<KpisGrid summary={fallbackSummary} />);
    expect(screen.getAllByText("estimado de parâmetro atual").length).toBeGreaterThan(0);
    expect(
      screen.getByTestId("kpi-origin-Receita estimada (BRL)"),
    ).toHaveAttribute("data-origin", "economic_parameter_fallback");
    unmount();

    const backfilledSummary: OperationRunsSummary = {
      ...SUMMARY,
      usdBrlRateSource: "backfilled_seed",
      creditValueSource: "backfilled_from_audit",
      revenueEstimationNote: "backfilled_historical_approximation",
    };
    render(<KpisGrid summary={backfilledSummary} />);
    expect(screen.getAllByText("reconstruído de histórico").length).toBeGreaterThan(0);
  });
});

describe("OperationRunsTable (D3/D5/D7)", () => {
  it("renderiza data, tipo, loja, status, custo USD/BRL, créditos, tempo, chamadas, regenerações, provider/model e badge", () => {
    render(<OperationRunsTable runs={[makeRun()]} />);

    expect(screen.getByText("01/08/2026, 09:00")).toBeInTheDocument();
    expect(screen.getByText("Campanha")).toBeInTheDocument();
    expect(screen.getByText("Loja Teste")).toBeInTheDocument();
    expect(screen.getByText("Sucesso")).toBeInTheDocument();
    expect(screen.getByText("US$ 10,00")).toBeInTheDocument();
    expect(screen.getByText("R$ 50,00")).toBeInTheDocument();
    expect(screen.getByText("Bruto: 20")).toBeInTheDocument(); // breakdown créditos
    expect(screen.getByText("Estorno: 0")).toBeInTheDocument();
    expect(screen.getByText("Líquido: 20")).toBeInTheDocument();
    expect(
      screen.getByText("Receita estimada R$ 20,00 · Resultado estimado R$ -30,00"),
    ).toBeInTheDocument(); // financeiro derivado de líquidos
    expect(screen.getByText("1.0s")).toBeInTheDocument(); // tempo
    expect(screen.getByText("2")).toBeInTheDocument(); // chamadas
    expect(screen.getByText("0")).toBeInTheDocument(); // regenerações
    expect(screen.getByText("openai/gpt-4o")).toBeInTheDocument();
    expect(screen.getByText("Estimado")).toBeInTheDocument(); // badge D5
  });

  it("placeholder F38.3 (D7): 'ainda indisponível' e 'pendente' visíveis", () => {
    render(<OperationRunsTable runs={[makeRun()]} />);
    expect(screen.getAllByText("ainda indisponível").length).toBeGreaterThan(0);
    expect(screen.getAllByText("pendente").length).toBeGreaterThan(0);
  });

  it("run legado (sem snapshot) → badge de fallback 'parâmetro atual (fallback)' visível (T-38.2.1-15)", () => {
    render(
      <OperationRunsTable
        runs={[
          makeRun({
            usdBrlRateAtGeneration: null,
            creditValueBrlAtGeneration: null,
            usdBrlRateSource: "economic_parameter_fallback",
            creditValueSource: "economic_parameter_fallback",
            revenueEstimationNote: "estimated_from_admin_credit_value",
          }),
        ]}
      />,
    );
    expect(screen.getByText("parâmetro atual (fallback)")).toBeInTheDocument();
    expect(
      screen.getByTestId("run-origin-11111111-1111-4111-8111-111111111111"),
    ).toHaveAttribute("data-origin", "economic_parameter_fallback");
  });

  it("run backfilled → badge 'reconstruído de histórico' visível (D8)", () => {
    render(
      <OperationRunsTable
        runs={[
          makeRun({
            usdBrlRateSource: "backfilled_seed",
            creditValueSource: "backfilled_from_audit",
            revenueEstimationNote: "backfilled_historical_approximation",
          }),
        ]}
      />,
    );
    expect(screen.getByText("reconstruído de histórico")).toBeInTheDocument();
  });

  it("run falho 100% estornado: líquido 0, receita R$ 0,00 e resultado negativo (custo de IA permanece)", () => {
    render(
      <OperationRunsTable
        runs={[
          makeRun({
            deliveryStatus: "failed",
            creditosDebitados: 10,
            creditosEstornados: 10,
            creditosLiquidos: 0,
            receitaEstimadaBrl: 0,
            resultadoEstimadoBrl: -50,
          }),
        ]}
      />,
    );
    expect(screen.getByText("Líquido: 0")).toBeInTheDocument();
    expect(
      screen.getByText("Receita estimada R$ 0,00 · Resultado estimado R$ -50,00"),
    ).toBeInTheDocument();
  });

  it("clicar numa linha → abre o drilldown e busca o detalhe call-level (D4)", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        run: makeRun(),
        events: [
          {
            generationType: "campaign_image",
            provider: "openai",
            model: "gpt-4o",
            status: "success",
            errorType: null,
            attemptNumber: 1,
            durationMs: 500,
            promptTokens: 100,
            completionTokens: 50,
            totalTokens: 150,
            cachedInputTokens: 0,
            imageTokens: 0,
            estimatedCostUsd: 0.1,
            estimatedCostBrl: 0.5,
            textComponentUsd: 0.04,
            imageToolComponentUsd: 0.06,
            costSource: "pricing_table",
            costFormulaVersion: "responses_image_generation_v2",
            costEstimationNote: null,
            metadata: null,
            badge: "estimated",
            // Snapshot econômico do evento (F38.2.1-03) — 0.1 × 5 = 0.5
            usdBrlRateAtGeneration: 5,
            creditValueBrlAtGeneration: 1,
            usdBrlRateSourceAtGeneration: "captured_at_generation",
            creditValueBrlSourceAtGeneration: "captured_at_generation",
          },
        ],
      }),
    });

    render(<OperationRunsTable runs={[makeRun()]} />);
    fireEvent.click(screen.getByText("Loja Teste"));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/admin/ai-operation-runs/11111111-1111-4111-8111-111111111111",
      );
    });
    await waitFor(() => {
      expect(screen.getByTestId("run-detail-dialog")).toBeInTheDocument();
    });
    expect(screen.getByText("campaign_image")).toBeInTheDocument();
    // provider/model aparece na tabela E no detalhe — multiple elements ok
    expect(screen.getAllByText("openai/gpt-4o").length).toBeGreaterThan(0);
    // textComponentUsd/imageToolComponentUsd — texto quebrado em spans (T / · I)
    expect(screen.getByText("T US$ 0,04")).toBeInTheDocument();
    expect(screen.getByText("· I US$ 0,06")).toBeInTheDocument();
    // Câmbio do evento: taxa snapshotada + origem capturada (F38.2.1)
    expect(screen.getByText("5 · capturado")).toBeInTheDocument();
    // Placeholder F38.3 no cabeçalho do run
    expect(screen.getByText("Custo reconciliado provider: ainda indisponível")).toBeInTheDocument();
    expect(screen.getByText("Diferença: pendente")).toBeInTheDocument();
    // Breakdown de créditos + financeiro no cabeçalho do drilldown (D4)
    expect(
      screen.getByText("Créditos: bruto 20 · estorno 0 · líquido 20"),
    ).toBeInTheDocument();
    // Receita/Resultado aparece na linha da tabela E no cabeçalho do dialog
    expect(
      screen.getAllByText("Receita estimada R$ 20,00 · Resultado estimado R$ -30,00").length,
    ).toBeGreaterThan(0);
  });
});

describe("RunDetailDialog (D4)", () => {
  it("busca GET /api/admin/ai-operation-runs/[id] e mostra etapas com custo + componentes + badge", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        run: makeRun(),
        events: [
          {
            generationType: "brand_profile",
            provider: "openai",
            model: "gpt-4o-mini",
            status: "success",
            errorType: null,
            attemptNumber: 1,
            durationMs: 300,
            promptTokens: 50,
            completionTokens: 25,
            totalTokens: 75,
            cachedInputTokens: 0,
            imageTokens: 0,
            estimatedCostUsd: 0.05,
            estimatedCostBrl: 0.25,
            textComponentUsd: 0.05,
            imageToolComponentUsd: null,
            costSource: "provider_reported",
            costFormulaVersion: null,
            costEstimationNote: null,
            metadata: null,
            badge: "provider_reported",
            // Snapshot econômico do evento (F38.2.1-03) — 0.05 × 5 = 0.25
            usdBrlRateAtGeneration: 5,
            creditValueBrlAtGeneration: 1,
            usdBrlRateSourceAtGeneration: "captured_at_generation",
            creditValueBrlSourceAtGeneration: "captured_at_generation",
          },
        ],
      }),
    });

    render(
      <RunDetailDialog
        operationRunId="22222222-2222-4222-8222-222222222222"
        onClose={() => {}}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("brand_profile")).toBeInTheDocument();
    });
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/admin/ai-operation-runs/22222222-2222-4222-8222-222222222222",
    );
    expect(screen.getByText("openai/gpt-4o-mini")).toBeInTheDocument();
    expect(screen.getByText("75")).toBeInTheDocument(); // tokens
    expect(screen.getByText("Custo reportado pelo provider")).toBeInTheDocument();
    // Câmbio do evento: taxa snapshotada + origem capturada (F38.2.1)
    expect(screen.getByText("5 · capturado")).toBeInTheDocument();
    // Breakdown de créditos + financeiro no cabeçalho do run (D4)
    expect(
      screen.getByText("Créditos: bruto 20 · estorno 0 · líquido 20"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Receita estimada R$ 20,00 · Resultado estimado R$ -30,00"),
    ).toBeInTheDocument();
  });

  it("run legado no detalhe → origem 'estimado de parâmetro atual (fallback)' + câmbio do evento 'parâmetro atual (fallback)'", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        run: {
          ...makeRun(),
          usdBrlRateAtGeneration: null,
          creditValueBrlAtGeneration: null,
          usdBrlRateSource: "economic_parameter_fallback",
          creditValueSource: "economic_parameter_fallback",
          revenueEstimationNote: "estimated_from_admin_credit_value",
        },
        events: [
          {
            generationType: "campaign_image",
            provider: "openai",
            model: "gpt-4o",
            status: "success",
            errorType: null,
            attemptNumber: 1,
            durationMs: 500,
            promptTokens: 100,
            completionTokens: 50,
            totalTokens: 150,
            cachedInputTokens: 0,
            imageTokens: 0,
            estimatedCostUsd: 0.1,
            estimatedCostBrl: 0.5,
            textComponentUsd: 0.04,
            imageToolComponentUsd: 0.06,
            costSource: "pricing_table",
            costFormulaVersion: "responses_image_generation_v2",
            costEstimationNote: null,
            metadata: null,
            badge: "estimated",
            usdBrlRateAtGeneration: null,
            creditValueBrlAtGeneration: null,
            usdBrlRateSourceAtGeneration: null,
            creditValueBrlSourceAtGeneration: null,
          },
        ],
      }),
    });

    render(
      <RunDetailDialog
        operationRunId="22222222-2222-4222-8222-222222222222"
        onClose={() => {}}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByText("Origem: estimado de parâmetro atual (fallback)"),
      ).toBeInTheDocument();
    });
    // Câmbio do evento sem snapshot → fallback explícito
    expect(screen.getByText("parâmetro atual (fallback)")).toBeInTheDocument();
  });

  it("fetch falha → estado de erro no dialog", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 503 });
    render(
      <RunDetailDialog
        operationRunId="22222222-2222-4222-8222-222222222222"
        onClose={() => {}}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText(/Erro 503/)).toBeInTheDocument();
    });
  });
});

describe("AiOperationCostsFilters (D3/D9)", () => {
  const baseFilters = {
    periodStart: null,
    periodEnd: null,
    storeId: null,
    operationRunType: null,
    status: null,
    provider: null,
    model: null,
    generationType: null,
    operationRunId: null,
    segment: null,
  };

  it("renderiza presets de período 7/30/90 dias e o select de segmento econômico", () => {
    render(<AiOperationCostsFilters filters={baseFilters} />);
    expect(screen.getByRole("button", { name: "7 dias" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "30 dias" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "90 dias" })).toBeInTheDocument();
    const segment = screen.getByLabelText("Segmento econômico");
    expect(within(segment).getByRole("option", { name: "Teste" })).toBeInTheDocument();
    expect(
      within(segment).getByRole("option", { name: "Freemium/promocional" }),
    ).toBeInTheDocument();
    expect(
      within(segment).getByRole("option", { name: "Manual/admin" }),
    ).toBeInTheDocument();
    expect(
      within(segment).getByRole("option", { name: "Desconhecido" }),
    ).toBeInTheDocument();
  });

  it("aplicar filtros atualiza a query (router.push com searchParams)", () => {
    render(
      <AiOperationCostsFilters
        filters={{ ...baseFilters, status: "failed", segment: "paid" }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    expect(mockPush).toHaveBeenCalledWith(
      "/admin/ai-operation-costs?status=failed&segment=paid",
    );
  });

  it("preset de período navega com periodStart/periodEnd", () => {
    render(<AiOperationCostsFilters filters={baseFilters} />);
    fireEvent.click(screen.getByRole("button", { name: "7 dias" }));
    expect(mockPush).toHaveBeenCalledTimes(1);
    const url = mockPush.mock.calls[0][0] as string;
    expect(url).toMatch(/^\/admin\/ai-operation-costs\?/);
    expect(url).toMatch(/periodStart=\d{4}-\d{2}-\d{2}/);
    expect(url).toMatch(/periodEnd=\d{4}-\d{2}-\d{2}/);
  });
});

describe("SegmentAggregations (D9)", () => {
  it("renderiza custo/resultado/margem %/taxa de erro por segmento + distribuições", () => {
    render(<SegmentAggregations aggregations={AGGREGATIONS} />);
    expect(
      screen.getByText("Agregados por segmento econômico"),
    ).toBeInTheDocument();
    expect(screen.getByText("Freemium/promocional")).toBeInTheDocument();
    expect(screen.getByText("Custo (BRL)")).toBeInTheDocument();
    expect(screen.getByText("R$ 50,00")).toBeInTheDocument();
    expect(
      screen.getByText("Resultado estimado"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Margem estimada"),
    ).toBeInTheDocument();
    expect(screen.getByText("Taxa de erro")).toBeInTheDocument();
    expect(screen.getByText("Gerações por tipo de entrega")).toBeInTheDocument();
    expect(screen.getByText("Gerações por etapa")).toBeInTheDocument();
    expect(screen.getByText("Gerações por provider/model")).toBeInTheDocument();
    expect(screen.getByText("Gerações por status")).toBeInTheDocument();
    expect(screen.getByText("Gerações por loja")).toBeInTheDocument();
    expect(screen.getByText("Gerações por owner")).toBeInTheDocument();
    expect(screen.getByText("Gerações por hora (UTC)")).toBeInTheDocument();
  });

  it("exibe margem já como percentual (sem ×100) e taxa de erro como ratio×100", () => {
    render(<SegmentAggregations aggregations={AGGREGATIONS} />);
    // margemEstimadaPct já vem em % do service (-150 = -150%) — NÃO multiplicar.
    expect(screen.getByText("-150%")).toBeInTheDocument();
    // taxaErro é ratio 0..1 (0.5 = 50%) — multiplicar por 100.
    expect(screen.getByText("50%")).toBeInTheDocument();
    // Sanity: margem NÃO aparece inflada 100× (bug antigo: -15.000%).
    expect(screen.queryByText("-15.000%")).not.toBeInTheDocument();
  });
});
