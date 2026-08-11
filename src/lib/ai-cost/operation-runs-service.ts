import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/server";
import { EconomicParameterService } from "@/lib/economic/economic-parameter-service";
import type { EconomicParameterKey } from "@/lib/economic/types";

/**
 * Erro de indisponibilidade da apuração de custos de operação (fail-closed,
 * padrão AiCostAdminUnavailableError / OperationCostUnavailableError) — a
 * rota mapeia para 503.
 */
export class OperationRunsUnavailableError extends Error {
  constructor(message?: string) {
    super(message ?? "Falha ao consultar custos de operação");
    this.name = "OperationRunsUnavailableError";
  }
}

/** Badge de confiança do custo (D5) — derivado no service, nunca no SQL. */
export type CostBadge =
  | "provider_reported"
  | "provisional image tool estimate"
  | "partial"
  | "estimated"
  | "not_available";

/** Segmento econômico da entrega (D9) — origem operacional do consumo. */
export type Segment =
  | "test"
  | "freemium/promotional"
  | "paid"
  | "manual/admin"
  | "unknown";

/** Filtros da listagem de entregas (D3/D4) — espelham os parâmetros p_* do RPC. */
export interface OperationRunsFilters {
  periodStart?: string | null;
  periodEnd?: string | null;
  storeId?: string | null;
  operationRunType?: string | null;
  status?: string | null;
  provider?: string | null;
  model?: string | null;
  generationType?: string | null;
  operationRunId?: string | null;
  segment?: Segment | null;
  page?: number;
  pageSize?: number;
}

/** Entrega derivada (lista) — BRL/receita/margem (D1/D4), badge (D5), segmento (D9). */
export interface OperationRun {
  operationRunId: string;
  operationRunType: string | null;
  storeId: string | null;
  storeName: string | null;
  ownerId: string | null;
  createdAt: string | null;
  deliveryStatus: string | null;
  custoUsdTotal: number | null;
  custoBrl: number | null;
  creditosDebitados: number | null;
  receitaOpBrl: number | null;
  resultadoOpBrl: number | null;
  margemOpPct: number | null;
  duracaoTotalMs: number | null;
  chamadas: number;
  chamadasSuccess: number;
  regeneracoes: number;
  provider: string | null;
  model: string | null;
  costSource: string | null;
  badge: CostBadge;
  segment: Segment;
  segmentConfidence: "high" | "low";
}

/** KPIs do painel — derivados no service sobre o conjunto filtrado inteiro (D3/D4). */
export interface OperationRunsSummary {
  custoUsdTotal: number | null;
  custoBrl: number | null;
  creditosDebitados: number | null;
  receitaOpBrl: number | null;
  resultadoOpBrl: number | null;
  margemOpPct: number | null;
  tempoMedioMs: number | null;
  p95Ms: number | null;
  totalEntregas: number;
  entregasErro: number;
  entregasSucesso: number;
}

/** Agregado por segmento econômico (D9) — custo/resultado/margem/taxa de erro. */
export interface SegmentAggregation {
  segment: Segment;
  entregas: number;
  custoBrl: number | null;
  resultadoOpBrl: number | null;
  margemOpPct: number | null;
  taxaErro: number | null;
}

/** Agregado por loja (D3) — custo + contagem com storeName resolvido. */
export interface StoreAggregation {
  storeName: string | null;
  entregas: number;
  custoBrl: number | null;
}

/** Agregado por owner (D3/D9) — dono da loja via stores.user_id. */
export interface OwnerAggregation {
  ownerId: string | null;
  entregas: number;
  custoBrl: number | null;
}

/** Agregados do painel (D3/D9) — a UI nunca calcula KPIs/agregados (só consome). */
export interface OperationRunsAggregations {
  bySegment: Record<string, SegmentAggregation>;
  byDeliveryType: Record<string, number>;
  byStage: Record<string, number>;
  byProviderModel: Record<string, number>;
  byStatus: Record<string, number>;
  byStore: Record<string, StoreAggregation>;
  byOwner: Record<string, OwnerAggregation>;
  byHour: Record<number, number>;
}

export interface OperationRunsListResult {
  runs: OperationRun[];
  summary: OperationRunsSummary;
  aggregations: OperationRunsAggregations;
  page: number;
  total: number;
}

