import "server-only";

import type { ExpansionSelection } from "@/lib/ai/nine-sixteen-expansion-model-config";
import type { AuthorizationContext } from "@/lib/campaign/composition-artifacts/types";
import type { PreparationStepInput } from "@/lib/product-9-16-two-stage/orchestration/preparation-step";
import type { ExpansionStepInput } from "@/lib/product-9-16-two-stage/orchestration/expansion-step";
import type { VerticalArtifactProbeResult } from "@/lib/product-9-16-two-stage/two-stage-financial-service";
import type {
  AttemptTarget,
  ResumeOperationResult,
  TwoStageStepStatus,
} from "@/lib/product-9-16-two-stage/types";
import type {
  NineSixteenNextStep,
  NineSixteenProcessingState,
  StepExecutionOutcome,
} from "@/lib/product-9-16-two-stage/orchestration/types";

import type {
  TwoFormatDeliverInput,
  TwoFormatDeliverReason,
  TwoFormatDeliverResult,
  TwoFormatDeliveryErrorCode,
} from "@/lib/product-two-format/joint-financial-client";
import type { CreditOperationErrorCode } from "@/lib/product-1-1/credit-operation/types";

/**
 * F60.7-06 — entrega do vertical conjunto por um confirmador DEDICADO.
 *
 * O artefato final já foi persistido e verificado pelo step layer; aqui só se
 * confirma a entrega sob a identidade de CONTROLE (que também é a identidade
 * financeira do vertical). A confirmação e a projeção são atômicas na RPC
 * conjunta: este módulo não projeta, não faz upload, não copia bytes e não
 * estorna.
 *
 * Fence: o abort só ocorre com token JÁ adquirido e falha comprovadamente sem
 * confirmação (allowlist). Resposta ambígua/transporte preserva o fence para
 * reconciliação — a mesma política aprovada no plano 05.
 */

export interface JointVerticalDeliveryInput {
  readonly storeId: string;
  readonly campaignId: string;
  /** Identidade de CONTROLE; é também a identidade financeira do vertical. */
  readonly operationId: string;
  readonly authorization: AuthorizationContext;
  readonly acquisitionId: string;
  readonly attemptReference: string;
  readonly attemptTarget: AttemptTarget;
  readonly deadlineAtMs: number;
  readonly expansionStatus: TwoStageStepStatus;
  /** Seleção congelada, derivada da operação persistida pelo chamador. */
  readonly selection: ExpansionSelection;
  readonly allowNewPaidStep: boolean;
  readonly signal?: AbortSignal;
}

export interface JointVerticalDeliveryDeps {
  readonly resume: (input: {
    campaignId: string;
    operationId: string;
  }) => Promise<ResumeOperationResult>;
  readonly prepare: (
    input: PreparationStepInput,
  ) => Promise<StepExecutionOutcome>;
  readonly expand: (input: ExpansionStepInput) => Promise<StepExecutionOutcome>;
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
  readonly deliverFormat: (
    input: TwoFormatDeliverInput,
  ) => Promise<TwoFormatDeliverResult>;
  readonly clock?: () => number;
}

export type JointVerticalDeliveryOutcome =
  | {
      readonly kind: "delivered";
      readonly idempotent: boolean;
      readonly campaignStatus: string | null;
      readonly storagePath: string | null;
    }
  | {
      readonly kind: "processing";
      readonly state: NineSixteenProcessingState;
      readonly nextStep: NineSixteenNextStep;
      readonly canContinue: boolean;
      readonly reason?: string;
    }
  | { readonly kind: "retryable"; readonly reason: string }
  | { readonly kind: "publication_pending" }
  | { readonly kind: "artifact_absent" }
  | { readonly kind: "artifact_incompatible"; readonly reason: string }
  | { readonly kind: "indeterminate" }
  | { readonly kind: "unknown"; readonly reason: string }
  | {
      readonly kind: "terminal_conflict";
      readonly code: "operation_terminal" | "invalid_transition";
    }
  | { readonly kind: "definitive"; readonly reason: string }
  | {
      readonly kind: "failed";
      readonly code: TwoFormatDeliveryErrorCode | CreditOperationErrorCode;
    };

