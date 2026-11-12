import "server-only";

/**
 * F60.4 — Telemetria bufferizada da base quadrada.
 *
 * O gateway emite EXATAMENTE um envelope por chamada real. Este módulo
 * bufferiza esse envelope até o desfecho da base ser conhecido, decora apenas os
 * campos da allowlist `SQUARE_BASE_TELEMETRY_FIELDS` e entrega o evento ao sink
 * ÚNICO (`DefaultAiTelemetrySink`) — nenhuma escrita direta de eventos e nenhum
 * sink paralelo.
 *
 * Regras (design D9 / T-60.4-19):
 * - `operationRunId = operationId` da operação e `traceId = callId` correlacionam
 *   a base com a expansão F60.3 (mesmo `operation_run_id`);
 * - `usdBrlRateAtGeneration` é OBRIGATÓRIO no input do módulo e
 *   `creditValueBrlAtGeneration` é repassado quando fornecido (inclusive `null`
 *   explícito) ao `createDefaultTelemetryContext`;
 * - custo interno resolvido pelo par congelado (`defaultResolveAttemptCost` +
 *   `attemptCostForTarget`) SOMENTE quando o envelope não reporta custo; o custo
 *   resolvido é capturado por `onCostResolved` sem uma segunda apuração;
 * - custo desconhecido é `estimatedCostUsd: null` + `costSource: "not_available"`,
 *   nunca zero;
 * - `flush()` é idempotente e best-effort: nunca altera o resultado, nunca lança
 *   e nunca dispara nova chamada. Um envelope que chega DEPOIS do flush é
 *   entregue UMA vez diretamente ao sink base (nunca abandonado/re-bufferizado).
 */

import {
  BufferingAiTelemetrySink,
  createDefaultTelemetryContext,
} from "@/lib/ai/telemetry-sink";
import type {
  AiCallEnvelope,
  AiEnvelopeInternalCost,
  AiTelemetryContext,
  AiTelemetrySink,
} from "@/lib/ai/types";
import type { ImageModelPairConfig } from "@/lib/ai/image-model-pair";
import type { CostResolution } from "@/lib/ai-cost/types";
import type { ImagePairCostResolution } from "@/lib/ai-cost/image-pair-pricing";
import {
  attemptCostForTarget,
  defaultResolveAttemptCost,
} from "@/lib/product-1-1/orchestration/instrumentation";

import { PROVIDER_SIZE, SQUARE_BASE_PROVIDER } from "./policy";
import type {
  SquareBaseCallEvidence,
  SquareBaseResult,
  SquareBaseTarget,
} from "./types";

/** Campos permitidos em metadata do evento da base (nenhum sensível). */
export const SQUARE_BASE_TELEMETRY_FIELDS = Object.freeze([
  "stage",
  "operationId",
  "callId",
  "attemptRef",
  "attemptNumber",
  "requestedSize",
  "squareOutcome",
  "provider",
  "model",
  "quality",
] as const);

/**
 * Tabela EXPLÍCITA de desfecho: `kind` preciso do resultado → bucket grosseiro de
 * `SquareBaseCallEvidence["outcome"]`. `null` = nenhuma evidência de chamada
 * (kinds pré-chamada, sem envelope).
 *
 * `snapshot_failed` acontece antes de qualquer chamada paga (preflight/snapshot/
 * reserva) e, como os demais kinds pré-chamada, não emite envelope. Já
 * `existing_artifact_conflict` pode ocorrer DEPOIS da chamada (conflito na
 * persistência F60.1), por isso mapeia para o bucket de persistência.
 */
export const SQUARE_BASE_OUTCOME_BY_KIND: Readonly<
  Record<SquareBaseResult["kind"], SquareBaseCallEvidence["outcome"] | null>
> = Object.freeze({
  completed: "generated",
  provider_failure: "provider_failure",
  definitive_failure: "definitive_failure",
  unknown_result: "unknown",
  invalid_output: "invalid_output",
  existing_artifact_conflict: "persistence_failed",
  persistence_failed: "persistence_failed",
  readback_failed: "readback_failed",
  snapshot_failed: null,
  content_divergence: null,
  frozen_state_conflict: null,
  blocked: null,
  invalid_input: null,
  authorization_denied: null,
});

