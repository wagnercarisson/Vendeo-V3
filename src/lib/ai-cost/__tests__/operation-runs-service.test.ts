import { vi, describe, it, expect } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: {} as any,
}));

import {
  OperationRunsService,
  OperationRunsUnavailableError,
  deriveEventBadge,
  deriveRunBadge,
  classifySegment,
} from "../operation-runs-service";

/** Run bruto do RPC — mesmo shape do JSONB de admin_get_ai_operation_runs (38-2-01/38-2-1-03). */
function makeRawRun(overrides: Record<string, unknown> = {}): any {
  return {
    operation_run_id: "11111111-1111-4111-8111-111111111111",
    operation_run_type: "campaign_delivery",
    store_id: "store-1",
    created_at: "2026-08-01T12:00:00.000Z",
    delivery_status: "success",
    custo_usd_total: "10",
    creditos_debitados: "20",
    creditos_estornados: "0",
    creditos_liquidos: "20",
    // Snapshots econômicos (F38.2.1-03): NULL por default → preserva os testes
    // existentes de fallback legacy; overrides explícitos para snapshot/backfill.
    usd_brl_rate_at_generation: null,
    credit_value_brl_at_generation: null,
    usd_brl_rate_source_at_generation: null,
    credit_value_brl_source_at_generation: null,
    duracao_total_ms: "1000",
    chamadas: 2,
    chamadas_success: 2,
    regeneracoes: 0,
    provider: "openai",
    model: "gpt-4o",
    cost_source: "pricing_table",
    store_is_test: false,
    deduction_purchased_amount: null,
    deduction_bonus_amount: null,
    admin_grant_evidence: null,
    cost_sources: ["pricing_table"],
    cost_estimation_notes: [],
    has_provider_reported: false,
    has_provisional_image_estimate: false,
    has_partial_estimate: false,
    has_not_available: false,
    has_estimated: true,
    ...overrides,
  };
}

/** Run do RPC de eventos (detalhe) — defaults NULL de snapshot (fallback preservado, F38.2.1-04). */
function makeDetailRun(overrides: Record<string, unknown> = {}): any {
  return {
    operation_run_id: "run-detail-1",
    created_at: "2026-08-01T12:00:00.000Z",
    delivery_status: "success",
    custo_usd_total: "5",
    creditos_debitados: "10",
    creditos_estornados: "3",
    creditos_liquidos: "7",
    duracao_total_ms: "800",
    chamadas: 2,
    chamadas_success: 2,
    regeneracoes: 0,
    p95_ms: "600",
    usd_brl_rate_at_generation: null,
    credit_value_brl_at_generation: null,
    usd_brl_rate_source_at_generation: null,
    credit_value_brl_source_at_generation: null,
    ...overrides,
  };
}

/** Evento call-level (detalhe) — defaults NULL de snapshot (F38.2.1-04). */
function makeEvent(overrides: Record<string, unknown> = {}): any {
  return {
    generation_type: "campaign_copy",
    provider: "openai",
    model: "gpt-4o",
    status: "success",
    error_type: null,
    attempt_number: 1,
    duration_ms: 400,
    prompt_tokens: 100,
    completion_tokens: 50,
    total_tokens: 150,
    cached_input_tokens: 0,
    image_tokens: null,
    estimated_cost_usd: 0.01,
    provider_reported_cost_usd: null,
    text_component_usd: 0.01,
    image_tool_component_usd: 0,
    cost_source: "provider_reported",
    cost_formula_version: null,
    cost_estimation_note: null,
    metadata: { trace_id: "t1" },
    usd_brl_rate_at_generation: null,
    credit_value_brl_at_generation: null,
    usd_brl_rate_source_at_generation: null,
    credit_value_brl_source_at_generation: null,
    ...overrides,
  };
}

/** Cliente mock — dispatcher de RPC (lista com paginação + detalhe) + leitura de stores. */
function buildClient(options: {
  runs?: any[];
  total?: number;
  stores?: any[];
  rpcError?: string;
  events?: { run: any; events: any[] } | null;
  eventsError?: string;
} = {}) {
  const runs = options.runs ?? [];
  const total = options.total ?? runs.length;
  const mockRpc = vi.fn(async (fn: string, args: any) => {
    if (options.rpcError) {
      return { data: null, error: { message: options.rpcError } };
    }
    if (fn === "admin_get_ai_operation_runs") {
      const page = args.p_page ?? 1;
      const pageSize = args.p_page_size ?? 25;
      const start = (page - 1) * pageSize;
      return {
        data: {
          runs: runs.slice(start, start + pageSize),
          summary: {
            custo_usd_total: null,
            creditos_debitados: null,
            duracao_total_ms: null,
            tempo_medio_ms: null,
            p95_ms: null,
            total,
            erros: 0,
            sucessos: 0,
          },
          page,
          total,
        },
        error: null,
      };
    }
    if (fn === "admin_get_ai_operation_run_events") {
      if (options.eventsError) {
        return { data: null, error: { message: options.eventsError } };
      }
      return { data: options.events ?? { run: null, events: [] }, error: null };
    }
    return { data: null, error: { message: `RPC desconhecido: ${fn}` } };
  });
  const mockIn = vi.fn(async (_col: string, ids: string[]) => ({
    data: (options.stores ?? []).filter((s) => ids.includes(s.id)),
    error: null,
  }));
  const mockSelect = vi.fn(() => ({ in: mockIn }));
  // from() do Supabase é síncrono e encadeável (client real) — mock NÃO async
  const mockFrom = vi.fn((table: string) => {
    if (table === "stores") return { select: mockSelect };
    return {};
  });
  return { client: { rpc: mockRpc, from: mockFrom } as any, mockRpc };
}

/** Fake do EconomicParameterService — resolvers por chave (NÃO mockar o service real). */
function buildEconomic(values: Record<string, number> = {}) {
  return {
    getParameter: vi.fn(async (key: string) => ({
      key,
      value: values[key] ?? 1.0,
      source: "table" as const,
    })),
  } as any;
}

