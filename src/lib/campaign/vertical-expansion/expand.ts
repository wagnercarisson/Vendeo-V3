import "server-only";

/**
 * F60.3 — Entrada pública server-only do expansor 1:1 → 9:16.
 *
 * Fluxo (uma chamada paga no máximo): entrada validada → autorização →
 * `square_prepared` pela F60.1 → gate conservador do destino (linha + objeto) →
 * alvo do catálogo + pricing → UMA `images.edit` → classificação → validação por
 * conteúdo → exportação 1080×1920 → persistência `ai_expansion` → readback F60.1.
 *
 * Regras invioláveis:
 * - o resultado é calculado LOCALMENTE dentro do caminho protegido; o `finally`
 *   descarta o sinal, finaliza o desfecho e faz UM flush de telemetria;
 * - só depois do flush o `call` é reconstruído com o custo resolvido e o
 *   resultado é devolvido uma ÚNICA vez — nenhuma evidência sai congelada;
 * - `created` e `reused` da F60.1 convergem AMBOS para o readback; o readback é
 *   a única fonte de bytes/artefato do sucesso (inclusive na corrida pós-chamada);
 * - nenhum caminho escreve em campanhas, chama crédito/RPC, cria URL, baixa,
 *   entrega, apaga ou atualiza objeto.
 */

import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { AiModelCatalogRow } from "@/lib/ai/ai-model-catalog-service";
import type { ModelPricing } from "@/lib/ai-cost/ai-model-pricing";
import type { TokenUsage } from "@/lib/ai-cost/types";
import { AiInvocationError, type AiInvocationRequest } from "@/lib/ai/types";
import { verifyCampaignAccess } from "@/lib/campaign/composition-artifacts/access";
import { compositionArtifactStoragePath } from "@/lib/campaign/composition-artifacts/artifact-path";
import { persistCompositionArtifact } from "@/lib/campaign/composition-artifacts/persist";
import { getArtifactByIdentity } from "@/lib/campaign/composition-artifacts/repository";
import { retrieveCompositionArtifact } from "@/lib/campaign/composition-artifacts/retrieve";
import { CompositionArtifactStorage } from "@/lib/campaign/composition-artifacts/storage";
import type {
  ArtifactIdentity,
  PersistArtifactResult,
} from "@/lib/campaign/composition-artifacts/types";

import {
  classifyExpansionFailure,
  type ExpansionFailureClassification,
} from "./failure";
import {
  resolveExpansionPricing,
  resolveExpansionTarget,
  type ExpansionCatalogReader,
  type ExpansionPricingReader,
} from "./model";
import {
  exportVerticalJpeg,
  validateProviderImageBytes,
  type ExportVerticalJpegOutcome,
} from "./output";
import {
  DESTINATION_ROLE,
  EXPANSION_ORIGIN,
  EXPANSION_PROMPT_VERSION,
  EXPANSION_QUALITY,
  EXPANSION_SOURCE,
  PROVIDER_SIZE,
  parseExpandVerticalInput,
} from "./policy";
import { EXPANSION_PROMPT } from "./prompt";
import {
  createExpansionTelemetry,
  expansionOutcomeFor,
  type ExpansionTelemetryDetails,
} from "./telemetry";
import {
  createExpansionAbortSignal,
  createExpansionTransport,
  invokeExpansionOnce,
  type ExpansionInvoker,
  type ExpansionTransportTarget,
} from "./transport";
import type {
  ExpandVerticalInput,
  ExpandVerticalResult,
  ExpansionCallEvidence,
  ExpansionInvalidReason,
} from "./types";

export interface ExpandVerticalDeps {
  readonly client?: SupabaseClient;
  readonly clock?: () => number;
  /** Invoker do gateway (teste); o alvo/preparação continuam internos. */
  readonly invoker?: ExpansionInvoker;
  readonly catalog?: ExpansionCatalogReader;
  readonly pricing?: ExpansionPricingReader;
  readonly callIdFactory?: () => string;
  /** Costura de teste: falha de exportação. Default = pipeline vertical real. */
  readonly exportJpeg?: (bytes: Buffer) => Promise<ExportVerticalJpegOutcome>;
  /** Costura de teste: falha de persistência. Default = F60.1 real. */
  readonly persist?: typeof persistCompositionArtifact;
  /** Costura de teste: falha/ausência no readback. Default = F60.1 real. */
  readonly retrieve?: typeof retrieveCompositionArtifact;
}

type WithoutCall<T> = Omit<T, "call">;

