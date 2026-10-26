import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/server";
import {
  OPENAI_PRICING_HUMAN_URL,
  OPENAI_PRICING_INVENTORY,
  OPENAI_PRICING_MODELS,
  OPENAI_PRICING_PROVIDER,
  OPENAI_PRICING_QUALITY_ORDER,
  getOpenAiPricingLabel,
} from "./openai-pricing-inventory";
import {
  derivePricingSyncState,
  type PricingSyncAttemptSummary,
  type PricingSyncState,
} from "./openai-pricing-sync-state";

/** Linha persistida exibida no admin (dimensões por 1M de tokens). */
export interface OpenAiPricingDashboardRow {
  id: string;
  provider: string;
  model: string;
  label: string;
  quality: string | null;
  inputTokenUsdPer1M: number | null;
  cachedInputTokenUsdPer1M: number | null;
  outputTokenUsdPer1M: number | null;
  inputImageTokenUsdPer1M: number | null;
  cachedInputImageTokenUsdPer1M: number | null;
  outputImageTokenUsdPer1M: number | null;
  /** Preço por unidade de imagem (fora da unidade “por 1M de tokens”). */
  imageUnitUsd: number | null;
  effectiveFrom: string;
}

export interface OpenAiPricingDashboardResult {
  prices: OpenAiPricingDashboardRow[];
  pricesQueryFailed: boolean;
  lastPriceChangedAt: string | null;
  lastSuccessAt: string | null;
  lastAttempt: PricingSyncAttemptSummary | null;
  state: PricingSyncState;
  sourceUrl: string;
}

interface PricingDbRow {
  id: string;
  provider: string;
  model: string;
  quality: string | null;
  input_token_usd_per_1m: number | string | null;
  output_token_usd_per_1m: number | string | null;
  cached_input_token_usd_per_1m: number | string | null;
  image_unit_usd: number | string | null;
  image_token_usd_per_1m: number | string | null;
  image_input_token_usd_per_1m: number | string | null;
  image_cached_input_token_usd_per_1m: number | string | null;
  effective_from: string;
}

interface AttemptDbRow {
  id: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  failure_stage: string | null;
  failure_code: string | null;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function modelOrder(model: string): number {
  const index = OPENAI_PRICING_INVENTORY.findIndex((entry) => entry.model === model);
  return index >= 0 ? index : Number.MAX_SAFE_INTEGER;
}

function qualityOrder(quality: string | null): number {
  const index = OPENAI_PRICING_QUALITY_ORDER.indexOf(quality);
  return index >= 0 ? index : Number.MAX_SAFE_INTEGER;
}

function mapAttempt(row: AttemptDbRow): PricingSyncAttemptSummary {
  const status =
    row.status === "success" || row.status === "failed" || row.status === "running"
      ? row.status
      : "failed";
  return {
    id: row.id,
    status,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    failureStage: row.failure_stage,
    failureCode: row.failure_code,
  };
}

export async function getOpenAiPricingDashboard(params: {
  client?: SupabaseClient;
  now?: Date;
} = {}): Promise<OpenAiPricingDashboardResult> {
  const client = params.client ?? supabaseAdmin;
  const now = params.now ?? new Date();

  const pricesPromise = client
    .from("ai_model_pricing")
    .select(
      "id, provider, model, quality, input_token_usd_per_1m, output_token_usd_per_1m, cached_input_token_usd_per_1m, image_unit_usd, image_token_usd_per_1m, image_input_token_usd_per_1m, image_cached_input_token_usd_per_1m, effective_from",
    )
    .eq("provider", OPENAI_PRICING_PROVIDER)
    .in("model", [...OPENAI_PRICING_MODELS])
    .is("effective_until", null);

  const attemptsPromise = client
    .from("pricing_sync_attempts")
    .select("id, status, started_at, finished_at, failure_stage, failure_code")
    .order("started_at", { ascending: false })
    .limit(50);

  // Consulta separada garante que a última confirmação não seja perdida se
  // houver uma sequência longa de falhas (> 50 tentativas).
  const latestSuccessPromise = client
    .from("pricing_sync_attempts")
    .select("id, status, started_at, finished_at, failure_stage, failure_code")
    .eq("status", "success")
    .order("finished_at", { ascending: false })
    .limit(1);

  const [pricesResult, attemptsResult, latestSuccessResult] = await Promise.all([
    pricesPromise,
    attemptsPromise,
    latestSuccessPromise,
  ]);

  const pricesQueryFailed = pricesResult.error !== null;
  const attemptsQueryFailed =
    attemptsResult.error !== null || latestSuccessResult.error !== null;

  const prices = ((pricesResult.data ?? []) as unknown as PricingDbRow[])
    .map((row) => ({
      id: row.id,
      provider: row.provider,
      model: row.model,
      label: getOpenAiPricingLabel(row.model),
      quality: row.quality ?? null,
      inputTokenUsdPer1M: toNumber(row.input_token_usd_per_1m),
      cachedInputTokenUsdPer1M: toNumber(row.cached_input_token_usd_per_1m),
      outputTokenUsdPer1M: toNumber(row.output_token_usd_per_1m),
      inputImageTokenUsdPer1M: toNumber(row.image_input_token_usd_per_1m),
      cachedInputImageTokenUsdPer1M: toNumber(
        row.image_cached_input_token_usd_per_1m,
      ),
      outputImageTokenUsdPer1M: toNumber(row.image_token_usd_per_1m),
      imageUnitUsd: toNumber(row.image_unit_usd),
      effectiveFrom: row.effective_from,
    }))
    .sort(
      (a, b) =>
        modelOrder(a.model) - modelOrder(b.model) ||
        qualityOrder(a.quality) - qualityOrder(b.quality) ||
        a.model.localeCompare(b.model),
    );

  const attemptRows = [
    ...((attemptsResult.data ?? []) as unknown as AttemptDbRow[]),
    ...((latestSuccessResult.data ?? []) as unknown as AttemptDbRow[]),
  ];
  const attemptsById = new Map<string, PricingSyncAttemptSummary>();
  for (const row of attemptRows) {
    const mapped = mapAttempt(row);
    attemptsById.set(mapped.id, mapped);
  }
  const attempts = [...attemptsById.values()].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  );

  const state = derivePricingSyncState({
    attempts,
    now,
    queryFailed: attemptsQueryFailed,
  });

  const lastPriceChangedAt =
    prices
      .map((row) => row.effectiveFrom)
      .filter((value) => Number.isFinite(new Date(value).getTime()))
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null;

  return {
    prices,
    pricesQueryFailed,
    lastPriceChangedAt,
    lastSuccessAt: state.lastSuccessAt,
    lastAttempt: attempts[0] ?? null,
    state,
    sourceUrl: OPENAI_PRICING_HUMAN_URL,
  };
}
