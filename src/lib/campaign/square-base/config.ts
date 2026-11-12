import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  assertEligibleModelPair,
  type ImageModelPair,
  type ImageModelPairConfig,
} from "@/lib/ai/image-model-pair";
import type { CurrentImageGenerationConfig, ImageGenerationConfigSnapshot } from "@/lib/ai/image-generation-config-snapshot";
import { assertImagePairExecutable } from "@/lib/ai-cost/image-pair-pricing";
import {
  deadlineAt,
  canStartDurableWrite,
  PRODUCT_1_1_GENERATION_DEADLINE_MS,
} from "@/lib/product-1-1/orchestration/deadline";
import {
  runNewFlowPreflight,
  type NewFlowPreflightResult,
} from "@/lib/product-1-1/orchestration/preflight";
import type { BuildProductOneToOneSnapshotContext } from "@/lib/product-1-1/snapshot/persist-snapshot";
import {
  ProductOneToOneSnapshotPersistError,
  buildProductOneToOneFrozenEvidence,
  buildProductOneToOneSnapshot,
  persistProductOneToOneSnapshot,
  type PersistProductOneToOneSnapshotResult,
  type ProductOneToOneEvidenceReference,
  type ProductOneToOneFrozenEvidence,
} from "@/lib/product-1-1/snapshot/persist-snapshot";
import type { ProductPromptComposition } from "@/lib/product-1-1/prompt-composition";
import { supabaseAdmin } from "@/lib/supabase/server";

import {
  deriveReferenceSelections,
  serializeFrozenPayload,
} from "./frozen-state";
import {
  composeSquareBasePrompt,
  type SquareBasePromptContent,
  type SquareBasePromptDeps,
} from "./prompt";
import type {
  ContentDivergenceReason,
  FrozenContentComparison,
  FrozenContentPayload,
  FrozenSnapshotRecord,
  FrozenStateReadResult,
  SnapshotFailedReason,
  SquareBaseInput,
} from "./types";

/**
 * F60.4 — Configuração congelada da base quadrada.
 *
 * Primeira composição (campanha sem snapshot): resolve a configuração vigente
 * UMA vez (preflight), compõe/congela o conteúdo e persiste
 * snapshot + binding + evidência ANTES de qualquer chamada paga.
 *
 * Retomada: NÃO resolve a configuração atual — usa o snapshot e o conteúdo
 * congelados e valida apenas elegibilidade/pricing do par congelado.
 *
 * Reparo: somente para `repairable` com comparação equivalente, reutilizando
 * `persistProductOneToOneSnapshot` para o MESMO snapshot. Nenhuma função aqui
 * reserva crédito, escreve na tabela de campanha ou chama provider.
 */

const SNAPSHOT_FAILURE_REASONS: readonly SnapshotFailedReason[] = Object.freeze([
  "snapshot_persist_failed",
  "snapshot_read_failed",
  "evidence_read_failed",
  "operation_identity_conflict",
  "frozen_evidence_persist_failed",
  "persistence_reserve_reached",
]);

/** Dependências injetáveis (teste/integração), todas opcionais. */
export interface SquareBaseConfigDeps {
  readonly client?: SupabaseClient;
  readonly clock?: () => number;
  /** Orçamento do chamador; default = deadline interno do fluxo 1:1. */
  readonly deadlineMs?: number;
  readonly runPreflight?: (input: {
    readonly campaignId: string;
  }) => Promise<NewFlowPreflightResult>;
  readonly buildSnapshot?: (
    config: CurrentImageGenerationConfig,
    context: BuildProductOneToOneSnapshotContext,
  ) => ImageGenerationConfigSnapshot;
  readonly persistSnapshot?: (
    snapshot: ImageGenerationConfigSnapshot,
    evidence: ProductOneToOneFrozenEvidence,
  ) => Promise<PersistProductOneToOneSnapshotResult>;
  readonly composePrompt?: (
    content: SquareBasePromptContent,
    deps?: SquareBasePromptDeps,
  ) => ProductPromptComposition;
  /** Substituição de base APENAS em teste/integração (nunca no contrato público). */
  readonly promptBase?: string;
  readonly assertEligiblePair?: (pair: ImageModelPair) => void;
  readonly assertExecutable?: (pair: ImageModelPairConfig) => Promise<unknown>;
}

