import "server-only";

import {
  correlateSnapshotWithTelemetry,
  resolveSnapshotPairForTarget,
  type CorrelatedImageGenerationAttempt,
  type ImageGenerationConfigSnapshot,
  type ImageGenerationTelemetryAttempt,
  type ImageModelTarget,
  type ImageQuality,
} from "@/lib/ai/image-generation-config-snapshot";
import type { ImageModelPairConfig } from "@/lib/ai/image-model-pair";
import {
  createDefaultTelemetryContext,
  DefaultAiTelemetrySink,
  NoopAiTelemetrySink,
} from "@/lib/ai/telemetry-sink";
import {
  toInternalDiagnosis,
  type ImageGenerationDiagnosisInput,
} from "@/lib/ai/image-generation-support-reference";
import {
  resolveImagePairCost,
  type ImagePairAttemptCost,
  type ImagePairCostResolution,
} from "@/lib/ai-cost/image-pair-pricing";
import type { AiCallEnvelope, AiTelemetryContext } from "@/lib/ai/types";

/**
 * F56.2b1b — Instrumentação por tentativa + diagnóstico durável do Produto 1:1
 * (Plano 08, REQ-56.2.2-12).
 *
 * Centraliza:
 *
 *  1. o ENVELOPE por tentativa real: modelo, qualidade, alvo, `attempt_number`,
 *     run/trace, resultado e custo interno por par. Cada tentativa real emite
 *     EXATAMENTE um envelope e a sequência é reconstruível (principal ×
 *     fallback distinguíveis via `correlateSnapshotWithTelemetry`);
 *  2. o DIAGNÓSTICO durável correlacionado a `IMG-001` + referência opaca
 *     (`recordFailureDiagnosis` → `toInternalDiagnosis` + repositório durável),
 *     distinguindo falha CONFIRMADA de resultado DESCONHECIDO pela categoria
 *     interna persistida.
 *
 * Reutiliza os contratos existentes (NÃO fork): `resolveSnapshotPairForTarget`,
 * `correlateSnapshotWithTelemetry`, `toInternalDiagnosis` e o caminho de
 * telemetria/custo existente (`createDefaultTelemetryContext`), SEM alterar a
 * cadeia legada de `resolveAiCost` nem a contabilidade do fluxo legado. O custo
 * interno por par é apenas registrado — NUNCA vira cobrança adicional (o
 * crédito da entrega permanece um único efeito da operação de crédito).
 *
 * NUNCA grava texto cru/chave/URL do provider: o `normalized_error` é reduzido
 * ao conjunto FECHADO por `toInternalDiagnosis`/`normalizeDiagnosisErrorCode`.
 */

/** Resultado de uma tentativa real no envelope de telemetria. */
export type AttemptEnvelopeResult = "success" | "failed" | "timeout";

/**
 * Categoria INTERNA de falha CONFIRMADA (distinta do resultado desconhecido) —
 * persistida no diagnóstico durável; nunca exposta ao lojista.
 */
export const CONFIRMED_FAILURE_INTERNAL_CATEGORY = "generation_failed" as const;

/** Categoria INTERNA de resultado DESCONHECIDO (timeout/abort/perda). */
export const UNKNOWN_RESULT_INTERNAL_CATEGORY = "generation_unknown" as const;

/**
 * Envelope por tentativa real do novo fluxo. Um envelope por tentativa real
 * (sucesso/falha/timeout); `model`/`quality` vêm do snapshot congelado do alvo.
 * `internalCostUsd` é o custo INTERNO por par (interno; nunca cobrança) ou
 * `null` quando não resolvido — nunca um valor inventado.
 */
export interface AttemptEnvelope {
  readonly attemptNumber: number;
  readonly target: ImageModelTarget;
  readonly model: string;
  readonly quality: ImageQuality;
  readonly result: AttemptEnvelopeResult;
  readonly internalCostUsd: number | null;
  /**
   * Gap 4 — versão/origem do pricing do NOVO FLUXO (`modelo + qualidade`) que
   * produziu `internalCostUsd` (a MESMA pricing validada no preflight). `null`
   * quando o custo não foi resolvido.
   */
  readonly internalCostVersionId?: string | null;
  readonly internalCostSource?: string | null;
  readonly runId?: string;
  readonly traceId?: string;
}

export interface EmitAttemptEnvelopeInput {
  readonly snapshot: ImageGenerationConfigSnapshot;
  readonly attemptNumber: number;
  readonly target: ImageModelTarget;
  readonly result: AttemptEnvelopeResult;
  readonly internalCostUsd?: number | null;
  readonly internalCostVersionId?: string | null;
  readonly internalCostSource?: string | null;
  readonly runId?: string;
  readonly traceId?: string;
}

