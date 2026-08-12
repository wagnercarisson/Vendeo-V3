import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/server";
import { EconomicParameterService } from "@/lib/economic/economic-parameter-service";

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

/** Origem do valor econômico usado na derivação (D1/D4/D8) — 4 valores. */
export type EconomicValueSource =
  | "captured_at_generation"
  | "backfilled_from_audit"
  | "backfilled_seed"
  | "economic_parameter_fallback";

/** Nota de estimativa da receita (D8) — null quando o valor é snapshot captured. */
export type RevenueEstimationNote =
  | "estimated_from_admin_credit_value"
  | "backfilled_historical_approximation"
  | null;

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

/** Entrega derivada (lista) — BRL/receita estimada/margem (D1/D4/D8), badge (D5), segmento (D9), snapshots (F38.2.1). */
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
  creditosEstornados: number | null;
  creditosLiquidos: number | null;
  receitaEstimadaBrl: number | null;
  resultadoEstimadoBrl: number | null;
  margemEstimadaPct: number | null;
  usdBrlRateAtGeneration: number | null;
  creditValueBrlAtGeneration: number | null;
  usdBrlRateSource: EconomicValueSource;
  creditValueSource: EconomicValueSource;
  revenueEstimationNote: RevenueEstimationNote;
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
  creditosEstornados: number | null;
  creditosLiquidos: number | null;
  receitaEstimadaBrl: number | null;
  resultadoEstimadoBrl: number | null;
  margemEstimadaPct: number | null;
  /** Origem dominante do conjunto (D5/F38.2.1) — se há fallback, prevalece; senão backfilled; senão captured. */
  usdBrlRateSource: EconomicValueSource;
  creditValueSource: EconomicValueSource;
  revenueEstimationNote: RevenueEstimationNote;
  tempoMedioMs: number | null;
  p95Ms: number | null;
  totalEntregas: number;
  entregasErro: number;
  entregasSucesso: number;
}

/** Agregado por segmento econômico (D9) — custo/resultado estimado/margem/taxa de erro. */
export interface SegmentAggregation {
  segment: Segment;
  entregas: number;
  custoBrl: number | null;
  resultadoEstimadoBrl: number | null;
  margemEstimadaPct: number | null;
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

/** Evento call-level derivado (detalhe, D4) — BRL + badge por evento + snapshot do evento (F38.2.1). */
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
  /** Snapshot econômico do evento (F38.2.1-03) — null quando o evento não persistiu valor. */
  usdBrlRateAtGeneration: number | null;
  creditValueBrlAtGeneration: number | null;
  usdBrlRateSourceAtGeneration: EconomicValueSource | null;
  creditValueBrlSourceAtGeneration: EconomicValueSource | null;
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
  creditos_estornados?: string | number | null;
  creditos_liquidos?: string | number | null;
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
  /** Snapshot econômico do run + origens (F38.2.1-03 — 1º evento com valor preenchido). */
  usd_brl_rate_at_generation?: string | number | null;
  credit_value_brl_at_generation?: string | number | null;
  usd_brl_rate_source_at_generation?: string | null;
  credit_value_brl_source_at_generation?: string | null;
}

/** Evento bruto do RPC admin_get_ai_operation_run_events (detalhe, D4). */
interface RawEvent {
  generation_type?: string | null;
  provider?: string | null;
  model?: string | null;
  status?: string | null;
  error_type?: string | null;
  attempt_number?: string | number | null;
  duration_ms?: string | number | null;
  prompt_tokens?: string | number | null;
  completion_tokens?: string | number | null;
  total_tokens?: string | number | null;
  cached_input_tokens?: string | number | null;
  image_tokens?: string | number | null;
  estimated_cost_usd?: string | number | null;
  provider_reported_cost_usd?: string | number | null;
  text_component_usd?: string | number | null;
  image_tool_component_usd?: string | number | null;
  cost_source?: string | null;
  cost_formula_version?: string | null;
  cost_estimation_note?: string | null;
  metadata?: Record<string, unknown> | null;
  /** Snapshot econômico do evento (F38.2.1-03) + origens — null quando não persistido. */
  usd_brl_rate_at_generation?: string | number | null;
  credit_value_brl_at_generation?: string | number | null;
  usd_brl_rate_source_at_generation?: string | null;
  credit_value_brl_source_at_generation?: string | null;
}

