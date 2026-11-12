import "server-only";

/**
 * F60.4 — Orquestrador server-only da base quadrada (ÚNICA API pública).
 *
 * Ordem fixa (design Flow / T-60.4-15 / T-60.4-21 / T-60.4-27):
 * entrada → autorização → estado congelado → comparação de conteúdo → gate de
 * arte → configuração/snapshot → copy (não bloqueante) → UMA imagem →
 * conversão → persistência F60.1 → readback → materialização única do resultado.
 *
 * Garantias invioláveis:
 * - `invalid_input`/`authorization_denied`/`content_divergence`/
 *   `frozen_state_conflict`/`blocked` e `snapshot_failed` são PRÉ-chamada:
 *   `call: null` e zero chamadas de imagem/copy;
 * - autorização negada NÃO lê artefato/snapshot/copy nem escreve nada;
 * - `reference_selection_mismatch` é recusado ANTES de qualquer I/O (pré-efeito);
 * - preflight/config falho vira `blocked(preflight_failed)` sem exceção;
 * - arte reutilizada NUNCA chama o provider (`call: null`); se a copy falta, ela é
 *   gerada a partir do conteúdo CONGELADO (nunca do payload recebido);
 * - toda falha pós-chamada carrega `call` com callId/tentativa/alvo/modelo/
 *   qualidade/duração/resultado/usage/custo; exceção inesperada pós-chamada é
 *   `unknown_result(comm_lost)` (classe desconhecida);
 * - no máximo UMA chamada de imagem e UMA requisição de copy por invocação.
 * - nenhum crédito, `campaigns`, entrega/download, URL assinada/pública,
 *   migration, rota/UI/flag ou update/delete de objeto.
 */

import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { ImageModelPairConfig } from "@/lib/ai/image-model-pair";
import type { AiInvoker } from "@/lib/ai/gateway";
import type { CostResolution, TokenUsage } from "@/lib/ai-cost/types";
import { AiInvocationError, type AiInvocationRequest } from "@/lib/ai/types";
import { verifyCampaignAccess } from "@/lib/campaign/composition-artifacts/access";
import type {
  ArtifactIdentity,
  ArtifactRecord,
} from "@/lib/campaign/composition-artifacts/types";
import {
  canStartDurableWrite,
  deadlineAt,
} from "@/lib/product-1-1/orchestration/deadline";

import {
  artifactOutcomeFromPersist,
  convertProviderImage,
  persistSquareBaseArtifact,
  type SquareBaseArtifactPersistResult,
} from "./artifact";
import {
  imagePairFromSnapshot,
  repairFrozenEvidence,
  resolveFirstComposition,
  resolveResumeConfig,
  type FirstCompositionResult,
  type RepairFrozenEvidenceResult,
  type ResumeConfigResult,
  type SquareBaseConfigDeps,
} from "./config";
import {
  runSquareBaseCopy,
  type SquareBaseCopyDeps,
  type SquareBaseCopyOpsFactory,
} from "./copy";
import { squareBaseCopyInvoker } from "./copy-transport";
import {
  classifySquareBaseFailure,
  type SquareBaseDefinitiveReason,
  type SquareBaseFailureClassification,
  type SquareBaseUnknownReason,
} from "./failure";
import {
  compareFrozenContent,
  deriveReferenceSelections,
  frozenFingerprint,
  parseFrozenPayload,
  readSquareBaseFrozenState,
  referenceSelectionsMatch,
  serializeFrozenPayload,
  type SquareBaseFrozenStateDeps,
} from "./frozen-state";
import {
  decideReuseAdmissibility,
  probeSquareBaseTarget,
  type ProbeSquareBaseDeps,
  type ProbeSquareBaseOutcome,
} from "./gate";
import { PROVIDER_SIZE, SQUARE_BASE_CAPABILITY, SQUARE_BASE_PROVIDER, SQUARE_BASE_TARGET } from "./policy";
import {
  composeSquareBasePrompt,
  type SquareBasePromptContent,
} from "./prompt";
import {
  createSquareBaseImageGateway,
  invokeSquareBaseOnce,
  type SquareBaseImageGateway,
  type SquareBaseTransportDeps,
} from "./transport";
import {
  createSquareBaseTelemetry,
  squareBaseOutcomeFor,
  type SquareBaseTelemetryDeps,
  type SquareBaseTelemetryHandle,
} from "./telemetry";
import type {
  ArtOutcome,
  CopyOutcome,
  FrozenContentPayload,
  FrozenSnapshotRecord,
  FrozenStateReadResult,
  SnapshotFailedReason,
  SquareBaseCallEvidence,
  SquareBaseInput,
  SquareBaseResult,
} from "./types";
import { parseSquareBaseInput } from "./validation";