/** Destino observável do envelope por tentativa (injetável). */
export interface AttemptEnvelopeSink {
  emit(envelope: AttemptEnvelope): void | Promise<void>;
}

/**
 * Constrói (e emite, AGUARDANDO) UM envelope da tentativa real. O par
 * modelo–qualidade é reconstruído do snapshot congelado pelo alvo
 * (`resolveSnapshotPairForTarget`) — nunca de um valor do cliente.
 *
 * Gap 4 — a emissão ao sink é AGUARDADA e uma falha do sink NUNCA vira rejeição
 * não tratada (best-effort: a geração não é bloqueada pela observabilidade).
 */
export async function emitAttemptEnvelope(
  input: EmitAttemptEnvelopeInput,
  sink?: AttemptEnvelopeSink,
): Promise<AttemptEnvelope> {
  const pair = resolveSnapshotPairForTarget(input.snapshot, input.target);
  const envelope: AttemptEnvelope = Object.freeze({
    attemptNumber: input.attemptNumber,
    target: input.target,
    model: pair.model,
    quality: pair.quality,
    result: input.result,
    internalCostUsd:
      typeof input.internalCostUsd === "number" ? input.internalCostUsd : null,
    internalCostVersionId: input.internalCostVersionId ?? null,
    internalCostSource: input.internalCostSource ?? null,
    ...(input.runId !== undefined ? { runId: input.runId } : {}),
    ...(input.traceId !== undefined ? { traceId: input.traceId } : {}),
  });
  if (sink) {
    try {
      await sink.emit(envelope);
    } catch {
      // Best-effort: um sink defeituoso nunca bloqueia a geração NEM gera
      // rejeição não tratada.
    }
  }
  return envelope;
}

/** Contexto do destino PERSISTENTE do envelope por tentativa (novo fluxo). */
export interface AttemptEnvelopeSinkContext {
  readonly operationRunId: string;
  readonly traceId: string;
  readonly storeId: string;
  readonly campaignId: string;
}

/**
 * Gap 4 — destino PERSISTENTE DEFAULT do envelope por tentativa. REUSA o sink
 * ÚNICO da camada de IA (`DefaultAiTelemetrySink` de `src/lib/ai/telemetry-sink`,
 * que faz `resolveAiCost` + `AiCostTracker.record` DENTRO da fronteira `src/lib/ai/**`)
 * — o orquestrador NUNCA escreve `generation_events` diretamente (gate de
 * arquitetura F46-06). No novo fluxo, o envelope por tentativa É o registro (o
 * sink do gateway é no-op ⇒ UM registro por tentativa, sem duplicar). O custo
 * interno resolvido pela pricing do NOVO FLUXO (`modelo + qualidade`) acompanha
 * o envelope como `providerReportedCostUsd` (o caminho de entrada de um custo
 * resolvido externamente pelo sink único); a versão/origem vão no `metadata`.
 */
export function createDurableAttemptEnvelopeSink(
  context: AttemptEnvelopeSinkContext,
): AttemptEnvelopeSink {
  return {
    async emit(envelope: AttemptEnvelope): Promise<void> {
      const sink = new DefaultAiTelemetrySink({
        operationRunId: context.operationRunId,
        operationRunType: "campaign_delivery",
        traceId: context.traceId,
        storeId: context.storeId,
        campaignId: context.campaignId,
        attemptNumber: envelope.attemptNumber,
      });
      const callEnvelope: AiCallEnvelope = {
        capability: "campaign_product_image",
        protocol: "images",
        status: envelope.result,
        provider: "openai",
        model: envelope.model,
        durationMs: 0,
        ...(envelope.internalCostUsd !== null
          ? { providerReportedCostUsd: envelope.internalCostUsd }
          : {}),
        quality: envelope.quality,
        target: envelope.target,
        attemptNumber: envelope.attemptNumber,
        metadata: {
          product_1_1_attempt_envelope: true,
          quality: envelope.quality,
          target: envelope.target,
          internal_cost_version_id: envelope.internalCostVersionId ?? null,
          internal_cost_source: envelope.internalCostSource ?? null,
        },
      };
      await sink.emit(callEnvelope);
    },
  };
}

/**
 * Reconstrói a sequência de tentativas da operação correlacionando o snapshot
 * congelado à telemetria por run/trace (`correlateSnapshotWithTelemetry`):
 * apenas as tentativas da MESMA operação entram e cada uma recebe o par
 * modelo–qualidade do seu alvo — principal × fallback ficam distinguíveis.
 */
