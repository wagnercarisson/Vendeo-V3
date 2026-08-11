import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { AiCostEvent, OperationRunType } from "./types";

/**
 * Camada única de escrita de custo (D7) — módulo de servidor.
 * - `startRun(type)`: gera operationRunId + traceId DISTINTOS (D1) no início de
 *   um request e propaga às chamadas filhas via contexto de telemetria.
 * - `record(event)`: grava o evento em `generation_events` com todas as colunas
 *   novas (D2). BEST-EFFORT: nunca lança — a geração não é bloqueada por telemetria.
 *   F38.2 (D5): persiste os 4 campos de confiança do CostResolution como colunas
 *   próprias (versão da fórmula, nota de estimativa, componentes text e tool em
 *   USD) — daqui para frente, sem reclassificar histórico (eventos anteriores à
 *   migration ficam NULL → badge genérico na UI).
 * - Delivery marker (D1/D6): evento sem `cost` e sem `tokens` → colunas de
 *   custo/tokens NULL + flag de pipeline no metadata.
 *
 * NÃO exporta métodos de leitura — apuração é via RPCs admin (D10).
 * NÃO valida costSource em runtime — o enum TS cobre (D4).
 */
export class AiCostTracker {
  constructor(private readonly client: SupabaseClient = supabaseAdmin) {}

  startRun(type: OperationRunType): { operationRunId: string; traceId: string } {
    // NO ANALOG: run-context é padrão novo — UUIDs distintos, colunas separadas
    // com semânticas distintas (operation_run_id = entrega; trace_id = rastreio).
    return {
      operationRunId: crypto.randomUUID(),
      traceId: crypto.randomUUID(),
    };
  }

  async record(event: AiCostEvent): Promise<void> {
    try {
      const delivery = event.cost === undefined && event.tokens === undefined;
      const { error } = await this.client.from("generation_events").insert({
        operation_run_id: event.operationRunId,
        operation_run_type: event.operationRunType,
        trace_id: event.traceId,
        store_id: event.storeId,
        user_id: event.userId ?? null,
        campaign_id: event.campaignId ?? null,
        visual_signature_id: event.visualSignatureId ?? null,
        theme_id: event.themeId ?? null,
        generation_type: event.generationType,
        provider: event.provider,
        model: event.model,
        attempt_number: event.attemptNumber,
        duration_ms: event.durationMs,
        status: event.status,
        error_type: event.errorType ?? null,
        prompt_tokens: event.tokens?.promptTokens ?? null,
        completion_tokens: event.tokens?.completionTokens ?? null,
        total_tokens: event.tokens?.totalTokens ?? null,
        cached_input_tokens: event.tokens?.cachedInputTokens ?? null,
        image_tokens: event.tokens?.imageTokens ?? null,
        estimated_cost_usd: event.cost?.estimatedCostUsd ?? null,
        provider_reported_cost_usd: event.cost?.providerReportedCostUsd ?? null,
        cost_source: event.cost?.costSource ?? null,
        pricing_version: event.cost?.pricingVersion ?? null,
        cost_formula_version: event.cost?.costFormulaVersion ?? null,
        cost_estimation_note: event.cost?.costEstimationNote ?? null,
        text_component_usd: event.cost?.textComponentUsd ?? null,
        image_tool_component_usd: event.cost?.imageToolComponentUsd ?? null,
        metadata: delivery
          ? { ...(event.metadata ?? {}), duration_is_pipeline: true }
          : (event.metadata ?? {}),
      });

      if (error) {
        console.error("[AiCostTracker] record failed (best-effort):", error.message);
      }
    } catch (err) {
      console.error("[AiCostTracker] record exception (best-effort):", err);
    }
  }
}
