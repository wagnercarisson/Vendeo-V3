import "server-only";

import type { AuthorizationContext } from "@/lib/campaign/composition-artifacts/types";
import type { SquareBaseInput, SquareBaseResult } from "@/lib/campaign/square-base/types";
import type { FrozenStateReadResult } from "@/lib/campaign/square-base/types";
import type { ProductTwoStageOperationClient } from "../two-stage-operation-client";
import type { AttemptTarget, TwoStageStepStatus } from "../types";
import { canAffordStep, remainingForStep } from "./deadline-budget";
import { mapModuleOutcomeToControl, type ModuleOutcome } from "./failure-mapping";
import { reconcileBaseArtifact } from "./reconciliation";
import {
  reconstructFirstExecution,
  reconstructForRepair,
  type ReconstructionDeps,
  type ReconstructedContent,
} from "./reconstruction";
import type { StepExecutionOutcome } from "./types";

export interface BaseStepInput {
  readonly storeId: string;
  readonly campaignId: string;
  readonly operationId: string;
  readonly authorization: AuthorizationContext;
  readonly content: ReconstructedContent;
  readonly acquisitionId: string;
  readonly attemptReference: string;
  readonly attemptTarget: AttemptTarget;
  readonly deadlineAtMs: number;
  readonly baseStatus: TwoStageStepStatus;
  readonly allowNewPaidStep: boolean;
  readonly frozenState: FrozenStateReadResult;
  readonly signal?: AbortSignal;
  readonly runId?: string;
  readonly traceId?: string;
}

export interface BaseStepDeps extends ReconstructionDeps {
  readonly control: Pick<ProductTwoStageOperationClient, "acquire" | "finish">;
  readonly base: (input: SquareBaseInput) => Promise<SquareBaseResult>;
  readonly clock: () => number;
  readonly reconcile?: typeof reconcileBaseArtifact;
}

function outcomeForFailure(result: Exclude<SquareBaseResult, { kind: "completed" }>): ModuleOutcome {
  switch (result.kind) {
    case "provider_failure":
      return { kind: "provider_failure", failureClass: result.failure.class };
    case "definitive_failure":
      return { kind: "definitive_failure" };
    case "unknown_result":
      return { kind: "unknown_result" };
    case "invalid_output":
      return { kind: "invalid_output" };
    case "existing_artifact_conflict":
      return { kind: "existing_artifact_conflict" };
    case "persistence_failed":
      return { kind: "persistence_failed" };
    case "readback_failed":
      return { kind: "readback_failed" };
    case "snapshot_failed":
      return { kind: "snapshot_failed", transient: result.reason !== "operation_identity_conflict" };
    case "content_divergence":
      return { kind: "content_divergence" };
    case "frozen_state_conflict":
      return { kind: "frozen_state_conflict" };
    case "blocked":
      return { kind: "blocked", transient: result.reason !== "artifact_without_frozen_state" };
    case "invalid_input":
      return { kind: "invalid_input" };
    case "authorization_denied":
      return { kind: "authorization_denied" };
  }
}

function contentToSquareBaseInput(
  input: BaseStepInput,
  attempt: { number: number; target: AttemptTarget; reference: string },
  timeoutMs: number,
): SquareBaseInput {
  return {
    storeId: input.storeId,
    campaignId: input.campaignId,
    operationId: input.operationId,
    authorization: input.authorization,
    briefing: input.content.briefing,
    briefingText: input.content.briefingText,
    campaignIntent: input.content.campaignIntent,
    backgroundDirection: input.content.backgroundDirection,
    productImagesDataUrls: input.content.productImagesDataUrls,
    ...(input.content.identityImageUrl === undefined
      ? {}
      : { identityImageUrl: input.content.identityImageUrl }),
    ...(input.content.identityDirective === undefined
      ? {}
      : { identityDirective: input.content.identityDirective }),
    ...(input.content.references === undefined ? {} : { references: input.content.references }),
    ...(input.content.referenceSelections === undefined
      ? {}
      : { referenceSelections: input.content.referenceSelections }),
    ...(input.content.copyContext === undefined
      ? {}
      : { copyContext: input.content.copyContext }),
    attempt: {
      number: attempt.number,
      target: attempt.target === "fallback" ? "fallback" : "primary",
      reference: attempt.reference,
    },
    ...(input.runId === undefined ? {} : { runId: input.runId }),
    ...(input.traceId === undefined ? {} : { traceId: input.traceId }),
    usdBrlRateAtGeneration: input.content.usdBrlRateAtGeneration,
    creditValueBrlAtGeneration: input.content.creditValueBrlAtGeneration,
    timeoutMs,
    ...(input.signal === undefined ? {} : { signal: input.signal }),
  };
}

