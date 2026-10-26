import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/server";
import { OPENAI_PRICING_PROVIDER } from "./openai-pricing-inventory";

/** Preço desejado de UMA linha modelo+qualidade (dimensões por 1M de tokens). */
export interface PricingSyncDesiredPrice {
  provider: string;
  model: string;
  quality: string | null;
  inputTokenUsdPer1M: number;
  outputTokenUsdPer1M: number | null;
  cachedInputTokenUsdPer1M: number | null;
  imageTokenUsdPer1M: number | null;
  imageInputTokenUsdPer1M: number | null;
  imageCachedInputTokenUsdPer1M: number | null;
}

export interface PricingSyncCurrentRow {
  id: string;
  provider: string;
  model: string;
  quality: string | null;
  inputTokenUsdPer1M: number | null;
  outputTokenUsdPer1M: number | null;
  cachedInputTokenUsdPer1M: number | null;
  imageUnitUsd: number | null;
  imageTokenUsdPer1M: number | null;
  imageInputTokenUsdPer1M: number | null;
  imageCachedInputTokenUsdPer1M: number | null;
  effectiveFrom: string;
}

export interface PricingSyncApplyResult {
  modelsChecked: number;
  pricesChecked: number;
  pricesChanged: number;
}

export type PricingSyncStartResult =
  | { started: true; attemptId: string }
  | { started: false; reason: string };

export interface PricingSyncStore {
  startAttempt(sourceUrl: string): Promise<PricingSyncStartResult>;
  readCurrentPrices(models: readonly string[]): Promise<PricingSyncCurrentRow[]>;
  applyPrices(input: {
    attemptId: string;
    sourceUrl: string;
    contentHash: string;
    etag: string | null;
    lastModified: string | null;
    modelsChecked: number;
    prices: readonly PricingSyncDesiredPrice[];
  }): Promise<PricingSyncApplyResult>;
  failAttempt(attemptId: string, stage: string, code: string): Promise<void>;
}

export class PricingSyncStoreError extends Error {
  constructor(
    readonly stage: string,
    readonly code: string,
  ) {
    super(code);
    this.name = "PricingSyncStoreError";
  }
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

interface CurrentPricingDbRow {
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

export class SupabasePricingSyncStore implements PricingSyncStore {
  constructor(private readonly client: SupabaseClient = supabaseAdmin) {}

  async startAttempt(sourceUrl: string): Promise<PricingSyncStartResult> {
    const { data, error } = await this.client.rpc("pricing_sync_start", {
      p_source_url: sourceUrl,
    });
    if (error) {
      throw new PricingSyncStoreError("start", "start_failed");
    }
    const result = (data ?? {}) as {
      started?: boolean;
      attempt_id?: string;
      reason?: string;
    };
    if (result.started === true && result.attempt_id) {
      return { started: true, attemptId: result.attempt_id };
    }
    return { started: false, reason: result.reason ?? "already_running" };
  }

  async readCurrentPrices(models: readonly string[]): Promise<PricingSyncCurrentRow[]> {
    const { data, error } = await this.client
      .from("ai_model_pricing")
      .select(
        "id, provider, model, quality, input_token_usd_per_1m, output_token_usd_per_1m, cached_input_token_usd_per_1m, image_unit_usd, image_token_usd_per_1m, image_input_token_usd_per_1m, image_cached_input_token_usd_per_1m, effective_from",
      )
      .eq("provider", OPENAI_PRICING_PROVIDER)
      .in("model", [...models])
      .is("effective_until", null);

    if (error) {
      throw new PricingSyncStoreError("read_pricing", "read_failed");
    }

    return ((data ?? []) as unknown as CurrentPricingDbRow[]).map((row) => ({
      id: row.id,
      provider: row.provider,
      model: row.model,
      quality: row.quality ?? null,
      inputTokenUsdPer1M: toNumber(row.input_token_usd_per_1m),
      outputTokenUsdPer1M: toNumber(row.output_token_usd_per_1m),
      cachedInputTokenUsdPer1M: toNumber(row.cached_input_token_usd_per_1m),
      imageUnitUsd: toNumber(row.image_unit_usd),
      imageTokenUsdPer1M: toNumber(row.image_token_usd_per_1m),
      imageInputTokenUsdPer1M: toNumber(row.image_input_token_usd_per_1m),
      imageCachedInputTokenUsdPer1M: toNumber(
        row.image_cached_input_token_usd_per_1m,
      ),
      effectiveFrom: row.effective_from,
    }));
  }

  async applyPrices(input: {
    attemptId: string;
    sourceUrl: string;
    contentHash: string;
    etag: string | null;
    lastModified: string | null;
    modelsChecked: number;
    prices: readonly PricingSyncDesiredPrice[];
  }): Promise<PricingSyncApplyResult> {
    const { data, error } = await this.client.rpc("pricing_sync_apply", {
      p_attempt_id: input.attemptId,
      p_source_url: input.sourceUrl,
      p_content_hash: input.contentHash,
      p_etag: input.etag,
      p_last_modified: input.lastModified,
      p_models_checked: input.modelsChecked,
      p_prices: input.prices,
    });

    if (error) {
      throw new PricingSyncStoreError("apply", "apply_failed");
    }

    const result = (data ?? {}) as Record<string, unknown>;
    if (result.success !== true) {
      throw new PricingSyncStoreError("apply", "apply_not_confirmed");
    }

    return {
      modelsChecked: toNumber(result.models_checked) ?? input.modelsChecked,
      pricesChecked: toNumber(result.prices_checked) ?? 0,
      pricesChanged: toNumber(result.prices_changed) ?? 0,
    };
  }

  async failAttempt(attemptId: string, stage: string, code: string): Promise<void> {
    const { error } = await this.client.rpc("pricing_sync_fail", {
      p_attempt_id: attemptId,
      p_failure_stage: stage,
      p_failure_code: code,
    });
    if (error) {
      throw new PricingSyncStoreError("record", "failure_record_failed");
    }
  }
}
