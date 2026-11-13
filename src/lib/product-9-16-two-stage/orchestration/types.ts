import type { AuthorizationContext } from "@/lib/campaign/composition-artifacts/types";
import type { ProductOneToOneBackgroundDirection } from "@/lib/product-1-1/background-direction";
import type { ProductOneToOneCopyContext } from "@/lib/product-1-1/copy/default-copy-runner";
import type { ProductOneToOneIntent } from "@/lib/product-1-1/intent-selection";
import type { ProductPromptCompositionBriefing } from "@/lib/product-1-1/policies/types";
import type { ProductOneToOneEvidenceReference } from "@/lib/product-1-1/snapshot/persist-snapshot";
import type { ProductOneToOneCreditOperationClient } from "@/lib/product-1-1/credit-operation/credit-operation-client";
import type { ProductTwoStageOperationClient } from "../two-stage-operation-client";
import type { TwoStageFinancialService, VerticalArtifactProbe } from "../two-stage-financial-service";
import type {
  ResumeAction,
  TwoStageStepStatus,
  ProviderFailureClass,
} from "../types";

export type NineSixteenMode = "initial" | "continue";

export type NineSixteenPhase =
  | "campaign_validation"
  | "campaign_base"
  | "campaign_preparation"
  | "campaign_expansion"
  | "campaign_copy"
  | "campaign_delivery";

export type NineSixteenProcessingState =
  | "between_steps"
  | "step_in_progress"
  | "delivery_pending"
  | "preparation_retry"
  | "suspended";

export type NineSixteenNextStep = "base" | "expansion" | "delivery" | null;

export type NineSixteenEvent =
  | {
      readonly type: "phase";
      readonly campaignId: string;
      readonly operationId: string;
      readonly phase: NineSixteenPhase;
      readonly status: "running" | "complete" | "failed" | "skipped";
      readonly message?: string;
    }
  | {
      readonly type: "processing";
      readonly campaignId: string;
      readonly operationId: string;
      readonly state: NineSixteenProcessingState;
      readonly nextStep: NineSixteenNextStep;
      readonly canContinue: boolean;
      readonly continueAfterMs?: number;
    }
  | {
      readonly type: "result";
      readonly campaignId: string;
      readonly operationId: string;
      readonly campaignUrl: string;
    }
  | {
      readonly type: "error";
      readonly campaignId: string;
      readonly operationId: string;
      readonly code: string;
      readonly message: string;
      readonly refunded?: boolean;
    }
  | {
      readonly type: "unknown";
      readonly campaignId: string;
      readonly operationId: string;
      readonly reference: string;
    };

export interface AcquisitionIds {
  readonly base: string;
  readonly expansion: string;
}

export interface RunNineSixteenInput {
  readonly mode: NineSixteenMode;
  readonly storeId: string;
  readonly campaignId: string;
  readonly operationId: string;
  readonly authorization: AuthorizationContext;

  readonly briefing?: ProductPromptCompositionBriefing;
  readonly briefingText?: string;
  readonly campaignIntent?: ProductOneToOneIntent;
  readonly backgroundDirection?: ProductOneToOneBackgroundDirection;
  readonly productImagesDataUrls?: readonly string[];
  readonly identityImageUrl?: string;
  readonly identityDirective?: string;
  readonly references?: readonly string[];
  readonly referenceSelections?: readonly ProductOneToOneEvidenceReference[];
  readonly copyContext?: ProductOneToOneCopyContext;

  readonly requestStartedAtMs: number;
  readonly acquisitionIds?: AcquisitionIds;
  readonly allowNewPaidStep?: boolean;
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
  readonly usdBrlRateAtGeneration?: number | null;
  readonly creditValueBrlAtGeneration?: number | null;
  readonly runId?: string;
  readonly traceId?: string;
}

export type StepExecutionOutcome =
  | { readonly kind: "completed" }
  | { readonly kind: "retryable"; readonly reason: string }
  | { readonly kind: "definitive"; readonly reason: string }
  | { readonly kind: "unknown"; readonly reason: string }
  | {
      readonly kind: "processing";
      readonly state: NineSixteenProcessingState;
      readonly nextStep: NineSixteenNextStep;
      readonly canContinue: boolean;
      readonly reason?: string;
    }
  | { readonly kind: "skipped" };

