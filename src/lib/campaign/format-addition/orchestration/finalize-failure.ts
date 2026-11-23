import "server-only";

import type { AuthorizationContext } from "@/lib/campaign/composition-artifacts/types";
import type { ProductTwoStageOperationClient } from "@/lib/product-9-16-two-stage/two-stage-operation-client";
import type { RunNineSixteenDeps } from "@/lib/product-9-16-two-stage/orchestration/types";
import type { VerticalArtifactProbe } from "@/lib/product-9-16-two-stage/two-stage-financial-service";

import type {
  FormatAdditionRefundInput,
  FormatAdditionRefundResult,
} from "../financial-client";
import type { FormatAdditionFinalizationOutcome } from "./types";

/**
 * F62/62-04 (Task 4) — falha definitiva e unknown da adição.
 *
 * Só estorna com arte ausente comprovada, epoch observado antes da sonda e
 * outcome `failed` durável. `unknown` nunca estorna nem regenera. A operação
 * original, o quadrado e a copy permanecem intocados.
 */
export interface FinalizeFormatAdditionFailureInput {
  readonly storeId: string;
  readonly campaignId: string;
  readonly operationId: string;
  readonly authorization: AuthorizationContext;
  readonly reason: string;
}

export interface FinalizeFormatAdditionFailureDeps {
  readonly probe: VerticalArtifactProbe;
  readonly publication: Pick<RunNineSixteenDeps["credit"], "getPublicationEpoch">;
  readonly control: Pick<ProductTwoStageOperationClient, "recordOutcome">;
  readonly refund: (
    input: FormatAdditionRefundInput,
  ) => Promise<FormatAdditionRefundResult>;
}

export async function finalizeFormatAdditionFailure(
  input: FinalizeFormatAdditionFailureInput,
  deps: FinalizeFormatAdditionFailureDeps,
): Promise<FormatAdditionFinalizationOutcome> {
  let observedEpoch: number;
  try {
    observedEpoch = await deps.publication.getPublicationEpoch(
      input.campaignId,
      input.operationId,
    );
  } catch (error) {
    return Object.freeze({
      kind: "unknown" as const,
      reason: error instanceof Error ? error.message : String(error),
    });
  }

  let probe;
  try {
    probe = await deps.probe.probeVerticalArtifact({
      storeId: input.storeId,
      campaignId: input.campaignId,
      operationId: input.operationId,
    });
  } catch {
    return Object.freeze({ kind: "unknown" as const, reason: "probe_read_failed" });
  }

  if (probe.kind === "integral") {
    return Object.freeze({
      kind: "delivered" as const,
      reason: "artifact_present",
    });
  }
  if (probe.kind === "indeterminate") {
    return Object.freeze({ kind: "unknown" as const, reason: "probe_indeterminate" });
  }
  if (probe.kind !== "absent") {
    return Object.freeze({ kind: "blocked" as const, reason: "artifact_not_absent" });
  }

  try {
    const outcome = await deps.control.recordOutcome({
      campaignId: input.campaignId,
      operationId: input.operationId,
      stage: "expansion",
      outcome: "failed",
      supportReference: input.reason,
    });
    if (!outcome.success) {
      return Object.freeze({ kind: "blocked" as const, reason: outcome.reason });
    }
  } catch (error) {
    return Object.freeze({
      kind: "unknown" as const,
      reason: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    const refund = await deps.refund({
      storeId: input.storeId,
      campaignId: input.campaignId,
      operationId: input.operationId,
      observedEpoch,
      reason: input.reason,
    });
    if (refund.success) {
      return Object.freeze({ kind: "refunded" as const });
    }
    return Object.freeze({
      kind:
        refund.reason === "operation_unknown" ||
        refund.reason === "operation_in_progress"
          ? ("unknown" as const)
          : ("blocked" as const),
      reason: refund.reason,
    });
  } catch (error) {
    return Object.freeze({
      kind: "unknown" as const,
      reason: error instanceof Error ? error.message : String(error),
    });
  }
}
