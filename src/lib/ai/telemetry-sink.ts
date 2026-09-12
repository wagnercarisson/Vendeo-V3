import { resolveAiCost } from "@/lib/ai-cost/cost-estimator";
import { AiCostTracker } from "@/lib/ai-cost/tracker";
import type { AiCostEvent, CostResolution, OperationRunType } from "@/lib/ai-cost/types";
import { CAPABILITY_GENERATION_TYPE } from "./generation-type-map";
import type { AiCallEnvelope, AiTelemetryContext, AiTelemetrySink } from "./types";

/**
 * Sink de telemetria (F46, D3/D9/D10).
 *
 * O gateway **não** persiste — ele emite **um envelope por tentativa real** para
 * o sink injetado no `AiTelemetryContext`. O **sink padrão** é o único
 * responsável por `resolveAiCost` + `AiCostTracker.record` (best-effort/
 * fail-open): uma falha de persistência é apenas logada e nunca bloqueia a
 * geração (T-46-02c).
 *
 * Fluxos que precisam de buffering/ordenação (VS até conhecer
 * `visual_signature_id`; brand-profile por ordem) injetam o **próprio sink** —
 * `BufferingAiTelemetrySink` cobre esse caso sem alterar o gateway.
 */

export type { AiTelemetrySink } from "./types";

/** Campos de run/contexto que o sink padrão precisa para montar o `AiCostEvent`. */
export interface AiTelemetrySinkContext {
  operationRunId: string;
  operationRunType: OperationRunType;
  traceId: string;
  storeId: string;
  userId?: string;
  campaignId?: string;
  visualSignatureId?: string;
  themeId?: string;
  attemptNumber?: number;
  /**
   * F38.2.1 (D2/D3): snapshot CONTÁBIL do run — resolvido UMA vez no início e
   * propagado às chamadas filhas. O sink apenas repassa os valores; o tracker
   * define `captured_at_generation`.
   */
  usdBrlRateAtGeneration?: number | null;
  /** F38.2.1 (D2/D3): snapshot ESTIMATIVO do valor do crédito no run. */
  creditValueBrlAtGeneration?: number | null;
  /**
   * Callback chamado com o **mesmo `CostResolution`** que o sink persiste —
   * permite acumular o custo no caller **sem uma segunda chamada a
   * `resolveAiCost`** (correção de revisão 46-02/46-03 C).
   */
  onCostResolved?: (cost: CostResolution) => void;
}

/** Sink padrão de produção: resolve custo e grava call-level (fail-open). */
export class DefaultAiTelemetrySink implements AiTelemetrySink {
  constructor(
    private readonly context: AiTelemetrySinkContext,
    private readonly tracker: AiCostTracker = new AiCostTracker(),
  ) {}

  async emit(envelope: AiCallEnvelope): Promise<void> {
    try {
      const generationType = CAPABILITY_GENERATION_TYPE[envelope.capability];
      const cost = await resolveAiCost({
        provider: envelope.provider,
        model: envelope.model,
        usage: envelope.usage,
        providerReportedCostUsd: envelope.providerReportedCostUsd,
        // A tool image_generation só conta quando o envelope declara o uso REAL
        // (usageMeta.imageGenerationTool) — nunca inferida do protocolo responses.
        imageGenerationTool: envelope.usageMeta?.imageGenerationTool === true,
        generationType,
      });

      // Acumulação no caller usa exatamente esta resolução (sem 2ª chamada).
      this.context.onCostResolved?.(cost);

      const event: AiCostEvent = {
        operationRunId: this.context.operationRunId,
        operationRunType: this.context.operationRunType,
        traceId: this.context.traceId,
        storeId: this.context.storeId,
        userId: this.context.userId ?? null,
        campaignId: this.context.campaignId ?? null,
        visualSignatureId: this.context.visualSignatureId ?? null,
        themeId: this.context.themeId ?? null,
        generationType,
        provider: envelope.provider,
        model: envelope.model,
        attemptNumber: this.context.attemptNumber ?? 1,
        durationMs: envelope.durationMs,
        status: envelope.status,
        errorType: envelope.errorType ?? null,
        tokens: envelope.usage,
        cost,
        // F38.2.1 (D3): snapshot do run propagado às chamadas filhas — só valores.
        usdBrlRateAtGeneration: this.context.usdBrlRateAtGeneration ?? null,
        creditValueBrlAtGeneration: this.context.creditValueBrlAtGeneration ?? null,
        metadata: buildCallMetadata(envelope, cost),
      };

      await this.tracker.record(event);
    } catch (err) {
      console.error("[AiTelemetrySink] emit falhou (best-effort/fail-open):", err);
    }
  }
}