/** Run do RPC de eventos — sem evidências de segmento/insumos de badge (mais enxuto). */
interface RawDetailRun {
  operation_run_id: string;
  created_at?: string | null;
  delivery_status?: string | null;
  custo_usd_total?: string | number | null;
  creditos_debitados?: string | number | null;
  creditos_estornados?: string | number | null;
  creditos_liquidos?: string | number | null;
  duracao_total_ms?: string | number | null;
  chamadas?: string | number | null;
  chamadas_success?: string | number | null;
  regeneracoes?: string | number | null;
  p95_ms?: string | number | null;
  /** Snapshot econômico do run de detalhe (F38.2.1-03) + origens. */
  usd_brl_rate_at_generation?: string | number | null;
  credit_value_brl_at_generation?: string | number | null;
  usd_brl_rate_source_at_generation?: string | null;
  credit_value_brl_source_at_generation?: string | null;
}

/** NUMERIC do Postgres chega como string | number — normaliza para number. */
function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Normaliza a origem persistida (F38.2.1) para a union de 4 valores. Valor
 * inválido/ausente → null (o chamador aplica o fallback de leitura). A origem
 * persistida nunca é "economic_parameter_fallback" (rejeitada pelo CHECK do
 * banco — fallback é exclusivamente derivado em leitura).
 */
function normalizeSource(value: string | null | undefined): EconomicValueSource | null {
  if (
    value === "captured_at_generation" ||
    value === "backfilled_from_audit" ||
    value === "backfilled_seed" ||
    value === "economic_parameter_fallback"
  ) {
    return value;
  }
  return null;
}

/**
 * Origem dominante de um conjunto de origens (D5/F38.2.1) — regra de
 * prevalência: qualquer economic_parameter_fallback no conjunto prevalece
 * (valor sem procedência persistida); senão qualquer backfilled_* (com
 * backfilled_from_audit — evidência de audit — precedendo backfilled_seed);
 * senão (todos captured) → captured_at_generation.
 */
function aggregateSource(sources: EconomicValueSource[]): EconomicValueSource {
  if (sources.includes("economic_parameter_fallback")) {
    return "economic_parameter_fallback";
  }
  if (sources.includes("backfilled_from_audit")) return "backfilled_from_audit";
  if (sources.includes("backfilled_seed")) return "backfilled_seed";
  return "captured_at_generation";
}

/** Limite defensivo de páginas na paginação progressiva (100 runs/página). */
const MAX_RPC_PAGES = 10_000;

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

/**
 * Derivação monetária BRL (D1/D4/D5) — fórmulas centralizadas no service, nunca no SQL.
 * Snapshot econômico do run (F38.2.1) com fallback legacy EXPLÍCITO e marcado:
 *   custoBrl = custoUsd × (usd_brl_rate_at_generation ?? corrente)
 *   receitaEstimadaBrl = creditosLiquidos × (credit_value_brl_at_generation ?? corrente)
 *   resultadoEstimadoBrl = receitaEstimadaBrl − custoBrl
 *   margemEstimadaPct = receitaEstimadaBrl > 0 ? (resultado/receita)×100 : null
 * Origem (D1/D4): raw source ?? "economic_parameter_fallback"; note derivada da
 * origem do crédito. LÍQUIDO (creditos_liquidos) = bruto − estornos (floor 0,
 * RPC 38-2-12 via GREATEST) usado para receita/resultado/margem — run falho
 * 100% estornado deriva receita R$0 e mantém o custo de IA (resultado negativo).
 */