type BlockedReason = Extract<SquareBaseResult, { kind: "blocked" }>["reason"];
type Composition = ReturnType<NonNullable<SquareBaseConfigDeps["composePrompt"]>>;
type ClassificationProviderFailure = Extract<
  SquareBaseFailureClassification,
  { kind: "provider_failure" }
>["failure"];
type ClassificationUnknown = Extract<
  SquareBaseFailureClassification,
  { kind: "unknown_result" }
>;

/**
 * Resultado PRELIMINAR de um caminho pós-chamada: a copy é anexada ao final (no
 * `finally`, nunca deixando task órfã) e o `call` é montado UMA única vez depois
 * do flush de telemetria (custo resolvido).
 */
type PostCallOutcome =
  | { readonly kind: "completed"; readonly art: ArtOutcome }
  | {
      readonly kind: "provider_failure";
      readonly failure: ClassificationProviderFailure;
    }
  | {
      readonly kind: "definitive_failure";
      readonly reason: SquareBaseDefinitiveReason;
    }
  | {
      readonly kind: "unknown_result";
      readonly reason: SquareBaseUnknownReason;
      readonly failure: ClassificationUnknown["failure"];
    }
  | {
      readonly kind: "invalid_output";
      readonly reason: "empty_image" | "decode_failed" | "resize_failed";
    }
  | {
      readonly kind: "existing_artifact_conflict";
      readonly reason:
        | "incompatible"
        | "object_unverified"
        | "object_invalid"
        | "row_object_missing";
      readonly artifact?: ArtifactRecord;
    }
  | {
      readonly kind: "persistence_failed";
      readonly reason: "integrity_failure" | "persistence_failure";
      readonly detail: string;
      readonly storagePath?: string;
    }
  | {
      readonly kind: "readback_failed";
      readonly reason: "absent" | "invalid" | "indeterminate" | "metadata_conflict";
      readonly detail?: string;
    };

/** Dependências injetáveis (teste/integração). Todas opcionais. */
export interface SquareBaseDeps {
  readonly client?: SupabaseClient;
  readonly clock?: () => number;
  readonly callIdFactory?: () => string;

  // Estado congelado / configuração / gate.
  readonly readFrozenState?: typeof readSquareBaseFrozenState;
  readonly resolveFirstComposition?: typeof resolveFirstComposition;
  readonly resolveResumeConfig?: typeof resolveResumeConfig;
  readonly repairEvidence?: typeof repairFrozenEvidence;
  readonly probe?: typeof probeSquareBaseTarget;

  // Artefato / conversão.
  readonly persistArtifact?: typeof persistSquareBaseArtifact;
  readonly convertImage?: typeof convertProviderImage;

  // Imagem (gateway single-shot).
  readonly createImageGateway?: (pair: ImageModelPairConfig) => SquareBaseImageGateway;
  readonly imageGateway?: SquareBaseImageGateway;
  readonly transport?: SquareBaseTransportDeps;

  // Copy (caminho produtivo, invoker no-retry OBRIGATÓRIO).
  readonly runCopy?: typeof runSquareBaseCopy;
  readonly copyInvoker?: AiInvoker;
  readonly copyOps?: SquareBaseCopyOpsFactory;
  readonly acquireAttempt?: SquareBaseCopyDeps["acquireAttempt"];
  readonly copyDirectorEnabled?: boolean;

  // Telemetria (sink único).
  readonly createTelemetry?: typeof createSquareBaseTelemetry;
  readonly resolveTelemetryCost?: SquareBaseTelemetryDeps["resolveCost"];

  // Costuras encaminhadas para `config.ts` (primeira composição/retomada/reparo).
  readonly runPreflight?: SquareBaseConfigDeps["runPreflight"];
  readonly buildSnapshot?: SquareBaseConfigDeps["buildSnapshot"];
  readonly persistSnapshot?: SquareBaseConfigDeps["persistSnapshot"];
  readonly composePrompt?: SquareBaseConfigDeps["composePrompt"];
  readonly promptBase?: string;
  readonly assertEligiblePair?: SquareBaseConfigDeps["assertEligiblePair"];
  readonly assertExecutable?: SquareBaseConfigDeps["assertExecutable"];
}

