import "server-only";

import type { CreditOperationErrorCode } from "@/lib/product-1-1/credit-operation/types";
import type { VerticalArtifactProbeResult } from "@/lib/product-9-16-two-stage/two-stage-financial-service";

import { readTwoFormatDelivery, type TwoFormatReadResult } from "../delivery-reader";
import type { TwoFormatFormat } from "../types";
import type {
  TwoFormatDeliverInput,
  TwoFormatDeliverResult,
  TwoFormatDeliveryErrorCode,
  TwoFormatRefundInput,
  TwoFormatRefundResult,
} from "../joint-financial-client";
import {
  decideJointResolution,
  type JointArtifactKind,
  type JointCreditStatus,
  type JointOutcomeKind,
  type JointResolutionBlock,
} from "./pending-guards";
import type { JointSquareProbeResult } from "./square-probe";

/**
 * F60.7-09 — resolução administrativa por formato (server-only).
 *
 * Efeito EXCLUSIVAMENTE pelas RPCs conjuntas (`deliverFormat`/`refundFormat`).
 * Nenhuma mutação de crédito, nenhuma projeção, nenhum fallback para 1:1.
 *
 * Ordem: validar → ler entrega → validações estruturais (identidade/par,
 * SEMPRE, inclusive replay) → auditoria PRÉ-EFEITO → replay terminal (ambas as
 * ações) → epoch (refund) → sonda → guard → efeito → auditoria/reconciliação.
 *
 * Autoria: `idempotent:false` prova efeito desta execução (`kind:"resolution"`).
 * `idempotent:true` NÃO prova: relê a auditoria e usa `alreadyAudited` ou
 * reconciliação (`kind:"reconciliation"`, `authorship:"unverified"`).
 *
 * Efeito e auditoria NÃO são transacionais: a auditoria é escrita somente após
 * o sucesso. A unique index de `admin_audit_log.operation_id` garante
 * idempotência; divergência real é conflito. Mover a auditoria para SQL é
 * decisão de Gate de banco (sem migration aqui).
 */

export const JOINT_AUDIT_ACTION = "product_1_1_pending_resolution";

export type JointResolutionAvailabilityReason =
  | "not_two_format"
  | "not_found"
  | "inconsistent"
  | "read_failed";

export type JointRequestInvalidReason =
  | "missing_actor_id"
  | "missing_reason"
  | "missing_campaign_id"
  | "missing_operation_id"
  | "unsupported_format";

export type JointResolutionBlock09 =
  | JointResolutionBlock
  | "finality_not_recorded"
  | "publication_in_progress"
  | "stale_publication"
  | "evidence_stale"
  | "publication_not_owner"
  | "delivery_link_missing"
  | "credit_operation_missing"
  | "invalid_transition";

export interface JointResolutionRequest {
  readonly actorId: string;
  readonly campaignId: string;
  readonly operationId: string;
  readonly format: TwoFormatFormat;
  readonly action: "deliver" | "refund";
  readonly reason: string;
}

export interface JointResolutionState {
  readonly storeId: string;
  readonly creditStatus: JointCreditStatus;
  readonly outcomeKind: JointOutcomeKind;
  readonly sharedOutcomeKind: JointOutcomeKind;
  readonly sharedCreditStatus: JointCreditStatus;
  readonly activeClaim: boolean;
  readonly linkComplete: boolean;
}

export type JointResolutionStateResult =
  | { readonly kind: "found"; readonly state: JointResolutionState }
  | { readonly kind: "absent" }
  | { readonly kind: "read_failed"; readonly reason: string };

export type JointAuditKind = "resolution" | "reconciliation";