export type FirstCompositionResult =
  | {
      readonly ok: true;
      readonly snapshot: ImageGenerationConfigSnapshot;
      readonly evidence: ProductOneToOneFrozenEvidence;
      readonly snapshotOriginalId: string;
      readonly frozenPayload: FrozenContentPayload;
      readonly composition: ProductPromptComposition;
    }
  | {
      readonly ok: false;
      readonly reason: "preflight_failed" | SnapshotFailedReason;
    };

export type ResumeConfigResult =
  | {
      readonly ok: true;
      readonly snapshot: FrozenSnapshotRecord;
      readonly pair: ImageModelPairConfig;
    }
  | { readonly ok: false; readonly reason: "preflight_failed" };

export type RepairFrozenEvidenceResult =
  | {
      readonly ok: true;
      readonly snapshotOriginalId: string;
      readonly reused: boolean;
    }
  | {
      readonly ok: false;
      readonly reason: "content_divergence";
      readonly divergence?: ContentDivergenceReason;
    }
  | { readonly ok: false; readonly reason: SnapshotFailedReason };

/** Par modelo/qualidade do snapshot congelado (retomada). */
export function imagePairFromSnapshot(
  snapshot: Pick<
    FrozenSnapshotRecord,
    "primaryModel" | "primaryQuality" | "fallbackModel" | "fallbackQuality"
  >,
): ImageModelPairConfig {
  return {
    primary: {
      model: snapshot.primaryModel,
      quality: snapshot.primaryQuality,
    },
    fallback: {
      model: snapshot.fallbackModel,
      quality: snapshot.fallbackQuality,
    },
  };
}

function snapshotFailureReason(error: unknown): SnapshotFailedReason {
  if (error instanceof ProductOneToOneSnapshotPersistError) {
    return SNAPSHOT_FAILURE_REASONS.includes(error.code)
      ? error.code
      : "snapshot_persist_failed";
  }
  return "snapshot_persist_failed";
}

function freezeSelections(
  input: SquareBaseInput,
): readonly ProductOneToOneEvidenceReference[] {
  if (input.referenceSelections !== undefined) {
    return Object.freeze(
      input.referenceSelections.map((selection, index) =>
        Object.freeze({ ...selection, index: selection.index ?? index }),
      ),
    );
  }
  return deriveReferenceSelections(
    input.productImagesDataUrls,
    input.identityImageUrl,
  );
}

function toConfigSnapshot(
  record: FrozenSnapshotRecord,
): ImageGenerationConfigSnapshot {
  return {
    campaignId: record.campaignId,
    primaryModel: record.primaryModel,
    primaryQuality: record.primaryQuality,
    fallbackModel: record.fallbackModel,
    fallbackQuality: record.fallbackQuality,
    configVersionId: record.configVersionId,
    origin: record.origin,
    ...(record.runId === null ? {} : { runId: record.runId }),
    ...(record.traceId === null ? {} : { traceId: record.traceId }),
    createdAt: record.createdAt,
  };
}

/**
 * Primeira composição: preflight (uma vez) → congelar conteúdo → compor prompt →
 * serializar canonicamente → snapshot + evidência → reserva de escrita →
 * persistir snapshot/binding/evidência. Falhas de preflight/elegibilidade/pricing
 * viram `preflight_failed` (nunca exceção); falhas de persistência preservam o
 * código tipado; a reserva de persistência é devolvida ANTES de qualquer escrita.
 */
