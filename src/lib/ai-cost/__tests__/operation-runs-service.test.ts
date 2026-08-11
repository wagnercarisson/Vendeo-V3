import { vi, describe, it, expect } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: {} as any,
}));

import {
  OperationRunsService,
  OperationRunsUnavailableError,
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