export interface JointAuditEntry {
  readonly actorId: string;
  readonly action: typeof JOINT_AUDIT_ACTION;
  readonly targetType: "campaign";
  readonly targetId: string;
  readonly reason: string;
  readonly operationId: string;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface JointAuditRecord {
  readonly action: string;
  readonly targetType: string;
  readonly targetId: string;
  readonly operationId: string | null;
  readonly metadata: Readonly<Record<string, unknown>> | null;
}

export type JointAuditLookup =
  | { readonly kind: "found"; readonly record: JointAuditRecord }
  | { readonly kind: "absent" }
  | { readonly kind: "read_failed"; readonly reason: string };

export interface JointResolutionDeps {
  readonly readDelivery?: (input: {
    campaignId: string;
    operationId: string;
    storeId?: string;
  }) => Promise<TwoFormatReadResult>;
  readonly readResolutionState: (input: {
    campaignId: string;
    operationId: string;
    deliveryOperationId: string;
  }) => Promise<JointResolutionStateResult>;
  readonly probeSquare: (input: {
    storeId: string;
    campaignId: string;
    operationId: string;
  }) => Promise<JointSquareProbeResult>;
  readonly probeVertical: (input: {
    storeId: string;
    campaignId: string;
    operationId: string;
  }) => Promise<VerticalArtifactProbeResult>;
  readonly beginPublication: (
    campaignId: string,
    operationId: string,
  ) => Promise<{ acquired: boolean; token: string | null; publicationState: string }>;
  readonly abortPublication: (
    campaignId: string,
    operationId: string,
    publicationToken: string,
    phase: "before_upload",
  ) => Promise<{ success: boolean; reason?: string }>;
  readonly getPublicationEpoch: (
    campaignId: string,
    deliveryOperationId: string,
  ) => Promise<number>;
  readonly recordFormatOutcome: (input: {
    campaignId: string;
    operationId: string;
    outcome: "failed" | "unknown";
  }) => Promise<void>;
  readonly deliverFormat: (
    input: TwoFormatDeliverInput,
  ) => Promise<TwoFormatDeliverResult>;
  readonly refundFormat: (
    input: TwoFormatRefundInput,
  ) => Promise<TwoFormatRefundResult>;
  readonly writeAudit: (entry: JointAuditEntry) => Promise<void>;
  readonly readAuditByOperationId: (
    operationId: string,
  ) => Promise<JointAuditLookup>;
}

export type JointResolutionOutcome =
  | {
      readonly kind: "resolved";
      readonly action: "deliver" | "refund";
      readonly format: TwoFormatFormat;
      readonly idempotent: boolean;
      readonly auditRecorded: true;
      readonly alreadyAudited?: true;
    }
  | {
      readonly kind: "reconciled";
      readonly action: "deliver" | "refund";
      readonly format: TwoFormatFormat;
      readonly auditRecorded: true;
      readonly authorship: "unverified";
      readonly alreadyReconciled?: true;
    }
  | {
      readonly kind: "blocked";
      readonly block: JointResolutionBlock09;
      readonly outcomeRecorded: boolean;
    }
  | { readonly kind: "unavailable"; readonly reason: JointResolutionAvailabilityReason }
  | { readonly kind: "invalid_request"; readonly reason: JointRequestInvalidReason }
  | { readonly kind: "publication_pending" }
  | { readonly kind: "audit_pending"; readonly code: string }
  | { readonly kind: "audit_conflict" }
  | { readonly kind: "audit_unavailable"; readonly code: string }
  | {
      readonly kind: "failed";
      readonly code: TwoFormatDeliveryErrorCode | CreditOperationErrorCode;
    };

const ABORTABLE_DELIVER_REASONS: ReadonlySet<string> = new Set<string>([
  "missing_publication_token",
  "artifact_incompatible",
  "delivery_link_missing",
  "credit_operation_missing",
  "invalid_transition",
]);

const BUSINESS_BLOCKS: ReadonlySet<JointResolutionBlock09> =
  new Set<JointResolutionBlock09>([
    "delivery_link_missing",
    "credit_operation_missing",
    "artifact_present",
    "insufficient_evidence",
    "evidence_stale",
    "finality_not_recorded",
    "shared_operation_not_final",
    "operation_in_progress",
    "operation_terminal",
    "operation_identity_conflict",
    "publication_in_progress",
    "publication_not_owner",
    "stale_publication",
    "delivered_not_refundable",
    "already_delivered",
    "invalid_transition",
  ]);

/**
 * Motivos de RPC que NÃO pertencem à união fechada do 09 são mapeados aqui,
 * explicitamente, para que `BUSINESS_BLOCKS` permaneça tipado pela união:
 * - `absent_not_confirmed` (ausência não comprovada) ⇒ `insufficient_evidence`;
 * - `artifact_incompatible` permanece falha definitiva (`failed`), sem bloco.
 */
function blockForFailure(
  code: TwoFormatDeliveryErrorCode | CreditOperationErrorCode,
): JointResolutionBlock09 | null {
  if (code === "absent_not_confirmed") return "insufficient_evidence";
  return isBlock(code) ? code : null;
}

const ATTEMPT_START_OUTCOME_CODES: ReadonlySet<JointResolutionBlock09> =
  new Set<JointResolutionBlock09>([
    "operation_terminal",
    "operation_identity_conflict",
  ]);

function twoFormatErrorCode(error: unknown): TwoFormatDeliveryErrorCode | null {
  if (!(error instanceof Error) || error.name !== "TwoFormatDeliveryError") {
    return null;
  }
  const code = (error as { readonly code?: unknown }).code;
  return typeof code === "string" ? (code as TwoFormatDeliveryErrorCode) : null;
}

function creditErrorCode(error: unknown): CreditOperationErrorCode | null {
  if (!(error instanceof Error) || error.name !== "CreditOperationError") {
    return null;
  }
  const code = (error as { readonly code?: unknown }).code;
  return typeof code === "string" ? (code as CreditOperationErrorCode) : null;
}

function attemptStartOutcomeCode(
  error: unknown,
): JointResolutionBlock09 | null {
  if (!(error instanceof Error) || error.name !== "AttemptStartError") return null;
  const code = (error as { readonly code?: unknown }).code;
  if (typeof code !== "string") return null;
  for (const block of ATTEMPT_START_OUTCOME_CODES) {
    if (block === code) return block;
  }
  return null;
}

function isBlock(code: string): code is JointResolutionBlock09 {
  for (const block of BUSINESS_BLOCKS) {
    if (block === code) return true;
  }
  return false;
}

function isTerminalCredit(
  action: "deliver" | "refund",
  status: JointCreditStatus,
): boolean {
  return (
    (action === "deliver" && status === "delivered") ||
    (action === "refund" && status === "refunded")
  );
}

function errorCode(
  error: unknown,
): TwoFormatDeliveryErrorCode | CreditOperationErrorCode {
  return twoFormatErrorCode(error) ?? creditErrorCode(error) ?? "unknown";
}

function auditUniqueViolation(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const code = (error as { readonly code?: unknown }).code;
  if (code === "23505") return true;
  return /duplicate key|idx_admin_audit_log_operation/i.test(error.message);
}

function auditMatches(
  record: JointAuditRecord,
  expected: {
    readonly targetId: string;
    readonly operationId: string;
    readonly action: "deliver" | "refund";
    readonly format: TwoFormatFormat;
    readonly controlOperationId: string;
    readonly deliveryOperationId: string;
    readonly kind?: JointAuditKind;
  },
): boolean {
  if (record.operationId !== expected.operationId) return false;
  if (record.action !== JOINT_AUDIT_ACTION) return false;
  if (record.targetType !== "campaign") return false;
  if (record.targetId !== expected.targetId) return false;
  const meta = record.metadata;
  if (meta === null) return false;
  if (
    meta.flow !== "two_format" ||
    meta.action !== expected.action ||
    meta.format !== expected.format ||
    meta.campaign_id !== expected.targetId ||
    meta.control_operation_id !== expected.controlOperationId ||
    meta.delivery_operation_id !== expected.deliveryOperationId
  ) {
    return false;
  }
  if (expected.kind === undefined) return true;
  return meta.kind === expected.kind;
}

/**
 * Replay terminal: aceita `resolution` OU `reconciliation` equivalentes (nunca
 * conflito só pela diferença de kind), preservando a autoria registrada.
 */
function terminalAuditOutcome(
  lookup: JointAuditLookup,
  request: JointResolutionRequest,
  deliveryOperationId: string,
): JointResolutionOutcome | null {
  if (lookup.kind === "absent") return null;
  if (lookup.kind === "read_failed") {
    return { kind: "audit_unavailable", code: "audit_read_failed" };
  }
  const matches = auditMatches(lookup.record, {
    targetId: request.campaignId,
    operationId: deliveryOperationId,
    action: request.action,
    format: request.format,
    controlOperationId: request.operationId,
    deliveryOperationId,
  });
  if (!matches) return { kind: "audit_conflict" };
  const kind = lookup.record.metadata?.kind;
  if (kind !== "resolution" && kind !== "reconciliation") {
    return { kind: "audit_conflict" };
  }
  if (kind === "resolution") {
    return {
      kind: "resolved",
      action: request.action,
      format: request.format,
      idempotent: true,
      auditRecorded: true,
      alreadyAudited: true,
    };
  }
  return {
    kind: "reconciled",
    action: request.action,
    format: request.format,
    auditRecorded: true,
    authorship: "unverified",
    alreadyReconciled: true,
  };
}

function auditMetadata(input: {
  readonly request: JointResolutionRequest;
  readonly kind: JointAuditKind;
  readonly deliveryOperationId: string;
  readonly artKind: "integral" | "absent" | null;
}): Readonly<Record<string, unknown>> {
  return Object.freeze({
    flow: "two_format",
    kind: input.kind,
    action: input.request.action,
    format: input.request.format,
    campaign_id: input.request.campaignId,
    control_operation_id: input.request.operationId,
    delivery_operation_id: input.deliveryOperationId,
    art_kind: input.artKind,
    authorship: input.kind === "resolution" ? "admin" : "unverified",
    atomicity: "effect_then_audit",
  });
}

function auditEntry(input: {
  readonly request: JointResolutionRequest;
  readonly kind: JointAuditKind;
  readonly deliveryOperationId: string;
  readonly artKind: "integral" | "absent" | null;
}): JointAuditEntry {
  return Object.freeze({
    actorId: input.request.actorId,
    action: JOINT_AUDIT_ACTION,
    targetType: "campaign",
    targetId: input.request.campaignId,
    reason: input.request.reason.trim(),
    operationId: input.deliveryOperationId,
    metadata: auditMetadata(input),
  });
}

async function writeResolutionAudit(
  request: JointResolutionRequest,
  deliveryOperationId: string,
  artKind: "integral" | "absent",
  deps: JointResolutionDeps,
): Promise<JointResolutionOutcome | null> {
  const entry = auditEntry({
    request,
    kind: "resolution",
    deliveryOperationId,
    artKind,
  });
  try {
    await deps.writeAudit(entry);
    return null;
  } catch (error) {
    if (!auditUniqueViolation(error)) {
      return { kind: "audit_pending", code: "audit_write_failed" };
    }
    let lookup: JointAuditLookup;
    try {
      lookup = await deps.readAuditByOperationId(deliveryOperationId);
    } catch {
      return { kind: "audit_unavailable", code: "audit_read_failed" };
    }
    if (lookup.kind === "read_failed") {
      return { kind: "audit_unavailable", code: "audit_read_failed" };
    }
    // Reconciliação concorrente equivalente é reconhecida sem autoria admin.
    const closed = terminalAuditOutcome(lookup, request, deliveryOperationId);
    if (closed !== null) return closed;
    return { kind: "audit_pending", code: "audit_write_failed" };
  }
}

async function writeReconciliationAudit(
  request: JointResolutionRequest,
  deliveryOperationId: string,
  deps: JointResolutionDeps,
): Promise<JointResolutionOutcome> {
  const entry = auditEntry({
    request,
    kind: "reconciliation",
    deliveryOperationId,
    artKind: null,
  });
  try {
    await deps.writeAudit(entry);
    return {
      kind: "reconciled",
      action: request.action,
      format: request.format,
      auditRecorded: true,
      authorship: "unverified",
    };
  } catch (error) {
    if (!auditUniqueViolation(error)) {
      return { kind: "audit_pending", code: "audit_write_failed" };
    }
    let lookup: JointAuditLookup;
    try {
      lookup = await deps.readAuditByOperationId(deliveryOperationId);
    } catch {
      return { kind: "audit_unavailable", code: "audit_read_failed" };
    }
    const closed = terminalAuditOutcome(lookup, request, deliveryOperationId);
    if (closed !== null) return closed;
    return { kind: "audit_conflict" };
  }
}

export async function resolveJointPending(
  request: JointResolutionRequest,
  deps: JointResolutionDeps,
): Promise<JointResolutionOutcome> {
  if (request.actorId.trim() === "") {
    return { kind: "invalid_request", reason: "missing_actor_id" };
  }
  if (request.reason.trim() === "") {
    return { kind: "invalid_request", reason: "missing_reason" };
  }
  if (request.campaignId === "") {
    return { kind: "invalid_request", reason: "missing_campaign_id" };
  }
  if (request.operationId === "") {
    return { kind: "invalid_request", reason: "missing_operation_id" };
  }
  if (request.format !== "1:1" && request.format !== "9:16") {
    return { kind: "invalid_request", reason: "unsupported_format" };
  }

  const readDelivery = deps.readDelivery ?? readTwoFormatDelivery;
  let read: TwoFormatReadResult;
  try {
    read = await readDelivery({
      campaignId: request.campaignId,
      operationId: request.operationId,
    });
  } catch {
    return { kind: "unavailable", reason: "read_failed" };
  }
  if (read.kind !== "found") return { kind: "unavailable", reason: read.kind };

  const target = request.format === "1:1" ? read.view.square : read.view.vertical;
  const sibling = request.format === "1:1" ? read.view.vertical : read.view.square;
  if (target.state === "unavailable" || target.state === "unknown") {
    return { kind: "unavailable", reason: "read_failed" };
  }
  if (sibling.state === "unavailable" || sibling.state === "unknown") {
    return {
      kind: "blocked",
      block: "delivery_link_incomplete",
      outcomeRecorded: false,
    };
  }
  if (target.deliveryOperationId === null) {
    return {
      kind: "blocked",
      block: "delivery_link_incomplete",
      outcomeRecorded: false,
    };
  }
  const deliveryOperationId = target.deliveryOperationId;

  const stateRead = await deps
    .readResolutionState({
      campaignId: request.campaignId,
      operationId: request.operationId,
      deliveryOperationId,
    })
    .catch(() => ({ kind: "read_failed" as const, reason: "read_failed" }));
  if (stateRead.kind === "absent") {
    return { kind: "unavailable", reason: "not_found" };
  }
  if (stateRead.kind === "read_failed") {
    return { kind: "unavailable", reason: "read_failed" };
  }
  const state = stateRead.state;
  // Estrutural ANTES do replay terminal: o atalho nunca contorna o par estrito.
  if (!state.linkComplete) {
    return {
      kind: "blocked",
      block: "delivery_link_incomplete",
      outcomeRecorded: false,
    };
  }

  const terminal = isTerminalCredit(request.action, state.creditStatus);

  let preAudit: JointAuditLookup;
  try {
    preAudit = await deps.readAuditByOperationId(deliveryOperationId);
  } catch {
    return { kind: "audit_unavailable", code: "audit_read_failed" };
  }

  if (terminal) {
    const closed = terminalAuditOutcome(preAudit, request, deliveryOperationId);
    if (closed !== null) return closed;
    return writeReconciliationAudit(request, deliveryOperationId, deps);
  }

  const preAuditOutcome = terminalAuditOutcome(
    preAudit,
    request,
    deliveryOperationId,
  );
  if (preAuditOutcome !== null) {
    // Auditoria não substitui a autoridade financeira: se o estado lido não é
    // terminal, relê a autoridade e só aceita equivalência com crédito terminal.
    if (
      preAuditOutcome.kind === "audit_conflict" ||
      preAuditOutcome.kind === "audit_unavailable"
    ) {
      return preAuditOutcome;
    }
    let confirmation: JointResolutionStateResult;
    try {
      confirmation = await deps.readResolutionState({
        campaignId: request.campaignId,
        operationId: request.operationId,
        deliveryOperationId,
      });
    } catch {
      return { kind: "audit_unavailable", code: "audit_read_failed" };
    }
    if (confirmation.kind === "read_failed") {
      return { kind: "audit_unavailable", code: "audit_read_failed" };
    }
    if (confirmation.kind !== "found") return { kind: "audit_conflict" };
    if (
      !confirmation.state.linkComplete ||
      confirmation.state.storeId !== state.storeId ||
      !isTerminalCredit(request.action, confirmation.state.creditStatus)
    ) {
      return { kind: "audit_conflict" };
    }
    return preAuditOutcome;
  }

  let observedEpoch = 0;
  if (request.action === "refund") {
    try {
      observedEpoch = await deps.getPublicationEpoch(
        request.campaignId,
        deliveryOperationId,
      );
    } catch (error) {
      const code = errorCode(error);
      const block = blockForFailure(code);
      return block !== null
        ? { kind: "blocked", block, outcomeRecorded: false }
        : { kind: "failed", code };
    }
  }

  let artifactKind: JointArtifactKind;
  try {
    if (request.format === "1:1") {
      const probe = await deps.probeSquare({
        storeId: state.storeId,
        campaignId: request.campaignId,
        operationId: request.operationId,
      });
      artifactKind = probe.kind;
    } else {
      const probe = await deps.probeVertical({
        storeId: state.storeId,
        campaignId: request.campaignId,
        operationId: request.operationId,
      });
      artifactKind = probe.kind;
    }
  } catch {
    artifactKind = "indeterminate";
  }

  const decision = decideJointResolution({
    action: request.action,
    creditStatus: state.creditStatus,
    outcomeKind: state.outcomeKind,
    sharedOutcomeKind: state.sharedOutcomeKind,
    sharedCreditStatus: state.sharedCreditStatus,
    artifactKind,
    activeClaim: state.activeClaim,
    linkComplete: state.linkComplete,
  });
  if (!decision.allowed) {
    return { kind: "blocked", block: decision.block, outcomeRecorded: false };
  }

  if (request.action === "deliver") {
    let publication: {
      acquired: boolean;
      token: string | null;
      publicationState: string;
    };
    try {
      publication = await deps.beginPublication(
        request.campaignId,
        deliveryOperationId,
      );
    } catch (error) {
      const code = errorCode(error);
      const block = blockForFailure(code);
      return block !== null
        ? { kind: "blocked", block, outcomeRecorded: false }
        : { kind: "failed", code };
    }
    if (!publication.acquired || publication.token === null) {
      return { kind: "publication_pending" };
    }
    const token = publication.token;

    let delivered: TwoFormatDeliverResult;
    try {
      delivered = await deps.deliverFormat({
        storeId: state.storeId,
        campaignId: request.campaignId,
        operationId: request.operationId,
        format: request.format,
        publicationToken: token,
      });
    } catch (error) {
      const twoFormatCode = twoFormatErrorCode(error);
      const code = twoFormatCode ?? creditErrorCode(error);
      if (twoFormatCode === "missing_publication_token") {
        return { kind: "publication_pending" };
      }
      if (code === null) return { kind: "failed", code: "unknown" };
      const block = blockForFailure(code);
      return block !== null
        ? { kind: "blocked", block, outcomeRecorded: false }
        : { kind: "failed", code };
    }

    if (!delivered.success) {
      if (ABORTABLE_DELIVER_REASONS.has(delivered.reason)) {
        try {
          await deps.abortPublication(
            request.campaignId,
            deliveryOperationId,
            token,
            "before_upload",
          );
        } catch {
          // Best-effort: o fence continua sendo a autoridade.
        }
      }
      if (delivered.reason === "missing_publication_token") {
        return { kind: "publication_pending" };
      }
      const block = blockForFailure(delivered.reason);
      return block !== null
        ? { kind: "blocked", block, outcomeRecorded: false }
        : { kind: "failed", code: delivered.reason };
    }

    if (delivered.idempotent) {
      let lookup: JointAuditLookup;
      try {
        lookup = await deps.readAuditByOperationId(deliveryOperationId);
      } catch {
        return { kind: "audit_unavailable", code: "audit_read_failed" };
      }
      const closed = terminalAuditOutcome(lookup, request, deliveryOperationId);
      if (closed !== null) return closed;
      return writeReconciliationAudit(request, deliveryOperationId, deps);
    }

    const audit = await writeResolutionAudit(
      request,
      deliveryOperationId,
      "integral",
      deps,
    );
    if (audit !== null) return audit;
    return {
      kind: "resolved",
      action: "deliver",
      format: request.format,
      idempotent: false,
      auditRecorded: true,
    };
  }

  let outcomeRecorded = false;
  if (request.format === "1:1") {
    try {
      await deps.recordFormatOutcome({
        campaignId: request.campaignId,
        operationId: deliveryOperationId,
        outcome: "failed",
      });
      outcomeRecorded = true;
    } catch (error) {
      const code = attemptStartOutcomeCode(error);
      if (code !== null) {
        return { kind: "blocked", block: code, outcomeRecorded: false };
      }
      return { kind: "failed", code: errorCode(error) };
    }
  }

  let refunded: TwoFormatRefundResult;
  try {
    refunded = await deps.refundFormat({
      storeId: state.storeId,
      campaignId: request.campaignId,
      operationId: request.operationId,
      format: request.format,
      artKind: "absent",
      observedEpoch,
      reason: request.reason.trim(),
    });
  } catch (error) {
    const code = errorCode(error);
    const block = blockForFailure(code);
    return block !== null
      ? { kind: "blocked", block, outcomeRecorded }
      : { kind: "failed", code };
  }

  if (!refunded.success) {
    const block = blockForFailure(refunded.reason);
    return block !== null
      ? { kind: "blocked", block, outcomeRecorded }
      : { kind: "failed", code: refunded.reason };
  }

  if (refunded.idempotent) {
    let lookup: JointAuditLookup;
    try {
      lookup = await deps.readAuditByOperationId(deliveryOperationId);
    } catch {
      return { kind: "audit_unavailable", code: "audit_read_failed" };
    }
    const closed = terminalAuditOutcome(lookup, request, deliveryOperationId);
    if (closed !== null) return closed;
    return writeReconciliationAudit(request, deliveryOperationId, deps);
  }

  const audit = await writeResolutionAudit(
    request,
    deliveryOperationId,
    "absent",
    deps,
  );
  if (audit !== null) return audit;
  return {
    kind: "resolved",
    action: "refund",
    format: request.format,
    idempotent: false,
    auditRecorded: true,
  };
}