export async function resolveFirstComposition(
  input: SquareBaseInput,
  deps: SquareBaseConfigDeps = {},
): Promise<FirstCompositionResult> {
  const client = deps.client ?? (supabaseAdmin as unknown as SupabaseClient);
  const clock = deps.clock ?? (() => Date.now());
  const deadlineAtMs = deadlineAt(
    clock(),
    deps.deadlineMs ?? PRODUCT_1_1_GENERATION_DEADLINE_MS,
  );

  let preflight: NewFlowPreflightResult | null = null;
  let snapshot: ImageGenerationConfigSnapshot | null = null;
  let composition: ProductPromptComposition | null = null;
  let frozenPayload: FrozenContentPayload | null = null;

  try {
    const runPreflight =
      deps.runPreflight ??
      ((preflightInput: { readonly campaignId: string }) =>
        runNewFlowPreflight({ campaignId: preflightInput.campaignId }));

    preflight = await runPreflight({ campaignId: input.campaignId });

    const referenceSelections = freezeSelections(input);
    const content: SquareBasePromptContent = {
      briefing: input.briefing,
      identityDirective: input.identityDirective ?? null,
      referenceSelections,
      ...(input.references === undefined ? {} : { references: input.references }),
    };

    const compose = deps.composePrompt ?? composeSquareBasePrompt;
    composition = compose(
      content,
      deps.promptBase === undefined ? {} : { promptBase: deps.promptBase },
    );

    frozenPayload = Object.freeze({
      briefing: input.briefing,
      copyContext: input.copyContext ?? null,
      identityDirective: input.identityDirective ?? null,
      campaignIntent: input.campaignIntent,
      backgroundDirection: input.backgroundDirection,
      referenceSelections,
      ...(input.references === undefined ? {} : { references: input.references }),
      promptBaseVersion: composition.promptBaseVersion,
      composerVersion: composition.composerVersion,
      policyVersions: composition.policyVersions,
    });

    const buildSnapshot = deps.buildSnapshot ?? buildProductOneToOneSnapshot;
    snapshot = buildSnapshot(preflight.config, {
      campaignId: input.campaignId,
      ...(input.runId === undefined ? {} : { runId: input.runId }),
      ...(input.traceId === undefined ? {} : { traceId: input.traceId }),
    });
  } catch {
    return Object.freeze({ ok: false as const, reason: "preflight_failed" as const });
  }

  if (!preflight || !snapshot || !composition || !frozenPayload) {
    return Object.freeze({ ok: false as const, reason: "preflight_failed" as const });
  }

  const serialized = serializeFrozenPayload(frozenPayload);
  const evidence = buildProductOneToOneFrozenEvidence({
    campaignId: input.campaignId,
    operationId: input.operationId,
    campaignIntent: input.campaignIntent,
    backgroundDirection: input.backgroundDirection,
    briefing: serialized,
    referenceSelections: frozenPayload.referenceSelections,
    baseVersion: composition.promptBaseVersion,
    composerVersion: composition.composerVersion,
    policyVersions: composition.policyVersions,
  });

  if (!canStartDurableWrite(clock(), deadlineAtMs)) {
    return Object.freeze({
      ok: false as const,
      reason: "persistence_reserve_reached" as const,
    });
  }

  const persistSnapshot =
    deps.persistSnapshot ??
    ((snapshotToPersist: ImageGenerationConfigSnapshot, evidenceToPersist: ProductOneToOneFrozenEvidence) =>
      persistProductOneToOneSnapshot(client, snapshotToPersist, evidenceToPersist));

  try {
    const persisted = await persistSnapshot(snapshot, evidence);
    return Object.freeze({
      ok: true as const,
      snapshot,
      evidence,
      snapshotOriginalId: persisted.snapshotOriginalId,
      frozenPayload,
      composition,
    });
  } catch (error) {
    return Object.freeze({ ok: false as const, reason: snapshotFailureReason(error) });
  }
}

