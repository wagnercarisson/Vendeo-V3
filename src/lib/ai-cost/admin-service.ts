import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * Erro de indisponibilidade da apuração de custos (fail-closed, padrão
 * OperationCostUnavailableError) — a rota mapeia para 503.
 */
export class AiCostAdminUnavailableError extends Error {
  constructor(message?: string) {
    super(message ?? "Falha ao consultar custos de IA");
    this.name = "AiCostAdminUnavailableError";
  }
}

export interface AiCostsFilters {
  storeId?: string;
  userId?: string;
  provider?: string;
  model?: string;
  generationType?: string;
  operationRunId?: string;
  campaignId?: string;
  hours?: number;
}

/** Agrupamento por operation_run (SÓ call-level — delivery markers já excluídos no SQL). */
export interface AiCostOperationRun {
  operationRunId: string | null;
  operationRunType: string | null;
  custoUsdTotal: number | null;
  chamadas: number;
  chamadasSuccess: number;
  duracaoTotalMs: number | null;
  regeneracoes: number;
}

/** Agrupamento por etapa (generation_type) — gargalos copy vs review vs imagem. */
export interface AiCostCampaignStage {
  generationType: string;
  custoUsdTotal: number | null;
  chamadas: number;
}

/** Reconciliação USD × créditos (D10). Campos opcionais repassados quando presentes no JSONB do RPC. */
export interface AiCostReconciliation {
  operationRunId: string | null;
  domain: string | null;
  custoUsdTotal: number | null;
  creditosDebitados: number | null;
  margemEstimada: number | null;
  etapasMaisCaras: string[] | null;
  regeneracoes: number | null;
  /** Vínculo VS → deduction no ledger (D10) — credit_tx_id do store_visual_signatures.metadata */
  creditTxId?: string | null;
  /** Custo reportado pelo provider (D3) — evento com só provider_reported não some da apuração */
  providerReportedCostUsd?: number | null;
  estimatedCostUsd?: number | null;
  /** F38.1 (C): receita estimada = creditos_debitados × credit_unit_usd_value (NULL quando env não configurada) */
  receitaEstimadaUsd?: number | null;
  /** F38.1 (C): valor por crédito usado no cálculo (repasse do RPC; NULL quando não configurado) */
  creditUnitUsdValue?: number | null;
}

export interface AiCostAggregations {
  operationRuns: AiCostOperationRun[];
  campaignStages: AiCostCampaignStage[];
  reconciliation: AiCostReconciliation[];
}

/** NUMERIC do Postgres chega como string | number — normaliza para number (sem string/number inconsistência). */
function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function mapOperationRuns(rows: unknown): AiCostOperationRun[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => {
    const row = r as Record<string, unknown>;
    return {
      operationRunId: (row.operation_run_id as string) ?? null,
      operationRunType: (row.operation_run_type as string) ?? null,
      custoUsdTotal: toNumber(row.custo_usd_total),
      chamadas: toNumber(row.chamadas) ?? 0,
      chamadasSuccess: toNumber(row.chamadas_success) ?? 0,
      duracaoTotalMs: toNumber(row.duracao_total_ms),
      regeneracoes: clampNonNegative(toNumber(row.regeneracoes)),
    };
  });
}

/** Regenerações nunca podem ser negativas (floor 0 — defesa em profundidade; SQL já usa GREATEST). */
function clampNonNegative(value: number | null): number {
  const n = value ?? 0;
  return Math.max(0, n);
}

function mapCampaignStages(rows: unknown): AiCostCampaignStage[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => {
    const row = r as Record<string, unknown>;
    return {
      generationType: (row.generation_type as string) ?? "",
      custoUsdTotal: toNumber(row.custo_usd_total),
      chamadas: toNumber(row.chamadas) ?? 0,
    };
  });
}

function mapReconciliation(rows: unknown): AiCostReconciliation[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => {
    const row = r as Record<string, unknown>;
    const item: AiCostReconciliation = {
      operationRunId: (row.operation_run_id as string) ?? null,
      domain: (row.domain as string) ?? null,
      custoUsdTotal: toNumber(row.custo_usd_total),
      creditosDebitados: toNumber(row.creditos_debitados),
      margemEstimada: toNumber(row.margem_estimada),
      etapasMaisCaras: Array.isArray(row.etapas_mais_caras)
        ? (row.etapas_mais_caras as string[])
        : null,
      regeneracoes:
        row.regeneracoes === undefined || row.regeneracoes === null
          ? null
          : clampNonNegative(toNumber(row.regeneracoes)),
    };
    // Campos de contrato repassados quando o JSONB do RPC os inclui (D10/D3)
    if (row.credit_tx_id !== undefined) {
      item.creditTxId = (row.credit_tx_id as string) ?? null;
    }
    if (row.provider_reported_cost_usd !== undefined) {
      item.providerReportedCostUsd = toNumber(row.provider_reported_cost_usd);
    }
    if (row.estimated_cost_usd !== undefined) {
      item.estimatedCostUsd = toNumber(row.estimated_cost_usd);
    }
    // F38.1 (C): receita/margem derivadas de p_credit_unit_usd_value no RPC
    if (row.receita_estimada_usd !== undefined) {
      item.receitaEstimadaUsd = toNumber(row.receita_estimada_usd);
    }
    if (row.credit_unit_usd_value !== undefined) {
      item.creditUnitUsdValue = toNumber(row.credit_unit_usd_value);
    }
    return item;
  });
}

/**
 * Camada de leitura admin de custos de IA (D10).
 * ÚNICA via de leitura: o RPC definer de apuração (SECURITY DEFINER) — as views
 * admin_ai_* / admin_cost_vs_credits NUNCA são lidas direto (.from() proibido);
 * o SQL-side já exclui delivery markers (anti-dupla-contagem D1/D6).
 */
/**
 * Valor monetário por crédito para estimar receita/margem (F38.1-C).
 * Config server-side via VENDEO_AI_CREDIT_UNIT_USD_VALUE (default: não configurado →
 * receita_estimada_usd/margem_estimada = NULL no RPC).
 */
function getCreditUnitUsdValue(): number | null {
  const raw = process.env.VENDEO_AI_CREDIT_UNIT_USD_VALUE;
  if (raw) {
    const parsed = Number(raw);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return null;
}

export class AiCostAdminService {
  constructor(private readonly client: SupabaseClient = supabaseAdmin) {}

  async getAiCosts(filters: AiCostsFilters = {}): Promise<AiCostAggregations> {
    const { data, error } = await this.client.rpc("admin_get_ai_costs", {
      p_operation_run_id: filters.operationRunId ?? null,
      p_campaign_id: filters.campaignId ?? null,
      p_store_id: filters.storeId ?? null,
      p_user_id: filters.userId ?? null,
      p_provider: filters.provider ?? null,
      p_model: filters.model ?? null,
      p_generation_type: filters.generationType ?? null,
      p_hours: filters.hours ?? 24,
      p_credit_unit_usd_value: getCreditUnitUsdValue(),
    });

    if (error) {
      console.error("[ai-cost-admin] getAiCosts error", error.message);
      throw new AiCostAdminUnavailableError(error.message);
    }

    const raw = (data ?? {}) as Record<string, unknown>;
    return {
      operationRuns: mapOperationRuns(raw.by_operation_run),
      campaignStages: mapCampaignStages(raw.by_generation_type),
      reconciliation: mapReconciliation(raw.reconciliation),
    };
  }
}
