import "server-only";

import {
  correlateSnapshotWithTelemetry,
  type CorrelatedImageGenerationAttempt,
  type ImageGenerationConfigSnapshot,
  type ImageGenerationTelemetryAttempt,
  type ImageModelTarget,
} from "@/lib/ai/image-generation-config-snapshot";
import type { ImageModelPairConfig } from "@/lib/ai/image-model-pair";
import { createDefaultTelemetryContext } from "@/lib/ai/telemetry-sink";
import {
  toInternalDiagnosis,
  type ImageGenerationDiagnosisInput,
} from "@/lib/ai/image-generation-support-reference";
import {
  resolveImagePairCost,
  type ImagePairAttemptCost,
  type ImagePairCostResolution,
} from "@/lib/ai-cost/image-pair-pricing";
import type { AiCallEnvelope, AiEnvelopeInternalCost, AiTelemetryContext } from "@/lib/ai/types";

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

/** Resultado de uma tentativa real no envelope de telemetria do gateway. */
export type AttemptEnvelopeResult = "success" | "failed" | "timeout";

/**
 * Categoria INTERNA de falha CONFIRMADA (distinta do resultado desconhecido) —
 * persistida no diagnóstico durável; nunca exposta ao lojista.
 */
export const CONFIRMED_FAILURE_INTERNAL_CATEGORY = "generation_failed" as const;

/** Categoria INTERNA de resultado DESCONHECIDO (timeout/abort/perda). */
export const UNKNOWN_RESULT_INTERNAL_CATEGORY = "generation_unknown" as const;

/**
 * F56.2b1b (P1 — Opção A) — o NOVO FLUXO **NÃO reconstrói** o envelope de
 * telemetria. O `AiGateway` já emite **exatamente UM envelope REAL por tentativa**
 * (usage/durationMs/status/model/quality/alvo/attempt_number reais); o novo fluxo
 * o persiste via o **sink ÚNICO** da camada de IA (`DefaultAiTelemetrySink`, que
 * faz `AiCostTracker.record` DENTRO da fronteira `src/lib/ai/**` — o orquestrador
 * NUNCA escreve `generation_events` diretamente, gate F46-06). O custo interno do
 * par (`modelo + qualidade` + versão/origem) é entregue ao sink como
 * `AiTelemetrySinkContext.internalCost` (origem `pricing_table`, NUNCA
 * `provider_reported`). Resultado: **1 envelope do gateway ⇒ 1 registro**, com
 * `duration_ms`/`usage` reais.
 */

/**
 * Reconstrói a sequência de tentativas da operação correlacionando o snapshot
 * congelado à telemetria do gateway (`correlateSnapshotWithTelemetry`): apenas as
 * tentativas da MESMA operação entram e cada uma recebe o par modelo–qualidade do
 * seu alvo — principal × fallback ficam distinguíveis.
 *
 * Os envelopes do gateway NÃO carregam `runId`/`traceId` (não fazem parte do
 * contrato de telemetria de wire); a correlação usa a identidade do PRÓPRIO
 * snapshot observado (mesma operação), preservando o fail-closed de
 * `matchesSnapshotReference`.
 */
export function reconstructAttemptSequence(
  snapshot: ImageGenerationConfigSnapshot,
  envelopes: ReadonlyArray<AiCallEnvelope>,
): CorrelatedImageGenerationAttempt[] {
  const attempts: ImageGenerationTelemetryAttempt[] = envelopes.map((envelope) => ({
    attemptNumber: envelope.attemptNumber ?? 1,
    target: (envelope.target ?? "primary") as ImageModelTarget,
    runId: snapshot.runId,
    traceId: snapshot.traceId,
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
  /**
   * P1 (Opção A) — custo INTERNO do NOVO FLUXO (modelo+qualidade+versão+origem)
   * resolvido pela pricing do par. Entra no CONTEXTO do `DefaultAiTelemetrySink`
   * (origem `pricing_table`, NUNCA `provider_reported`); validado contra o
   * envelope REAL. Ausente ⇒ cadeia legada intacta.
   */
  readonly internalCost?: AiEnvelopeInternalCost;
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
 * P1 (Opção A) — contexto de telemetria por tentativa do novo fluxo. Usa o
 * **sink ÚNICO** (`DefaultAiTelemetrySink`, sink padrão do
 * `createDefaultTelemetryContext`): o envelope REAL do gateway É persistido LÁ
 * (`AiCostTracker.record` dentro de `src/lib/ai/**`, gate F46-06) — SEM
 * reconstrução zero-duration e SEM duplicar registros. O custo interno do par
 * (`modelo + qualidade` + versão/origem) vai no contexto como `internalCost`
 * (origem `pricing_table`, NUNCA `provider_reported`); a cadeia legada de
 * `resolveAiCost` permanece INTACTA para os consumidores do fluxo legado.
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
    // P1 (Opção A): custo interno do NOVO FLUXO (origem pricing_table).
    ...(input.internalCost ? { internalCost: input.internalCost } : {}),
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