/**
 * Tradução total, pura e exaustiva do `kind` para o bucket de telemetria.
 * Kinds pré-chamada devolvem `null` explicitamente.
 */
export function squareBaseOutcomeFor(
  kind: SquareBaseResult["kind"],
): SquareBaseCallEvidence["outcome"] | null {
  switch (kind) {
    case "completed":
      return "generated";
    case "provider_failure":
      return "provider_failure";
    case "definitive_failure":
      return "definitive_failure";
    case "unknown_result":
      return "unknown";
    case "invalid_output":
      return "invalid_output";
    case "existing_artifact_conflict":
    case "persistence_failed":
      return "persistence_failed";
    case "readback_failed":
      return "readback_failed";
    case "snapshot_failed":
    case "content_divergence":
    case "frozen_state_conflict":
    case "blocked":
    case "invalid_input":
    case "authorization_denied":
      return null;
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

export interface SquareBaseTelemetryInput {
  readonly operationId: string;
  readonly callId: string;
  readonly attemptNumber: number;
  /** Referência opaca da tentativa F60 (correlação na metadata). */
  readonly attemptReference: string;
  readonly storeId: string;
  readonly campaignId: string;
  /** Par congelado da operação (pricing do custo interno). */
  readonly pair: ImageModelPairConfig;
  /** Alvo explícito da tentativa (seleciona o custo do par). */
  readonly target: SquareBaseTarget;
  /** Snapshot econômico OBRIGATÓRIO do run (pode ser `null` explícito). */
  readonly usdBrlRateAtGeneration: number | null;
  /** Snapshot estimativo do crédito; quando fornecido, é propagado exatamente. */
  readonly creditValueBrlAtGeneration?: number | null;
}

export interface SquareBaseTelemetryDeps {
  /** Resolvedor do custo interno (teste injeta um fake; default = pricing real). */
  readonly resolveCost?: (pair: ImageModelPairConfig) => Promise<ImagePairCostResolution>;
}

export interface SquareBaseTelemetryDetails {
  readonly outcome: SquareBaseCallEvidence["outcome"];
  readonly durationMs: number;
  readonly errorType?: string;
}

export interface SquareBaseTelemetryHandle {
  readonly context: AiTelemetryContext;
  /** Envelopes ainda no buffer (0 após o flush; nunca conta o envelope tardio). */
  bufferedEnvelopes(): number;
  finalize(details: SquareBaseTelemetryDetails): void;
  resolvedCost(): CostResolution | null;
  flush(): Promise<void>;
}

const INTERNAL_COST_ORIGIN = "new_flow_pair_pricing" as const;

function pairForTarget(
  input: SquareBaseTelemetryInput,
): ImageModelPairConfig["primary"] {
  return input.target === "fallback" ? input.pair.fallback : input.pair.primary;
}

async function buildInternalCost(
  input: SquareBaseTelemetryInput,
  envelope: AiCallEnvelope,
  resolveCost: (pair: ImageModelPairConfig) => Promise<ImagePairCostResolution>,
): Promise<AiEnvelopeInternalCost | undefined> {
  // Custo REPORTADO pelo provider vence a cadeia existente (`provider_reported`).
  if (envelope.providerReportedCostUsd != null) return undefined;

  const resolution = await resolveCost(input.pair);
  const cost = attemptCostForTarget(resolution, input.target);

  return {
    estimatedCostUsd: cost.costUsd,
    pricingVersion: cost.versionId,
    origin: INTERNAL_COST_ORIGIN,
    source: cost.costSource,
    model: cost.model,
    quality: cost.quality,
    settlement: "usage_tokens",
    ...(cost.pricing === undefined ? {} : { tokenPricing: cost.pricing }),
  };
}

function decorateEnvelope(
  input: SquareBaseTelemetryInput,
  details: SquareBaseTelemetryDetails | null,
  envelope: AiCallEnvelope,
): AiCallEnvelope {
  const targetPair = pairForTarget(input);
  return {
    ...envelope,
    metadata: {
      ...(envelope.metadata ?? {}),
      stage: "square_base",
      operationId: input.operationId,
      callId: input.callId,
      attemptRef: input.attemptReference,
      attemptNumber: input.attemptNumber,
      requestedSize: PROVIDER_SIZE,
      squareOutcome: details === null ? null : details.outcome,
      provider: SQUARE_BASE_PROVIDER,
      model: typeof envelope.model === "string" ? envelope.model : targetPair.model,
      quality:
        typeof envelope.quality === "string" ? envelope.quality : targetPair.quality,
    },
  };
}

async function emitEnvelope(
  input: SquareBaseTelemetryInput,
  details: SquareBaseTelemetryDetails | null,
  envelope: AiCallEnvelope,
  resolveCost: (pair: ImageModelPairConfig) => Promise<ImagePairCostResolution>,
  onCostResolved: (cost: CostResolution) => void,
): Promise<void> {
  const internalCost = await buildInternalCost(input, envelope, resolveCost);

  const context = createDefaultTelemetryContext({
    operationRunId: input.operationId,
    operationRunType: "campaign_delivery",
    traceId: input.callId,
    storeId: input.storeId,
    campaignId: input.campaignId,
    attemptNumber: input.attemptNumber,
    usdBrlRateAtGeneration: input.usdBrlRateAtGeneration,
    ...(input.creditValueBrlAtGeneration === undefined
      ? {}
      : { creditValueBrlAtGeneration: input.creditValueBrlAtGeneration }),
    onCostResolved,
    ...(internalCost === undefined ? {} : { internalCost }),
  });

  await context.sink.emit(decorateEnvelope(input, details, envelope));
}

/** Cria o handle de telemetria de UMA chamada real (bufferiza até o flush). */
export function createSquareBaseTelemetry(
  input: SquareBaseTelemetryInput,
  deps: SquareBaseTelemetryDeps = {},
): SquareBaseTelemetryHandle {
  const resolveCost = deps.resolveCost ?? defaultResolveAttemptCost;
  let details: SquareBaseTelemetryDetails | null = null;
  let resolved: CostResolution | null = null;
  let flushed = false;

  const onCostResolved = (cost: CostResolution): void => {
    resolved = cost;
  };

  const buffering = new BufferingAiTelemetrySink(async (envelopes) => {
    for (const envelope of envelopes) {
      await emitEnvelope(input, details, envelope, resolveCost, onCostResolved);
    }
  });

  const sink: AiTelemetrySink = {
    emit(envelope) {
      if (!flushed) {
        buffering.emit(envelope);
        return;
      }
      // Envelope TARDIO (chegou após o flush): entregue UMA vez ao sink base,
      // best-effort, sem re-bufferizar e sem abandonar no buffer.
      return emitEnvelope(input, details, envelope, resolveCost, onCostResolved).catch(
        (error: unknown) => {
          console.error(
            "[square-base] telemetria tardia falhou (best-effort):",
            error instanceof Error ? error.message : String(error),
          );
        },
      );
    },
  };

  const context = createDefaultTelemetryContext({
    operationRunId: input.operationId,
    operationRunType: "campaign_delivery",
    traceId: input.callId,
    storeId: input.storeId,
    campaignId: input.campaignId,
    attemptNumber: input.attemptNumber,
    usdBrlRateAtGeneration: input.usdBrlRateAtGeneration,
    ...(input.creditValueBrlAtGeneration === undefined
      ? {}
      : { creditValueBrlAtGeneration: input.creditValueBrlAtGeneration }),
    sink,
  });

  return {
    context,
    bufferedEnvelopes: () => buffering.pending.length,
    finalize: (nextDetails) => {
      details = nextDetails;
    },
    resolvedCost: () => resolved,
    flush: async () => {
      if (flushed) return;
      flushed = true;
      try {
        await buffering.flush();
      } catch (error) {
        // Best-effort: falha do flush nunca propaga e nunca gera evento extra.
        console.error(
          "[square-base] flush de telemetria falhou (best-effort):",
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  };
}