function deriveBrl(
  raw: Pick<
    RawOperationRun,
    | "custo_usd_total"
    | "creditos_debitados"
    | "creditos_estornados"
    | "creditos_liquidos"
    | "usd_brl_rate_at_generation"
    | "credit_value_brl_at_generation"
    | "usd_brl_rate_source_at_generation"
    | "credit_value_brl_source_at_generation"
  >,
  params: { usdBrlRate: number; creditValueBrl: number },
): {
  custoBrl: number | null;
  receitaEstimadaBrl: number | null;
  resultadoEstimadoBrl: number | null;
  margemEstimadaPct: number | null;
  usdBrlRateAtGeneration: number | null;
  creditValueBrlAtGeneration: number | null;
  usdBrlRateSource: EconomicValueSource;
  creditValueSource: EconomicValueSource;
  revenueEstimationNote: RevenueEstimationNote;
} {
  const custoUsd = toNumber(raw.custo_usd_total);
  const creditos = toNumber(raw.creditos_liquidos);
  // Snapshot ?? corrente — fallback explícito (nunca assumir valor sem origem)
  const usdRate = toNumber(raw.usd_brl_rate_at_generation) ?? params.usdBrlRate;
  const creditValue =
    toNumber(raw.credit_value_brl_at_generation) ?? params.creditValueBrl;
  const custoBrl = custoUsd !== null ? custoUsd * usdRate : null;
  const receitaEstimadaBrl = creditos !== null ? creditos * creditValue : null;
  const resultadoEstimadoBrl =
    custoBrl !== null && receitaEstimadaBrl !== null
      ? receitaEstimadaBrl - custoBrl
      : null;
  const margemEstimadaPct =
    receitaEstimadaBrl !== null && receitaEstimadaBrl > 0 && resultadoEstimadoBrl !== null
      ? (resultadoEstimadoBrl / receitaEstimadaBrl) * 100
      : null;
  const usdBrlRateSource =
    normalizeSource(raw.usd_brl_rate_source_at_generation) ?? "economic_parameter_fallback";
  const creditValueSource =
    normalizeSource(raw.credit_value_brl_source_at_generation) ?? "economic_parameter_fallback";
  const revenueEstimationNote: RevenueEstimationNote =
    creditValueSource === "economic_parameter_fallback"
      ? "estimated_from_admin_credit_value"
      : creditValueSource.startsWith("backfilled")
        ? "backfilled_historical_approximation"
        : null;
  return {
    custoBrl,
    receitaEstimadaBrl,
    resultadoEstimadoBrl,
    margemEstimadaPct,
    usdBrlRateAtGeneration: toNumber(raw.usd_brl_rate_at_generation),
    creditValueBrlAtGeneration: toNumber(raw.credit_value_brl_at_generation),
    usdBrlRateSource,
    creditValueSource,
    revenueEstimationNote,
  };
}

/**
 * Evidências brutas de segmento (D9) — mesmo shape exposto pelo RPC
 * (store_is_test, deduction_* via credit_transactions.metadata, admin_grant_evidence).
 */
export interface SegmentEvidence {
  store_is_test?: boolean | null;
  deduction_purchased_amount?: string | number | null;
  deduction_bonus_amount?: string | number | null;
  admin_grant_evidence?: unknown;
}

/** Shape confirmado do admin_grant no RPC (38-2-01): `{ grant_count: N }` com N > 0. */
function isConfirmedAdminGrant(evidence: unknown): boolean {
  if (evidence === null || evidence === undefined) return false;
  if (typeof evidence !== "object" || Array.isArray(evidence)) return false;
  const count = toNumber((evidence as Record<string, unknown>).grant_count);
  return count !== null && count > 0;
}

/**
 * Classificador best-effort de segmento econômico (D9) — derivação no service,
 * NUNCA no RPC. Critérios exatos; fallback unknown; nunca infere admin_grant
 * sem shape confiável. paid/unknown → confidence "low"; demais "high".
 */
