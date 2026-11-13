import "server-only";

import type { AuthorizationContext } from "@/lib/campaign/composition-artifacts/types";
import type { ProjectDeliveredCampaignResult } from "@/lib/product-1-1/orchestration/project-delivered-campaign";
import type { ProjectClosedCampaignResult } from "@/lib/product-1-1/orchestration/project-closed-campaign";
import type { ThumbnailContext } from "@/lib/campaign/thumbnail/thumbnail-generator";
import type {
  TwoStageFinancialService,
  VerticalArtifactProbe,
  VerticalArtifactProbeResult,
} from "../two-stage-financial-service";
import type { ProductTwoStageOperationClient } from "../two-stage-operation-client";
import type { TwoStageStage } from "../types";
import type { StepExecutionOutcome } from "./types";

export interface DeliveryDeps {
  readonly control: Pick<ProductTwoStageOperationClient, "resume" | "finish" | "recordOutcome">;
  readonly financial: Pick<
    TwoStageFinancialService,
    | "confirmOnVerticalDelivery"
    | "refundOnDefinitiveFailure"
    | "readFinancialAuthority"
  >;
  readonly credit: {
    beginPublication(campaignId: string, operationId: string): Promise<{
      readonly acquired: boolean;
      readonly token?: string | null;
    }>;
    getPublicationEpoch(campaignId: string, operationId: string): Promise<number>;
    markArtUploaded(campaignId: string, operationId: string, token: string): Promise<unknown>;
    deliver(campaignId: string, operationId: string, token: string): Promise<unknown>;
  };
  readonly probeVertical: VerticalArtifactProbe;
  readonly projectDelivered: (input: {
    storeId: string;
    campaignId: string;
    operationId: string;
  }) => Promise<ProjectDeliveredCampaignResult>;
  readonly projectClosed: (input: {
    storeId: string;
    campaignId: string;
    operationId: string;
  }) => Promise<ProjectClosedCampaignResult>;
  readonly generateThumbnail: (input: {
    originalPath: string;
    originalBuffer: Buffer;
    context: ThumbnailContext | null;
    campaignId: string;
  }) => Promise<unknown>;
  readonly clock: () => number;
}

export interface DeliveryInput {
  readonly storeId: string;
  readonly campaignId: string;
  readonly operationId: string;
  readonly authorization: AuthorizationContext;
}

export type DeliveryOutcome =
  | { readonly kind: "completed" }
  | { readonly kind: "processing"; readonly reason: "delivery_pending" }
  | { readonly kind: "unknown"; readonly reason: string }
  | { readonly kind: "definitive"; readonly reason: string };

export async function deliverVertical(
  input: DeliveryInput,
  deps: DeliveryDeps,
): Promise<DeliveryOutcome> {
  const resume = await deps.control.resume({
    campaignId: input.campaignId,
    operationId: input.operationId,
  });
  if (!resume.success) return { kind: "unknown", reason: resume.reason };
  if (resume.creditStatus === "delivered") return { kind: "completed" };
  if (resume.creditStatus === "refunded") return { kind: "definitive", reason: "operation_terminal" };
  if (resume.baseStatus !== "done" || resume.expansionStatus !== "done") {
    return { kind: "processing", reason: "delivery_pending" };
  }

  const probe = await deps.probeVertical.probeVerticalArtifact({
    storeId: input.storeId,
    campaignId: input.campaignId,
    operationId: input.operationId,
  });
  if (probe.kind !== "integral") {
    return probe.kind === "indeterminate"
      ? { kind: "unknown", reason: "vertical_indeterminate" }
      : { kind: "definitive", reason: `vertical_${probe.kind}` };
  }

  const publication = await deps.credit.beginPublication(input.campaignId, input.operationId);
  if (!publication.acquired || !publication.token) {
    const authority = await deps.financial.readFinancialAuthority(
      input.campaignId,
      input.operationId,
    );
    if (authority?.delivered) return { kind: "completed" };
    return { kind: "processing", reason: "delivery_pending" };
  }

  await deps.financial.confirmOnVerticalDelivery({
    storeId: input.storeId,
    campaignId: input.campaignId,
    operationId: input.operationId,
    publicationToken: publication.token,
    verticalArtifactProbe: deps.probeVertical,
  });

  const projection = await deps.projectDelivered({
    storeId: input.storeId,
    campaignId: input.campaignId,
    operationId: input.operationId,
  });
  if (!projection.projected) return { kind: "processing", reason: "delivery_pending" };

  try {
    await deps.generateThumbnail({
      originalPath: probe.storagePath,
      originalBuffer: Buffer.alloc(0),
      context: null,
      campaignId: input.campaignId,
    });
  } catch {
    // Thumbnail is best-effort and never blocks delivery.
  }
  return { kind: "completed" };
}