describe("OperationRunsService — derivação monetária BRL (D1/D4)", () => {
  it("custoBrl = custoUsdTotal × usd_brl_rate (10 × 5.0 = 50)", async () => {
    const { client } = buildClient({ runs: [makeRawRun({ custo_usd_total: "10" })] });
    const service = new OperationRunsService(
      client,
      buildEconomic({ usd_brl_rate: 5.0 }),
    );

    const result = await service.listRuns({});

    expect(result.runs[0].custoBrl).toBe(50);
  });

  it("receitaEstimadaBrl/resultadoEstimadoBrl/margemEstimadaPct derivados (30, −20, −66.67)", async () => {
    const { client } = buildClient({
      runs: [makeRawRun({ custo_usd_total: "10", creditos_debitados: "20" })],
    });
    const service = new OperationRunsService(
      client,
      buildEconomic({ usd_brl_rate: 5.0, credit_value_brl: 1.5 }),
    );

    const run = (await service.listRuns({})).runs[0];

    expect(run.custoBrl).toBe(50);
    expect(run.receitaEstimadaBrl).toBe(30);
    expect(run.resultadoEstimadoBrl).toBe(-20);
    expect(run.margemEstimadaPct).toBeCloseTo(-66.67, 2);
  });

  it("margemEstimadaPct null quando receita 0 (sem divisão por zero)", async () => {
    const { client } = buildClient({
      runs: [makeRawRun({ creditos_debitados: "0", creditos_liquidos: "0" })],
    });
    const service = new OperationRunsService(client, buildEconomic({}));

    const run = (await service.listRuns({})).runs[0];

    expect(run.receitaEstimadaBrl).toBe(0);
    expect(run.margemEstimadaPct).toBeNull();
  });

  it("falha real do parâmetro econômico → OperationRunsUnavailableError (fail-closed)", async () => {
    const { client } = buildClient({ runs: [makeRawRun({})] });
    const economic = buildEconomic({});
    economic.getParameter.mockRejectedValue(new Error("connection refused"));
    const service = new OperationRunsService(client, economic);

    await expect(service.listRuns({})).rejects.toThrow(
      OperationRunsUnavailableError,
    );
  });
});

describe("OperationRunsService — derivação com estornos — créditos líquidos (gap F38.2)", () => {
  it("receita usa líquidos: bruto 10 / estorno 3 / líquido 7 → receita 10.5, resultado −39.5, margem ≈ −376.19 (bruto preservado como auditoria)", async () => {
    const { client } = buildClient({
      runs: [
        makeRawRun({
          custo_usd_total: "10",
          creditos_debitados: "10",
          creditos_estornados: "3",
          creditos_liquidos: "7",
        }),
      ],
    });
    const service = new OperationRunsService(
      client,
      buildEconomic({ usd_brl_rate: 5.0, credit_value_brl: 1.5 }),
    );

    const run = (await service.listRuns({})).runs[0];

    expect(run.creditosDebitados).toBe(10); // BRUTO — auditoria preservada
    expect(run.creditosEstornados).toBe(3);
    expect(run.creditosLiquidos).toBe(7);
    expect(run.receitaEstimadaBrl).toBe(10.5); // 7 × 1.5
    expect(run.resultadoEstimadoBrl).toBe(-39.5); // 10.5 − 50 (custo 10 USD × 5)
    expect(run.margemEstimadaPct).toBeCloseTo(-376.19, 2);
  });

  it("full-refund (run falho): bruto 10 / estorno 10 / líquido 0 → receita R$0 e custo de IA permanece (resultado −50)", async () => {
    const { client } = buildClient({
      runs: [
        makeRawRun({
          custo_usd_total: "10",
          creditos_debitados: "10",
          creditos_estornados: "10",
          creditos_liquidos: "0",
          delivery_status: "failed",
        }),
      ],
    });
    const service = new OperationRunsService(
      client,
      buildEconomic({ usd_brl_rate: 5.0, credit_value_brl: 1.5 }),
    );

    const run = (await service.listRuns({})).runs[0];

    expect(run.receitaEstimadaBrl).toBe(0);
    expect(run.resultadoEstimadoBrl).toBe(-50); // custo permanece mesmo com receita zerada
    expect(run.margemEstimadaPct).toBeNull();
  });

  it("estorno > bruto: floor 0 no líquido (RPC GREATEST — nunca negativo) → receita R$0 e margem null, inclusive no summary", async () => {
    const { client } = buildClient({
      runs: [
        makeRawRun({
          custo_usd_total: "10",
          creditos_debitados: "10",
          creditos_estornados: "12",
          creditos_liquidos: "0", // floor aplicado pelo RPC (38-2-12)
        }),
      ],
    });
    const service = new OperationRunsService(
      client,
      buildEconomic({ usd_brl_rate: 5.0, credit_value_brl: 1.5 }),
    );

    const result = await service.listRuns({});
    const run = result.runs[0];

    expect(run.creditosLiquidos).toBe(0);
    expect(run.receitaEstimadaBrl).toBe(0);
    expect(run.margemEstimadaPct).toBeNull();
    // Summary com receita 0 → margem null (sem divisão por zero)
    expect(result.summary.receitaEstimadaBrl).toBe(0);
    expect(result.summary.margemEstimadaPct).toBeNull();
  });

  it("summary de líquidos: brutos 13 / estornos 3 / líquidos 10 → receita 15, custo 100 (20 USD), resultado −85, margem ≈ −566.67", async () => {
    const { client } = buildClient({
      runs: [
        makeRawRun({
          operation_run_id: "run-liquid-1",
          custo_usd_total: "10",
          creditos_debitados: "10",
          creditos_estornados: "3",
          creditos_liquidos: "7",
        }),
        makeRawRun({
          operation_run_id: "run-liquid-2",
          custo_usd_total: "10",
          creditos_debitados: "3",
          creditos_estornados: "0",
          creditos_liquidos: "3",
        }),
      ],
    });
    const service = new OperationRunsService(
      client,
      buildEconomic({ usd_brl_rate: 5.0, credit_value_brl: 1.5 }),
    );

    const summary = (await service.listRuns({})).summary;

    expect(summary.creditosDebitados).toBe(13); // auditoria: soma dos brutos
    expect(summary.creditosEstornados).toBe(3);
    expect(summary.creditosLiquidos).toBe(10);
    expect(summary.receitaEstimadaBrl).toBe(15); // 10 líquidos × 1.5 — nunca bruto
    expect(summary.custoBrl).toBe(100); // 20 USD × 5.0
    expect(summary.resultadoEstimadoBrl).toBe(-85);
    expect(summary.margemEstimadaPct).toBeCloseTo(-566.67, 2);
  });
});