const RESERVE_REACHED_REASON = "persistence_reserve_reached" as const;

function invalidInput(reason: string): SquareBaseResult {
  return Object.freeze({ kind: "invalid_input" as const, reason });
}

function blocked(
  reason: BlockedReason,
  copy: CopyOutcome | null = null,
): SquareBaseResult {
  return Object.freeze({ kind: "blocked" as const, copy, reason, call: null });
}

function notRequested(): CopyOutcome {
  return Object.freeze({ kind: "not_requested" as const });
}

function snapshotFailed(reason: SnapshotFailedReason): SquareBaseResult {
  return Object.freeze({
    kind: "snapshot_failed" as const,
    copy: notRequested(),
    reason,
    call: null,
  });
}

function contentDivergence(
  reason: Extract<SquareBaseResult, { kind: "content_divergence" }>["reason"],
): SquareBaseResult {
  return Object.freeze({
    kind: "content_divergence" as const,
    reason,
    copy: null,
    call: null,
  });
}

function frozenStateConflict(
  reason: Extract<SquareBaseResult, { kind: "frozen_state_conflict" }>["reason"],
): SquareBaseResult {
  return Object.freeze({
    kind: "frozen_state_conflict" as const,
    reason,
    copy: null,
    call: null,
  });
}

function completed(
  art: ArtOutcome,
  copy: CopyOutcome,
  call: SquareBaseCallEvidence | null,
): SquareBaseResult {
  return Object.freeze({ kind: "completed" as const, copy, art, call });
}

function composeFor(
  content: SquareBasePromptContent,
  deps: SquareBaseDeps,
): Composition {
  const compose = deps.composePrompt ?? composeSquareBasePrompt;
  return compose(
    content,
    deps.promptBase === undefined ? {} : { promptBase: deps.promptBase },
  );
}

/** Conteúdo recebido na retomada (apenas para comparação). */
function receivedContent(valid: SquareBaseInput) {
  return {
    briefing: valid.briefing,
    copyContext: valid.copyContext,
    identityDirective: valid.identityDirective,
    campaignIntent: valid.campaignIntent,
    backgroundDirection: valid.backgroundDirection,
    productImagesDataUrls: valid.productImagesDataUrls,
    ...(valid.identityImageUrl === undefined
      ? {}
      : { identityImageUrl: valid.identityImageUrl }),
    ...(valid.references === undefined ? {} : { references: valid.references }),
    ...(valid.referenceSelections === undefined
      ? {}
      : { referenceSelections: valid.referenceSelections }),
  };
}

/**
 * Candidato de conteúdo para o estado `repairable` (binding sem evidência).
 * Deriva as seleções dos bytes REAIS, compõe (versões) e devolve o payload que
 * será comparado ao fingerprint persistido. `null` quando as seleções declaradas
 * divergem das imagens recebidas (fail-closed).
 */
function buildCandidatePayload(
  valid: SquareBaseInput,
  deps: SquareBaseDeps,
): FrozenContentPayload | null {
  const referenceSelections = deriveReferenceSelections(
    valid.productImagesDataUrls,
    valid.identityImageUrl,
  );

  if (
    valid.referenceSelections !== undefined &&
    valid.referenceSelections.length > 0
  ) {
    const provided = valid.referenceSelections.map((selection, index) =>
      Object.freeze({ ...selection, index: selection.index ?? index }),
    );
    if (!referenceSelectionsMatch(referenceSelections, provided)) return null;
  }

  const content: SquareBasePromptContent = {
    briefing: valid.briefing,
    identityDirective: valid.identityDirective ?? null,
    referenceSelections,
    ...(valid.references === undefined ? {} : { references: valid.references }),
  };
  const composition = composeFor(content, deps);

  return Object.freeze({
    briefing: valid.briefing,
    copyContext: valid.copyContext ?? null,
    identityDirective: valid.identityDirective ?? null,
    campaignIntent: valid.campaignIntent,
    backgroundDirection: valid.backgroundDirection,
    referenceSelections,
    ...(valid.references === undefined ? {} : { references: valid.references }),
    promptBaseVersion: composition.promptBaseVersion,
    composerVersion: composition.composerVersion,
    policyVersions: composition.policyVersions,
  });
}