export type FinalizeFailureResult =
  | { readonly kind: "refunded" }
  | { readonly kind: "delivery_required"; readonly probe: VerticalArtifactProbeResult & { kind: "integral" } }
  | { readonly kind: "unknown"; readonly reason: string };

export async function finalizeDefinitiveFailure(
  input: DeliveryInput & {
    readonly stage: TwoStageStage;
    readonly attemptToken?: string;
    readonly supportReference?: string | null;
  },
  deps: DeliveryDeps,
): Promise<FinalizeFailureResult> {
  if (input.attemptToken) {
    try {
      await deps.control.finish({
        campaignId: input.campaignId,
        operationId: input.operationId,
        attemptToken: input.attemptToken,
        expectedStatus: "in_progress",
        status: "failed",
        failureClass: "definitive",
      });
    } catch {
      // Late finish has no effect; finality is still recorded below.
    }
  }

  const probe = await deps.probeVertical.probeVerticalArtifact({
    storeId: input.storeId,
    campaignId: input.campaignId,
    operationId: input.operationId,
  });
  if (probe.kind === "integral") {
    return { kind: "delivery_required", probe };
  }
  if (probe.kind === "invalid" || probe.kind === "indeterminate") {
    await deps.control.recordOutcome({
      campaignId: input.campaignId,
      operationId: input.operationId,
      stage: input.stage,
      outcome: "unknown",
      supportReference: input.supportReference ?? null,
    });
    return { kind: "unknown", reason: `vertical_${probe.kind}` };
  }

  await deps.control.recordOutcome({
    campaignId: input.campaignId,
    operationId: input.operationId,
    stage: input.stage,
    outcome: "failed",
    supportReference: input.supportReference ?? null,
  });
  const refund = await deps.financial.refundOnDefinitiveFailure({
    storeId: input.storeId,
    campaignId: input.campaignId,
    operationId: input.operationId,
    verticalArtifactProbe: deps.probeVertical,
  });
  if (refund.kind === "delivery_required") {
    return { kind: "delivery_required", probe: refund.probe };
  }
  if (refund.kind === "insufficient_evidence") {
    return { kind: "unknown", reason: `refund_${refund.probeKind}` };
  }
  await deps.projectClosed({
    storeId: input.storeId,
    campaignId: input.campaignId,
    operationId: input.operationId,
  });
  return { kind: "refunded" };
}

export async function finalizeExhaustedLimit(
  input: DeliveryInput & {
    readonly stage: TwoStageStage;
    readonly supportReference?: string | null;
  },
  deps: DeliveryDeps,
): Promise<FinalizeFailureResult> {
  const authority = await deps.financial.readFinancialAuthority(
    input.campaignId,
    input.operationId,
  );
  if (authority?.refunded) return { kind: "refunded" };

  const probe = await deps.probeVertical.probeVerticalArtifact({
    storeId: input.storeId,
    campaignId: input.campaignId,
    operationId: input.operationId,
  });
  if (probe.kind === "integral") {
    return { kind: "delivery_required", probe };
  }
  if (authority?.delivered) {
    return { kind: "unknown", reason: "delivered_without_integral_vertical" };
  }
  if (probe.kind === "invalid" || probe.kind === "indeterminate") {
    await deps.control.recordOutcome({
      campaignId: input.campaignId,
      operationId: input.operationId,
      stage: input.stage,
      outcome: "unknown",
      supportReference: input.supportReference ?? null,
    });
    return { kind: "unknown", reason: `vertical_${probe.kind}` };
  }

  await deps.control.recordOutcome({
    campaignId: input.campaignId,
    operationId: input.operationId,
    stage: input.stage,
    outcome: "failed",
    supportReference: input.supportReference ?? null,
  });
  const refund = await deps.financial.refundOnDefinitiveFailure({
    storeId: input.storeId,
    campaignId: input.campaignId,
    operationId: input.operationId,
    verticalArtifactProbe: deps.probeVertical,
  });
  if (refund.kind === "delivery_required") return { kind: "delivery_required", probe: refund.probe };
  if (refund.kind === "insufficient_evidence") return { kind: "unknown", reason: `refund_${refund.probeKind}` };
  await deps.projectClosed({
    storeId: input.storeId,
    campaignId: input.campaignId,
    operationId: input.operationId,
  });
  return { kind: "refunded" };
}