/** Evento call-level derivado (detalhe, D4) — BRL + badge por evento. */
export interface OperationRunEvent {
  generationType: string | null;
  provider: string | null;
  model: string | null;
  status: string | null;
  errorType: string | null;
  attemptNumber: number | null;
  durationMs: number | null;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  cachedInputTokens: number | null;
  imageTokens: number | null;
  estimatedCostUsd: number | null;
  estimatedCostBrl: number | null;
  textComponentUsd: number | null;
  imageToolComponentUsd: number | null;
  costSource: string | null;
  costFormulaVersion: string | null;
  costEstimationNote: string | null;
  metadata: Record<string, unknown> | null;
  badge: CostBadge;
}

export interface OperationRunDetail {
  run: OperationRun | null;
  events: OperationRunEvent[];
}

/** Run bruto do RPC admin_get_ai_operation_runs (evidências brutas — D9/D5). */
interface RawOperationRun {
  operation_run_id: string;
  operation_run_type?: string | null;
  store_id?: string | null;
  created_at?: string | null;
  delivery_status?: string | null;
  custo_usd_total?: string | number | null;
  creditos_debitados?: string | number | null;
  duracao_total_ms?: string | number | null;
  chamadas?: string | number | null;
  chamadas_success?: string | number | null;
  regeneracoes?: string | number | null;
  provider?: string | null;
  model?: string | null;
  cost_source?: string | null;
  store_is_test?: boolean | null;
  deduction_purchased_amount?: string | number | null;
  deduction_bonus_amount?: string | number | null;
  admin_grant_evidence?: unknown;
  cost_sources?: string[] | null;
  cost_estimation_notes?: string[] | null;
  has_provider_reported?: boolean | null;
  has_provisional_image_estimate?: boolean | null;
  has_partial_estimate?: boolean | null;
  has_not_available?: boolean | null;
  has_estimated?: boolean | null;
  /** Etapa (generation_type) por run — presente apenas quando o RPC expõe; senão "unknown". */
  generation_type?: string | null;
}

interface RawSummary {
  total?: number;
}

/** NUMERIC do Postgres chega como string | number — normaliza para number. */
function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function clampNonNegative(value: number | null): number {
  const n = value ?? 0;
  return Math.max(0, n);
}

/** Soma de valores — ignora null; conjunto todo null → null (semântica do SUM SQL). */
function sumValues(values: Array<number | null>): number | null {
  const valid = values.filter((v): v is number => v !== null);
  if (valid.length === 0) return null;
  return valid.reduce((acc, v) => acc + v, 0);
}

/** Insumos agregados de badge por entrega (D5) — mesmo shape das flags do RPC. */
export interface RunBadgeInputs {
  cost_sources?: string[] | null;
  cost_estimation_notes?: string[] | null;
  has_provider_reported?: boolean | null;
  has_provisional_image_estimate?: boolean | null;
  has_partial_estimate?: boolean | null;
  has_not_available?: boolean | null;
  has_estimated?: boolean | null;
}

/**
 * Badge de confiança por EVENTO (detalhe, D5) — mapa exato da tabela D5 a partir
 * de cost_source + cost_estimation_note persistidos.
 */
export function deriveEventBadge(
  costSource: string | null | undefined,
  costEstimationNote: string | null | undefined,
): CostBadge {
  if (costSource === "provider_reported") return "provider_reported";
  if (costSource === "pricing_table") {
    if (
      costEstimationNote ===
      "provisional_image_tool_unit_cost_until_provider_reconciliation"
    ) {
      return "provisional image tool estimate";
    }
    if (costEstimationNote === "responses_image_generation_tool_without_unit_pricing") {
      return "partial";
    }
    // pricing_table sem nota → estimated
    return "estimated";
  }
  if (costSource === "manual_unknown") return "partial";
  if (costSource === "fallback_static") return "estimated";
  if (costSource === "not_available") return "not_available";
  // cost_source presente mas nota NULL (histórico) ou sem cost_source → estimated genérico
  return "estimated";
}

/** Ordem de prioridade D5 para o badge da entrega (menor = mais forte). */
const BADGE_PRIORITY: Record<CostBadge, number> = {
  "provider_reported": 0,
  "provisional image tool estimate": 1,
  "partial": 2,
  "not_available": 3,
  "estimated": 4,
};

function highestPriorityBadge(badges: CostBadge[]): CostBadge {
  return badges.reduce<CostBadge>(
    (best, badge) => (BADGE_PRIORITY[badge] < BADGE_PRIORITY[best] ? badge : best),
    "estimated",
  );
}

