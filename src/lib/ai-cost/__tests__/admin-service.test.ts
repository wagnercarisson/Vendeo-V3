import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: {} as any,
}));

import { AiCostAdminService } from "../admin-service";

const mockRpc = vi.fn();
const mockAdminClient = { rpc: mockRpc };

let service: AiCostAdminService;

beforeEach(() => {
  vi.clearAllMocks();
  service = new AiCostAdminService(mockAdminClient as any);
});

function mockRpcResult(overrides: Partial<Record<string, unknown>> = {}) {
  mockRpc.mockResolvedValue({
    data: {
      by_operation_run: [],
      by_generation_type: [],
      reconciliation: [],
      ...overrides,
    },
    error: null,
  });
}

describe("AiCostAdminService.getAiCosts (6.7 — contrato views/RPC, D10)", () => {
  it("agrupamento por run mapeado com SÓ call-level — mock sem delivery markers, serviço repassa (anti-dupla-contagem D1/D6)", async () => {
    mockRpcResult({
      by_operation_run: [
        {
          operation_run_id: "run-1",
          operation_run_type: "campaign_delivery",
          custo_usd_total: "0.037",
          chamadas: "4",
          chamadas_success: "4",
          duracao_total_ms: "5200",
          regeneracoes: "0",
        },
      ],
      by_generation_type: [
        { generation_type: "campaign_copy", custo_usd_total: "0.01", chamadas: "1" },
      ],
    });

    const result = await service.getAiCosts();

    expect(result.operationRuns).toHaveLength(1);
    expect(result.operationRuns[0]).toEqual({
      operationRunId: "run-1",
      operationRunType: "campaign_delivery",
      custoUsdTotal: 0.037,
      chamadas: 4,
      chamadasSuccess: 4,
      duracaoTotalMs: 5200,
      regeneracoes: 0,
    });
    // Contrato documentado: o SQL do RPC exclui delivery markers
    // (campaign_pipeline/visual_signature/brand_profile_*) — o mock entrega
    // apenas etapas call-level e o serviço repassa sem inventar linhas.
    expect(
      result.campaignStages.map((s) => s.generationType),
    ).not.toContain("campaign_pipeline");
    expect(
      result.campaignStages.map((s) => s.generationType),
    ).not.toContain("visual_signature");
  });

  it("campaignStages derivado do bloco por generation_type do RPC (uma linha por etapa call-level)", async () => {
    mockRpcResult({
      by_generation_type: [
        { generation_type: "campaign_copy", custo_usd_total: "0.01", chamadas: "1" },
        { generation_type: "campaign_image", custo_usd_total: "0.02", chamadas: "1" },
        {
          generation_type: "campaign_image_review",
          custo_usd_total: "0.03",
          chamadas: "2",
        },
      ],
    });

    const result = await service.getAiCosts();

    expect(result.campaignStages).toEqual([
      { generationType: "campaign_copy", custoUsdTotal: 0.01, chamadas: 1 },
      { generationType: "campaign_image", custoUsdTotal: 0.02, chamadas: 1 },
      { generationType: "campaign_image_review", custoUsdTotal: 0.03, chamadas: 2 },
    ]);
  });

  it("reconciliation inclui evento com só provider_reported (estimated null — D3, não some da apuração)", async () => {
    mockRpcResult({
      reconciliation: [
        {
          operation_run_id: "run-1",
          domain: "campaign",
          custo_usd_total: "0.05",
          creditos_debitados: "1",
          margem_estimada: "0.95",
          etapas_mais_caras: ["campaign_image"],
          regeneracoes: "0",
          provider_reported_cost_usd: "0.05",
          estimated_cost_usd: null,
        },
      ],
    });

    const result = await service.getAiCosts();

    expect(result.reconciliation).toHaveLength(1);
    expect(result.reconciliation[0].providerReportedCostUsd).toBe(0.05);
    expect(result.reconciliation[0].estimatedCostUsd).toBeNull();
    expect(result.reconciliation[0].custoUsdTotal).toBe(0.05);
  });

  it("reconciliação VS — credit_tx_id presente e repassado no mapeamento (D10)", async () => {
    mockRpcResult({
      reconciliation: [
        {
          operation_run_id: "run-vs-1",
          domain: "visual_signature",
          custo_usd_total: "0.02",
          creditos_debitados: "1",
          margem_estimada: "0.98",
          etapas_mais_caras: ["visual_signature_image"],
          regeneracoes: "0",
          credit_tx_id: "tx-123",
        },
      ],
    });

    const result = await service.getAiCosts();

    expect(result.reconciliation).toHaveLength(1);
    expect(result.reconciliation[0].domain).toBe("visual_signature");
    expect(result.reconciliation[0].creditTxId).toBe("tx-123");
  });

  it("RPC chamado com os 9 params exatos — null quando ausentes, p_hours=24 default, credit unit null sem env; valores com filtros", async () => {
    mockRpcResult();

    await service.getAiCosts();

    expect(mockRpc).toHaveBeenCalledWith("admin_get_ai_costs", {
      p_operation_run_id: null,
      p_campaign_id: null,
      p_store_id: null,
      p_user_id: null,
      p_provider: null,
      p_model: null,
      p_generation_type: null,
      p_hours: 24,
      p_credit_unit_usd_value: null,
    });

    mockRpc.mockClear();
    mockRpcResult();

    await service.getAiCosts({
      storeId: "store-1",
      userId: "user-1",
      provider: "openai",
      model: "gpt-4o",
      generationType: "campaign_copy",
      operationRunId: "run-1",
      campaignId: "camp-1",
      hours: 72,
    });

    expect(mockRpc).toHaveBeenCalledWith("admin_get_ai_costs", {
      p_operation_run_id: "run-1",
      p_campaign_id: "camp-1",
      p_store_id: "store-1",
      p_user_id: "user-1",
      p_provider: "openai",
      p_model: "gpt-4o",
      p_generation_type: "campaign_copy",
      p_hours: 72,
      p_credit_unit_usd_value: null,
    });
  });

  it("mapeamento numérico — numerics do JSONB convertidos a number (sem string/number inconsistência)", async () => {
    mockRpcResult({
      by_operation_run: [
        {
          operation_run_id: "run-1",
          operation_run_type: "campaign_delivery",
          custo_usd_total: "0.037",
          chamadas: "4",
          chamadas_success: "3",
          duracao_total_ms: "5200",
          regeneracoes: "1",
        },
      ],
      by_generation_type: [
        { generation_type: "campaign_copy", custo_usd_total: "0.01", chamadas: "1" },
      ],
      reconciliation: [
        {
          operation_run_id: "run-1",
          domain: "campaign",
          custo_usd_total: "0.037",
          creditos_debitados: "1",
          margem_estimada: "0.963",
          etapas_mais_caras: ["campaign_image"],
          regeneracoes: "0",
        },
      ],
    });

    const result = await service.getAiCosts();
    const parsed = JSON.parse(JSON.stringify(result)) as {
      operationRuns: Array<Record<string, unknown>>;
      campaignStages: Array<Record<string, unknown>>;
      reconciliation: Array<Record<string, unknown>>;
    };

    expect(typeof parsed.operationRuns[0].custoUsdTotal).toBe("number");
    expect(typeof parsed.operationRuns[0].chamadas).toBe("number");
    expect(typeof parsed.operationRuns[0].chamadasSuccess).toBe("number");
    expect(typeof parsed.operationRuns[0].regeneracoes).toBe("number");
    expect(typeof parsed.campaignStages[0].custoUsdTotal).toBe("number");
    expect(typeof parsed.reconciliation[0].creditosDebitados).toBe("number");
    expect(typeof parsed.reconciliation[0].margemEstimada).toBe("number");
  });

  it("regeneracoes nunca negativo — operação com valor negativo vindo do SQL vira 0 (defesa em profundidade)", async () => {
    mockRpcResult({
      by_operation_run: [
        {
          operation_run_id: "run-1",
          operation_run_type: "campaign_delivery",
          custo_usd_total: "0.00018",
          chamadas: "1",
          chamadas_success: "1",
          duracao_total_ms: "120",
          regeneracoes: "-1",
        },
      ],
    });

    const result = await service.getAiCosts();

    expect(result.operationRuns[0].regeneracoes).toBe(0);
  });

  it("reconciliation regeneracoes nunca negativo — valor negativo vindo do SQL vira 0 (floor 0)", async () => {
    mockRpcResult({
      reconciliation: [
        {
          operation_run_id: "run-1",
          domain: "campaign",
          custo_usd_total: "0.00018",
          creditos_debitados: "1",
          margem_estimada: "0.99982",
          etapas_mais_caras: ["campaign_input_validation"],
          regeneracoes: "-1",
        },
      ],
    });

    const result = await service.getAiCosts();

    expect(result.reconciliation[0].regeneracoes).toBe(0);
  });

  it("reconciliation regeneracoes null preservado (sem etapa de arte — RPC pode omitir)", async () => {
    mockRpcResult({
      reconciliation: [
        {
          operation_run_id: "run-1",
          domain: "campaign",
          custo_usd_total: "0.00018",
          creditos_debitados: "1",
          margem_estimada: "0.99982",
          etapas_mais_caras: ["campaign_input_validation"],
          regeneracoes: null,
        },
      ],
    });

    const result = await service.getAiCosts();

    expect(result.reconciliation[0].regeneracoes).toBeNull();
  });

  it("reconciliation receita/margem F38.1-C — receita_estimada_usd/credit_unit_usd_value repassados quando presentes no JSONB", async () => {
    mockRpcResult({
      reconciliation: [
        {
          operation_run_id: "run-1",
          domain: "campaign",
          custo_usd_total: "0.05",
          creditos_debitados: "10",
          receita_estimada_usd: "1.5",
          margem_estimada: "1.45",
          credit_unit_usd_value: "0.15",
          etapas_mais_caras: ["campaign_image"],
          regeneracoes: "0",
        },
      ],
    });

    const result = await service.getAiCosts();

    expect(result.reconciliation[0].receitaEstimadaUsd).toBe(1.5);
    expect(result.reconciliation[0].margemEstimada).toBe(1.45);
    expect(result.reconciliation[0].creditUnitUsdValue).toBe(0.15);
  });

  it("reconciliation F38.1-C sem env — campos ausentes no JSONB ficam undefined (não quebram o contrato)", async () => {
    mockRpcResult({
      reconciliation: [
        {
          operation_run_id: "run-1",
          domain: "campaign",
          custo_usd_total: "0.05",
          creditos_debitados: "10",
          etapas_mais_caras: ["campaign_image"],
          regeneracoes: "0",
        },
      ],
    });

    const result = await service.getAiCosts();

    expect(result.reconciliation[0].receitaEstimadaUsd).toBeUndefined();
    expect(result.reconciliation[0].creditUnitUsdValue).toBeUndefined();
  });
});