function pendingFromClassification(
  classification: SquareBaseFailureClassification,
): PostCallOutcome {
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

function describeClassification(
  classification: SquareBaseFailureClassification,
): string {
  switch (classification.kind) {
    case "provider_failure":
      return classification.failure.reason;
    case "definitive_failure":
      return classification.reason;
    case "unknown_result":
      return classification.reason;
  }
}

/** Mapeia a falha da persistência/readback F60.1 (pós-chamada) para a união. */
function pendingFromArtifactFailure(
  result: Exclude<
    SquareBaseArtifactPersistResult,
    { kind: "created" } | { kind: "reused" }
  >,
): PostCallOutcome {
  switch (result.kind) {
    case "existing_artifact_conflict":
      return Object.freeze({
        kind: "existing_artifact_conflict" as const,
        reason: result.reason,
        ...(result.artifact === undefined ? {} : { artifact: result.artifact }),
      });
    case "persistence_failed":
      return Object.freeze({
        kind: "persistence_failed" as const,
        reason: result.reason,
        detail: result.detail,
        ...(result.storagePath === undefined
          ? {}
          : { storagePath: result.storagePath }),
      });
    case "readback_failed":
      return Object.freeze({
        kind: "readback_failed" as const,
        reason: result.reason,
        ...(result.detail === undefined ? {} : { detail: result.detail }),
      });
  }
}

function materialize(
  pending: PostCallOutcome,
  copy: CopyOutcome,
  call: SquareBaseCallEvidence,
): SquareBaseResult {
  switch (pending.kind) {
    case "completed":
      return Object.freeze({ ...pending, copy, call });
    case "provider_failure":
      return Object.freeze({ ...pending, copy, call });
    case "definitive_failure":
      return Object.freeze({ ...pending, copy, call });
    case "unknown_result":
      return Object.freeze({ ...pending, copy, call });
    case "invalid_output":
      return Object.freeze({ ...pending, copy, call });
    case "existing_artifact_conflict":
      return Object.freeze({ ...pending, copy, call });
    case "persistence_failed":
      return Object.freeze({ ...pending, copy, call });
    case "readback_failed":
      return Object.freeze({ ...pending, copy, call });
  }
}

/** Inicia a copy (não bloqueante) com o conteúdo CONGELADO e invoker no-retry. */
function startCopy(
  valid: SquareBaseInput,
  frozenPayload: FrozenContentPayload,
  deadlineAtMs: number,
  deps: SquareBaseDeps,
): Promise<CopyOutcome> {
  const runCopy = deps.runCopy ?? runSquareBaseCopy;
  const copyDeps: SquareBaseCopyDeps = {
    ...(deps.client === undefined ? {} : { client: deps.client }),
    // Invoker OBRIGATÓRIO: sem ele o runner cairia no gateway padrão (retry oculto).
    invoker: deps.copyInvoker ?? squareBaseCopyInvoker,
    ...(deps.copyOps === undefined ? {} : { copyOps: deps.copyOps }),
    ...(deps.acquireAttempt === undefined
      ? {}
      : { acquireAttempt: deps.acquireAttempt }),
    ...(deps.copyDirectorEnabled === undefined
      ? {}
      : { copyDirectorEnabled: deps.copyDirectorEnabled }),
    now: deps.clock ?? (() => Date.now()),
  };

  const copyInput = {
    campaignId: valid.campaignId,
    operationId: valid.operationId,
    storeId: valid.storeId,
    frozen: frozenPayload,
    deadlineAtMs,
    usdBrlRateAtGeneration: valid.usdBrlRateAtGeneration ?? null,
    creditValueBrlAtGeneration: valid.creditValueBrlAtGeneration ?? null,
    ...(valid.traceId === undefined ? {} : { traceId: valid.traceId }),
  };

  try {
    return Promise.resolve(runCopy(copyInput, copyDeps));
  } catch {
    return Promise.resolve(
      Object.freeze({ kind: "unavailable" as const, reason: "not_attempted" }),
    );
  }
}

/**
 * Executa a etapa `base` da operação F60. Única API pública do módulo.
 * Nunca lança: toda recusa é um membro fechado da união `SquareBaseResult`.
 */
export async function runSquareBase(
  input: SquareBaseInput,
  deps: SquareBaseDeps = {},
): Promise<SquareBaseResult> {
  // (1) Entrada — nenhum I/O antes da recusa.
  const parsed = parseSquareBaseInput(input);
  if (!parsed.ok) return invalidInput(parsed.reason);
  const valid = parsed.input;

  // (1b) Pré-efeito: seleções declaradas DIVERGENTES dos bytes reais são
  // `invalid_input` ANTES de qualquer leitura/escrita/chamada.
  if (
    valid.referenceSelections !== undefined &&
    valid.referenceSelections.length > 0
  ) {
    const actual = deriveReferenceSelections(
      valid.productImagesDataUrls,
      valid.identityImageUrl,
    );
    const provided = valid.referenceSelections.map((selection, index) =>
      Object.freeze({ ...selection, index: selection.index ?? index }),
    );
    if (!referenceSelectionsMatch(actual, provided)) {
      return invalidInput("reference_selection_mismatch");
    }
  }

  const clock = deps.clock ?? (() => Date.now());
  const callIdFactory = deps.callIdFactory ?? randomUUID;
  const deadlineAtMs = deadlineAt(clock(), valid.timeoutMs);

  // (2) Autorização + vínculo loja↔campanha ANTES de qualquer leitura/escrita.
  let access: Awaited<ReturnType<typeof verifyCampaignAccess>>;
  try {
    access = await verifyCampaignAccess(
      {
        storeId: valid.storeId,
        campaignId: valid.campaignId,
        authorization: valid.authorization,
      },
      deps.client,
    );
  } catch {
    return blocked("frozen_state_read_failed");
  }
  if (!access.ok) {
    return Object.freeze({
      kind: "authorization_denied" as const,
      reason: access.reason,
    });
  }

  // (3) Estado congelado (read-only): a autoridade é o snapshot da operação.
  const readState = deps.readFrozenState ?? readSquareBaseFrozenState;
  const stateDeps: SquareBaseFrozenStateDeps =
    deps.client === undefined ? {} : { client: deps.client };

  let frozen: FrozenStateReadResult;
  try {
    frozen = await readState(
      { campaignId: valid.campaignId, operationId: valid.operationId },
      stateDeps,
    );
  } catch {
    return blocked("frozen_state_read_failed");
  }

  if (frozen.kind === "indeterminate") {
    return blocked("frozen_state_read_failed");
  }
  if (
    frozen.kind === "bound_to_other_operation" ||
    frozen.kind === "unproven" ||
    frozen.kind === "corrupt"
  ) {
    return frozenStateConflict(frozen.kind);
  }

  // (4) Comparação de conteúdo ANTES do gate e de qualquer chamada.
  let frozenPayload: FrozenContentPayload | null = null;
  let snapshotOriginalId: string | null = null;
  let existingSnapshot: FrozenSnapshotRecord | null = null;
  let composition: Composition | null = null;
  let repairFingerprint: string | null = null;

  if (frozen.kind === "complete") {
    const parsedPayload = parseFrozenPayload(frozen.evidence.briefing);
    if (!parsedPayload.ok) return blocked("frozen_content_invalid");

    const comparison = compareFrozenContent({
      frozen: parsedPayload.payload,
      received: receivedContent(valid),
      receivedBriefingText: valid.briefingText,
    });
    if (!comparison.ok) return contentDivergence(comparison.reason);

    frozenPayload = comparison.payload;
    snapshotOriginalId = frozen.snapshotOriginalId;
    existingSnapshot = frozen.snapshot;
  } else if (frozen.kind === "repairable") {
    const candidate = buildCandidatePayload(valid, deps);
    if (candidate === null) return blocked("frozen_content_invalid");

    const candidateFingerprint = frozenFingerprint(
      candidate,
      serializeFrozenPayload(candidate),
    );
    if (candidateFingerprint !== frozen.fingerprint) {
      return contentDivergence("fingerprint");
    }

    frozenPayload = candidate;
    snapshotOriginalId = frozen.snapshotOriginalId;
    existingSnapshot = frozen.snapshot;
    repairFingerprint = candidateFingerprint;
  }

  // (5) Gate de arte (linha e objeto como perguntas distintas).
  const destination: ArtifactIdentity = {
    storeId: valid.storeId,
    campaignId: valid.campaignId,
    operationId: valid.operationId,
    role: SQUARE_BASE_TARGET.role,
  };
  const allowAdoption =
    frozen.kind === "complete" || frozen.kind === "repairable";

  const probe = deps.probe ?? probeSquareBaseTarget;
  const probeDeps: ProbeSquareBaseDeps =
    deps.client === undefined ? {} : { client: deps.client };

  let probeOutcome: ProbeSquareBaseOutcome;
  try {
    probeOutcome = await probe(
      { destination, authorization: valid.authorization, allowAdoption },
      probeDeps,
    );
  } catch {
    return blocked("pre_call_probe_indeterminate");
  }

  const decision = decideReuseAdmissibility(probeOutcome, frozen.kind);

  if (decision.kind === "blocked") {
    return blocked(decision.reason);
  }
  if (decision.kind === "conflict") {
    if (decision.reason === "bound_to_other_operation") {
      // Inalcançável (o conflito de operação já foi decidido no estado congelado).
      return frozenStateConflict("bound_to_other_operation");
    }
    return Object.freeze({
      kind: "existing_artifact_conflict" as const,
      copy: notRequested(),
      reason: decision.reason,
      ...(decision.artifact === undefined ? {} : { artifact: decision.artifact }),
      call: null,
    });
  }

  // (5b) Arte reutilizada: NUNCA chama o provider. A copy (se solicitada) é
  // gerada a partir do conteúdo CONGELADO — nunca do payload recebido.
  if (decision.kind === "reuse") {
    if (frozenPayload === null) return blocked("frozen_content_invalid");

    const copy = await startCopy(valid, frozenPayload, deadlineAtMs, deps);
    const art: ArtOutcome = Object.freeze({
      kind: "reused" as const,
      artifact: decision.artifact,
      adoption: decision.adoption,
      ...(snapshotOriginalId === null ? {} : { snapshotOriginalId }),
    });
    return completed(art, copy, null);
  }

  // (6) Configuração: primeira composição congela; retomada usa o congelado.
  const configDeps: SquareBaseConfigDeps = {
    ...(deps.client === undefined ? {} : { client: deps.client }),
    clock,
    deadlineMs: valid.timeoutMs,
    ...(deps.runPreflight === undefined ? {} : { runPreflight: deps.runPreflight }),
    ...(deps.buildSnapshot === undefined ? {} : { buildSnapshot: deps.buildSnapshot }),
    ...(deps.persistSnapshot === undefined
      ? {}
      : { persistSnapshot: deps.persistSnapshot }),
    ...(deps.composePrompt === undefined ? {} : { composePrompt: deps.composePrompt }),
    ...(deps.promptBase === undefined ? {} : { promptBase: deps.promptBase }),
    ...(deps.assertEligiblePair === undefined
      ? {}
      : { assertEligiblePair: deps.assertEligiblePair }),
    ...(deps.assertExecutable === undefined
      ? {}
      : { assertExecutable: deps.assertExecutable }),
  };

  let pair: ImageModelPairConfig;

  if (frozen.kind === "absent") {
    const resolveFirst = deps.resolveFirstComposition ?? resolveFirstComposition;
    let first: FirstCompositionResult;
    try {
      first = await resolveFirst(valid, configDeps);
    } catch {
      return blocked("preflight_failed", notRequested());
    }
    if (!first.ok) {
      switch (first.reason) {
        case "preflight_failed":
          return blocked("preflight_failed", notRequested());
        case "reference_selection_mismatch":
          return invalidInput("reference_selection_mismatch");
        default:
          return snapshotFailed(first.reason);
      }
    }
    frozenPayload = first.frozenPayload;
    snapshotOriginalId = first.snapshotOriginalId;
    composition = first.composition;
    pair = imagePairFromSnapshot(first.snapshot);
  } else {
    // `complete`/`repairable`: NUNCA resolve a configuração vigente.
    const resolveResume = deps.resolveResumeConfig ?? resolveResumeConfig;
    let resume: ResumeConfigResult;
    try {
      resume = await resolveResume({ frozen: { snapshot: frozen.snapshot } }, configDeps);
    } catch {
      return blocked("preflight_failed", notRequested());
    }
    if (!resume.ok) return blocked("preflight_failed", notRequested());
    pair = resume.pair;

    if (frozen.kind === "repairable") {
      if (frozenPayload === null || repairFingerprint === null) {
        return blocked("frozen_content_invalid");
      }
      const repair = deps.repairEvidence ?? repairFrozenEvidence;
      let repaired: RepairFrozenEvidenceResult;
      try {
        repaired = await repair(
          {
            frozen,
            comparison: {
              ok: true,
              fingerprint: repairFingerprint,
              payload: frozenPayload,
            },
          },
          configDeps,
        );
      } catch {
        return blocked("pre_call_probe_indeterminate");
      }
      if (!repaired.ok) {
        if (repaired.reason === "content_divergence") {
          return contentDivergence(repaired.divergence ?? "fingerprint");
        }
        return snapshotFailed(repaired.reason);
      }
      snapshotOriginalId = repaired.snapshotOriginalId;
    }
  }

  if (frozenPayload === null) return blocked("frozen_content_invalid");
  const frozenContent = frozenPayload;

  // (7) Reserva de escrita durável ANTES da chamada paga.
  if (!canStartDurableWrite(clock(), deadlineAtMs)) {
    return blocked(RESERVE_REACHED_REASON);
  }

  // (8) Copy iniciada de forma NÃO bloqueante (após o gate e, na geração, após
  // a persistência do snapshot). Requisição única, identidade da aquisição.
  let copyPromise: Promise<CopyOutcome> | null = startCopy(
    valid,
    frozenContent,
    deadlineAtMs,
    deps,
  );

  // (9) UMA chamada de imagem com alvo explícito, sem retry/fallback.
  const target = valid.attempt.target;
  const targetPair = target === "fallback" ? pair.fallback : pair.primary;
  const requestComposition =
    composition ?? composeFor(
      {
        briefing: frozenContent.briefing,
        identityDirective: frozenContent.identityDirective,
        referenceSelections: frozenContent.referenceSelections,
        ...(frozenContent.references === undefined
          ? {}
          : { references: frozenContent.references }),
      },
      deps,
    );

  const request: AiInvocationRequest = {
    prompt: requestComposition.text,
    productImagesDataUrls: [...valid.productImagesDataUrls],
    ...(valid.identityImageUrl === undefined
      ? {}
      : { identityImageUrl: valid.identityImageUrl }),
    size: PROVIDER_SIZE,
    quality: targetPair.quality,
  };
  const expectedIdentity = frozenContent.referenceSelections.some(
    (selection) => selection.kind === "identity",
  );

  const gateway =
    deps.imageGateway ??
    (deps.createImageGateway ?? ((imagePair: ImageModelPairConfig) =>
      createSquareBaseImageGateway(imagePair, deps.transport)))(pair);

  const callId = callIdFactory();
  const createTelemetry = deps.createTelemetry ?? createSquareBaseTelemetry;
  const telemetryDeps: SquareBaseTelemetryDeps =
    deps.resolveTelemetryCost === undefined
      ? {}
      : { resolveCost: deps.resolveTelemetryCost };

  let telemetryHandle: SquareBaseTelemetryHandle | null = null;

  const startedAt = clock();
  let pending: PostCallOutcome | null = null;
  let attempted = false;
  let callStatus: SquareBaseCallEvidence["callStatus"] = "failed";
  let usage: TokenUsage | undefined;
  let errorType: string | undefined;
  let copyOutcome: CopyOutcome | null = null;

  try {
    telemetryHandle = createTelemetry(
      {
        operationId: valid.operationId,
        callId,
        attemptNumber: valid.attempt.number,
        attemptReference: valid.attempt.reference,
        storeId: valid.storeId,
        campaignId: valid.campaignId,
        pair,
        target,
        usdBrlRateAtGeneration: valid.usdBrlRateAtGeneration ?? null,
        creditValueBrlAtGeneration: valid.creditValueBrlAtGeneration ?? null,
      },
      telemetryDeps,
    );

    let once: Awaited<ReturnType<typeof invokeSquareBaseOnce>>;
    try {
      once = await invokeSquareBaseOnce({
        gateway,
        capability: SQUARE_BASE_CAPABILITY,
        target,
        request,
        telemetry: telemetryHandle.context,
        timeoutMs: valid.timeoutMs,
        signal: valid.signal,
        quality: targetPair.quality,
        expectedIdentity,
      });
    } catch (error) {
      once = Object.freeze({
        error,
        prepared: null,
        sendEvidence: "not_sent" as const,
      });
    }

    attempted = true;

    if ("error" in once) {
      const classification = classifySquareBaseFailure(once.error, {
        sendEvidence: once.sendEvidence,
      });
      pending = pendingFromClassification(classification);
      errorType = describeClassification(classification);
      callStatus =
        once.error instanceof AiInvocationError && once.error.kind === "timeout"
          ? "timeout"
          : "failed";
    } else {
      callStatus = "success";
      usage = once.result.usage;

      const imageBase64 = once.result.imageBase64 ?? "";
      if (imageBase64.length === 0) {
        pending = Object.freeze({
          kind: "invalid_output" as const,
          reason: "empty_image" as const,
        });
      } else {
        const convert = deps.convertImage ?? convertProviderImage;
        const converted = await convert({
          imageBase64,
          ...(once.result.mimeType === undefined
            ? {}
            : { mimeType: once.result.mimeType }),
        });

        if (!converted.ok) {
          pending = Object.freeze({
            kind: "invalid_output" as const,
            reason: converted.reason,
          });
        } else if (snapshotOriginalId === null) {
          pending = Object.freeze({
            kind: "persistence_failed" as const,
            reason: "persistence_failure" as const,
            detail: "missing_snapshot_original_id",
          });
        } else {
          const persist = deps.persistArtifact ?? persistSquareBaseArtifact;
          const persisted = await persist({
            identity: destination,
            authorization: valid.authorization,
            bytes: converted.bytes,
            snapshotOriginalId,
          });
          if (persisted.kind === "created" || persisted.kind === "reused") {
            const art = artifactOutcomeFromPersist(persisted);
            pending =
              art === null
                ? Object.freeze({
                    kind: "persistence_failed" as const,
                    reason: "persistence_failure" as const,
                    detail: "artifact_outcome_missing",
                  })
                : Object.freeze({ kind: "completed" as const, art });
          } else {
            pending = pendingFromArtifactFailure(persisted);
          }
        }
      }
    }
  } catch {
    // Exceção inesperada: pós-chamada ⇒ resultado DESCONHECIDO com `call`
    // preservado; pré-chamada ⇒ o bloqueio tipado mais próximo (abaixo).
    pending = attempted
      ? Object.freeze({
          kind: "unknown_result" as const,
          reason: "comm_lost" as const,
          failure: Object.freeze({
            class: "unknown" as const,
            reason: "comm_lost" as const,
            sendEvidence: "possibly_sent" as const,
          }),
        })
      : null;
  } finally {
    if (telemetryHandle !== null) {
      try {
        const outcome =
          pending === null ? "unknown" : squareBaseOutcomeFor(pending.kind) ?? "unknown";
        telemetryHandle.finalize({
          outcome,
          durationMs: Math.max(0, clock() - startedAt),
          ...(errorType === undefined ? {} : { errorType }),
        });
      } catch {
        // `finalize` é síncrono/defensivo: nunca altera o resultado.
      }
      // Flush ÚNICO, best-effort, ANTES de materializar o custo resolvido.
      await telemetryHandle.flush();
    }

    // Nunca deixa task de copy órfã.
    if (copyPromise !== null) {
      try {
        copyOutcome = await copyPromise;
      } catch {
        copyOutcome = Object.freeze({
          kind: "unavailable" as const,
          reason: "read_failed" as const,
        });
      }
      copyPromise = null;
    }
  }

  if (pending === null) {
    return blocked("pre_call_probe_indeterminate", copyOutcome);
  }

  // (10) Materialização ÚNICA: `call` com custo já resolvido pelo flush e `copy`
  // anexada ao desfecho (inclusive em falha).
  const outcome = squareBaseOutcomeFor(pending.kind) ?? "unknown";
  const call: SquareBaseCallEvidence = Object.freeze({
    callId,
    operationId: valid.operationId,
    attemptNumber: valid.attempt.number,
    attemptReference: valid.attempt.reference,
    provider: SQUARE_BASE_PROVIDER,
    model: targetPair.model,
    protocol: "images" as const,
    quality: targetPair.quality,
    requestedSize: PROVIDER_SIZE,
    durationMs: Math.max(0, clock() - startedAt),
    callStatus,
    outcome,
    ...(usage === undefined ? {} : { usage }),
    cost:
      telemetryHandle === null
        ? ({ estimatedCostUsd: null, costSource: "not_available" } as CostResolution)
        : telemetryHandle.resolvedCost() ?? {
            estimatedCostUsd: null,
            costSource: "not_available" as const,
          },
    ...(errorType === undefined ? {} : { errorType }),
  });

  return materialize(pending, copyOutcome ?? notRequested(), call);
}
