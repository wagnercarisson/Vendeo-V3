import "server-only";

/**
 * F60.3 — Telemetria bufferizada da expansão por IA.
 *
 * O gateway emite EXATAMENTE um envelope por tentativa real. Este módulo
 * bufferiza esse envelope até o desfecho do expansor ser conhecido, decora
 * apenas os campos da allowlist `EXPANSION_TELEMETRY_FIELDS` e entrega o evento
 * ao sink padrão (custo/uso persistidos pelo mecanismo existente).
 *
 * Regras (T-60.3-13/T-60.3-14):
 * - `operationRunId = operationId` de destino e `traceId = callId` correlacionam
 *   a expansão com a base 1:1;
 * - nenhum campo sensível (prompt, bytes, chave, URL) entra em metadata;
 * - o desfecho (`expansionOutcome`) é resolvido NO FLUSH, nunca na emissão;
 * - `flush()` é único e protegido: falha é logada, não propaga, não altera o
 *   resultado e nunca emite evento compensatório;
 * - custo: `provider_reported` quando o envelope reporta; senão tokens reais ×
 *   tarifas congeladas (`pricing_table`); sem usage/tarifa ⇒ `not_available`
 *   com `estimatedCostUsd: null` (nunca zero).
 */

import { BufferingAiTelemetrySink, createDefaultTelemetryContext } from "@/lib/ai/telemetry-sink";
import type { AiCallEnvelope, AiEnvelopeInternalCost, AiTelemetryContext } from "@/lib/ai/types";
import type { CostResolution, UsageTokenPricing } from "@/lib/ai-cost/types";

import { EXPANSION_STAGE, PROVIDER_SIZE } from "./policy";
import type { ExpandVerticalResult, ExpansionCallEvidence } from "./types";

/** Campos permitidos em metadata do evento de expansão (nenhum sensível). */
export const EXPANSION_TELEMETRY_FIELDS = Object.freeze([
  "stage",
  "operationId",
  "callId",
  "attemptRef",
  "requestedSize",
  "returnedSize",
  "promptVersion",
  "sourceArtifactId",
  "expansionOutcome",
  "provider",
  "model",
  "quality",
] as const);

/**
 * Tabela EXPLÍCITA de desfecho: `kind` preciso do resultado → bucket grosseiro
 * de `ExpansionCallEvidence["outcome"]`. `null` = nenhuma evidência de chamada
 * (kinds pré-chamada, sem evento).
 */
export const EXPANSION_OUTCOME_BY_KIND: Readonly<
  Record<ExpandVerticalResult["kind"], ExpansionCallEvidence["outcome"] | null>
> = Object.freeze({
  expanded: "expanded",
  reused: "expanded",
  invalid_output: "invalid_output",
  export_failed: "invalid_output",
  provider_failure: "provider_failure",
  definitive_failure: "provider_failure",
  unknown_result: "unknown",
  conflict: "persistence_failed",
  persistence_failed: "persistence_failed",
  readback_failed: "persistence_failed",
  invalid_input: null,
  authorization_denied: null,
  source_unavailable: null,
  model_unavailable: null,
  pricing_unavailable: null,
  existing_artifact_conflict: null,
  blocked: null,
});

/**
 * Tradução total, pura e exaustiva do `kind` para o bucket de telemetria.
 * Kinds pré-chamada devolvem `null` explicitamente.
 */