describe("OperationRunsService — snapshot econômico por run (F38.2.1-04)", () => {
  it("run com snapshot captured (5.20/2.00) usa a taxa snapshotada, NÃO a corrente (5.0/1.5) — origens captured + note null", async () => {
    const { client } = buildClient({
      runs: [
        makeRawRun({
          custo_usd_total: "10",
          creditos_debitados: "10",
          creditos_estornados: "3",
          creditos_liquidos: "7",
          usd_brl_rate_at_generation: "5.20",
          credit_value_brl_at_generation: "2.00",
          usd_brl_rate_source_at_generation: "captured_at_generation",
          credit_value_brl_source_at_generation: "captured_at_generation",
        }),
      ],
    });
    const service = new OperationRunsService(
      client,
      buildEconomic({ usd_brl_rate: 5.0, credit_value_brl: 1.5 }),
    );

    const run = (await service.listRuns({})).runs[0];

    expect(run.custoBrl).toBe(52.0); // 10 × 5.20 (snapshot, não 5.0 corrente)
    expect(run.receitaEstimadaBrl).toBe(14.0); // 7 × 2.00 (snapshot, não 1.5 corrente)
    expect(run.resultadoEstimadoBrl).toBe(-38.0); // 14 − 52
    expect(run.margemEstimadaPct).toBeCloseTo(-271.43, 2);
    expect(run.usdBrlRateAtGeneration).toBe(5.2);
    expect(run.creditValueBrlAtGeneration).toBe(2.0);
    expect(run.usdBrlRateSource).toBe("captured_at_generation");
    expect(run.creditValueSource).toBe("captured_at_generation");
    expect(run.revenueEstimationNote).toBeNull();
  });

  it("run com valores backfilled → sources refletem backfilled (NUNCA captured) + note backfilled_historical_approximation", async () => {
    const { client } = buildClient({
      runs: [
        makeRawRun({
          custo_usd_total: "10",
          creditos_liquidos: "7",
          usd_brl_rate_at_generation: "5.18",
          credit_value_brl_at_generation: "1.00",
          usd_brl_rate_source_at_generation: "backfilled_seed",
          credit_value_brl_source_at_generation: "backfilled_from_audit",
        }),
      ],
    });
    const service = new OperationRunsService(
      client,
      buildEconomic({ usd_brl_rate: 5.0, credit_value_brl: 1.5 }),
    );

    const run = (await service.listRuns({})).runs[0];

    expect(run.custoBrl).toBe(51.8); // 10 × 5.18 (backfilled, não 5.0)
    expect(run.receitaEstimadaBrl).toBe(7.0); // 7 × 1.00 (backfilled, não 1.5)
    expect(run.usdBrlRateSource).toBe("backfilled_seed");
    expect(run.creditValueSource).toBe("backfilled_from_audit");
    expect(run.creditValueSource).not.toBe("captured_at_generation");
    expect(run.revenueEstimationNote).toBe("backfilled_historical_approximation");
  });

  it("run SEM valor persistido → fallback corrente 5.0/1.5 com origens economic_parameter_fallback + note estimated_from_admin_credit_value", async () => {
    const { client } = buildClient({
      runs: [makeRawRun({ custo_usd_total: "10", creditos_liquidos: "7" })],
    });
    const service = new OperationRunsService(
      client,
      buildEconomic({ usd_brl_rate: 5.0, credit_value_brl: 1.5 }),
    );

    const run = (await service.listRuns({})).runs[0];

    expect(run.custoBrl).toBe(50); // 10 × 5.0 (corrente — fallback explícito)
    expect(run.receitaEstimadaBrl).toBe(10.5); // 7 × 1.5 (corrente — fallback explícito)
    expect(run.usdBrlRateAtGeneration).toBeNull();
    expect(run.creditValueBrlAtGeneration).toBeNull();
    expect(run.usdBrlRateSource).toBe("economic_parameter_fallback");
    expect(run.creditValueSource).toBe("economic_parameter_fallback");
    expect(run.revenueEstimationNote).toBe("estimated_from_admin_credit_value");
  });

  it("receita estimada 0 (líquidos 0) → margemEstimadaPct null; resultadoEstimadoBrl = −custoBrl", async () => {
    const { client } = buildClient({
      runs: [
        makeRawRun({
          custo_usd_total: "10",
          creditos_debitados: "10",
          creditos_estornados: "10",
          creditos_liquidos: "0",
          usd_brl_rate_at_generation: "5.20",
          credit_value_brl_at_generation: "2.00",
          usd_brl_rate_source_at_generation: "captured_at_generation",
          credit_value_brl_source_at_generation: "captured_at_generation",
        }),
      ],
    });
    const service = new OperationRunsService(
      client,
      buildEconomic({ usd_brl_rate: 5.0, credit_value_brl: 1.5 }),
    );

    const run = (await service.listRuns({})).runs[0];

    expect(run.receitaEstimadaBrl).toBe(0);
    expect(run.resultadoEstimadoBrl).toBe(-52); // 0 − 52 (custo de IA permanece)
    expect(run.margemEstimadaPct).toBeNull();
  });

  it("receita estimada usa LÍQUIDOS (estorno descontado): líquidos 7 → 14.00, nunca bruto (10 × 2 = 20)", async () => {
    const { client } = buildClient({
      runs: [
        makeRawRun({
          custo_usd_total: "10",
          creditos_debitados: "10",
          creditos_estornados: "3",
          creditos_liquidos: "7",
          usd_brl_rate_at_generation: "5.20",
          credit_value_brl_at_generation: "2.00",
          usd_brl_rate_source_at_generation: "captured_at_generation",
          credit_value_brl_source_at_generation: "captured_at_generation",
        }),
      ],
    });
    const service = new OperationRunsService(
      client,
      buildEconomic({ usd_brl_rate: 5.0, credit_value_brl: 1.5 }),
    );

    const run = (await service.listRuns({})).runs[0];

    expect(run.creditosLiquidos).toBe(7);
    expect(run.receitaEstimadaBrl).toBe(14); // 7 líquidos × 2.00 — nunca 10 bruto × 2 = 20
    expect(run.receitaEstimadaBrl).not.toBe(20);
  });
});

