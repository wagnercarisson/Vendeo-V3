import { supabaseAdmin as supabase } from '@/lib/supabase/server';
import type { GenerationEventInsert, GenerationEventRecord } from '@/lib/visual-signature/types';
import { AiCostTracker } from '@/lib/ai-cost/tracker';

export async function insertGenerationEvent(
  event: GenerationEventInsert
): Promise<GenerationEventRecord | null> {
  try {
    const tracker = new AiCostTracker();

    const hasTokens =
      event.cached_input_tokens !== undefined || event.image_tokens !== undefined;
    const hasCost =
      event.estimated_cost_usd !== undefined ||
      event.provider_reported_cost_usd !== undefined ||
      event.cost_source !== undefined ||
      event.pricing_version !== undefined;

    await tracker.record({
      operationRunId: event.operation_run_id ?? crypto.randomUUID(),
      operationRunType: event.operation_run_type ?? 'visual_signature',
      traceId: event.trace_id ?? crypto.randomUUID(),
      storeId: event.store_id,
      visualSignatureId: event.visual_signature_id ?? null,
      generationType: event.generation_type,
      provider: event.provider ?? 'unknown',
      model: event.model ?? 'unknown',
      attemptNumber: event.attempt_number ?? 1,
      durationMs: event.duration_ms ?? 0,
      status: event.status,
      errorType: event.error_type ?? null,
      tokens: hasTokens
        ? {
            cachedInputTokens: event.cached_input_tokens ?? undefined,
            imageTokens: event.image_tokens ?? undefined,
          }
        : undefined,
      cost: hasCost
        ? {
            estimatedCostUsd: event.estimated_cost_usd ?? null,
            providerReportedCostUsd: event.provider_reported_cost_usd ?? null,
            costSource: event.cost_source ?? 'not_available',
            pricingVersion: event.pricing_version ?? null,
          }
        : undefined,
      // F38.2.1 (D3): repassa os snapshots do run ao tracker (APENAS valores —
      // a origem captured_at_generation é definida pelo tracker na gravação).
      usdBrlRateAtGeneration: event.usd_brl_rate_at_generation ?? null,
      creditValueBrlAtGeneration: event.credit_value_brl_at_generation ?? null,
      metadata: event.metadata ?? {},
    });

    return null;
  } catch (err) {
    console.error('[GenerationEvents] Insert failed (best-effort):', err);
    return null;
  }
}

export async function updateGenerationEventDecision(
  assetId: string,
  attemptNumber: number,
  decision: { approved?: boolean; rejected?: boolean }
): Promise<void> {
  try {
    await supabase
      .from('generation_events')
      .update(decision)
      .eq('asset_id', assetId)
      .eq('attempt_number', attemptNumber);
  } catch (err) {
    console.error('[GenerationEvents] Update failed (best-effort):', err);
  }
}