export function expansionOutcomeFor(
  kind: ExpandVerticalResult["kind"],
): ExpansionCallEvidence["outcome"] | null {
  switch (kind) {
    case "expanded":
    case "reused":
      return "expanded";
    case "invalid_output":
    case "export_failed":
      return "invalid_output";
    case "provider_failure":
    case "definitive_failure":
      return "provider_failure";
    case "unknown_result":
      return "unknown";
    case "conflict":
    case "persistence_failed":
    case "readback_failed":
      return "persistence_failed";
    case "invalid_input":
    case "authorization_denied":
    case "source_unavailable":
    case "model_unavailable":
    case "pricing_unavailable":
    case "existing_artifact_conflict":
    case "blocked":
      return null;
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

export interface ExpansionTelemetryInput {
  readonly operationId: string;
  readonly callId: string;
  readonly attemptNumber: number;
  readonly attemptReference: string;
  readonly storeId: string;
  readonly campaignId: string;
  readonly userId?: string;
  readonly promptVersion: string;
  readonly sourceArtifactId: string;
  readonly provider: string;
  readonly model: string;
  readonly quality: "low";
  readonly pricingVersion: string;
  readonly tokenPricing: UsageTokenPricing;
  /** Estimativa pré-chamada (`image_unit`) usada apenas como teto/auditoria. */
  readonly imageUnitUsd: number;
}

export interface ExpansionTelemetryDetails {
  readonly outcome: ExpansionCallEvidence["outcome"];
  readonly returnedSize: string | null;
  readonly durationMs: number;
  readonly errorType?: string;
}

export interface ExpansionTelemetryHandle {
  readonly telemetry: AiTelemetryContext;
  bufferedEnvelopes(): number;
  finalize(details: ExpansionTelemetryDetails): void;
  resolvedCost(): CostResolution | null;
  flush(): Promise<void>;
}

const INTERNAL_COST_ORIGIN = "expansion_pair_pricing" as const;

function buildInternalCost(
  input: ExpansionTelemetryInput,
  envelope: AiCallEnvelope,
): AiEnvelopeInternalCost {
  const model = typeof envelope.model === "string" ? envelope.model : input.model;
  const quality =
    typeof envelope.quality === "string" ? envelope.quality : input.quality;

  return {
    estimatedCostUsd: input.imageUnitUsd,
    pricingVersion: input.pricingVersion,
    origin: INTERNAL_COST_ORIGIN,
    source: "pricing_table",
    model,
    quality,
    settlement: "usage_tokens",
    tokenPricing: input.tokenPricing,
  };
}

function decorateEnvelope(
  input: ExpansionTelemetryInput,
  details: ExpansionTelemetryDetails | null,
  envelope: AiCallEnvelope,
): AiCallEnvelope {
  const returnedSize =
    details === null ? null : details.returnedSize;
  const outcome = details === null ? null : details.outcome;

  return {
    ...envelope,
    metadata: {
      ...(envelope.metadata ?? {}),
      stage: EXPANSION_STAGE,
      operationId: input.operationId,
      callId: input.callId,
      attemptRef: input.attemptReference,
      requestedSize: PROVIDER_SIZE,
      returnedSize,
      promptVersion: input.promptVersion,
      sourceArtifactId: input.sourceArtifactId,
      expansionOutcome: outcome,
      provider: input.provider,
      model: typeof envelope.model === "string" ? envelope.model : input.model,
      quality:
        typeof envelope.quality === "string" ? envelope.quality : input.quality,
    },
  };
}

/** Cria o handle de telemetria de UMA chamada real. */
export function createExpansionTelemetry(
  input: ExpansionTelemetryInput,
): ExpansionTelemetryHandle {
  let details: ExpansionTelemetryDetails | null = null;
  let resolved: CostResolution | null = null;

  const buffering = new BufferingAiTelemetrySink(async (envelopes) => {
    for (const envelope of envelopes) {
      // Custo REPORTADO pelo provider usa a cadeia existente
      // (`provider_reported`); fora isso, o custo interno por tokens é usado.
      const internalCost =
        envelope.providerReportedCostUsd == null
          ? buildInternalCost(input, envelope)
          : undefined;

      const context = createDefaultTelemetryContext({
        operationRunId: input.operationId,
        operationRunType: "campaign_delivery",
        traceId: input.callId,
        storeId: input.storeId,
        campaignId: input.campaignId,
        ...(input.userId === undefined ? {} : { userId: input.userId }),
        attemptNumber: input.attemptNumber,
        onCostResolved: (cost) => {
          resolved = cost;
        },
        ...(internalCost === undefined ? {} : { internalCost }),
      });

      await context.sink.emit(decorateEnvelope(input, details, envelope));
    }
  });

  const telemetry = createDefaultTelemetryContext({
    operationRunId: input.operationId,
    operationRunType: "campaign_delivery",
    traceId: input.callId,
    storeId: input.storeId,
    campaignId: input.campaignId,
    ...(input.userId === undefined ? {} : { userId: input.userId }),
    attemptNumber: input.attemptNumber,
    sink: buffering,
  });

  return {
    telemetry,
    bufferedEnvelopes: () => buffering.pending.length,
    finalize: (finalDetails) => {
      details = finalDetails;
    },
    resolvedCost: () => resolved,
    flush: async () => {
      try {
        await buffering.flush();
      } catch (error) {
        // Best-effort: falha do flush nunca propaga e nunca gera evento extra.
        console.error(
          "[vertical-expansion] flush de telemetria falhou (best-effort):",
          error instanceof Error ? error.message : String(error),
        );
      }
    },
  };
}