export async function runBaseStep(
  input: BaseStepInput,
  deps: BaseStepDeps,
): Promise<StepExecutionOutcome> {
  if (!input.allowNewPaidStep) {
    return { kind: "processing", state: "suspended", nextStep: "base", canContinue: false };
  }
  if (input.baseStatus === "done") return { kind: "skipped" };
  if (input.baseStatus === "in_progress") {
    return { kind: "processing", state: "step_in_progress", nextStep: "base", canContinue: false };
  }
  if (!canAffordStep(deps.clock(), input.deadlineAtMs, "base")) {
    return { kind: "processing", state: "between_steps", nextStep: "base", canContinue: true };
  }

  let content = input.content;
  if (input.frozenState.kind === "repairable") {
    const repair = await reconstructForRepair(
      {
        campaignId: input.campaignId,
        operationId: input.operationId,
        storeId: input.storeId,
        frozen: input.frozenState,
      },
      deps,
    );
    if (!repair.ok) {
      return repair.definitive
        ? { kind: "definitive", reason: repair.reason }
        : { kind: "unknown", reason: repair.reason };
    }
    content = repair.content;
  } else if (input.frozenState.kind === "absent") {
    const reconstruction = await reconstructFirstExecution(
      {
        campaignId: input.campaignId,
        operationId: input.operationId,
        storeId: input.storeId,
        frozen: input.frozenState,
      },
      deps,
    );
    if (!reconstruction.ok) {
      return reconstruction.definitive
        ? { kind: "definitive", reason: reconstruction.reason }
        : { kind: "unknown", reason: reconstruction.reason };
    }
    content = reconstruction.content;
  } else if (input.frozenState.kind !== "complete") {
    return { kind: "definitive", reason: "artifact_without_frozen_state" };
  }

  const acquire = await deps.control.acquire({
    campaignId: input.campaignId,
    operationId: input.operationId,
    stage: "base",
    requestId: input.acquisitionId,
    target: input.attemptTarget,
  });
  if (!acquire.acquired) {
    return {
      kind: "processing",
      state: "step_in_progress",
      nextStep: "base",
      canContinue: false,
      reason: acquire.reason ?? "query_only",
    };
  }

  const remaining = remainingForStep(deps.clock(), input.deadlineAtMs);
  const result = await deps.base(
    contentToSquareBaseInput(
      { ...input, content },
      {
        number: acquire.attemptNumber,
        target: acquire.target,
        reference: input.attemptReference,
      },
      remaining,
    ),
  );

  if (result.kind === "completed") {
    await deps.control.finish({
      campaignId: input.campaignId,
      operationId: input.operationId,
      attemptToken: acquire.attemptToken,
      expectedStatus: "in_progress",
      status: "completed",
    });
    return { kind: "completed" };
  }

  const mapped = mapModuleOutcomeToControl(outcomeForFailure(result));
  if (mapped.reconcileFirst) {
    const reconcile = deps.reconcile ?? reconcileBaseArtifact;
    const reconciled = await reconcile(
      {
        storeId: input.storeId,
        campaignId: input.campaignId,
        operationId: input.operationId,
        authorization: input.authorization,
      },
      deps,
    );
    if (reconciled.kind === "completed") {
      await deps.control.finish({
        campaignId: input.campaignId,
        operationId: input.operationId,
        attemptToken: acquire.attemptToken,
        expectedStatus: "in_progress",
        status: "completed",
      });
      return { kind: "completed" };
    }
    if (reconciled.kind === "unknown") {
      return { kind: "unknown", reason: reconciled.reason };
    }
  }

  try {
    await deps.control.finish({
      campaignId: input.campaignId,
      operationId: input.operationId,
      attemptToken: acquire.attemptToken,
      expectedStatus: "in_progress",
      status: "failed",
      failureClass: mapped.finishFailureClass,
    });
  } catch {
    return { kind: "unknown", reason: "late_finish_rejected" };
  }

  if (mapped.finishFailureClass === "unknown") {
    return { kind: "unknown", reason: "provider_unknown" };
  }
  if (mapped.finishFailureClass === "transient") {
    return { kind: "retryable", reason: "transient" };
  }
  return { kind: "definitive", reason: result.kind };
}