export interface RunNineSixteenDeps {
  readonly control: ProductTwoStageOperationClient;
  readonly financial: TwoStageFinancialService;
  readonly credit: Pick<
    ProductOneToOneCreditOperationClient,
    "beginPublication" | "getPublicationEpoch" | "markArtUploaded" | "deliver"
  >;
  readonly clock: () => number;
  readonly callIdFactory: () => string;
  readonly newSupportReference: () => string;
  readonly base: typeof import("@/lib/campaign/square-base/run-square-base").runSquareBase;
  readonly prepare: typeof import("@/lib/campaign/square-preparation/prepare").prepareSquareForExpansion;
  readonly expand: typeof import("@/lib/campaign/vertical-expansion/expand").expandVerticalToNineSixteen;
  readonly readFrozenState: typeof import("@/lib/campaign/square-base/frozen-state").readSquareBaseFrozenState;
  readonly projectDelivered: typeof import("@/lib/product-1-1/orchestration/project-delivered-campaign").projectDeliveredCampaign;
  readonly projectClosed: typeof import("@/lib/product-1-1/orchestration/project-closed-campaign").projectClosedCampaign;
  readonly probeVertical: VerticalArtifactProbe;
  readonly generateThumbnail: typeof import("@/lib/campaign/thumbnail/thumbnail-safe").generateCampaignThumbnailSafely;
  readonly pilotSpend?: unknown;
}

export interface StepView {
  readonly stage: "base" | "expansion";
  readonly status: TwoStageStepStatus;
  readonly attemptsUsed: number;
  readonly failureClass: ProviderFailureClass | null;
  readonly attemptNumber: number | null;
  readonly claimedAt: string | null;
}

export type TwoStageProcessingPhase =
  | "step_in_progress"
  | "between_steps"
  | "delivery_pending"
  | "preparation_retry"
  | "suspended";

export type TwoStageStatusState = "delivered" | "refunded" | "unknown" | "processing";

export interface TwoStageActivationInput {
  readonly allowNewPaidStep: boolean;
}

export interface TwoStageOperationView {
  readonly campaignId: string;
  readonly operationId: string;
  readonly origin: "9_16_two_stage";
  readonly credit: {
    readonly status: string;
    readonly terminal: boolean;
    readonly delivered: boolean;
    readonly refunded: boolean;
    readonly reserved: boolean;
  };
  readonly base: StepView;
  readonly expansion: StepView;
  readonly unknown: boolean;
  readonly failedOutcome: boolean;
  readonly supportReference: string | null;
  readonly nextAction: ResumeAction;
  readonly canContinue: boolean;
  readonly processingPhase: TwoStageProcessingPhase | null;
}

export type OperationViewLookup =
  | { readonly kind: "found"; readonly view: TwoStageOperationView }
  | { readonly kind: "absent" }
  | { readonly kind: "read_failed"; readonly reason: string };

export type TwoStageStatusView = TwoStageOperationView & {
  readonly state: TwoStageStatusState;
  readonly terminal: boolean;
};

export type BlockedStateReason =
  | "known_final_failure"
  | "attempt_limit_exhausted"
  | "unknown"
  | "terminal"
  | "in_progress"
  | "other_blocked";

export interface DurableInputDescriptor {
  readonly kind: "product" | "identity";
  readonly role: "primary" | "variation" | "combo_item" | "reference" | "identity";
  readonly index: number;
  readonly contentId: string;
  readonly storagePath: string;
  readonly mimeType: string;
  readonly dataUrlPrefix: string;
  readonly byteSize: number;
}

export interface CampaignResumeContext {
  readonly briefing: ProductPromptCompositionBriefing;
  readonly briefingText: string;
  readonly campaignIntent: ProductOneToOneIntent;
  readonly backgroundDirection: ProductOneToOneBackgroundDirection;
  readonly identityDirective: string | null;
  readonly identityContext: unknown | null;
  readonly copyContext: ProductOneToOneCopyContext | null;
  readonly economicSnapshot: {
    readonly usdBrlRateAtGeneration: number | null;
    readonly creditValueBrlAtGeneration: number | null;
  };
  readonly inputFiles: readonly DurableInputDescriptor[];
}
