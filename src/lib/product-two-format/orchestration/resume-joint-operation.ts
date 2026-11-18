import "server-only";

import type { AuthorizationContext } from "@/lib/campaign/composition-artifacts/types";
import type { TwoStageOperationView, OperationViewLookup } from "@/lib/product-9-16-two-stage/types";
import type { AttemptTarget } from "@/lib/product-9-16-two-stage/types";
import { deriveFrozenExpansionSelection } from "@/lib/product-9-16-two-stage/orchestration/delivery-deps";

import { readTwoFormatDelivery, type TwoFormatReadResult } from "../delivery-reader";
import type { TwoFormatFormat } from "../types";

import {
  classifyJointFormat,
  needsSquareArtifact,
  planJointResume,
  type JointResumePlan,
} from "./classify-joint-resume";
import type { JointArtifactObservation } from "./classify-joint-resume";
import type {
  JointBaseInput,
  JointBaseOutcome,
} from "./joint-base";
import type {
  JointSquareDeliveryInput,
  JointSquareDeliveryOutcome,
} from "./deliver-square";
import type {
  JointVerticalDeliveryInput,
  JointVerticalDeliveryOutcome,
} from "./deliver-joint-vertical";
import type { JointProjectionRepairOutcome } from "./repair-joint-projection";
import type { JointSquareProbeResult } from "./square-probe";

/**
 * F60.7-07 — executor da continuação (server-only).
 *
 * Lê UMA vez o delivery, classifica, sonda o quadrado só quando necessário e
 * executa NO MÁXIMO uma ação. Não abre operação, não reserva, não estorna e não
 * projeta diretamente. Antes de base/liquidação, a operação durável é
 * autoridade: unknown/failed/execução ativa (e terminal, por ação) bloqueiam.
 */

export interface JointResumeOperationInput {
  readonly storeId: string;
  readonly campaignId: string;
  readonly operationId: string;
  readonly authorization: AuthorizationContext;
  readonly acquisitionId: string;
  /** Obrigatório nos dois caminhos (base e vertical); nunca inventado. */
  readonly attemptReference: string;
  readonly deadlineAtMs: number;
  readonly allowNewPaidStep: boolean;
  /** Obrigatório apenas quando o plano for `run_base`. */
  readonly attemptTarget?: AttemptTarget;
  readonly signal?: AbortSignal;
}

export interface JointResumeDeps {
  readonly readDelivery?: (input: {
    campaignId: string;
    operationId: string;
    storeId?: string;
  }) => Promise<TwoFormatReadResult>;
  readonly readOperationView: (input: {
    campaignId: string;
    operationId: string;
  }) => Promise<OperationViewLookup>;
  readonly probeSquare: (input: {
    storeId: string;
    campaignId: string;
    operationId: string;
  }) => Promise<JointSquareProbeResult>;
  readonly reconstruct: (input: {
    storeId: string;
    campaignId: string;
    operationId: string;
  }) => Promise<
    | {
        readonly ok: true;
        readonly content: JointBaseInput["content"];
        readonly frozenState: JointBaseInput["frozenState"];
      }
    | { readonly ok: false; readonly reason: string }
  >;
  readonly runBase: (input: JointBaseInput) => Promise<JointBaseOutcome>;
  readonly deliverSquare: (
    input: JointSquareDeliveryInput,
  ) => Promise<JointSquareDeliveryOutcome>;
  readonly deliverVertical: (
    input: JointVerticalDeliveryInput,
  ) => Promise<JointVerticalDeliveryOutcome>;
  readonly repairProjection: (input: {
    storeId: string;
    campaignId: string;
    operationId: string;
  }) => Promise<JointProjectionRepairOutcome>;
}

export type JointResumeBlockedReason =
  | "not_found"
  | "not_two_format"
  | "inconsistent"
  | "read_failed"
  | "unknown"
  | "partial_read"
  | "base_missing"
  | "artifact_invalid"
  | "artifact_indeterminate"
  | "unhandled_state"
  | "frozen_selection_missing"
  | "reconstruction_failed"
  | "probe_failed"
  | "operation_absent"
  | "operation_read_failed"
  | "operation_in_progress"
  | "failed_outcome"
  | "operation_terminal";