/**
 * Metadata call-level para auditoria (preserva o contrato do `buildCallMetadata`
 * legado): usage bruto sanitizado + flags do caminho + componentes da fórmula de
 * estimativa + capability/protocol originais.
 */
function buildCallMetadata(
  envelope: AiCallEnvelope,
  cost: CostResolution,
): Record<string, unknown> {
  const usageMeta = envelope.usageMeta
    ? {
        provider_usage_raw: envelope.usageMeta.providerUsageRaw,
        provider_usage_source: envelope.usageMeta.providerUsageSource,
        responses_model: envelope.usageMeta.responsesModel,
        image_generation_tool: envelope.usageMeta.imageGenerationTool,
      }
    : undefined;

  const formula =
    cost.costFormulaVersion ||
    cost.costEstimationNote ||
    cost.textComponentUsd !== undefined
      ? {
          cost_formula_version: cost.costFormulaVersion,
          text_component_usd: cost.textComponentUsd,
          image_tool_component_usd: cost.imageToolComponentUsd,
          image_tool_pricing_provider: cost.imageToolPricingProvider,
          image_tool_pricing_model: cost.imageToolPricingModel,
          image_tool_pricing_version: cost.imageToolPricingVersion,
          cost_estimation_note: cost.costEstimationNote,
        }
      : undefined;

  return {
    capability: envelope.capability,
    protocol: envelope.protocol,
    ...(usageMeta ?? {}),
    ...(formula ?? {}),
  };
}

/**
 * Sink no-op explícito — **apenas para testes** com adapter falso (nunca em
 * produção: o contexto de produção exige o sink padrão ou um sink real).
 */
export class NoopAiTelemetrySink implements AiTelemetrySink {
  emit(_envelope: AiCallEnvelope): void {
    // intencionalmente vazio
  }
}

/**
 * Sink de buffering/ordenação — acumula envelopes na ordem de emissão e os
 * entrega ao `flushHandler` quando o contexto estiver completo (ex.: VS aguarda
 * o `visual_signature_id`).
 */
export class BufferingAiTelemetrySink implements AiTelemetrySink {
  private readonly buffer: AiCallEnvelope[] = [];

  constructor(
    private readonly flushHandler: (envelopes: AiCallEnvelope[]) => void | Promise<void>,
  ) {}

  emit(envelope: AiCallEnvelope): void {
    this.buffer.push(envelope);
  }

  /** Envelopes ainda não entregues (ordem preservada). */
  get pending(): readonly AiCallEnvelope[] {
    return this.buffer;
  }

  /** Entrega os envelopes acumulados, em ordem, e limpa o buffer. */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    const items = [...this.buffer];
    this.buffer.length = 0;
    await this.flushHandler(items);
  }
}

/**
 * Factory do contexto de telemetria com o **sink padrão** (ou um sink injetado
 * para buffering/ordenação). O `sink` é sempre obrigatório no retorno.
 */
export function createDefaultTelemetryContext(
  params: AiTelemetrySinkContext & { sink?: AiTelemetrySink; tracker?: AiCostTracker },
): AiTelemetryContext {
  const { sink, tracker, ...context } = params;
  return {
    ...context,
    sink: sink ?? new DefaultAiTelemetrySink(context, tracker),
  };
}
