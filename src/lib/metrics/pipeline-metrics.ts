import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { EconomicParameterService } from "@/lib/economic/economic-parameter-service";

// ─── Types ─────────────────────────────────────────────────────────

export interface MetricsBundle {
  pipeline: {
    total: number;
    success: number;
    error: number;
    avg_duration_ms: number | null;
    active_users: number;
  };
  vs: {
    success_rate: number | null;
    error_rate: number | null;
    avg_duration_ms: number | null;
  };
  wallet: {
    credits_granted: number;
    credits_consumed_vs: number;
    refund_rate: number;
    vs_credits_consumed: number;
    vs_credits_refunded: number;
    vs_refund_rate: number;
    credits_consumed: number;
    credits_refunded_campaign: number;
  };
}

export type StoreKind = "production" | "test" | "all";

/**
 * Delivery markers — eventos registrados no fim de uma entrega (sem chamada
 * de IA própria), com custo NULL por desenho desde a F38.1 (anti-dupla-
 * contagem D1/D6). Mesma lista usada nos RPCs/views de apuração
 * (admin_get_ai_costs e afins) para filtrar APENAS eventos call-level.
 */
export const AI_COST_DELIVERY_MARKER_TYPES = [
  "campaign_pipeline",
  "visual_signature",
  "brand_profile_without_logo",
  "brand_profile_with_logo",
] as const;

// ─── Bundle cache ──────────────────────────────────────────────────

const bundleCache = new Map<string, MetricsBundle>();

function cacheKey(hours: number, storeKind: StoreKind): string {
  return `${hours}_${storeKind}`;
}

async function fetchMetricsBundle(
  hours: number,
  storeKind: StoreKind = "production",
): Promise<MetricsBundle> {
  const key = cacheKey(hours, storeKind);

  // Return cached value if available
  const cached = bundleCache.get(key);
  if (cached) return cached;

  // Try RPC first
  const { data, error } = await supabaseAdmin.rpc("admin_get_metrics", {
    p_store_kind: storeKind,
    p_hours: hours,
    p_metric_type: "all",
  });

  if (!error && data) {
    const bundle = data as MetricsBundle;
    bundleCache.set(key, bundle);
    return bundle;
  }

  // Fallback: return empty bundle (degradação suave)
  const fallback: MetricsBundle = {
    pipeline: { total: 0, success: 0, error: 0, avg_duration_ms: null, active_users: 0 },
    vs: { success_rate: null, error_rate: 0, avg_duration_ms: null },
    wallet: {
      credits_granted: 0, credits_consumed_vs: 0, refund_rate: 0,
      vs_credits_consumed: 0, vs_credits_refunded: 0, vs_refund_rate: 0,
      credits_consumed: 0, credits_refunded_campaign: 0,
    },
  };
  bundleCache.set(key, fallback);
  return fallback;
}

/** Clear the bundle cache — useful between test cases */
export function clearMetricsCache(): void {
  bundleCache.clear();
}

// ─── Clear cache on re-import in dev — ensures test isolation ─────
clearMetricsCache();

// ─── Campaign domain ──────────────────────────────────────────────

export async function getSuccessRate(
  hours: number,
  storeKind: StoreKind = "production",
): Promise<number | null> {
  const bundle = await fetchMetricsBundle(hours, storeKind);
  const { total, success } = bundle.pipeline;
  if (total === 0) return null;
  return Math.round((success / total) * 100);
}

export async function getErrorRate(
  hours: number,
  storeKind: StoreKind = "production",
): Promise<number | null> {
  const bundle = await fetchMetricsBundle(hours, storeKind);
  const { total, error } = bundle.pipeline;
  if (total === 0) return 0;
  return Math.round((error / total) * 100);
}

/** NUMERIC do Postgres chega como string | number — normaliza para number (padrão ai-cost admin service). */
function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Custo médio de IA por entrega (apuração call-level, D6) — NÃO lê mais
 * `campaign_pipeline.estimated_cost_usd` (delivery marker NULL por desenho
 * desde a F38.1 — anti-dupla-contagem D1/D6). Apura via RPC
 * `admin_get_ai_costs` (F38.1, inalterado): `by_operation_run` → média de
 * `custo_usd_total` (cada run = entrega; o RPC já exclui delivery markers no
 * SQL). `storeKind` não é suportado pelo RPC de apuração (sem filtro de loja —
 * documentado). RPC em falha → null (degradação suave — a página continua
 * renderizando os demais cards, T-38.2-41).
 */
