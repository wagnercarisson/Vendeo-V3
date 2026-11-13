import "server-only";

import type { ProductTwoStageOperationClient } from "../two-stage-operation-client";
import type {
  FinishStepRequest,
  FinishStepResult,
  TwoStageStage,
} from "../types";

/**
 * Resultado REAL de um `finish`. A RPC pode devolver `{ success: false }` sem
 * lancar excecao; nesse caso a autoridade e relida antes de qualquer avanco.
 */
export type FinishAck =
  | { readonly kind: "accepted"; readonly idempotent: boolean }
  | { readonly kind: "already_done" }
  | { readonly kind: "rejected"; readonly reason: string }
  | { readonly kind: "unknown"; readonly reason: string };

export interface FinishAckDeps {
  readonly control: Pick<ProductTwoStageOperationClient, "finish" | "getOperationView">;
}

function stepIsDone(
  lookup: Awaited<ReturnType<ProductTwoStageOperationClient["getOperationView"]>>,
  stage: TwoStageStage,
): boolean {
  if (lookup.kind !== "found") return false;
  const step = stage === "base" ? lookup.view.base : lookup.view.expansion;
  return step.status === "done";
}

export async function finishStepWithAck(
  input: { readonly stage: TwoStageStage; readonly request: FinishStepRequest },
  deps: FinishAckDeps,
): Promise<FinishAck> {
  let result: FinishStepResult;
  try {
    result = await deps.control.finish(input.request);
  } catch {
    return { kind: "unknown", reason: "finish_threw" };
  }
  if (result.success) {
    return { kind: "accepted", idempotent: result.idempotent };
  }

  // Recusa NAO autoriza avanco: reler a autoridade para distinguir uma
  // execucao tardia ja persistida de uma recusa real.
  let lookup: Awaited<ReturnType<ProductTwoStageOperationClient["getOperationView"]>>;
  try {
    lookup = await deps.control.getOperationView({
      campaignId: input.request.campaignId,
      operationId: input.request.operationId,
    });
  } catch {
    return { kind: "unknown", reason: `finish_${result.reason}_ack_unreadable` };
  }
  if (stepIsDone(lookup, input.stage)) {
    return { kind: "already_done" };
  }
  if (lookup.kind === "read_failed") {
    return { kind: "unknown", reason: `finish_${result.reason}_ack_unreadable` };
  }
  return { kind: "rejected", reason: result.reason };
}
