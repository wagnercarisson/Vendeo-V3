import { resolveAiCost } from "@/lib/ai-cost/cost-estimator";
import { AiCostTracker } from "@/lib/ai-cost/tracker";
import type { AiCostEvent, CostResolution, OperationRunType } from "@/lib/ai-cost/types";
import { CAPABILITY_GENERATION_TYPE } from "./generation-type-map";
import type {
  AiCallEnvelope,
  AiEnvelopeInternalCost,
  AiTelemetryContext,
  AiTelemetrySink,
} from "./types";

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
  /**
   * F56.2b1b (P1 — Opção A) — custo INTERNO do NOVO FLUXO já resolvido
   * (modelo + qualidade + versão + origem, `@/lib/ai-cost/image-pair-pricing`).
   * Quando presente, o sink usa ESTE custo (origem `pricing_table` +
   * `pricing_version`) — NUNCA `provider_reported` — e VALIDA `model`/`quality`
   * contra o envelope REAL; um valor ausente/inválido é sinalizado
   * explicitamente (nunca mislabelado, nunca cai na cadeia legada). Ausente ⇒ a
   * cadeia legada de `resolveAiCost` permanece byte-idêntica. **ADITIVO.**
   */
  internalCost?: AiEnvelopeInternalCost;
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
      const internal = this.context.internalCost;

      let cost: CostResolution;
      let internalInvalidReason: string | null = null;
      if (internal) {
        // P1 (Opção A): custo INTERNO já resolvido. A origem é `pricing_table`
        // (nunca `provider_reported`) — o envelope REAL carrega usage/durationMs/
        // status/model/quality reais do gateway.
        const resolution = resolveInternalCost(internal, envelope);
        if (resolution.valid) {
          cost = resolution.cost;
        } else {
          // NUNCA mislabelar como `pricing_table` nem cair SILENCIOSAMENTE na
          // cadeia legada: custo honestamente DESCONHECIDO (`not_available`) +
          // motivo explícito em metadata.
          internalInvalidReason = resolution.reason;
          console.warn(
            `[AiTelemetrySink] internalCost inválido (${resolution.reason}); ` +
              "registrando custo como not_available (sem fallback legado).",
          );
          cost = { estimatedCostUsd: null, costSource: "not_available" };
        }
      } else {
        // Cadeia legada INTACTA (byte-idêntica) quando `internalCost` está ausente.
        cost = await resolveAiCost({
          provider: envelope.provider,
          model: envelope.model,
          usage: envelope.usage,
          providerReportedCostUsd: envelope.providerReportedCostUsd,
          // A tool image_generation só conta quando o envelope declara o uso REAL
          // (usageMeta.imageGenerationTool) — nunca inferida do protocolo responses.
          imageGenerationTool: envelope.usageMeta?.imageGenerationTool === true,
          generationType,
        });
      }

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
        // P1 (Opção A): preserva o `attemptNumber` do envelope REAL (o gateway já
        // o preenche); fallback ao contexto do sink. Para flows legados os dois
        // coincidem (o gateway semeia `envelope.attemptNumber` do contexto).
        attemptNumber: envelope.attemptNumber ?? this.context.attemptNumber ?? 1,
        durationMs: envelope.durationMs,
        status: envelope.status,
        errorType: envelope.errorType ?? null,
        tokens: envelope.usage,
        cost,
        // F38.2.1 (D3): snapshot do run propagado às chamadas filhas — só valores.
        usdBrlRateAtGeneration: this.context.usdBrlRateAtGeneration ?? null,
        creditValueBrlAtGeneration: this.context.creditValueBrlAtGeneration ?? null,
        metadata: buildCallMetadata(envelope, cost, internal, internalInvalidReason),
      };

      await this.tracker.record(event);
    } catch (err) {
      console.error("[AiTelemetrySink] emit falhou (best-effort/fail-open):", err);
    }
  }
}

/**
 * Resolve o custo INTERNO do novo fluxo a partir do envelope REAL (P1 — Opção A).
 *
 * Só é VÁLIDO quando:
 *  - o `model` e o `quality` do custo INTERNO são IGUAIS aos do envelope REAL
 *    (a chamada real) — mismatch ⇒ inválido (nunca associar modelo/qualidade
 *    divergentes);
 *  - o valor é FINITO e NÃO-NEGATIVO;
 *  - `pricingVersion` e `origin` estão presentes (não vazios).
 *
 * Inválido/ausente NUNCA vira `pricing_table` nem cai na cadeia legada — é
 * devolvido como `{ valid: false, reason }` para o chamador gravar
 * `not_available` + motivo explícito em metadata.
 */