/**
 * Badge de confiança por ENTREGA (lista, D5) — prioridade das flags has_* do
 * RPC; quando as flags não bastam, aplica o mapa D5 sobre a distribuição de
 * cost_sources/notes. Fallback: estimated (genérico).
 */
export function deriveRunBadge(raw: RunBadgeInputs): CostBadge {
  if (raw.has_provider_reported) return "provider_reported";
  if (raw.has_provisional_image_estimate) return "provisional image tool estimate";
  if (raw.has_partial_estimate) return "partial";
  if (raw.has_not_available) return "not_available";
  if (raw.has_estimated) return "estimated";
  // Sem flags: aplica o mapa D5 sobre a distribuição cost_sources/notes
  const sources = raw.cost_sources ?? [];
  if (sources.length > 0) {
    const notes = raw.cost_estimation_notes ?? [];
    const badges = sources.map((src) =>
      deriveEventBadge(src, notes.length === 1 ? notes[0] : null),
    );
    return highestPriorityBadge(badges);
  }
  return "estimated"; // genérico
}

/** Percentil p (0..1) — réplica no service do percentile_cont do RPC (P95 do painel). */
function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

/** Derivação monetária BRL (D1/D4) — fórmulas centralizadas no service, nunca no SQL. */
function deriveBrl(
  raw: Pick<RawOperationRun, "custo_usd_total" | "creditos_debitados">,
  usdBrlRate: number,
  creditValueBrl: number,
): {
  custoBrl: number | null;
  receitaOpBrl: number | null;
  resultadoOpBrl: number | null;
  margemOpPct: number | null;
} {
  const custoUsd = toNumber(raw.custo_usd_total);
  const creditos = toNumber(raw.creditos_debitados);
  const custoBrl = custoUsd !== null ? custoUsd * usdBrlRate : null;
  const receitaOpBrl = creditos !== null ? creditos * creditValueBrl : null;
  const resultadoOpBrl =
    custoBrl !== null && receitaOpBrl !== null ? receitaOpBrl - custoBrl : null;
  const margemOpPct =
    receitaOpBrl !== null && receitaOpBrl > 0 && resultadoOpBrl !== null
      ? (resultadoOpBrl / receitaOpBrl) * 100
      : null;
  return { custoBrl, receitaOpBrl, resultadoOpBrl, margemOpPct };
}

/**
 * Camada de leitura admin dos custos de operação (D4) — server-side apenas.
 * ÚNICA via: RPCs definer admin_get_ai_operation_runs/_events; derivações
 * (BRL D1/D4, badges D5, segmento D9, storeName/owner D3) centralizadas aqui —
 * o SQL/RPC nunca deriva BRL nem segmento.
 */
export class OperationRunsService {
  constructor(
    private readonly client: SupabaseClient = supabaseAdmin,
    private readonly economic: Pick<EconomicParameterService, "getParameter"> =
      new EconomicParameterService(supabaseAdmin),
  ) {}

  async listRuns(filters: OperationRunsFilters = {}): Promise<OperationRunsListResult> {
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(Math.max(filters.pageSize ?? 25, 1), 100);

    const params = await this.getEconomicParams();
    const raw = await this.fetchRunsPage(filters, page, pageSize);

    const runs = (raw.runs ?? []).map((r) => this.mapRun(r, params));
    const summary = this.deriveSummary(runs, params);

    return {
      runs,
      summary,
      aggregations: this.emptyAggregations(),
      page,
      total: raw.total ?? 0,
    };
  }

  /**
   * Resolve os parâmetros econômicos (D1/D2) via EconomicParameterService.
   * Fail-closed: erro REAL (EconomicParameterUnavailableError ou qualquer outro)
   * propaga como OperationRunsUnavailableError → 503. Fail-open (linha inexistente
   * → 1.00) continua sendo tratado pelo service econômico.
   */
  private async getEconomicParams(): Promise<{
    usdBrlRate: number;
    creditValueBrl: number;
  }> {
    try {
      const [usd, credit] = await Promise.all([
        this.economic.getParameter("usd_brl_rate" as EconomicParameterKey),
        this.economic.getParameter("credit_value_brl" as EconomicParameterKey),
      ]);
      return { usdBrlRate: usd.value, creditValueBrl: credit.value };
    } catch (e) {
      console.error("[operation-runs] parâmetros econômicos indisponíveis", e);
      throw new OperationRunsUnavailableError(
        e instanceof Error ? e.message : "Falha ao ler parâmetros econômicos",
      );
    }
  }