export type JointResumeOutcome =
  | {
      readonly kind: "executed";
      readonly action: "run_base";
      readonly outcome: JointBaseOutcome;
    }
  | {
      readonly kind: "executed";
      readonly action: "run_vertical_only";
      readonly outcome: JointVerticalDeliveryOutcome;
    }
  | {
      readonly kind: "executed";
      readonly action: "repair_only";
      readonly outcome: JointProjectionRepairOutcome;
    }
  | {
      readonly kind: "settle_square";
      readonly outcome: JointSquareDeliveryOutcome;
    }
  | {
      readonly kind: "partial_terminal";
      readonly creditRefundedFormats: readonly TwoFormatFormat[];
    }
  | {
      readonly kind: "pending_finalization";
      readonly refundedFormats: readonly TwoFormatFormat[];
    }
  | { readonly kind: "terminal_error" }
  | { readonly kind: "blocked"; readonly reason: JointResumeBlockedReason };

function blocked(reason: JointResumeBlockedReason): JointResumeOutcome {
  return { kind: "blocked", reason };
}

function planBlockedReason(plan: JointResumePlan): JointResumeBlockedReason | null {
  switch (plan.action) {
    case "blocked_unknown":
      return "unknown";
    case "blocked_partial_read":
      return "partial_read";
    case "fail_closed":
      return plan.reason;
    default:
      return null;
  }
}

function verticalAttemptTarget(view: TwoStageOperationView): AttemptTarget {
  return view.nextAction === "retry_expansion" ? "retry" : "initial";
}

/**
 * Autoridade durável. `run_base` bloqueia com crédito terminal (delivered ou
 * refunded); `settle_square` aceita `delivered` (é o crédito do vertical) e só
 * bloqueia com `refunded`.
 */
function durableBlockedReason(
  view: TwoStageOperationView,
  action: "run_base" | "settle_square",
): JointResumeBlockedReason | null {
  if (view.unknown) return "unknown";
  if (view.failedOutcome) return "failed_outcome";
  if (
    view.base.status === "in_progress" ||
    view.expansion.status === "in_progress" ||
    view.processingPhase === "step_in_progress" ||
    view.nextAction === "wait"
  ) {
    return "operation_in_progress";
  }
  if (action === "run_base" && (view.credit.delivered || view.credit.refunded)) {
    return "operation_terminal";
  }
  if (action === "settle_square" && view.credit.refunded) {
    return "operation_terminal";
  }
  return null;
}

async function readOperation(
  input: JointResumeOperationInput,
  deps: JointResumeDeps,
): Promise<
  | { readonly ok: true; readonly view: TwoStageOperationView }
  | { readonly ok: false; readonly reason: JointResumeBlockedReason }
> {
  let lookup: OperationViewLookup;
  try {
    lookup = await deps.readOperationView({
      campaignId: input.campaignId,
      operationId: input.operationId,
    });
  } catch {
    return { ok: false, reason: "operation_read_failed" };
  }
  if (lookup.kind === "absent") return { ok: false, reason: "operation_absent" };
  if (lookup.kind === "read_failed") {
    return { ok: false, reason: "operation_read_failed" };
  }
  return { ok: true, view: lookup.view };
}