/**
 * Retomada: usa o snapshot congelado e valida elegibilidade/pricing do par
 * congelado. NUNCA resolve a configuração vigente (não chama preflight).
 */
export async function resolveResumeConfig(
  input: { readonly frozen: { readonly snapshot: FrozenSnapshotRecord } },
  deps: SquareBaseConfigDeps = {},
): Promise<ResumeConfigResult> {
  try {
    const pair = imagePairFromSnapshot(input.frozen.snapshot);
    const assertPair = deps.assertEligiblePair ?? assertEligibleModelPair;
    assertPair(pair.primary);
    assertPair(pair.fallback);

    const assertExecutable =
      deps.assertExecutable ??
      ((pairToCheck: ImageModelPairConfig) => assertImagePairExecutable(pairToCheck));
    await assertExecutable(pair);

    return Object.freeze({
      ok: true as const,
      snapshot: input.frozen.snapshot,
      pair,
    });
  } catch {
    return Object.freeze({ ok: false as const, reason: "preflight_failed" as const });
  }
}

/**
 * Reparo da evidência ausente (`repairable`) SOMENTE sob equivalência de
 * conteúdo. Reutiliza `persistProductOneToOneSnapshot` para o MESMO snapshot,
 * nunca escrevendo evidência manualmente. Divergência ou conflito de identidade
 * no reparo viram `content_divergence` (a comparação ocorreu antes da escrita).
 */
export async function repairFrozenEvidence(
  input: {
    readonly frozen: Extract<FrozenStateReadResult, { kind: "repairable" }>;
    readonly comparison: FrozenContentComparison;
  },
  deps: SquareBaseConfigDeps = {},
): Promise<RepairFrozenEvidenceResult> {
  if (!input.comparison.ok) {
    return Object.freeze({
      ok: false as const,
      reason: "content_divergence" as const,
      divergence: input.comparison.reason,
    });
  }

  const client = deps.client ?? (supabaseAdmin as unknown as SupabaseClient);
  const clock = deps.clock ?? (() => Date.now());
  const deadlineAtMs = deadlineAt(
    clock(),
    deps.deadlineMs ?? PRODUCT_1_1_GENERATION_DEADLINE_MS,
  );

  if (!canStartDurableWrite(clock(), deadlineAtMs)) {
    return Object.freeze({
      ok: false as const,
      reason: "persistence_reserve_reached" as const,
    });
  }

  const snapshot = toConfigSnapshot(input.frozen.snapshot);
  const payload = input.comparison.payload;
  const serialized = serializeFrozenPayload(payload);

  const evidence = buildProductOneToOneFrozenEvidence({
    campaignId: snapshot.campaignId,
    operationId: input.frozen.operationId,
    campaignIntent: payload.campaignIntent,
    backgroundDirection: payload.backgroundDirection,
    briefing: serialized,
    referenceSelections: payload.referenceSelections,
    baseVersion: payload.promptBaseVersion,
    composerVersion: payload.composerVersion,
    policyVersions: payload.policyVersions,
  });

  const persistSnapshot =
    deps.persistSnapshot ??
    ((snapshotToPersist: ImageGenerationConfigSnapshot, evidenceToPersist: ProductOneToOneFrozenEvidence) =>
      persistProductOneToOneSnapshot(client, snapshotToPersist, evidenceToPersist));

  try {
    const persisted = await persistSnapshot(snapshot, evidence);
    return Object.freeze({
      ok: true as const,
      snapshotOriginalId: persisted.snapshotOriginalId,
      reused: persisted.reused,
    });
  } catch (error) {
    if (
      error instanceof ProductOneToOneSnapshotPersistError &&
      error.code === "operation_identity_conflict"
    ) {
      return Object.freeze({ ok: false as const, reason: "content_divergence" as const });
    }
    return Object.freeze({ ok: false as const, reason: snapshotFailureReason(error) });
  }
}