type PendingOutcome =
  | WithoutCall<Extract<ExpandVerticalResult, { kind: "expanded" }>>
  | WithoutCall<Extract<ExpandVerticalResult, { kind: "reused" }>>
  | WithoutCall<Extract<ExpandVerticalResult, { kind: "provider_failure" }>>
  | WithoutCall<Extract<ExpandVerticalResult, { kind: "definitive_failure" }>>
  | WithoutCall<Extract<ExpandVerticalResult, { kind: "unknown_result" }>>
  | WithoutCall<Extract<ExpandVerticalResult, { kind: "invalid_output" }>>
  | WithoutCall<Extract<ExpandVerticalResult, { kind: "export_failed" }>>
  | WithoutCall<Extract<ExpandVerticalResult, { kind: "conflict" }>>
  | WithoutCall<Extract<ExpandVerticalResult, { kind: "persistence_failed" }>>
  | WithoutCall<Extract<ExpandVerticalResult, { kind: "readback_failed" }>>;

function invalidInput(reason: ExpansionInvalidReason): ExpandVerticalResult {
  return Object.freeze({ kind: "invalid_input" as const, reason });
}

function blocked(): ExpandVerticalResult {
  return Object.freeze({
    kind: "blocked" as const,
    reason: "pre_call_probe_indeterminate" as const,
    call: null,
  });
}

/** Materializa o resultado com a evidência da chamada já com custo resolvido. */
function materialize(
  pending: PendingOutcome,
  call: ExpansionCallEvidence,
): ExpandVerticalResult {
  switch (pending.kind) {
    case "expanded":
      return Object.freeze({ ...pending, call });
    case "reused":
      return Object.freeze({ ...pending, call });
    case "provider_failure":
      return Object.freeze({ ...pending, call });
    case "definitive_failure":
      return Object.freeze({ ...pending, call });
    case "unknown_result":
      return Object.freeze({ ...pending, call });
    case "invalid_output":
      return Object.freeze({ ...pending, call });
    case "export_failed":
      return Object.freeze({ ...pending, call });
    case "conflict":
      return Object.freeze({ ...pending, call });
    case "persistence_failed":
      return Object.freeze({ ...pending, call });
    case "readback_failed":
      return Object.freeze({ ...pending, call });
  }
}

function pendingFromClassification(
  classification: ExpansionFailureClassification,
): PendingOutcome {
  switch (classification.kind) {
    case "provider_failure":
      return Object.freeze({
        kind: "provider_failure" as const,
        failure: classification.failure,
      });
    case "definitive_failure":
      return Object.freeze({
        kind: "definitive_failure" as const,
        reason: classification.reason,
      });
    case "unknown_result":
      return Object.freeze({
        kind: "unknown_result" as const,
        reason: classification.reason,
        failure: classification.failure,
      });
  }
}

function describeFailure(classification: ExpansionFailureClassification): string {
  switch (classification.kind) {
    case "provider_failure":
      return classification.failure.reason;
    case "definitive_failure":
      return classification.reason;
    case "unknown_result":
      return classification.reason;
  }
}

/**
 * Traduz o desfecho não-sucesso da F60.1. `null` = `created`/`reused` (o
 * chamador precisa do readback antes de decidir).
 */
function pendingFromPersist(result: PersistArtifactResult): PendingOutcome | null {
  switch (result.kind) {
    case "created":
    case "reused":
      return null;
    case "content_conflict":
    case "identity_conflict":
    case "metadata_conflict":
    case "provenance_conflict":
      return Object.freeze({
        kind: "conflict" as const,
        reason: result.kind,
        detail: result.reason,
        existing: result.existing,
      });
    case "invalid_input":
      return Object.freeze({
        kind: "persistence_failed" as const,
        reason: "persistence_failure" as const,
        detail: result.reason,
      });
    case "integrity_failure":
      return Object.freeze({
        kind: "persistence_failed" as const,
        reason: "integrity_failure" as const,
        detail: result.reason,
      });
    case "persistence_failure":
      return Object.freeze({
        kind: "persistence_failed" as const,
        reason: "persistence_failure" as const,
        detail: result.reason,
        storagePath: result.storagePath,
      });
    case "indeterminate":
      return Object.freeze({
        kind: "persistence_failed" as const,
        reason: "persistence_failure" as const,
        detail: "indeterminate",
      });
  }
}

function dataUrl(bytes: Buffer): string {
  return `data:image/jpeg;base64,${bytes.toString("base64")}`;
}

