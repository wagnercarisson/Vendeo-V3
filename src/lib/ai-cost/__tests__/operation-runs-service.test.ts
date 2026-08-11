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

/** Run bruto do RPC — mesmo shape do JSONB de admin_get_ai_operation_runs (38-2-01). */
function makeRawRun(overrides: Record<string, unknown> = {}): any {
  return {
    operation_run_id: "11111111-1111-4111-8111-111111111111",
    operation_run_type: "campaign_delivery",
    store_id: "store-1",
    created_at: "2026-08-01T12:00:00.000Z",
    delivery_status: "success",
    custo_usd_total: "10",
    creditos_debitados: "20",
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

/** Cliente mock — dispatcher de RPC (lista com paginação) + leitura de stores. */
function buildClient(options: {
  runs?: any[];
  total?: number;
  stores?: any[];
  rpcError?: string;
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
    return { data: null, error: { message: `RPC desconhecido: ${fn}` } };
  });
  const mockIn = vi.fn(async () => ({ data: options.stores ?? [], error: null }));
  const mockSelect = vi.fn(() => ({ in: mockIn }));
  const mockFrom = vi.fn(async (table: string) => {
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

  it("receitaOpBrl/resultadoOpBrl/margemOpPct derivados (30, −20, −66.67)", async () => {
    const { client } = buildClient({
      runs: [makeRawRun({ custo_usd_total: "10", creditos_debitados: "20" })],
    });
    const service = new OperationRunsService(
      client,
      buildEconomic({ usd_brl_rate: 5.0, credit_value_brl: 1.5 }),
    );

    const run = (await service.listRuns({})).runs[0];

    expect(run.custoBrl).toBe(50);
    expect(run.receitaOpBrl).toBe(30);
    expect(run.resultadoOpBrl).toBe(-20);
    expect(run.margemOpPct).toBeCloseTo(-66.67, 2);
  });

  it("margemOpPct null quando receita 0 (sem divisão por zero)", async () => {
    const { client } = buildClient({ runs: [makeRawRun({ creditos_debitados: "0" })] });
    const service = new OperationRunsService(client, buildEconomic({}));

    const run = (await service.listRuns({})).runs[0];

    expect(run.receitaOpBrl).toBe(0);
    expect(run.margemOpPct).toBeNull();
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