export async function resumeJointOperation(
  input: JointResumeOperationInput,
  deps: JointResumeDeps,
): Promise<JointResumeOutcome> {
  const readDelivery = deps.readDelivery ?? readTwoFormatDelivery;
  let read: TwoFormatReadResult;
  try {
    read = await readDelivery({
      campaignId: input.campaignId,
      operationId: input.operationId,
      storeId: input.storeId,
    });
  } catch {
    return blocked("read_failed");
  }
  if (read.kind !== "found") return blocked(read.kind);

  const square = classifyJointFormat(read.view.square);
  const vertical = classifyJointFormat(read.view.vertical);

  let squareArtifact: JointArtifactObservation = "indeterminate";
  if (needsSquareArtifact({ square, vertical })) {
    try {
      const probe = await deps.probeSquare({
        storeId: input.storeId,
        campaignId: input.campaignId,
        operationId: input.operationId,
      });
      squareArtifact = probe.kind;
    } catch {
      return blocked("probe_failed");
    }
  }

  const plan = planJointResume({ square, vertical, squareArtifact });
  const blockedReason = planBlockedReason(plan);
  if (blockedReason !== null) return blocked(blockedReason);

  switch (plan.action) {
    case "terminal_error":
      return { kind: "terminal_error" };
    case "partial_terminal":
      return {
        kind: "partial_terminal",
        creditRefundedFormats: [
          plan.reason === "square_refunded" ? "1:1" : "9:16",
        ],
      };
    case "pending_finalization":
      return { kind: "pending_finalization", refundedFormats: [plan.refunded] };
    case "repair_only": {
      const outcome = await deps.repairProjection({
        storeId: input.storeId,
        campaignId: input.campaignId,
        operationId: input.operationId,
      });
      return { kind: "executed", action: "repair_only", outcome };
    }
    case "run_vertical_only": {
      const operation = await readOperation(input, deps);
      if (!operation.ok) return blocked(operation.reason);
      const selection = deriveFrozenExpansionSelection(operation.view);
      if (selection.kind !== "found") {
        return blocked("frozen_selection_missing");
      }
      const outcome = await deps.deliverVertical({
        storeId: input.storeId,
        campaignId: input.campaignId,
        operationId: input.operationId,
        authorization: input.authorization,
        acquisitionId: input.acquisitionId,
        attemptReference: input.attemptReference,
        attemptTarget: verticalAttemptTarget(operation.view),
        deadlineAtMs: input.deadlineAtMs,
        expansionStatus: operation.view.expansion.status,
        selection: selection.selection,
        allowNewPaidStep: input.allowNewPaidStep,
        ...(input.signal === undefined ? {} : { signal: input.signal }),
      });
      return { kind: "executed", action: "run_vertical_only", outcome };
    }
    case "settle_square": {
      const operation = await readOperation(input, deps);
      if (!operation.ok) return blocked(operation.reason);
      const durable = durableBlockedReason(operation.view, "settle_square");
      if (durable !== null) return blocked(durable);
      const deliveryOperationId = read.view.square.deliveryOperationId;
      if (deliveryOperationId === null) return blocked("unhandled_state");
      const outcome = await deps.deliverSquare({
        storeId: input.storeId,
        campaignId: input.campaignId,
        operationId: input.operationId,
        deliveryOperationId,
      });
      return { kind: "settle_square", outcome };
    }
    case "run_base": {
      const operation = await readOperation(input, deps);
      if (!operation.ok) return blocked(operation.reason);
      const durable = durableBlockedReason(operation.view, "run_base");
      if (durable !== null) return blocked(durable);
      if (input.attemptTarget === undefined) return blocked("unhandled_state");
      const reconstructed = await deps.reconstruct({
        storeId: input.storeId,
        campaignId: input.campaignId,
        operationId: input.operationId,
      });
      if (!reconstructed.ok) return blocked("reconstruction_failed");
      const outcome = await deps.runBase({
        storeId: input.storeId,
        campaignId: input.campaignId,
        operationId: input.operationId,
        authorization: input.authorization,
        content: reconstructed.content,
        acquisitionId: input.acquisitionId,
        attemptReference: input.attemptReference,
        attemptTarget: input.attemptTarget,
        deadlineAtMs: input.deadlineAtMs,
        baseStatus: operation.view.base.status,
        allowNewPaidStep: input.allowNewPaidStep,
        frozenState: reconstructed.frozenState,
        ...(input.signal === undefined ? {} : { signal: input.signal }),
      });
      return { kind: "executed", action: "run_base", outcome };
    }
    default:
      return blocked("unhandled_state");
  }
}
