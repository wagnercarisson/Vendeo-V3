import type {
  BlockedStateReason,
  ResumeAction,
  StepView,
  TwoStageActivationInput,
  TwoStageOperationView,
  TwoStageProcessingPhase,
  TwoStageStatusView,
} from "../types";

const PAID_ACTIONS = new Set<ResumeAction>([
  "acquire_base",
  "retry_base",
  "acquire_expansion",
  "retry_expansion",
]);

function isPaid(action: ResumeAction): boolean {
  return PAID_ACTIONS.has(action);
}

function limitReached(view: TwoStageOperationView, stage: "base" | "expansion"): boolean {
  const step = stage === "base" ? view.base : view.expansion;
  if (stage === "base") return step.attemptsUsed >= 3;
  return step.attemptsUsed >= 2;
}

export function deriveDurableNextAction(
  view: Pick<TwoStageOperationView, "credit" | "base" | "expansion" | "unknown" | "failedOutcome">,
): ResumeAction {
  if (view.credit.terminal || view.unknown || view.failedOutcome) return "blocked";
  const { base, expansion } = view;
  if (base.status === "pending") return "acquire_base";
  if (base.status === "in_progress") return "wait";
  if (base.status === "failed") {
    if (base.failureClass === "transient" && !limitReached(view as TwoStageOperationView, "base")) {
      return "retry_base";
    }
    return "blocked";
  }
  if (base.status !== "done") return "blocked";
  if (expansion.status === "pending") return "acquire_expansion";
  if (expansion.status === "in_progress") return "wait";
  if (expansion.status === "failed") {
    if (
      expansion.failureClass === "transient" &&
      !limitReached(view as TwoStageOperationView, "expansion")
    ) {
      return "retry_expansion";
    }
    return "blocked";
  }
  if (expansion.status === "done") return "deliver";
  return "blocked";
}

export function classifyBlockedState(view: TwoStageOperationView): BlockedStateReason {
  if (view.credit.terminal) return "terminal";
  if (view.unknown) return "unknown";
  if (view.failedOutcome) return "other_blocked";
  if (view.base.status === "in_progress" || view.expansion.status === "in_progress") {
    return "in_progress";
  }
  const failedStage = view.base.status === "failed" ? view.base : view.expansion.status === "failed" ? view.expansion : null;
  if (!failedStage) return "other_blocked";
  if (failedStage.failureClass === "unknown") return "unknown";
  if (failedStage.failureClass === null) return "other_blocked";
  if (failedStage.failureClass === "definitive") return "known_final_failure";
  if (failedStage.failureClass === "transient") {
    return limitReached(view, failedStage.stage) ? "attempt_limit_exhausted" : "other_blocked";
  }
  return "other_blocked";
}

function processingPhase(
  view: TwoStageOperationView,
  activation: TwoStageActivationInput | undefined,
): TwoStageProcessingPhase {
  if (activation?.allowNewPaidStep === false && isPaid(view.nextAction)) {
    return "suspended";
  }
  if (view.base.status === "in_progress" || view.expansion.status === "in_progress") {
    return "step_in_progress";
  }
  if (view.nextAction === "deliver") return "delivery_pending";
  return "between_steps";
}

export function deriveTwoStageStatus(
  view: TwoStageOperationView,
  activation?: TwoStageActivationInput,
): TwoStageStatusView {
  if (view.credit.delivered) {
    return Object.freeze({ ...view, state: "delivered" as const, terminal: true });
  }
  if (view.credit.refunded) {
    return Object.freeze({ ...view, state: "refunded" as const, terminal: true });
  }
  if (view.unknown) {
    return Object.freeze({ ...view, state: "unknown" as const, terminal: false });
  }
  const phase = processingPhase(view, activation);
  const canContinue =
    phase !== "suspended" && view.nextAction !== "wait" && view.nextAction !== "blocked";
  return Object.freeze({
    ...view,
    nextAction: view.nextAction,
    canContinue,
    processingPhase: phase,
    state: "processing" as const,
    terminal: false,
  });
}

export function nextStepFromAction(action: ResumeAction): "base" | "expansion" | "delivery" | null {
  switch (action) {
    case "acquire_base":
    case "retry_base":
      return "base";
    case "acquire_expansion":
    case "retry_expansion":
      return "expansion";
    case "deliver":
      return "delivery";
    case "wait":
    case "blocked":
      return null;
  }
}

export type { StepView };