function readReturnedSize(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Expande um `square_prepared` 1152×1152 em `vertical` JPEG 1080×1920, com no
 * máximo uma chamada paga. Única API pública do módulo.
 */
export async function expandVerticalToNineSixteen(
  input: ExpandVerticalInput,
  deps: ExpandVerticalDeps = {},
): Promise<ExpandVerticalResult> {
  // (1) Entrada — nenhum I/O antes da recusa.
  const parsed = parseExpandVerticalInput(input);
  if (!parsed.ok) return invalidInput(parsed.reason);
  const valid = parsed.input;

  const client = deps.client;
  const clock = deps.clock ?? (() => Date.now());
  const retrieve = deps.retrieve ?? retrieveCompositionArtifact;
  const persist = deps.persist ?? persistCompositionArtifact;
  const exportImage = deps.exportJpeg ?? exportVerticalJpeg;
  const authorization = valid.authorization;

  // (2) Autorização + vínculo loja↔campanha antes de qualquer leitura.
  const access = await verifyCampaignAccess(
    {
      storeId: valid.source.storeId,
      campaignId: valid.source.campaignId,
      authorization,
    },
    client,
  );
  if (!access.ok) {
    return Object.freeze({ kind: "authorization_denied" as const, reason: access.reason });
  }

  // (3) Fonte `square_prepared` exclusivamente pela F60.1.
  const sourceProbe = await retrieve(
    {
      identity: {
        storeId: valid.source.storeId,
        campaignId: valid.source.campaignId,
        operationId: valid.source.operationId,
        role: EXPANSION_SOURCE.role,
      },
      authorization,
    },
    { client },
  );

  if (sourceProbe.kind !== "integral") {
    if (sourceProbe.kind === "absent") {
      return Object.freeze({ kind: "source_unavailable" as const, reason: "absent" as const });
    }
    if (sourceProbe.kind === "invalid") {
      return Object.freeze({
        kind: "source_unavailable" as const,
        reason: "invalid" as const,
        detail: sourceProbe.reason,
      });
    }
    if (sourceProbe.kind === "metadata_conflict") {
      return Object.freeze({
        kind: "source_unavailable" as const,
        reason: "metadata_conflict" as const,
        detail: sourceProbe.reason,
      });
    }
    return Object.freeze({
      kind: "source_unavailable" as const,
      reason: "indeterminate" as const,
    });
  }

  const sourceArtifact = sourceProbe.artifact;
  if (
    sourceArtifact.role !== EXPANSION_SOURCE.role ||
    sourceArtifact.width !== EXPANSION_SOURCE.width ||
    sourceArtifact.height !== EXPANSION_SOURCE.height ||
    sourceArtifact.mimeType !== EXPANSION_SOURCE.mimeType
  ) {
    return Object.freeze({
      kind: "source_unavailable" as const,
      reason: "invalid" as const,
      detail: "role_policy_mismatch",
    });
  }
  const sourceBytes = sourceProbe.bytes;

  // (4) Gate conservador do destino (linha + objeto). Nenhum ramo chama provider.
  const destination: ArtifactIdentity = {
    storeId: valid.source.storeId,
    campaignId: valid.source.campaignId,
    operationId: valid.operationId,
    role: DESTINATION_ROLE,
  };

  const destinationRow = await getArtifactByIdentity(destination, client);
  if (destinationRow.kind === "read_failed") {
    return blocked();
  }

  if (destinationRow.kind === "found") {
    const probe = await retrieve({ identity: destination, authorization }, { client });
    if (probe.kind === "integral") {
      return Object.freeze({
        kind: "existing_artifact_conflict" as const,
        reason: "incompatible" as const,
        artifact: probe.artifact,
      });
    }
    if (probe.kind === "absent") {
      return Object.freeze({
        kind: "existing_artifact_conflict" as const,
        reason: "row_object_missing" as const,
        artifact: destinationRow.record,
      });
    }
    if (probe.kind === "metadata_conflict") {
      return Object.freeze({
        kind: "existing_artifact_conflict" as const,
        reason: "incompatible" as const,
        artifact: probe.artifact,
      });
    }
    if (probe.kind === "invalid") {
      return Object.freeze({
        kind: "existing_artifact_conflict" as const,
        reason: "object_invalid" as const,
        artifact: destinationRow.record,
      });
    }
    return Object.freeze({
      kind: "existing_artifact_conflict" as const,
      reason: "object_unverified" as const,
      artifact: destinationRow.record,
    });
  }

  const destinationStorage = new CompositionArtifactStorage(client);
  const destinationObject = await destinationStorage.readObjectInfo(
    compositionArtifactStoragePath(destination),
  );
  if (destinationObject.kind === "indeterminate") {
    return blocked();
  }
  if (destinationObject.kind === "found") {
    // Objeto presente (mesmo válido, sem evidência) bloqueia nesta wave.
    return Object.freeze({
      kind: "existing_artifact_conflict" as const,
      reason: "object_unverified" as const,
    });
  }

  // (5) Alvo do catálogo e pricing ANTES de qualquer chamada paga.
  const targetResolution = await resolveExpansionTarget({
    ...(deps.catalog === undefined ? {} : { catalog: deps.catalog }),
    ...(client === undefined ? {} : { client }),
  });
  if (!targetResolution.ok) {
    return Object.freeze({
      kind: "model_unavailable" as const,
      reason: targetResolution.reason,
      ...(targetResolution.detail === undefined
        ? {}
        : { detail: targetResolution.detail }),
    });
  }

  const pricingResolution = await resolveExpansionPricing(
    {
      provider: targetResolution.provider,
      model: targetResolution.model,
      quality: targetResolution.quality,
    },
    {
      ...(deps.pricing === undefined ? {} : { pricing: deps.pricing }),
      ...(client === undefined ? {} : { client }),
    },
  );
  if (!pricingResolution.ok) {
    return Object.freeze({
      kind: "pricing_unavailable" as const,
      reason: pricingResolution.reason,
      missing: pricingResolution.missing,
    });
  }

  const transportTarget: ExpansionTransportTarget = {
    provider: targetResolution.provider,
    model: targetResolution.model,
    protocol: targetResolution.protocol,
    quality: targetResolution.quality,
  };
  const transport = createExpansionTransport(transportTarget, {
    ...(deps.invoker === undefined ? {} : { invoker: deps.invoker }),
  });

  // (6) Correlação, telemetria bufferizada e prazo efetivo.
  const callId = (deps.callIdFactory ?? randomUUID)();
  const telemetryHandle = createExpansionTelemetry({
    operationId: valid.operationId,
    callId,
    attemptNumber: valid.attempt.number,
    attemptReference: valid.attempt.reference,
    storeId: valid.source.storeId,
    campaignId: valid.source.campaignId,
    ...(authorization.kind === "owner" ? { userId: authorization.userId } : {}),
    promptVersion: EXPANSION_PROMPT_VERSION,
    sourceArtifactId: sourceArtifact.id,
    provider: transportTarget.provider,
    model: transportTarget.model,
    quality: transportTarget.quality,
    pricingVersion: pricingResolution.versionId,
    tokenPricing: pricingResolution.pricing,
    imageUnitUsd: pricingResolution.imageUnitUsd,
  });

  const abortHandle = createExpansionAbortSignal(valid.timeoutMs, valid.signal);

  let pending: PendingOutcome | null = null;
  let returnedSize: string | null = null;
  let callStatus: ExpansionCallEvidence["callStatus"] = "failed";
  let errorType: string | undefined;
  let usage: TokenUsage | undefined;

  const startedAt = clock();

  try {
    let prepared: Awaited<ReturnType<typeof transport.prepare>> | null = null;
    try {
      prepared = await transport.prepare();
    } catch {
      prepared = null;
    }

    if (prepared === null) {
      // Defesa: falha de preparação nunca é chamada paga.
      pending = null;
    } else {
      const request: AiInvocationRequest = {
        prompt: EXPANSION_PROMPT,
        productImagesDataUrls: [dataUrl(sourceBytes)],
        size: PROVIDER_SIZE,
        quality: EXPANSION_QUALITY,
        signal: abortHandle.signal,
      };

      // (7) UMA chamada, sem laço e sem segunda tentativa.
      const once = await invokeExpansionOnce({
        invoker: transport.invoker,
        prepared,
        request,
        telemetry: telemetryHandle.telemetry,
      });

      if ("error" in once) {
        const classification = classifyExpansionFailure(once.error, once.sendEvidence);
        pending = pendingFromClassification(classification);
        errorType = describeFailure(classification);
        callStatus =
          once.error instanceof AiInvocationError && once.error.kind === "timeout"
            ? "timeout"
            : "failed";
      } else {
        callStatus = "success";
        usage = once.result.usage;
        returnedSize = readReturnedSize(once.result.metadata?.returnedSize);

        const imageBase64 = once.result.imageBase64 ?? "";

        if (imageBase64.length === 0) {
          // (8) Sem imagem: `usage` preservado (custo conhecido), saída inválida.
          pending = Object.freeze({
            kind: "invalid_output" as const,
            reason: "not_image" as const,
            returnedSize,
          });
        } else {
          const providerBytes = Buffer.from(imageBase64, "base64");

          // (9) Validação por conteúdo do retorno.
          const validation = await validateProviderImageBytes(providerBytes);

          if (!validation.ok) {
            returnedSize = validation.returnedSize;
            pending = Object.freeze({
              kind: "invalid_output" as const,
              reason: validation.reason,
              returnedSize: validation.returnedSize,
            });
          } else {
            returnedSize = validation.returnedSize;

            // (10) Exportação 1080×1920 pelo pipeline existente.
            const exported = await exportImage(providerBytes);

            if (!exported.ok) {
              pending = Object.freeze({
                kind: "export_failed" as const,
                reason: exported.reason,
              });
            } else {
              // (11) Persistência F60.1 — `created` e `reused` seguem AMBOS ao readback.
              const persisted = await persist(
                {
                  identity: destination,
                  authorization,
                  bytes: exported.buffer,
                  origin: EXPANSION_ORIGIN,
                  source: { kind: "internal_artifact", artifactId: sourceArtifact.id },
                },
                { client },
              );

              const persistedFailure = pendingFromPersist(persisted);
              if (persistedFailure !== null) {
                pending = persistedFailure;
              } else {
                const persistenceKind = persisted.kind;
                const adoption = persisted.kind === "reused" ? persisted.adoption : false;

                // (12) Readback: única fonte de bytes/artefato do sucesso.
                const readback = await retrieve(
                  { identity: destination, authorization },
                  { client },
                );

                if (readback.kind === "integral") {
                  if (persistenceKind === "created") {
                    pending = Object.freeze({
                      kind: "expanded" as const,
                      artifact: readback.artifact,
                      bytes: readback.bytes,
                      persistence: "created" as const,
                    });
                  } else {
                    pending = Object.freeze({
                      kind: "reused" as const,
                      artifact: readback.artifact,
                      bytes: readback.bytes,
                      adoption,
                    });
                  }
                } else if (readback.kind === "metadata_conflict") {
                  pending = Object.freeze({
                    kind: "readback_failed" as const,
                    reason: "metadata_conflict" as const,
                    detail: readback.reason,
                  });
                } else if (readback.kind === "invalid") {
                  pending = Object.freeze({
                    kind: "readback_failed" as const,
                    reason: "invalid" as const,
                    detail: readback.reason,
                  });
                } else if (readback.kind === "absent") {
                  pending = Object.freeze({
                    kind: "readback_failed" as const,
                    reason: "absent" as const,
                  });
                } else {
                  pending = Object.freeze({
                    kind: "readback_failed" as const,
                    reason: "indeterminate" as const,
                  });
                }
              }
            }
          }
        }
      }
    }
  } catch {
    // Exceção inesperada pós-chamada (costura de teste ou defeito real): falha
    // tipada, sem segunda chamada e sem deixar exceção escapar.
    pending = Object.freeze({
      kind: "persistence_failed" as const,
      reason: "persistence_failure" as const,
      detail: "unexpected_after_call",
    });
  } finally {
    abortHandle.dispose();
    try {
      const outcome: ExpansionTelemetryDetails["outcome"] =
        pending === null ? "unknown" : expansionOutcomeFor(pending.kind) ?? "unknown";
      telemetryHandle.finalize({
        outcome,
        returnedSize,
        durationMs: Math.max(0, clock() - startedAt),
        ...(errorType === undefined ? {} : { errorType }),
      });
    } catch {
      // finalize é síncrono e defensivo: nunca altera o resultado.
    }
    await telemetryHandle.flush();
  }

  if (pending === null) return blocked();

  // Saída ÚNICA: custo resolvido depois do flush, evidência reconstruída uma vez.
  const outcome =
    expansionOutcomeFor(pending.kind) ?? "unknown";

  const call: ExpansionCallEvidence = Object.freeze({
    callId,
    operationId: valid.operationId,
    attemptNumber: valid.attempt.number,
    attemptReference: valid.attempt.reference,
    provider: transportTarget.provider,
    model: transportTarget.model,
    protocol: "images" as const,
    quality: EXPANSION_QUALITY,
    requestedSize: PROVIDER_SIZE,
    returnedSize,
    durationMs: Math.max(0, clock() - startedAt),
    callStatus,
    outcome,
    ...(usage === undefined ? {} : { usage }),
    cost: telemetryHandle.resolvedCost() ?? {
      estimatedCostUsd: null,
      costSource: "not_available" as const,
    },
    ...(errorType === undefined ? {} : { errorType }),
  });

  return materialize(pending, call);
}