describe("OperationRunsService — deriveSummary soma BRL por run + origens agregadas (F38.2.1-04/D5)", () => {
  it("2 runs com taxas snapshotadas DISTINTAS (5.20/6.00) → summary soma os BRL por run (52+60), NÃO re-deriva do total USD com taxa única", async () => {
    const { client } = buildClient({
      runs: [
        makeRawRun({
          operation_run_id: "run-sum-a",
          custo_usd_total: "10",
          creditos_debitados: "10",
          creditos_estornados: "3",
          creditos_liquidos: "7",
          usd_brl_rate_at_generation: "5.20",
          credit_value_brl_at_generation: "2.00",
          usd_brl_rate_source_at_generation: "captured_at_generation",
          credit_value_brl_source_at_generation: "captured_at_generation",
        }),
        makeRawRun({
          operation_run_id: "run-sum-b",
          custo_usd_total: "10",
          creditos_debitados: "3",
          creditos_estornados: "0",
          creditos_liquidos: "3",
          usd_brl_rate_at_generation: "6.00",
          credit_value_brl_at_generation: "2.50",
          usd_brl_rate_source_at_generation: "captured_at_generation",
          credit_value_brl_source_at_generation: "captured_at_generation",
        }),
      ],
    });
    const service = new OperationRunsService(
      client,
      buildEconomic({ usd_brl_rate: 5.0, credit_value_brl: 1.5 }),
    );

    const summary = (await service.listRuns({})).summary;

    expect(summary.custoBrl).toBe(112); // 52 (10×5.20) + 60 (10×6.00) — por run
    expect(summary.receitaEstimadaBrl).toBe(21.5); // 14 (7×2.00) + 7.5 (3×2.50)
    expect(summary.resultadoEstimadoBrl).toBe(-90.5); // (14−52) + (7.5−60)
    expect(summary.margemEstimadaPct).toBeCloseTo(-420.93, 2);
  });

  it("summary com 1 run captured + 1 run backfilled → creditValueSource backfilled_from_audit + note backfilled", async () => {
    const { client } = buildClient({
      runs: [
        makeRawRun({
          operation_run_id: "run-src-a",
          usd_brl_rate_at_generation: "5.20",
          credit_value_brl_at_generation: "2.00",
          usd_brl_rate_source_at_generation: "captured_at_generation",
          credit_value_brl_source_at_generation: "captured_at_generation",
        }),
        makeRawRun({
          operation_run_id: "run-src-b",
          usd_brl_rate_at_generation: "5.18",
          credit_value_brl_at_generation: "1.00",
          usd_brl_rate_source_at_generation: "backfilled_from_audit",
          credit_value_brl_source_at_generation: "backfilled_from_audit",
        }),
      ],
    });
    const service = new OperationRunsService(
      client,
      buildEconomic({ usd_brl_rate: 5.0, credit_value_brl: 1.5 }),
    );

    const summary = (await service.listRuns({})).summary;

    expect(summary.creditValueSource).toBe("backfilled_from_audit");
    expect(summary.revenueEstimationNote).toBe("backfilled_historical_approximation");
  });

  it("summary com 1 run snapshot + 1 run fallback → creditValueSource economic_parameter_fallback + note estimated (qualquer fallback no conjunto prevalece)", async () => {
    const { client } = buildClient({
      runs: [
        makeRawRun({
          operation_run_id: "run-src-c",
          usd_brl_rate_at_generation: "5.20",
          credit_value_brl_at_generation: "2.00",
          usd_brl_rate_source_at_generation: "captured_at_generation",
          credit_value_brl_source_at_generation: "captured_at_generation",
        }),
        makeRawRun({ operation_run_id: "run-src-d", creditos_liquidos: "7" }), // sem snapshot → fallback
      ],
    });
    const service = new OperationRunsService(
      client,
      buildEconomic({ usd_brl_rate: 5.0, credit_value_brl: 1.5 }),
    );

    const summary = (await service.listRuns({})).summary;

    expect(summary.creditValueSource).toBe("economic_parameter_fallback");
    expect(summary.revenueEstimationNote).toBe("estimated_from_admin_credit_value");
  });

  it("summary só com runs captured → creditValueSource captured_at_generation + note null", async () => {
    const { client } = buildClient({
      runs: [
        makeRawRun({
          operation_run_id: "run-src-e",
          usd_brl_rate_at_generation: "5.20",
          credit_value_brl_at_generation: "2.00",
          usd_brl_rate_source_at_generation: "captured_at_generation",
          credit_value_brl_source_at_generation: "captured_at_generation",
        }),
        makeRawRun({
          operation_run_id: "run-src-f",
          usd_brl_rate_at_generation: "6.00",
          credit_value_brl_at_generation: "2.00",
          usd_brl_rate_source_at_generation: "captured_at_generation",
          credit_value_brl_source_at_generation: "captured_at_generation",
        }),
      ],
    });
    const service = new OperationRunsService(
      client,
      buildEconomic({ usd_brl_rate: 5.0, credit_value_brl: 1.5 }),
    );

    const summary = (await service.listRuns({})).summary;

    expect(summary.creditValueSource).toBe("captured_at_generation");
    expect(summary.revenueEstimationNote).toBeNull();
  });
});

