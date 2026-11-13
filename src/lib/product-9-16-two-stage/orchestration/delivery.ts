import "server-only";

import type { AuthorizationContext } from "@/lib/campaign/composition-artifacts/types";
import type { ProjectDeliveredCampaignResult } from "@/lib/product-1-1/orchestration/project-delivered-campaign";
import type { ProjectClosedCampaignResult } from "@/lib/product-1-1/orchestration/project-closed-campaign";
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
    readonly storeId: string;
    readonly campaignId: string;
    readonly operationId: string;
    readonly storagePath: string;
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

async function projectDeliveredAndThumbnail(
  input: DeliveryInput,
  deps: DeliveryDeps,
  storagePath: string | null,
): Promise<DeliveryOutcome> {
  // A projecao e idempotente e SEMPRE reexecutada em replay: se falhou na
  // execucao anterior, a continuacao a repara sem nova chamada paga.
  const projection = await deps.projectDelivered({
    storeId: input.storeId,
    campaignId: input.campaignId,
    operationId: input.operationId,
  });
  if (!projection.projected) return { kind: "processing", reason: "delivery_pending" };

  if (storagePath !== null) {
    try {
      // O adaptador real recupera os bytes/contexto do vertical a partir do
      // caminho; nenhum buffer vazio e fabricado aqui.
      await deps.generateThumbnail({
        storeId: input.storeId,
        campaignId: input.campaignId,
        operationId: input.operationId,
        storagePath,
      });
    } catch {
      // Thumbnail is best-effort and never blocks delivery.
    }
  }
  return { kind: "completed" };
}

export async function deliverVertical(
  input: DeliveryInput,
  deps: DeliveryDeps,
): Promise<DeliveryOutcome> {
  const resume = await deps.control.resume({
    campaignId: input.campaignId,
    operationId: input.operationId,
  });
  if (!resume.success) return { kind: "unknown", reason: resume.reason };
  if (resume.creditStatus === "refunded") return { kind: "definitive", reason: "operation_terminal" };
  if (resume.creditStatus === "delivered") {
    // Replay entregue: reparar a projecao (e a miniatura) antes de declarar
    // sucesso. A sonda e read-only e so fornece o caminho do vertical.
    const probe = await deps.probeVertical.probeVerticalArtifact({
      storeId: input.storeId,
      campaignId: input.campaignId,
      operationId: input.operationId,
    });
    return projectDeliveredAndThumbnail(
      input,
      deps,
      probe.kind === "integral" ? probe.storagePath : null,
    );
  }
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
    if (authority?.delivered) {
      return projectDeliveredAndThumbnail(input, deps, probe.storagePath);
    }
    return { kind: "processing", reason: "delivery_pending" };
  }

  await deps.financial.confirmOnVerticalDelivery({
    storeId: input.storeId,
    campaignId: input.campaignId,
    operationId: input.operationId,
    publicationToken: publication.token,
    verticalArtifactProbe: deps.probeVertical,
  });

  return projectDeliveredAndThumbnail(input, deps, probe.storagePath);
}

export type FinalizeFailureResult =
  | { readonly kind: "refunded" }
  | { readonly kind: "delivery_required"; readonly probe: VerticalArtifactProbeResult & { kind: "integral" } }
  | { readonly kind: "unknown"; readonly reason: string };

async function recordFinalOutcome(
  input: {
    readonly campaignId: string;
    readonly operationId: string;
    readonly stage: TwoStageStage;
    readonly outcome: "failed" | "unknown";
    readonly supportReference?: string | null;
  },
  deps: DeliveryDeps,
): Promise<{ readonly ok: true } | { readonly ok: false; readonly reason: string }> {
  let result: Awaited<ReturnType<ProductTwoStageOperationClient["recordOutcome"]>>;
  try {
    result = await deps.control.recordOutcome({
      campaignId: input.campaignId,
      operationId: input.operationId,
      stage: input.stage,
      outcome: input.outcome,
      supportReference: input.supportReference ?? null,
    });
  } catch {
    return { ok: false, reason: "record_outcome_threw" };
  }
  if (result.success) return { ok: true };
  return { ok: false, reason: `record_outcome_${result.reason}` };
}

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
    const recorded = await recordFinalOutcome(
      {
        campaignId: input.campaignId,
        operationId: input.operationId,
        stage: input.stage,
        outcome: "unknown",
        supportReference: input.supportReference,
      },
      deps,
    );
    if (!recorded.ok) return { kind: "unknown", reason: recorded.reason };
    return { kind: "unknown", reason: `vertical_${probe.kind}` };
  }

  const recorded = await recordFinalOutcome(
    {
      campaignId: input.campaignId,
      operationId: input.operationId,
      stage: input.stage,
      outcome: "failed",
      supportReference: input.supportReference,
    },
    deps,
  );
  if (!recorded.ok) return { kind: "unknown", reason: recorded.reason };
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
    const recorded = await recordFinalOutcome(
      {
        campaignId: input.campaignId,
        operationId: input.operationId,
        stage: input.stage,
        outcome: "unknown",
        supportReference: input.supportReference,
      },
      deps,
    );
    if (!recorded.ok) return { kind: "unknown", reason: recorded.reason };
    return { kind: "unknown", reason: `vertical_${probe.kind}` };
  }

  const recorded = await recordFinalOutcome(
    {
      campaignId: input.campaignId,
      operationId: input.operationId,
      stage: input.stage,
      outcome: "failed",
      supportReference: input.supportReference,
    },
    deps,
  );
  if (!recorded.ok) return { kind: "unknown", reason: recorded.reason };
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
