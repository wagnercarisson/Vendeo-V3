import "server-only";

import type { AuthorizationContext } from "@/lib/campaign/composition-artifacts/types";

import {
  parseFrozenEconomics,
} from "../frozen-economics";
import type {
  FormatAdditionExecutionDeps,
  FormatAdditionRunResult,
} from "./types";

export interface ContinueFormatAdditionInput {
  readonly storeId: string;
  readonly campaignId: string;
  readonly operationId: string;
  readonly requestId: string;
  readonly authorization: AuthorizationContext;
  readonly deadlineAtMs: number;
  readonly allowNewPaidStep: boolean;
  readonly signal?: AbortSignal;
}

function fail(
  code: string,
  reason: string,
  detail?: string,
): FormatAdditionRunResult {
  return Object.freeze({
    ok: false as const,
    code,
    reason,
    ...(detail === undefined ? {} : { detail }),
  });
}

export async function continueFormatAddition(
  input: ContinueFormatAdditionInput,
  deps: FormatAdditionExecutionDeps,
): Promise<FormatAdditionRunResult> {
  const durable = await deps.readDurableContext({
    storeId: input.storeId,
    campaignId: input.campaignId,
    operationId: input.operationId,
  });
  if (durable.kind === "missing") {
    return fail("durable_context_missing", "format_addition_not_found");
  }
  if (durable.kind === "read_failed") {
    return fail("durable_context_read_failed", durable.reason);
  }

  const frozen = parseFrozenEconomics(
    durable.context.selection,
    durable.context.frozenEconomics,
  );
  if (!frozen.ok) {
    return fail(
      "frozen_economics_invalid",
      frozen.reason,
      frozen.detail,
    );
  }

  const prepared = await deps.prepare({
    source: {
      storeId: input.storeId,
      campaignId: input.campaignId,
      operationId: durable.context.sourceRegistrationOperationId,
      role: "square_original",
    },
    preparedOperationId: input.operationId,
    authorization: input.authorization,
  });
  if (prepared.kind !== "prepared") {
    if (
      prepared.kind === "indeterminate" ||
      (prepared.kind === "source_unavailable" &&
        prepared.reason === "indeterminate")
    ) {
      return Object.freeze({
        ok: true as const,
        kind: "processing" as const,
        operationId: input.operationId,
        requestId: input.requestId,
        state: "preparation_retry",
      });
    }
    return finalize(input, deps, `preparation_${prepared.kind}`);
  }

  let lookup;
  try {
    lookup = await deps.control.getOperationView({
      campaignId: input.campaignId,
      operationId: input.operationId,
    });
  } catch (error) {
    return fail(
      "operation_view_read_failed",
      error instanceof Error ? error.message : String(error),
    );
  }
  if (lookup.kind === "absent") {
    return fail("operation_not_found", "format_addition_not_found");
  }
  if (lookup.kind === "read_failed") {
    return fail("operation_view_read_failed", lookup.reason);
  }
  const view = lookup.view;

  if (view.credit.delivered) {
    return Object.freeze({
      ok: true as const,
      kind: "delivered" as const,
      operationId: input.operationId,
      requestId: input.requestId,
      idempotent: true,
    });
  }
  if (view.credit.refunded) {
    return Object.freeze({
      ok: true as const,
      kind: "refunded" as const,
      operationId: input.operationId,
      requestId: input.requestId,
    });
  }
  if (view.unknown || view.failedOutcome) {
    return Object.freeze({
      ok: true as const,
      kind: "unknown" as const,
      operationId: input.operationId,
      requestId: input.requestId,
      reason: view.unknown ? "operation_unknown" : "failed_outcome",
    });
  }
  if (view.base.status !== "done") {
    return Object.freeze({
      ok: true as const,
      kind: "processing" as const,
      operationId: input.operationId,
      requestId: input.requestId,
      state: "base_not_done",
    });
  }

  if (view.expansion.status === "done" || view.nextAction === "deliver") {
    return deliverOrFinalize(input, deps);
  }
  if (view.expansion.status === "in_progress" || view.nextAction === "wait") {
    return Object.freeze({
      ok: true as const,
      kind: "processing" as const,
      operationId: input.operationId,
      requestId: input.requestId,
      state: "expansion_in_progress",
    });
  }
  if (view.nextAction === "blocked") {
    return Object.freeze({
      ok: true as const,
      kind: "unknown" as const,
      operationId: input.operationId,
      requestId: input.requestId,
      reason: "operation_blocked",
    });
  }

  const expansion = await deps.runExpansion({
    storeId: input.storeId,
    campaignId: input.campaignId,
    operationId: input.operationId,
    authorization: input.authorization,
    selection: {
      model: frozen.frozen.selection.model,
      quality: frozen.frozen.selection.quality,
      configVersionId: frozen.frozen.selection.configVersionId,
      origin: "configured",
    },
    frozen: frozen.frozen,
    acquisitionId: deps.callId(),
    attemptReference: deps.callId(),
    attemptTarget:
      view.nextAction === "retry_expansion" ? "retry" : "initial",
    deadlineAtMs: input.deadlineAtMs,
    expansionStatus: view.expansion.status,
    allowNewPaidStep: input.allowNewPaidStep,
    ...(input.signal === undefined ? {} : { signal: input.signal }),
  });

  switch (expansion.kind) {
    case "completed":
      return deliverOrFinalize(input, deps);
    case "processing":
    case "retryable":
      return Object.freeze({
        ok: true as const,
        kind: "processing" as const,
        operationId: input.operationId,
        requestId: input.requestId,
        state: expansion.kind === "processing" ? expansion.state : "retryable",
        ...("reason" in expansion && expansion.reason !== undefined
          ? { reason: expansion.reason }
          : {}),
      });
    case "definitive":
      return finalize(input, deps, expansion.reason);
    case "unknown":
      return Object.freeze({
        ok: true as const,
        kind: "unknown" as const,
        operationId: input.operationId,
        requestId: input.requestId,
        reason: expansion.reason,
      });
    case "skipped":
      return Object.freeze({
        ok: true as const,
        kind: "processing" as const,
        operationId: input.operationId,
        requestId: input.requestId,
        state: "skipped",
      });
  }
}