describe("OperationRunsService — estabilidade temporal + variantes de origem (F38.2.1-04, tasks 8.2/8.4)", () => {
  it("ESTABILIDADE TEMPORAL: alterar o parâmetro corrente (6.00/3.00) depois da geração NÃO muda custoBrl/receitaEstimadaBrl/resultadoEstimadoBrl/margemEstimadaPct de runs com snapshot (5.20/2.00)", async () => {
    const { client } = buildClient({
      runs: [
        makeRawRun({
          custo_usd_total: "10",
          creditos_debitados: "10",
          creditos_estornados: "3",
          creditos_liquidos: "7",
          usd_brl_rate_at_generation: "5.20",
          credit_value_brl_at_generation: "2.00",
          usd_brl_rate_source_at_generation: "captured_at_generation",
          credit_value_brl_source_at_generation: "captured_at_generation",
        }),
      ],
    });
    // Parâmetro corrente ALTERADO depois da geração (simula admin mudando 5.0→6.0)
    const service = new OperationRunsService(
      client,
      buildEconomic({ usd_brl_rate: 6.0, credit_value_brl: 3.0 }),
    );

    const result = await service.listRuns({});
    const run = result.runs[0];

    // Histórico snapshotted permanece congelado (não usa 6.0/3.0 correntes)
    expect(run.custoBrl).toBe(52); // 10 × 5.20 — não 60
    expect(run.receitaEstimadaBrl).toBe(14); // 7 × 2.00 — não 21
    expect(run.resultadoEstimadoBrl).toBe(-38);
    expect(run.margemEstimadaPct).toBeCloseTo(-271.43, 2);
    expect(run.usdBrlRateSource).toBe("captured_at_generation");
    expect(run.creditValueSource).toBe("captured_at_generation");
    // Summary também soma os derivados snapshotted (estável perante mudança corrente)
    expect(result.summary.custoBrl).toBe(52);
    expect(result.summary.receitaEstimadaBrl).toBe(14);
    expect(result.summary.creditValueSource).toBe("captured_at_generation");
  });

  it("credit_value_brl_source_at_generation = backfilled_seed → creditValueSource backfilled_seed + note backfilled", async () => {
    const { client } = buildClient({
      runs: [
        makeRawRun({
          custo_usd_total: "10",
          creditos_liquidos: "7",
          usd_brl_rate_at_generation: "5.18",
          credit_value_brl_at_generation: "1.00",
          usd_brl_rate_source_at_generation: "backfilled_seed",
          credit_value_brl_source_at_generation: "backfilled_seed",
        }),
      ],
    });
    const service = new OperationRunsService(
      client,
      buildEconomic({ usd_brl_rate: 5.0, credit_value_brl: 1.5 }),
    );

    const run = (await service.listRuns({})).runs[0];

    expect(run.creditValueSource).toBe("backfilled_seed");
    expect(run.usdBrlRateSource).toBe("backfilled_seed");
    expect(run.revenueEstimationNote).toBe("backfilled_historical_approximation");
  });

  it("fallback legacy (sem snapshot) continua somado por run no summary com taxa única corrente", async () => {
    const { client } = buildClient({
      runs: [
        makeRawRun({ operation_run_id: "run-fb-1", custo_usd_total: "10", creditos_liquidos: "7" }),
        makeRawRun({ operation_run_id: "run-fb-2", custo_usd_total: "10", creditos_liquidos: "3" }),
      ],
    });
    const service = new OperationRunsService(
      client,
      buildEconomic({ usd_brl_rate: 5.0, credit_value_brl: 1.5 }),
    );

    const summary = (await service.listRuns({})).summary;

    expect(summary.custoBrl).toBe(100); // (10×5.0) + (10×5.0)
    expect(summary.receitaEstimadaBrl).toBe(15); // (7×1.5) + (3×1.5)
    expect(summary.creditValueSource).toBe("economic_parameter_fallback");
    expect(summary.revenueEstimationNote).toBe("estimated_from_admin_credit_value");
  });
});

describe("OperationRunsService — badges de confiança (D5)", () => {
  it("evento cost_source provider_reported → badge provider_reported", () => {
    expect(deriveEventBadge("provider_reported", null)).toBe("provider_reported");
  });

  it("pricing_table + nota provisional → badge provisional image tool estimate", () => {
    expect(
      deriveEventBadge(
        "pricing_table",
        "provisional_image_tool_unit_cost_until_provider_reconciliation",
      ),
    ).toBe("provisional image tool estimate");
  });

  it("manual_unknown → partial; pricing_table sem nota → estimated; not_available → not_available", () => {
    expect(deriveEventBadge("manual_unknown", null)).toBe("partial");
    expect(deriveEventBadge("pricing_table", null)).toBe("estimated");
    expect(deriveEventBadge("not_available", null)).toBe("not_available");
  });

  it("entrega: has_provider_reported=true → provider_reported (prioridade); sem flags → estimated genérico", () => {
    expect(
      deriveRunBadge({
        has_provider_reported: true,
        has_estimated: true,
        cost_sources: ["provider_reported", "pricing_table"],
      }),
    ).toBe("provider_reported");
    expect(deriveRunBadge({ cost_sources: ["pricing_table"], has_estimated: false })).toBe(
      "estimated",
    );
    expect(deriveRunBadge({})).toBe("estimated");
  });
});