  private async fetchRunsPage(
    filters: OperationRunsFilters,
    page: number,
    pageSize: number,
  ): Promise<{ runs: RawOperationRun[] | null; total: number | null }> {
    const { data, error } = await this.client.rpc("admin_get_ai_operation_runs", {
      p_period_start: filters.periodStart ?? null,
      p_period_end: filters.periodEnd ?? null,
      p_store_id: filters.storeId ?? null,
      p_run_type: filters.operationRunType ?? null,
      p_status: filters.status ?? null,
      p_provider: filters.provider ?? null,
      p_model: filters.model ?? null,
      p_generation_type: filters.generationType ?? null,
      p_operation_run_id: filters.operationRunId ?? null,
      p_page: page,
      p_page_size: pageSize,
    });

    if (error) {
      console.error("[operation-runs] admin_get_ai_operation_runs error", error.message);
      throw new OperationRunsUnavailableError(error.message);
    }

    const raw = (data ?? {}) as { runs: RawOperationRun[] | null; total?: number | null };
    return { runs: raw.runs ?? [], total: toNumber(raw.total) };
  }

  private mapRun(
    raw: RawOperationRun,
    params: { usdBrlRate: number; creditValueBrl: number },
  ): OperationRun {
    const { custoBrl, receitaOpBrl, resultadoOpBrl, margemOpPct } = deriveBrl(
      raw,
      params.usdBrlRate,
      params.creditValueBrl,
    );
    return {
      operationRunId: raw.operation_run_id,
      operationRunType: raw.operation_run_type ?? null,
      storeId: raw.store_id ?? null,
      storeName: null,
      ownerId: null,
      createdAt: raw.created_at ?? null,
      deliveryStatus: raw.delivery_status ?? null,
      custoUsdTotal: toNumber(raw.custo_usd_total),
      custoBrl,
      creditosDebitados: toNumber(raw.creditos_debitados),
      receitaOpBrl,
      resultadoOpBrl,
      margemOpPct,
      duracaoTotalMs: toNumber(raw.duracao_total_ms),
      chamadas: toNumber(raw.chamadas) ?? 0,
      chamadasSuccess: toNumber(raw.chamadas_success) ?? 0,
      regeneracoes: clampNonNegative(toNumber(raw.regeneracoes)),
      provider: raw.provider ?? null,
      model: raw.model ?? null,
      costSource: raw.cost_source ?? null,
      badge: deriveRunBadge(raw),
      segment: "unknown",
      segmentConfidence: "low",
    };
  }

  private deriveSummary(
    runs: OperationRun[],
    params: { usdBrlRate: number; creditValueBrl: number },
  ): OperationRunsSummary {
    const custoUsdTotal = sumValues(runs.map((r) => r.custoUsdTotal));
    const creditos = sumValues(runs.map((r) => r.creditosDebitados));
    const custoBrl =
      custoUsdTotal !== null ? custoUsdTotal * params.usdBrlRate : null;
    const receitaOpBrl =
      creditos !== null ? creditos * params.creditValueBrl : null;
    const resultadoOpBrl =
      custoBrl !== null && receitaOpBrl !== null ? receitaOpBrl - custoBrl : null;
    const margemOpPct =
      receitaOpBrl !== null && receitaOpBrl > 0 && resultadoOpBrl !== null
        ? (resultadoOpBrl / receitaOpBrl) * 100
        : null;
    const durations = runs
      .map((r) => r.duracaoTotalMs)
      .filter((d): d is number => d !== null);
    return {
      custoUsdTotal,
      custoBrl,
      creditosDebitados: creditos,
      receitaOpBrl,
      resultadoOpBrl,
      margemOpPct,
      tempoMedioMs:
        durations.length > 0
          ? durations.reduce((a, b) => a + b, 0) / durations.length
          : null,
      p95Ms: percentile(durations, 0.95),
      totalEntregas: runs.length,
      entregasErro: runs.filter((r) => r.deliveryStatus === "failed").length,
      entregasSucesso: runs.filter((r) => r.deliveryStatus === "success").length,
    };
  }

  private emptyAggregations(): OperationRunsAggregations {
    return {
      bySegment: {},
      byDeliveryType: {},
      byStage: {},
      byProviderModel: {},
      byStatus: {},
      byStore: {},
      byOwner: {},
      byHour: {},
    };
  }
}