const ABORTABLE_DELIVERY_REASONS: ReadonlySet<TwoFormatDeliverReason> =
  new Set<TwoFormatDeliverReason>([
    "missing_publication_token",
    "artifact_incompatible",
    "delivery_link_missing",
    "credit_operation_missing",
    "invalid_transition",
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

function nextStepOf(
  baseStatus: TwoStageStepStatus,
  expansionStatus: TwoStageStepStatus,
): NineSixteenNextStep {
  if (baseStatus !== "done") return "base";
  if (expansionStatus !== "done") return "expansion";
  return "delivery";
}

function stepOutcome(
  outcome: StepExecutionOutcome,
  nextStep: NineSixteenNextStep,
): JointVerticalDeliveryOutcome | null {
  switch (outcome.kind) {
    case "completed":
    case "skipped":
      return null;
    case "retryable":
      return { kind: "retryable", reason: outcome.reason };
    case "definitive":
      return { kind: "definitive", reason: outcome.reason };
    case "unknown":
      return { kind: "unknown", reason: outcome.reason };
    case "processing":
      return {
        kind: "processing",
        state: outcome.state,
        nextStep,
        canContinue: outcome.canContinue,
        ...(outcome.reason === undefined ? {} : { reason: outcome.reason }),
      };
  }
}

/**
 * Entrega o 9:16 já persistido. Nenhuma etapa roda sem base `done`, e nenhuma
 * entrega acontece sem artefato vertical integral.
 */
export async function deliverTwoFormatVertical(
  input: JointVerticalDeliveryInput,
  deps: JointVerticalDeliveryDeps,
): Promise<JointVerticalDeliveryOutcome> {
  let resume: ResumeOperationResult;
  try {
    resume = await deps.resume({
      campaignId: input.campaignId,
      operationId: input.operationId,
    });
  } catch (error) {
    const code = creditErrorCode(error);
    return { kind: "failed", code: code ?? "unknown" };
  }

  if (!resume.success) {
    return { kind: "failed", code: "operation_not_found" };
  }

  // Precedência explícita: a RPC real devolve `action:"blocked"` TAMBÉM para
  // crédito terminal e outcomes persistidos; os campos vêm no mesmo envelope.
  if (resume.creditStatus === "delivered") {
    const probe = await deps.probeVertical({
      storeId: input.storeId,
      campaignId: input.campaignId,
      operationId: input.operationId,
    });
    if (probe.kind === "integral") {
      return {
        kind: "delivered",
        idempotent: true,
        // Sem RPC não há projeção nesta invocação; o reparo é do plano 07.
        campaignStatus: null,
        storagePath: probe.storagePath,
      };
    }
    if (probe.kind === "indeterminate") return { kind: "indeterminate" };
    return {
      kind: "unknown",
      reason: `delivered_without_integral_vertical_${probe.kind}`,
    };
  }
  if (resume.creditStatus === "refunded") {
    return { kind: "terminal_conflict", code: "operation_terminal" };
  }
  if (resume.unknown) return { kind: "unknown", reason: "unknown_outcome" };
  if (resume.failedOutcome) {
    return { kind: "definitive", reason: "failed_outcome" };
  }

  const nextStep = nextStepOf(resume.baseStatus, resume.expansionStatus);

  if (resume.action === "wait") {
    return {
      kind: "processing",
      state: "step_in_progress",
      nextStep,
      canContinue: true,
    };
  }
  if (resume.action === "blocked") {
    return {
      kind: "processing",
      state: "suspended",
      nextStep,
      canContinue: false,
    };
  }
  if (resume.baseStatus !== "done") {
    // A base é do chamador: preparar sem ela produziria `source_absent`
    // definitivo e estornaria o vertical indevidamente.
    return {
      kind: "processing",
      state: "between_steps",
      nextStep: "base",
      canContinue: true,
      reason: "base_pending",
    };
  }

  if (resume.expansionStatus !== "done") {
    const preparation = await deps.prepare({
      storeId: input.storeId,
      campaignId: input.campaignId,
      operationId: input.operationId,
      authorization: input.authorization,
    });
    const preparationOutcome = stepOutcome(preparation, nextStep);
    if (preparationOutcome !== null) return preparationOutcome;

    const expansion = await deps.expand({
      storeId: input.storeId,
      campaignId: input.campaignId,
      operationId: input.operationId,
      authorization: input.authorization,
      acquisitionId: input.acquisitionId,
      attemptReference: input.attemptReference,
      attemptTarget: input.attemptTarget,
      deadlineAtMs: input.deadlineAtMs,
      expansionStatus: input.expansionStatus,
      allowNewPaidStep: input.allowNewPaidStep,
      selection: input.selection,
      ...(input.signal === undefined ? {} : { signal: input.signal }),
    });
    const expansionOutcome = stepOutcome(expansion, nextStep);
    if (expansionOutcome !== null) return expansionOutcome;
  }

  const probe = await deps.probeVertical({
    storeId: input.storeId,
    campaignId: input.campaignId,
    operationId: input.operationId,
  });
  if (probe.kind === "absent") return { kind: "artifact_absent" };
  if (probe.kind === "indeterminate") return { kind: "indeterminate" };
  if (probe.kind === "invalid") {
    return { kind: "artifact_incompatible", reason: "vertical_incompatible" };
  }

  let publication: { acquired: boolean; token: string | null; publicationState: string };
  try {
    publication = await deps.beginPublication(
      input.campaignId,
      input.operationId,
    );
  } catch (error) {
    const creditCode = creditErrorCode(error);
    if (creditCode === "operation_terminal") {
      return { kind: "terminal_conflict", code: "operation_terminal" };
    }
    const code = creditCode ?? twoFormatErrorCode(error);
    return { kind: "failed", code: code ?? "unknown" };
  }

  if (!publication.acquired || publication.token === null) {
    return { kind: "publication_pending" };
  }
  const token = publication.token;

  let delivered: TwoFormatDeliverResult;
  try {
    delivered = await deps.deliverFormat({
      storeId: input.storeId,
      campaignId: input.campaignId,
      operationId: input.operationId,
      format: "9:16",
      publicationToken: token,
    });
  } catch (error) {
    const twoFormatCode = twoFormatErrorCode(error);
    if (twoFormatCode === "missing_publication_token") {
      return { kind: "publication_pending" };
    }
    const code = twoFormatCode ?? creditErrorCode(error);
    return { kind: "failed", code: code ?? "unknown" };
  }

  if (!delivered.success) {
    const reason = delivered.reason;
    if (ABORTABLE_DELIVERY_REASONS.has(reason)) {
      try {
        await deps.abortPublication(
          input.campaignId,
          input.operationId,
          token,
          "before_upload",
        );
      } catch {
        // Best-effort: o fence continua sendo a autoridade.
      }
    }

    if (reason === "missing_publication_token") {
      return { kind: "publication_pending" };
    }
    if (reason === "artifact_incompatible") {
      return { kind: "artifact_incompatible", reason };
    }
    if (reason === "invalid_transition") {
      return { kind: "terminal_conflict", code: "invalid_transition" };
    }
    return { kind: "failed", code: reason };
  }

  return {
    kind: "delivered",
    idempotent: delivered.idempotent,
    campaignStatus: delivered.campaignStatus,
    storagePath: delivered.storagePath,
  };
}