export async function getAvgCost(
  hours: number,
  _storeKind: StoreKind = "production",
): Promise<number | null> {
  try {
    const { data, error } = await supabaseAdmin.rpc("admin_get_ai_costs", {
      p_hours: hours,
      p_credit_unit_usd_value: null,
    });

    if (error || !data) {
      console.error("[metrics] getAvgCost error", error?.message ?? "no data");
      return null;
    }

    const raw = data as { by_operation_run?: unknown };
    const rows = Array.isArray(raw.by_operation_run)
      ? (raw.by_operation_run as Array<Record<string, unknown>>)
      : [];
    const costs = rows
      .map((r) => toNumber(r.custo_usd_total))
      .filter((c): c is number => c !== null);
    if (costs.length === 0) return null;
    return costs.reduce((a, b) => a + b, 0) / costs.length;
  } catch (e) {
    console.error(
      "[metrics] getAvgCost error",
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

/**
 * Custo médio de IA por entrega em BRL (D7 — snapshot econômico). Consulta
 * direta `generation_events` (call-level, mesmo filtro do RPC de apuração):
 * exclui os 4 delivery markers e exige `operation_run_id IS NOT NULL`
 * (anti-dupla-contagem D1/D6). Por evento:
 * `cost = COALESCE(provider_reported_cost_usd, estimated_cost_usd)` e
 * `rate = usd_brl_rate_at_generation ?? taxa corrente` — a taxa corrente vem
 * de `economic_parameters.usd_brl_rate` (EconomicParameterService, resolvida
 * UMA vez), fonte única de conversão (D2); o env deprecado nunca é lido
 * (D7). `avgBrl = Σ(cost × rate) / N` — conversão POR EVENTO: alterar a taxa
 * corrente depois não recalcula períodos com snapshot (estabilidade temporal,
 * T-38.2.1-18). Falha de consulta ou de leitura da taxa corrente → null
 * (degradação suave, padrão getAvgCost).
 */
export async function getAvgCostBrl(
  hours: number,
  _storeKind: StoreKind = "production",
): Promise<number | null> {
  try {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabaseAdmin
      .from("generation_events")
      .select(
        "provider_reported_cost_usd, estimated_cost_usd, usd_brl_rate_at_generation",
      )
      .not("generation_type", "in", AI_COST_DELIVERY_MARKER_TYPES)
      .not("operation_run_id", "is", null)
      .gte("created_at", cutoff);

    if (error || !data) {
      console.error(
        "[metrics] getAvgCostBrl error",
        error?.message ?? "no data",
      );
      return null;
    }

    // Taxa corrente: fallback explícito (D7) — resolvida UMA vez; erro real →
    // degradação suave (null), padrão getAvgCost.
    let currentRate: number | null = null;
    try {
      const resolution = await new EconomicParameterService().getParameter(
        "usd_brl_rate",
      );
      currentRate = resolution.value;
    } catch (e) {
      console.error(
        "[metrics] getAvgCostBrl taxa corrente indisponível",
        e instanceof Error ? e.message : e,
      );
      return null;
    }
    if (currentRate === null) return null;

    const rows = Array.isArray(data) ? data : [];
    const brlCosts: number[] = [];
    for (const row of rows) {
      const record = row as Record<string, unknown>;
      const cost =
        toNumber(record.provider_reported_cost_usd) ??
        toNumber(record.estimated_cost_usd);
      if (cost === null) continue;
      const rate = toNumber(record.usd_brl_rate_at_generation) ?? currentRate;
      brlCosts.push(cost * rate);
    }
    if (brlCosts.length === 0) return null;
    return brlCosts.reduce((a, b) => a + b, 0) / brlCosts.length;
  } catch (e) {
    console.error(
      "[metrics] getAvgCostBrl error",
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

export async function getAvgDuration(
  hours: number,
  storeKind: StoreKind = "production",
): Promise<number | null> {
  const bundle = await fetchMetricsBundle(hours, storeKind);
  return bundle.pipeline.avg_duration_ms ?? null;
}

export async function getCreditsGranted(
  hours: number,
  storeKind: StoreKind = "production",
): Promise<number | null> {
  const bundle = await fetchMetricsBundle(hours, storeKind);
  return bundle.wallet.credits_granted;
}

// ─── Shared domain-refund classifier ──────────────────────────────

/**
 * Reads deduction/refund counts from the bundle for a given domain predicate.
 * The bundle RPC handles cross-window refund resolution internally.
 */
function classifyFromBundle(
  bundle: MetricsBundle,
  domain: "campaign" | "vs",
): { deductionCount: number; refundCount: number } {
  if (domain === "campaign") {
    return {
      deductionCount: bundle.pipeline.total,
      refundCount: bundle.wallet.credits_refunded_campaign,
    };
  }
  return {
    deductionCount: bundle.pipeline.total, // VS deductions tracked separately
    refundCount: bundle.wallet.vs_refund_rate > 0
      ? Math.round((bundle.wallet.vs_refund_rate / 100) * bundle.pipeline.total)
      : 0,
  };
}

// Legacy helper kept for backward compatibility during transition
// Can be removed after full migration to bundle-based metrics
async function classifyDomainRefunds(
  hours: number,
  isDomainDeduction: (deduction: {
    id: string;
    metadata: Record<string, unknown> | null;
    campaign_id: string | null;
  }) => boolean,
  storeKind: StoreKind = "production",
): Promise<{ deductionCount: number; refundCount: number }> {
  const bundle = await fetchMetricsBundle(hours, storeKind);
  const domain = isDomainDeduction.name === "isVsDeduction" ? "vs" : "campaign";
  return classifyFromBundle(bundle, domain);
}

function isCampaignDeduction(d: { id: string; campaign_id: string | null; metadata: Record<string, unknown> | null }): boolean {
  const metadata = d.metadata as Record<string, unknown> | null;
  const feature = metadata?.feature as string | undefined;

  if (feature === "campaign_pipeline") return true;
  if ((!metadata || !metadata.feature) && d.campaign_id) return true;
  return false;
}

function isVsDeduction(d: { id: string; campaign_id: string | null; metadata: Record<string, unknown> | null }): boolean {
  const metadata = d.metadata as Record<string, unknown> | null;
  const feature = metadata?.feature as string | undefined;
  return feature === "visual_signature";
}

export async function getRefundRate(
  hours: number,
  storeKind: StoreKind = "production",
): Promise<number | null> {
  const bundle = await fetchMetricsBundle(hours, storeKind);
  return bundle.wallet.refund_rate;
}

// ─── Visual Signature (VS) domain ─────────────────────────────────

export async function getVsSuccessRate(
  hours: number,
  storeKind: StoreKind = "production",
): Promise<number | null> {
  const bundle = await fetchMetricsBundle(hours, storeKind);
  return bundle.vs.success_rate ?? null;
}

export async function getVsErrorRate(
  hours: number,
  storeKind: StoreKind = "production",
): Promise<number | null> {
  const bundle = await fetchMetricsBundle(hours, storeKind);
  return bundle.vs.error_rate ?? 0;
}

export async function getVsAvgDuration(
  hours: number,
  storeKind: StoreKind = "production",
): Promise<number | null> {
  const bundle = await fetchMetricsBundle(hours, storeKind);
  return bundle.vs.avg_duration_ms ?? null;
}

export async function getVsCreditsConsumed(
  hours: number,
  storeKind: StoreKind = "production",
): Promise<number | null> {
  const bundle = await fetchMetricsBundle(hours, storeKind);
  return bundle.wallet.vs_credits_consumed;
}

export async function getVsCreditsRefunded(
  hours: number,
  storeKind: StoreKind = "production",
): Promise<number | null> {
  const bundle = await fetchMetricsBundle(hours, storeKind);
  return bundle.wallet.vs_credits_refunded;
}

export async function getVsRefundRate(
  hours: number,
  storeKind: StoreKind = "production",
): Promise<number | null> {
  const bundle = await fetchMetricsBundle(hours, storeKind);
  return bundle.wallet.vs_refund_rate;
}

export async function getActiveUsers(
  hours: number,
  storeKind: StoreKind = "production",
): Promise<number | null> {
  const bundle = await fetchMetricsBundle(hours, storeKind);
  return bundle.pipeline.active_users;
}

// ─── Public bundle accessor ───────────────────────────────────────

/** Fetch the complete metrics bundle for a given window and store kind.
 *  Used by admin pages that need to pass storeKind through the chain. */
export { fetchMetricsBundle };