async function deliverOrFinalize(
  input: ContinueFormatAdditionInput,
  deps: FormatAdditionExecutionDeps,
  allowFinalize = true,
): Promise<FormatAdditionRunResult> {
  const delivery = await deps.deliverVertical({
    storeId: input.storeId,
    campaignId: input.campaignId,
    operationId: input.operationId,
    authorization: input.authorization,
  });

  switch (delivery.kind) {
    case "delivered":
      return Object.freeze({
        ok: true as const,
        kind: "delivered" as const,
        operationId: input.operationId,
        requestId: input.requestId,
        idempotent: delivery.idempotent,
      });
    case "processing":
      return Object.freeze({
        ok: true as const,
        kind: "processing" as const,
        operationId: input.operationId,
        requestId: input.requestId,
        state: "delivery_pending",
        reason: delivery.reason,
      });
    case "indeterminate":
      return Object.freeze({
        ok: true as const,
        kind: "unknown" as const,
        operationId: input.operationId,
        requestId: input.requestId,
        reason: "vertical_artifact_indeterminate",
      });
    case "absent":
      return allowFinalize
        ? finalize(input, deps, "vertical_artifact_absent")
        : fail("delivery_failed", "vertical_artifact_absent");
    case "invalid":
      return allowFinalize
        ? finalize(input, deps, "vertical_artifact_invalid")
        : fail("delivery_failed", "vertical_artifact_invalid");
    case "failed":
      return fail("delivery_failed", delivery.reason, delivery.code);
  }
}

async function finalize(
  input: ContinueFormatAdditionInput,
  deps: FormatAdditionExecutionDeps,
  reason: string,
): Promise<FormatAdditionRunResult> {
  const finalized = await deps.finalizeFailure({
    storeId: input.storeId,
    campaignId: input.campaignId,
    operationId: input.operationId,
    authorization: input.authorization,
    reason,
  });

  switch (finalized.kind) {
    case "refunded":
      return Object.freeze({
        ok: true as const,
        kind: "refunded" as const,
        operationId: input.operationId,
        requestId: input.requestId,
      });
    case "delivered":
      return deliverOrFinalize(input, deps, false);
    case "unknown":
      return Object.freeze({
        ok: true as const,
        kind: "unknown" as const,
        operationId: input.operationId,
        requestId: input.requestId,
        reason: finalized.reason,
      });
    case "blocked":
      return fail("finalization_blocked", finalized.reason);
  }
}