export function classifySegment(
  evidence: SegmentEvidence,
): { segment: Segment; confidence: "high" | "low" } {
  // test: loja de teste (F32/F33)
  if (evidence.store_is_test === true) {
    return { segment: "test", confidence: "high" };
  }
  const purchased = toNumber(evidence.deduction_purchased_amount);
  const bonus = toNumber(evidence.deduction_bonus_amount);
  // freemium/promotional: consumo coberto por grant/bônus sem compra
  if (bonus !== null && bonus > 0 && (purchased === null || purchased === 0)) {
    return { segment: "freemium/promotional", confidence: "high" };
  }
  // paid: consumo coberto por crédito comprado (F39 ainda sem origem rastreável)
  if (purchased !== null && purchased > 0) {
    return { segment: "paid", confidence: "low" };
  }
  // manual/admin: evidência com shape real confirmado; senão unknown (nunca inferir errado)
  if (isConfirmedAdminGrant(evidence.admin_grant_evidence)) {
    return { segment: "manual/admin", confidence: "high" };
  }
  // unknown: sem origem clara no ledger (fallback)
  return { segment: "unknown", confidence: "low" };
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

    // Paginação progressiva (obrigatória — RPC limita page_size a 100): requisita
    // o conjunto base completo para derivar summary/aggregations sobre o conjunto
    // filtrado inteiro (D3/D4) e re-paginar após o filtro de segmento (D9).
    const rawRuns = await this.fetchAllRuns(filters);
    const storeInfo = await this.resolveStores(
      rawRuns.map((r) => r.store_id ?? null),
    );

    const derived = rawRuns.map((raw) =>
      this.mapRun(raw, params, storeInfo.get(raw.store_id ?? "")),
    );
    const filtered = filters.segment
      ? derived.filter((r) => r.segment === filters.segment)
      : derived;

    const total = filtered.length;
    const pageRuns = filtered.slice((page - 1) * pageSize, page * pageSize);
    const summary = this.deriveSummary(filtered);
    const stageByRunId = new Map(
      rawRuns.map((r) => [r.operation_run_id, r.generation_type ?? null]),
    );
    const aggregations = this.deriveAggregations(filtered, stageByRunId);

    return {
      runs: pageRuns,
      summary,
      aggregations,
      page,
      total,
    };
  }

  /**
   * Busca progressiva do conjunto base: loop de páginas (p_page = 1, 2, ...,
   * p_page_size = 100) até acumular todos os runs do período filtrado
   * (runs_acumulados >= summary.total do RPC). A janela ≤ 365d é garantida pelo
   * próprio RPC (window_exceeded_365d).
   */
  private async fetchAllRuns(filters: OperationRunsFilters): Promise<RawOperationRun[]> {
    const all: RawOperationRun[] = [];
    let rpcTotal = Infinity;
    let page = 1;
    while (all.length < rpcTotal) {
      const raw = await this.fetchRunsPage(filters, page, 100);
      const pageRuns = raw.runs ?? [];
      all.push(...pageRuns);
      rpcTotal = raw.total ?? 0;
      if (pageRuns.length === 0) break; // defensivo: sem mais dados
      if (page > MAX_RPC_PAGES) {
        console.error("[operation-runs] fetchAllRuns excedeu o limite defensivo de páginas");
        break;
      }
      page += 1;
    }
    return all;
  }

  /**
   * Resolve storeName/owner (D3/D9) para a listagem/agregados — service layer,
   * via stores.user_id (dono da loja, não o executor técnico). Fail-open para
   * dado de apresentação: erro de leitura → nomes/owners null (agrupados em
   * "unknown"); o RPC já falha-closed se a própria leitura de stores falhar
   * (is_test_store via JOIN).
   */
  private async resolveStores(
    storeIds: Array<string | null>,
  ): Promise<Map<string, { name: string | null; ownerId: string | null }>> {
    const ids = [...new Set(storeIds.filter((id): id is string => Boolean(id)))];
    const map = new Map<string, { name: string | null; ownerId: string | null }>();
    if (ids.length === 0) return map;
    // Lote: .in() limitado a 100 ids por chamada
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100);
      const { data, error } = await this.client
        .from("stores")
        .select("id, name, user_id")
        .in("id", chunk);
      if (error) {
        console.error("[operation-runs] stores lookup error", error.message);
        continue;
      }
      for (const row of data ?? []) {
        map.set(row.id, { name: row.name ?? null, ownerId: row.user_id ?? null });
      }
    }
    return map;
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
        this.economic.getParameter("usd_brl_rate"),
        this.economic.getParameter("credit_value_brl"),
      ]);
      return { usdBrlRate: usd.value, creditValueBrl: credit.value };
    } catch (e) {
      console.error("[operation-runs] parâmetros econômicos indisponíveis", e);
      throw new OperationRunsUnavailableError(
        e instanceof Error ? e.message : "Falha ao ler parâmetros econômicos",
      );
    }
  }

  /**
   * Detalhe call-level de uma entrega (D4): chama o RPC de eventos, deriva
   * estimatedCostBrl = estimatedCostUsd × usd_brl_rate por evento, repassa os
   * componentes textComponentUsd/imageToolComponentUsd e deriva o badge por
   * evento (D5). run null + events [] quando o id não existe (contrato do RPC).
   */
  async getRunDetail(operationRunId: string): Promise<OperationRunDetail> {
    const { data, error } = await this.client.rpc(
      "admin_get_ai_operation_run_events",
      { p_operation_run_id: operationRunId },
    );

    if (error) {
      console.error(
        "[operation-runs] admin_get_ai_operation_run_events error",
        error.message,
      );
      throw new OperationRunsUnavailableError(error.message);
    }

    const raw = (data ?? {}) as { run: RawDetailRun | null; events: RawEvent[] | null };

    // Id inexistente → run null + events [] (contrato do RPC — spec D4)
    if (!raw.run) {
      return { run: null, events: [] };
    }

    const params = await this.getEconomicParams();
    const run = this.mapDetailRun(raw.run, params);
    const events = (raw.events ?? []).map((e) => this.mapEvent(e, params));
    return { run, events };
  }

  /** Run do detalhe — resumo com BRL derivado via deriveBrl (líquidos, D1/D4/D8); sem evidências de segmento no RPC de eventos. */
  private mapDetailRun(
    raw: RawDetailRun,
    params: { usdBrlRate: number; creditValueBrl: number },
  ): OperationRun {
    const derived = deriveBrl(raw, params);
    return {
      operationRunId: raw.operation_run_id,
      operationRunType: null,
      storeId: null,
      storeName: null,
      ownerId: null,
      createdAt: raw.created_at ?? null,
      deliveryStatus: raw.delivery_status ?? null,
      custoUsdTotal: toNumber(raw.custo_usd_total),
      custoBrl: derived.custoBrl,
      creditosDebitados: toNumber(raw.creditos_debitados),
      creditosEstornados: toNumber(raw.creditos_estornados),
      creditosLiquidos: toNumber(raw.creditos_liquidos),
      receitaEstimadaBrl: derived.receitaEstimadaBrl,
      resultadoEstimadoBrl: derived.resultadoEstimadoBrl,
      margemEstimadaPct: derived.margemEstimadaPct,
      usdBrlRateAtGeneration: derived.usdBrlRateAtGeneration,
      creditValueBrlAtGeneration: derived.creditValueBrlAtGeneration,
      usdBrlRateSource: derived.usdBrlRateSource,
      creditValueSource: derived.creditValueSource,
      revenueEstimationNote: derived.revenueEstimationNote,
      duracaoTotalMs: toNumber(raw.duracao_total_ms),
      chamadas: toNumber(raw.chamadas) ?? 0,
      chamadasSuccess: toNumber(raw.chamadas_success) ?? 0,
      regeneracoes: clampNonNegative(toNumber(raw.regeneracoes)),
      provider: null,
      model: null,
      costSource: null,
      badge: "estimated",
      segment: "unknown",
      segmentConfidence: "low",
    };
  }

  /** Evento call-level derivado — BRL + badge + componentes + snapshot do evento (D4/D5/F38.2.1). */
  private mapEvent(
    raw: RawEvent,
    params: { usdBrlRate: number },
  ): OperationRunEvent {
    const estimatedCostUsd = toNumber(raw.estimated_cost_usd);
    // Snapshot do evento ?? corrente — mesma semântica D1/D5 do deriveBrl
    const usdRate = toNumber(raw.usd_brl_rate_at_generation) ?? params.usdBrlRate;
    return {
      generationType: raw.generation_type ?? null,
      provider: raw.provider ?? null,
      model: raw.model ?? null,
      status: raw.status ?? null,
      errorType: raw.error_type ?? null,
      attemptNumber: toNumber(raw.attempt_number),
      durationMs: toNumber(raw.duration_ms),
      promptTokens: toNumber(raw.prompt_tokens),
      completionTokens: toNumber(raw.completion_tokens),
      totalTokens: toNumber(raw.total_tokens),
      cachedInputTokens: toNumber(raw.cached_input_tokens),
      imageTokens: toNumber(raw.image_tokens),
      estimatedCostUsd,
      estimatedCostBrl: estimatedCostUsd !== null ? estimatedCostUsd * usdRate : null,
      textComponentUsd: toNumber(raw.text_component_usd),
      imageToolComponentUsd: toNumber(raw.image_tool_component_usd),
      costSource: raw.cost_source ?? null,
      costFormulaVersion: raw.cost_formula_version ?? null,
      costEstimationNote: raw.cost_estimation_note ?? null,
      metadata: raw.metadata ?? null,
      badge: deriveEventBadge(raw.cost_source, raw.cost_estimation_note),
      usdBrlRateAtGeneration: toNumber(raw.usd_brl_rate_at_generation),
      creditValueBrlAtGeneration: toNumber(raw.credit_value_brl_at_generation),
      usdBrlRateSourceAtGeneration: normalizeSource(raw.usd_brl_rate_source_at_generation),
      creditValueBrlSourceAtGeneration: normalizeSource(
        raw.credit_value_brl_source_at_generation,
      ),
    };
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
    store?: { name: string | null; ownerId: string | null },
  ): OperationRun {
    const derived = deriveBrl(raw, params);
    const { segment, confidence } = classifySegment(raw);
    return {
      operationRunId: raw.operation_run_id,
      operationRunType: raw.operation_run_type ?? null,
      storeId: raw.store_id ?? null,
      storeName: store?.name ?? null,
      ownerId: store?.ownerId ?? null,
      createdAt: raw.created_at ?? null,
      deliveryStatus: raw.delivery_status ?? null,
      custoUsdTotal: toNumber(raw.custo_usd_total),
      custoBrl: derived.custoBrl,
      creditosDebitados: toNumber(raw.creditos_debitados),
      creditosEstornados: toNumber(raw.creditos_estornados),
      creditosLiquidos: toNumber(raw.creditos_liquidos),
      receitaEstimadaBrl: derived.receitaEstimadaBrl,
      resultadoEstimadoBrl: derived.resultadoEstimadoBrl,
      margemEstimadaPct: derived.margemEstimadaPct,
      usdBrlRateAtGeneration: derived.usdBrlRateAtGeneration,
      creditValueBrlAtGeneration: derived.creditValueBrlAtGeneration,
      usdBrlRateSource: derived.usdBrlRateSource,
      creditValueSource: derived.creditValueSource,
      revenueEstimationNote: derived.revenueEstimationNote,
      duracaoTotalMs: toNumber(raw.duracao_total_ms),
      chamadas: toNumber(raw.chamadas) ?? 0,
      chamadasSuccess: toNumber(raw.chamadas_success) ?? 0,
      regeneracoes: clampNonNegative(toNumber(raw.regeneracoes)),
      provider: raw.provider ?? null,
      model: raw.model ?? null,
      costSource: raw.cost_source ?? null,
      badge: deriveRunBadge(raw),
      segment,
      segmentConfidence: confidence,
    };
  }

  /**
   * Deriva os agregados do painel (D3/D9) sobre o CONJUNTO FILTRADO INTEIRO
   * (antes da página) — a UI nunca calcula KPIs/agregados:
   * bySegment (custo/resultado/margem %/taxa de erro), byDeliveryType,
   * byStage (generation_type), byProviderModel, byStatus, byStore (com
   * storeName), byOwner (dono da loja via stores.user_id), byHour (hora UTC
   * de created_at — determinística entre ambientes).
   */
  private deriveAggregations(
    runs: OperationRun[],
    stageByRunId: Map<string, string | null>,
  ): OperationRunsAggregations {
    const bySegment: Record<string, SegmentAggregation> = {};
    const byDeliveryType: Record<string, number> = {};
    const byStage: Record<string, number> = {};
    const byProviderModel: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    const byStore: Record<string, StoreAggregation> = {};
    const byOwner: Record<string, OwnerAggregation> = {};
    const byHour: Record<number, number> = {};
    // Acumuladores internos para margem % e taxa de erro por segmento
    const segReceita: Record<string, number> = {};
    const segErros: Record<string, number> = {};

    for (const run of runs) {
      // bySegment (D9)
      const seg = (bySegment[run.segment] ??= {
        segment: run.segment,
        entregas: 0,
        custoBrl: null,
        resultadoEstimadoBrl: null,
        margemEstimadaPct: null,
        taxaErro: null,
      });
      seg.entregas += 1;
      if (run.custoBrl !== null) seg.custoBrl = (seg.custoBrl ?? 0) + run.custoBrl;
      if (run.resultadoEstimadoBrl !== null) {
        seg.resultadoEstimadoBrl = (seg.resultadoEstimadoBrl ?? 0) + run.resultadoEstimadoBrl;
      }
      if (run.receitaEstimadaBrl !== null) {
        segReceita[run.segment] = (segReceita[run.segment] ?? 0) + run.receitaEstimadaBrl;
      }
      if (run.deliveryStatus === "failed") {
        segErros[run.segment] = (segErros[run.segment] ?? 0) + 1;
      }

      // byDeliveryType
      const deliveryType = run.operationRunType ?? "unknown";
      byDeliveryType[deliveryType] = (byDeliveryType[deliveryType] ?? 0) + 1;

      // byStage (generation_type — bucket "unknown" quando o RPC não expõe)
      const stage = stageByRunId.get(run.operationRunId) ?? "unknown";
      byStage[stage] = (byStage[stage] ?? 0) + 1;

      // byProviderModel
      const providerModel =
        run.provider && run.model
          ? `${run.provider}/${run.model}`
          : (run.provider ?? run.model ?? "unknown");
      byProviderModel[providerModel] = (byProviderModel[providerModel] ?? 0) + 1;

      // byStatus
      const status = run.deliveryStatus ?? "unknown";
      byStatus[status] = (byStatus[status] ?? 0) + 1;

      // byStore
      const storeKey = run.storeId ?? "unknown";
      const store = (byStore[storeKey] ??= {
        storeName: run.storeName,
        entregas: 0,
        custoBrl: null,
      });
      store.entregas += 1;
      if (run.custoBrl !== null) store.custoBrl = (store.custoBrl ?? 0) + run.custoBrl;
      if (run.storeName !== null) store.storeName = run.storeName;

      // byOwner (D3/D9 — dono da loja via stores.user_id)
      const ownerKey = run.ownerId ?? "unknown";
      const owner = (byOwner[ownerKey] ??= {
        ownerId: run.ownerId,
        entregas: 0,
        custoBrl: null,
      });
      owner.entregas += 1;
      if (run.custoBrl !== null) owner.custoBrl = (owner.custoBrl ?? 0) + run.custoBrl;

      // byHour (hora UTC de created_at)
      if (run.createdAt) {
        const hour = new Date(run.createdAt).getUTCHours();
        byHour[hour] = (byHour[hour] ?? 0) + 1;
      }
    }

    // Margem % e taxa de erro por segmento — mesma fórmula D1 sobre o agregado
    for (const segment of Object.keys(bySegment)) {
      const seg = bySegment[segment];
      const receita = segReceita[segment];
      seg.margemEstimadaPct =
        receita !== undefined && receita > 0 && seg.resultadoEstimadoBrl !== null
          ? (seg.resultadoEstimadoBrl / receita) * 100
          : null;
      seg.taxaErro = seg.entregas > 0 ? (segErros[segment] ?? 0) / seg.entregas : null;
    }

    return {
      bySegment,
      byDeliveryType,
      byStage,
      byProviderModel,
      byStatus,
      byStore,
      byOwner,
      byHour,
    };
  }

  /**
   * KPIs do painel (D3/D4/D5/F38.2.1) — soma os BRL JÁ derivados por run (nunca
   * re-deriva do total USD com uma taxa única: taxas snapshotadas distintas não
   * se misturam). Origens agregadas pela regra de prevalência (aggregateSource).
   */
  private deriveSummary(runs: OperationRun[]): OperationRunsSummary {
    const custoUsdTotal = sumValues(runs.map((r) => r.custoUsdTotal));
    const creditosDebitados = sumValues(runs.map((r) => r.creditosDebitados));
    const creditosEstornados = sumValues(runs.map((r) => r.creditosEstornados));
    const creditosLiquidos = sumValues(runs.map((r) => r.creditosLiquidos));
    const custoBrl = sumValues(runs.map((r) => r.custoBrl));
    const receitaEstimadaBrl = sumValues(runs.map((r) => r.receitaEstimadaBrl));
    const resultadoEstimadoBrl = sumValues(runs.map((r) => r.resultadoEstimadoBrl));
    // Margem derivada das somas (receita > 0 senão null — sem divisão por zero)
    const margemEstimadaPct =
      receitaEstimadaBrl !== null &&
      receitaEstimadaBrl > 0 &&
      resultadoEstimadoBrl !== null
        ? (resultadoEstimadoBrl / receitaEstimadaBrl) * 100
        : null;
    const usdBrlRateSource = aggregateSource(runs.map((r) => r.usdBrlRateSource));
    const creditValueSource = aggregateSource(runs.map((r) => r.creditValueSource));
    const revenueEstimationNote: RevenueEstimationNote =
      creditValueSource === "economic_parameter_fallback"
        ? "estimated_from_admin_credit_value"
        : creditValueSource.startsWith("backfilled")
          ? "backfilled_historical_approximation"
          : null;
    const durations = runs
      .map((r) => r.duracaoTotalMs)
      .filter((d): d is number => d !== null);
    return {
      custoUsdTotal,
      custoBrl,
      creditosDebitados,
      creditosEstornados,
      creditosLiquidos,
      receitaEstimadaBrl,
      resultadoEstimadoBrl,
      margemEstimadaPct,
      usdBrlRateSource,
      creditValueSource,
      revenueEstimationNote,
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
}