function resolveInternalCost(
  internal: AiEnvelopeInternalCost,
  envelope: AiCallEnvelope,
): { valid: true; cost: CostResolution } | { valid: false; reason: string } {
  if (internal.model !== envelope.model) {
    return { valid: false, reason: "model_mismatch" };
  }
  if (internal.quality !== envelope.quality) {
    return { valid: false, reason: "quality_mismatch" };
  }

  const usd = internal.estimatedCostUsd;
  if (typeof usd !== "number" || !Number.isFinite(usd) || usd < 0) {
    return { valid: false, reason: "invalid_cost_value" };
  }
  if (internal.pricingVersion == null || internal.pricingVersion === "") {
    return { valid: false, reason: "missing_pricing_version" };
  }
  if (internal.origin == null || internal.origin === "") {
    return { valid: false, reason: "missing_origin" };
  }

  return {
    valid: true,
    cost: {
      estimatedCostUsd: usd,
      costSource: "pricing_table",
      pricingVersion: internal.pricingVersion,
    },
  };
}

/**
 * Metadata call-level para auditoria (preserva o contrato do `buildCallMetadata`
 * legado): usage bruto sanitizado + flags do caminho + componentes da fórmula de
 * estimativa + capability/protocol originais.
 */
function buildCallMetadata(
  envelope: AiCallEnvelope,
  cost: CostResolution,
  internal?: AiEnvelopeInternalCost,
  internalInvalidReason?: string | null,
): Record<string, unknown> {
  const usageMeta = envelope.usageMeta
    ? {
        provider_usage_raw: envelope.usageMeta.providerUsageRaw,
        provider_usage_source: envelope.usageMeta.providerUsageSource,
        responses_model: envelope.usageMeta.responsesModel,
        image_generation_tool: envelope.usageMeta.imageGenerationTool,
        image_generation_model: envelope.usageMeta.imageGenerationModel,
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
    // Caller metadata primeiro: os campos canônicos do sink (capability/protocol/
    // usage/fórmula) SEMPRE vencem — o caller não pode forjar campos do sink.
    ...(envelope.metadata ?? {}),
    capability: envelope.capability,
    protocol: envelope.protocol,
    ...(usageMeta ?? {}),
    ...(formula ?? {}),
    // P1 (Opção A): origem INTERNA auditável do NOVO FLUXO — acrescentada DEPOIS
    // do spread de `envelope.metadata` (o caller não pode forjar estas chaves).
    // Ausente ⇒ metadata legada byte-idêntica.
    ...(internal
      ? {
          internal_cost_origin: internal.origin,
          internal_cost_source: internal.source,
          internal_cost_version_id: internal.pricingVersion,
          internal_cost_model: internal.model,
          internal_cost_quality: internal.quality,
          ...(internalInvalidReason != null
            ? {
                internal_cost_invalid: true,
                internal_cost_invalid_reason: internalInvalidReason,
              }
            : {}),
        }
      : {}),
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

/**
 * Adaptador fino de compatibilidade: mantém o `onCall` legado (que recebe o
 * **envelope já produzido** pelo gateway) SEM conduzir a telemetria de produção
 * (D9/D11). O envelope continua indo ao sink original; o `onCall` é best-effort
 * e nunca bloqueia a geração. O callback recebe o `AiCallEnvelope` COMPLETO
 * (aditivo a `AiCallInfo`) — observadores que tipam `AiCallInfo` continuam
 * compatíveis (o envelope o estende).
 */
export function withOnCallTelemetry(
  telemetry: AiTelemetryContext,
  onCall?: (envelope: AiCallEnvelope) => void | Promise<void>,
): AiTelemetryContext {
  if (!onCall) return telemetry;
  return {
    ...telemetry,
    sink: {
      emit: async (envelope: AiCallEnvelope): Promise<void> => {
        await telemetry.sink.emit(envelope);
        try {
          await onCall(envelope);
        } catch (err) {
          console.error(
            "[ai-telemetry] onCall falhou (best-effort):",
            err instanceof Error ? err.message : String(err),
          );
        }
      },
    },
  };
}