describe("OperationRunsService — segmentação econômica (D9)", () => {
  it("store_is_test true → segmento test (confiança alta)", () => {
    expect(classifySegment({ store_is_test: true })).toEqual({
      segment: "test",
      confidence: "high",
    });
  });

  it("bonus_amount > 0 e purchased_amount = 0 → freemium/promotional", () => {
    expect(
      classifySegment({ deduction_bonus_amount: 5, deduction_purchased_amount: 0 }),
    ).toEqual({ segment: "freemium/promotional", confidence: "high" });
  });

  it("purchased_amount > 0 → paid (confiança baixa)", () => {
    expect(classifySegment({ deduction_purchased_amount: 3 })).toEqual({
      segment: "paid",
      confidence: "low",
    });
  });

  it("admin_grant shape confirmado → manual/admin; shape divergente → unknown (nunca inferir errado)", () => {
    expect(classifySegment({ admin_grant_evidence: { grant_count: 2 } })).toEqual({
      segment: "manual/admin",
      confidence: "high",
    });
    expect(classifySegment({ admin_grant_evidence: { foo: "x" } })).toEqual({
      segment: "unknown",
      confidence: "low",
    });
    expect(classifySegment({ admin_grant_evidence: "grant-string" })).toEqual({
      segment: "unknown",
      confidence: "low",
    });
  });

  it("sem evidência → unknown (fallback, confiança baixa)", () => {
    expect(classifySegment({})).toEqual({ segment: "unknown", confidence: "low" });
  });

  it("listRuns com segment=test filtra + re-pagina (total reflete o conjunto segmento-filtrado)", async () => {
    const runs = [
      makeRawRun({ operation_run_id: "aaaaaaaa-1111-4111-8111-111111111111", store_is_test: true }),
      makeRawRun({ operation_run_id: "bbbbbbbb-1111-4111-8111-111111111111", deduction_purchased_amount: 2 }),
      makeRawRun({ operation_run_id: "cccccccc-1111-4111-8111-111111111111", deduction_purchased_amount: 4 }),
      makeRawRun({ operation_run_id: "dddddddd-1111-4111-8111-111111111111", deduction_purchased_amount: 1 }),
      makeRawRun({ operation_run_id: "eeeeeeee-1111-4111-8111-111111111111", deduction_purchased_amount: 6 }),
    ];
    const { client, mockRpc } = buildClient({ runs });
    const service = new OperationRunsService(client, buildEconomic({}));

    const result = await service.listRuns({ segment: "test" });

    expect(result.total).toBe(1);
    expect(result.runs).toHaveLength(1);
    expect(result.runs[0].operationRunId).toBe("aaaaaaaa-1111-4111-8111-111111111111");
    expect(result.runs[0].segment).toBe("test");
    // Re-paginação no service: o RPC recebe page_size 100 (conjunto base completo)
    const rpcArgs = mockRpc.mock.calls.map((c) => c[1]);
    expect(rpcArgs[0].p_page).toBe(1);
    expect(rpcArgs[0].p_page_size).toBe(100);
  });
});

describe("OperationRunsService — aggregations (D3/D9)", () => {
  it("aggregations com as 8 chaves sobre o conjunto filtrado inteiro (não a página)", async () => {
    const runs = Array.from({ length: 20 }, (_, i) =>
      makeRawRun({
        operation_run_id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
        delivery_status: i % 2 === 0 ? "success" : "failed",
        created_at: new Date(Date.UTC(2026, 7, 1, i % 24)).toISOString(),
        generation_type: i % 2 === 0 ? "campaign_image" : "campaign_copy",
      }),
    );
    const { client } = buildClient({ runs });
    const service = new OperationRunsService(client, buildEconomic({}));

    const result = await service.listRuns({ page: 1, pageSize: 5 });

    expect(Object.keys(result.aggregations).sort()).toEqual([
      "byDeliveryType",
      "byHour",
      "byOwner",
      "byProviderModel",
      "bySegment",
      "byStage",
      "byStatus",
      "byStore",
    ]);
    expect(result.runs).toHaveLength(5);
    // KPIs/agregados sobre o conjunto inteiro (20), nunca a página (5)
    expect(result.summary.totalEntregas).toBe(20);
    const statusTotal = Object.values(result.aggregations.byStatus).reduce(
      (a, b) => a + b,
      0,
    );
    expect(statusTotal).toBe(20);
    expect(result.aggregations.byStatus.failed).toBe(10);
    expect(result.aggregations.byStage.campaign_image).toBe(10);
    expect(result.aggregations.byStage.campaign_copy).toBe(10);
  });

  it("bySegment com custo/resultado/margem/taxa de erro (D9); byOwner via stores.user_id", async () => {
    const runs = [
      makeRawRun({
        operation_run_id: "run-a",
        store_id: "store-1",
        store_is_test: true,
        custo_usd_total: "10",
        creditos_debitados: "20",
      }),
      makeRawRun({
        operation_run_id: "run-b",
        store_id: "store-2",
        deduction_purchased_amount: "3",
        custo_usd_total: "20",
        creditos_debitados: "10",
        creditos_liquidos: "10",
        delivery_status: "failed",
      }),
    ];
    const stores = [
      { id: "store-1", name: "Loja A", user_id: "owner-1" },
      { id: "store-2", name: "Loja B", user_id: "owner-2" },
    ];
    const { client } = buildClient({ runs, stores });
    const service = new OperationRunsService(
      client,
      buildEconomic({ usd_brl_rate: 5.0, credit_value_brl: 1.5 }),
    );

    const { aggregations, summary } = await service.listRuns({});

    // bySegment — custo, resultado operacional estimado, margem % e taxa de erro
    const testSeg = aggregations.bySegment.test;
    expect(testSeg).toBeDefined();
    expect(testSeg.entregas).toBe(1);
    expect(testSeg.custoBrl).toBe(50);
    expect(testSeg.resultadoEstimadoBrl).toBe(-20);
    expect(testSeg.margemEstimadaPct).toBeCloseTo(-66.67, 2);
    expect(testSeg.taxaErro).toBe(0);
    expect(aggregations.bySegment.paid).toMatchObject({
      segment: "paid",
      entregas: 1,
      custoBrl: 100,
      taxaErro: 1,
    });
    // byOwner — dono da loja via stores.user_id
    expect(aggregations.byOwner["owner-1"]).toMatchObject({
      ownerId: "owner-1",
      entregas: 1,
      custoBrl: 50,
    });
    expect(aggregations.byOwner["owner-2"]).toMatchObject({
      ownerId: "owner-2",
      entregas: 1,
      custoBrl: 100,
    });
    // summary BRL sobre o conjunto inteiro (D1/D4): custo (10+20)×5 = 150,
    // receita (20+10)×1.5 = 45, resultado = 45−150 = −105, margem ≈ −233.33
    expect(summary.custoBrl).toBe(150);
    expect(summary.receitaEstimadaBrl).toBe(45);
    expect(summary.resultadoEstimadoBrl).toBe(-105);
    expect(summary.margemEstimadaPct).toBeCloseTo(-233.33, 1);
  });

  it("summary/aggregations refletem os 60 runs com page=2 (não a página 2)", async () => {
    const runs = Array.from({ length: 60 }, (_, i) =>
      makeRawRun({
        operation_run_id: `run-${i}`,
        delivery_status: i % 3 === 0 ? "failed" : "success",
      }),
    );
    const { client } = buildClient({
      runs,
      stores: [{ id: "store-1", name: "Loja A", user_id: "owner-1" }],
    });
    const service = new OperationRunsService(client, buildEconomic({}));

    const result = await service.listRuns({ page: 2 });

    expect(result.runs).toHaveLength(25);
    expect(result.page).toBe(2);
    expect(result.total).toBe(60);
    expect(result.summary.totalEntregas).toBe(60);
    const statusTotal = Object.values(result.aggregations.byStatus).reduce(
      (a, b) => a + b,
      0,
    );
    expect(statusTotal).toBe(60);
    expect(result.aggregations.byStatus.failed).toBe(20);
    expect(result.aggregations.byStatus.success).toBe(40);
  });
});

