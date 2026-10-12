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
import { createDefaultTelemetryContext } from "@/lib/ai/telemetry-sink";
import {
  toInternalDiagnosis,
  type ImageGenerationDiagnosisInput,
} from "@/lib/ai/image-generation-support-reference";
import type { AiTelemetryContext } from "@/lib/ai/types";

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
  readonly runId?: string;
  readonly traceId?: string;
}

export interface EmitAttemptEnvelopeInput {
  readonly snapshot: ImageGenerationConfigSnapshot;
  readonly attemptNumber: number;
  readonly target: ImageModelTarget;
  readonly result: AttemptEnvelopeResult;
  readonly internalCostUsd?: number | null;
  readonly runId?: string;
  readonly traceId?: string;
}

/** Destino observável do envelope por tentativa (injetável; default no-op). */
export interface AttemptEnvelopeSink {
  emit(envelope: AttemptEnvelope): void | Promise<void>;
}

/**
 * Constrói (e opcionalmente emite) UM envelope da tentativa real. O par
 * modelo–qualidade é reconstruído do snapshot congelado pelo alvo
 * (`resolveSnapshotPairForTarget`) — nunca de um valor do cliente.
 */
export function emitAttemptEnvelope(
  input: EmitAttemptEnvelopeInput,
  sink?: AttemptEnvelopeSink,
): AttemptEnvelope {
  const pair = resolveSnapshotPairForTarget(input.snapshot, input.target);
  const envelope: AttemptEnvelope = Object.freeze({
    attemptNumber: input.attemptNumber,
    target: input.target,
    model: pair.model,
    quality: pair.quality,
    result: input.result,
    internalCostUsd:
      typeof input.internalCostUsd === "number" ? input.internalCostUsd : null,
    ...(input.runId !== undefined ? { runId: input.runId } : {}),
    ...(input.traceId !== undefined ? { traceId: input.traceId } : {}),
  });
  void sink?.emit(envelope);
  return envelope;
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
  /** Recebe o custo interno resolvido pela cadeia EXISTENTE (por tentativa). */
  readonly onInternalCostResolved?: (costUsd: number | null) => void;
}

/**
 * Contexto de telemetria por tentativa usando o caminho EXISTENTE
 * (`createDefaultTelemetryContext` + `DefaultAiTelemetrySink` → `resolveAiCost`
 * + `AiCostTracker`). A cadeia de resolução de custo legada NÃO é alterada; o
 * custo resolvido é apenas exposto ao chamador (interno, sem cobrança).
 */
export function buildAttemptTelemetry(input: AttemptTelemetryInput): AiTelemetryContext {
  return createDefaultTelemetryContext({
    operationRunId: input.operationRunId,
    operationRunType: "campaign_delivery",
    traceId: input.traceId,
    storeId: input.storeId,
    campaignId: input.campaignId,
    attemptNumber: input.attemptNumber,
    onCostResolved: (cost) => {
      input.onInternalCostResolved?.(
        typeof cost.estimatedCostUsd === "number" ? cost.estimatedCostUsd : null,
      );
    },
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