export function reconstructAttemptSequence(
  snapshot: ImageGenerationConfigSnapshot,
  envelopes: ReadonlyArray<AttemptEnvelope>,
): CorrelatedImageGenerationAttempt[] {
  const attempts: ImageGenerationTelemetryAttempt[] = envelopes.map((envelope) => ({
    attemptNumber: envelope.attemptNumber,
    target: envelope.target,
    ...(envelope.runId !== undefined ? { runId: envelope.runId } : {}),
    ...(envelope.traceId !== undefined ? { traceId: envelope.traceId } : {}),
  }));
  return correlateSnapshotWithTelemetry(snapshot, attempts);
}

export interface AttemptTelemetryInput {
  readonly operationRunId: string;
  readonly traceId: string;
  readonly storeId: string;
  readonly campaignId: string;
  readonly attemptNumber: number;
  /**
   * F46-04 (D3) — snapshot econômico propagado; sem ele a apuração cai no
   * fallback silencioso. Obrigatório no contrato (nullable apenas quando o
   * chamador realmente não tem o valor).
   */
  readonly usdBrlRateAtGeneration?: number | null;
  readonly creditValueBrlAtGeneration?: number | null;
}

/**
 * Resolvedor do custo INTERNO por tentativa do NOVO FLUXO (`modelo + qualidade`,
 * com versão/origem do pricing) — a MESMA pricing validada no preflight
 * (`@/lib/ai-cost/image-pair-pricing`). Injetável (testes usam um fake).
 */
export type AttemptCostResolver = (
  config: ImageModelPairConfig,
) => Promise<ImagePairCostResolution>;

/** Default: pricing do novo fluxo (`ImagePairPricingService`). */
export async function defaultResolveAttemptCost(
  config: ImageModelPairConfig,
): Promise<ImagePairCostResolution> {
  return resolveImagePairCost(config);
}

/** Seleciona o custo do alvo a partir da resolução do par (novo fluxo). */
export function attemptCostForTarget(
  resolution: ImagePairCostResolution,
  target: ImageModelTarget,
): ImagePairAttemptCost {
  return target === "fallback" ? resolution.fallback : resolution.primary;
}

/**
 * Gap 4 — contexto de telemetria por tentativa do novo fluxo. O sink do gateway
 * é NO-OP: no novo fluxo o ENVELOPE por tentativa (persistido em
 * `generation_events` via `createDurableAttemptEnvelopeSink`) É o registro, com
 * o custo interno resolvido pela pricing do novo fluxo (`modelo + qualidade` +
 * versão/origem) — SEM depender da resolução legada (`resolveAiCost`) que
 * ignora a qualidade e SEM duplicar registros. A cadeia legada de custo
 * permanece INTACTA para os consumidores do fluxo legado.
 */
export function buildAttemptTelemetry(input: AttemptTelemetryInput): AiTelemetryContext {
  return createDefaultTelemetryContext({
    operationRunId: input.operationRunId,
    operationRunType: "campaign_delivery",
    traceId: input.traceId,
    storeId: input.storeId,
    campaignId: input.campaignId,
    attemptNumber: input.attemptNumber,
    // F46-04 (D3): snapshot econômico propagado (nunca fallback silencioso).
    usdBrlRateAtGeneration: input.usdBrlRateAtGeneration ?? null,
    creditValueBrlAtGeneration: input.creditValueBrlAtGeneration ?? null,
    sink: new NoopAiTelemetrySink(),
  });
}

export interface RecordFailureDiagnosisInput {
  /** Referência opaca JÁ emitida ao lojista (mesma ocorrência). */
  readonly reference: string;
  readonly category: string;
  readonly normalizedError: string;
  readonly model?: string;
  readonly quality?: string;
  readonly target?: ImageModelTarget;
  readonly attemptNumber?: number;
  readonly runId?: string;
  readonly traceId?: string;
}

/**
 * Persiste o diagnóstico durável correlacionado à referência opaca
 * (`toInternalDiagnosis` + repositório durável injetado). Best-effort: uma falha
 * de persistência NUNCA bloqueia o terminal público `IMG-001`. O
 * `normalized_error` é sempre reduzido ao conjunto FECHADO antes de persistir —
 * nenhum texto cru/chave/URL do provider é gravado.
 */
export async function recordFailureDiagnosis(
  recordDiagnosis: (input: ImageGenerationDiagnosisInput) => Promise<{ reference: string }>,
  input: RecordFailureDiagnosisInput,
): Promise<{ reference: string }> {
  const diagnosis: ImageGenerationDiagnosisInput = {
    internalCategory: input.category,
    model: input.model ?? "",
    quality: input.quality ?? "",
    target: input.target ?? "primary",
    attemptNumber: input.attemptNumber ?? 1,
    normalizedError: input.normalizedError,
    runId: input.runId,
    traceId: input.traceId,
  };
  try {
    return await recordDiagnosis(toInternalDiagnosis(diagnosis, input.reference));
  } catch {
    return { reference: input.reference };
  }
}