describe("OperationRunsService — getRunDetail (D4)", () => {
  const eventsPayload = {
    run: {
      operation_run_id: "run-detail-1",
      created_at: "2026-08-01T12:00:00.000Z",
      delivery_status: "success",
      custo_usd_total: "5",
      creditos_debitados: "10",
      creditos_estornados: "3",
      creditos_liquidos: "7",
      duracao_total_ms: "800",
      chamadas: 2,
      chamadas_success: 2,
      regeneracoes: 0,
      p95_ms: "600",
    },
    events: [
      {
        generation_type: "campaign_copy",
        provider: "openai",
        model: "gpt-4o",
        status: "success",
        error_type: null,
        attempt_number: 1,
        duration_ms: 400,
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150,
        cached_input_tokens: 0,
        image_tokens: null,
        estimated_cost_usd: 0.01,
        provider_reported_cost_usd: null,
        text_component_usd: 0.01,
        image_tool_component_usd: 0,
        cost_source: "provider_reported",
        cost_formula_version: null,
        cost_estimation_note: null,
        metadata: { trace_id: "t1" },
      },
      {
        generation_type: "campaign_image",
        provider: "openai",
        model: "gpt-image-1",
        status: "success",
        error_type: null,
        attempt_number: 1,
        duration_ms: 300,
        prompt_tokens: 80,
        completion_tokens: 20,
        total_tokens: 100,
        cached_input_tokens: 0,
        image_tokens: 10,
        estimated_cost_usd: 2,
        provider_reported_cost_usd: null,
        text_component_usd: 0.5,
        image_tool_component_usd: 1.5,
        cost_source: "pricing_table",
        cost_formula_version: "responses_image_generation_v2",
        cost_estimation_note:
          "provisional_image_tool_unit_cost_until_provider_reconciliation",
        metadata: {},
      },
    ],
  };

  it("RPC de eventos chamado; estimatedCostBrl = estimatedCostUsd × usd_brl_rate por evento", async () => {
    const { client, mockRpc } = buildClient({ events: eventsPayload });
    const service = new OperationRunsService(
      client,
      buildEconomic({ usd_brl_rate: 5.0, credit_value_brl: 1.5 }),
    );

    const detail = await service.getRunDetail("run-detail-1");

    expect(mockRpc).toHaveBeenCalledWith(
      "admin_get_ai_operation_run_events",
      expect.objectContaining({ p_operation_run_id: "run-detail-1" }),
    );
    // run com resumo BRL derivado (D1/D4 — líquidos via deriveBrl)
    expect(detail.run).not.toBeNull();
    expect(detail.run?.custoBrl).toBe(25); // 5 USD × 5.0
    expect(detail.run?.creditosDebitados).toBe(10); // BRUTO — auditoria
    expect(detail.run?.creditosEstornados).toBe(3);
    expect(detail.run?.creditosLiquidos).toBe(7);
    expect(detail.run?.receitaEstimadaBrl).toBe(10.5); // 7 × 1.5
    expect(detail.run?.resultadoEstimadoBrl).toBe(-14.5); // 10.5 − 25
    expect(detail.run?.margemEstimadaPct).toBeCloseTo(-138.1, 1);
    // eventos com BRL/badges/componentes por evento
    expect(detail.events).toHaveLength(2);
    expect(detail.events[0].estimatedCostBrl).toBeCloseTo(0.05, 5);
    expect(detail.events[0].textComponentUsd).toBe(0.01);
    expect(detail.events[0].badge).toBe("provider_reported");
    expect(detail.events[1].estimatedCostBrl).toBe(10); // 2 USD × 5.0
    expect(detail.events[1].imageToolComponentUsd).toBe(1.5);
    expect(detail.events[1].badge).toBe("provisional image tool estimate");
  });

  it("detalhe: estimatedCostBrl do evento usa SNAPSHOT do evento (1 USD × 5.20 = 5.20); run do detalhe carrega snapshots/origens do 1º evento", async () => {
    const { client } = buildClient({
      events: {
        run: {
          operation_run_id: "run-detail-snap",
          created_at: "2026-08-01T12:00:00.000Z",
          delivery_status: "success",
          custo_usd_total: "5",
          creditos_debitados: "10",
          creditos_estornados: "3",
          creditos_liquidos: "7",
          duracao_total_ms: "800",
          chamadas: 1,
          chamadas_success: 1,
          regeneracoes: 0,
          p95_ms: "600",
          usd_brl_rate_at_generation: "5.20",
          credit_value_brl_at_generation: "2.00",
          usd_brl_rate_source_at_generation: "captured_at_generation",
          credit_value_brl_source_at_generation: "captured_at_generation",
        },
        events: [
          {
            generation_type: "campaign_image",
            provider: "openai",
            model: "gpt-image-1",
            status: "success",
            error_type: null,
            attempt_number: 1,
            duration_ms: 400,
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0,
            cached_input_tokens: 0,
            image_tokens: 1,
            estimated_cost_usd: 1,
            provider_reported_cost_usd: null,
            text_component_usd: null,
            image_tool_component_usd: null,
            cost_source: "pricing_table",
            cost_formula_version: null,
            cost_estimation_note: null,
            metadata: null,
            usd_brl_rate_at_generation: "5.20",
            credit_value_brl_at_generation: "2.00",
            usd_brl_rate_source_at_generation: "captured_at_generation",
            credit_value_brl_source_at_generation: "captured_at_generation",
          },
        ],
      },
    });
    const service = new OperationRunsService(
      client,
      buildEconomic({ usd_brl_rate: 5.0, credit_value_brl: 1.5 }),
    );

    const detail = await service.getRunDetail("run-detail-snap");

    // Evento: snapshot do evento (5.20) vence o corrente (5.0)
    expect(detail.events[0].estimatedCostBrl).toBe(5.2); // 1 × 5.20
    expect(detail.events[0].usdBrlRateAtGeneration).toBe(5.2);
    expect(detail.events[0].creditValueBrlAtGeneration).toBe(2.0);
    expect(detail.events[0].usdBrlRateSourceAtGeneration).toBe("captured_at_generation");
    expect(detail.events[0].creditValueBrlSourceAtGeneration).toBe(
      "captured_at_generation",
    );
    // Run do detalhe: carrega snapshots/origens do RPC (1º evento do run)
    expect(detail.run?.usdBrlRateAtGeneration).toBe(5.2);
    expect(detail.run?.creditValueBrlAtGeneration).toBe(2.0);
    expect(detail.run?.usdBrlRateSource).toBe("captured_at_generation");
    expect(detail.run?.creditValueSource).toBe("captured_at_generation");
    expect(detail.run?.revenueEstimationNote).toBeNull();
    expect(detail.run?.custoBrl).toBe(26); // 5 × 5.20
    expect(detail.run?.receitaEstimadaBrl).toBe(14); // 7 × 2.00
    expect(detail.run?.resultadoEstimadoBrl).toBe(-12); // 14 − 26
  });

  it("detalhe via makeDetailRun/makeEvent com snapshot backfilled: estimatedCostBrl usa snapshot do evento; run carrega origem backfilled", async () => {
    const { client } = buildClient({
      events: {
        run: makeDetailRun({
          operation_run_id: "run-detail-bf",
          usd_brl_rate_at_generation: "5.18",
          credit_value_brl_at_generation: "1.00",
          usd_brl_rate_source_at_generation: "backfilled_seed",
          credit_value_brl_source_at_generation: "backfilled_seed",
        }),
        events: [
          makeEvent({
            generation_type: "campaign_copy",
            estimated_cost_usd: 1,
            usd_brl_rate_at_generation: "5.18",
            credit_value_brl_at_generation: "1.00",
            usd_brl_rate_source_at_generation: "backfilled_seed",
            credit_value_brl_source_at_generation: "backfilled_seed",
          }),
        ],
      },
    });
    const service = new OperationRunsService(
      client,
      buildEconomic({ usd_brl_rate: 5.0, credit_value_brl: 1.5 }),
    );

    const detail = await service.getRunDetail("run-detail-bf");

    // Evento: 1 USD × 5.18 (snapshot backfilled do evento) = 5.18, não 5.0
    expect(detail.events[0].estimatedCostBrl).toBe(5.18);
    expect(detail.events[0].usdBrlRateSourceAtGeneration).toBe("backfilled_seed");
    // Run do detalhe: snapshot do run + origem backfilled (nunca captured/fallback)
    expect(detail.run?.usdBrlRateSource).toBe("backfilled_seed");
    expect(detail.run?.creditValueSource).toBe("backfilled_seed");
    expect(detail.run?.revenueEstimationNote).toBe("backfilled_historical_approximation");
    expect(detail.run?.custoBrl).toBeCloseTo(25.9, 1); // 5 × 5.18
  });

  it("run null + events [] para id inexistente", async () => {
    const { client } = buildClient({ events: { run: null, events: [] } });
    const service = new OperationRunsService(client, buildEconomic({}));

    const detail = await service.getRunDetail("id-inexistente");

    expect(detail).toEqual({ run: null, events: [] });
  });

  it("erro do RPC de eventos → OperationRunsUnavailableError (fail-closed)", async () => {
    const { client } = buildClient({ eventsError: "boom" });
    const service = new OperationRunsService(client, buildEconomic({}));

    await expect(service.getRunDetail("run-1")).rejects.toThrow(
      OperationRunsUnavailableError,
    );
  });
});
