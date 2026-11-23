import "server-only";

import type {
  AuthorizationContext,
} from "@/lib/campaign/composition-artifacts/types";
import type { PrepareSquareResult } from "@/lib/campaign/square-preparation/types";
import type { ExpansionSelection } from "@/lib/ai/nine-sixteen-expansion-model-config";
import type { StepExecutionOutcome } from "@/lib/product-9-16-two-stage/orchestration/types";
import type { ProductTwoStageOperationClient } from "@/lib/product-9-16-two-stage/two-stage-operation-client";

import type {
  EnsureSourceBridgeResult,
} from "../source-registration";
import type {
  CaptureFrozenEconomicsResult,
  FrozenEconomics,
} from "../frozen-economics";
import type {
  FormatAdditionOpenInput,
  FormatAdditionOpenResult,
} from "../financial-client";
import type {
  FormatAdditionReadResult,
  FormatAdditionReadState,
} from "../delivery-reader";

/**
 * F62/62-04 — Contratos do orquestrador dedicado da adição.
 *
 * As portas são explícitas e separadas da composição: testes injetam fakes
 * declarados; o root de produção compõe os clientes reais. Preparação e
 * expansão não são executadas nas Tasks 1–2.
 */

export interface FormatAdditionOpeningGateInput {
  readonly storeId: string;
  readonly campaignId: string;
  readonly userId: string | null;
}

export type FormatAdditionOpeningGate =
  | { readonly allowed: true }
  | {
      readonly allowed: false;
      readonly code: string;
      readonly reason: string;
    };

export interface OpenFormatAdditionInput {
  readonly storeId: string;
  readonly campaignId: string;
  readonly operationId: string;
  readonly requestId: string;
  readonly sourceOrigin: "new_flow_1_1" | "legacy_campaign";
  readonly authorization: AuthorizationContext;
  readonly selection: ExpansionSelection;
  /**
   * Checksum da fonte confirmado pelo token server-side. Nunca é declaração
   * livre do navegador; é comparado com a ponte antes de captura/reserva.
   */
  readonly confirmedSourceChecksumSha256: string;
}

export interface PrepareAdditionSourceInput {
  readonly storeId: string;
  readonly campaignId: string;
  /** Identidade de destino/financeira da adição. */
  readonly operationId: string;
  /** Identidade estável de registro da fonte (ponte). */
  readonly sourceRegistrationOperationId: string;
  readonly authorization: AuthorizationContext;
}

export type PrepareAdditionSourceResult =
  | { readonly ok: true; readonly result: PrepareSquareResult }
  | {
      readonly ok: false;
      readonly reason: string;
      readonly detail?: string;
    };

export interface FormatAdditionOpeningDeps {
  readonly readLink: (input: {
    readonly storeId: string;
    readonly campaignId: string;
  }) => Promise<FormatAdditionReadResult>;
  readonly readLinkByRequest: (input: {
    readonly storeId: string;
    readonly campaignId: string;
    readonly requestId: string;
  }) => Promise<FormatAdditionReadResult>;
  readonly checkOpeningGate: (
    input: FormatAdditionOpeningGateInput,
  ) => Promise<FormatAdditionOpeningGate>;
  readonly registerSource: (input: {
    readonly storeId: string;
    readonly campaignId: string;
    readonly sourceOrigin: "new_flow_1_1" | "legacy_campaign";
    readonly authorization: AuthorizationContext;
  }) => Promise<EnsureSourceBridgeResult>;
  readonly captureFrozenEconomics: (
    selection: ExpansionSelection,
  ) => Promise<CaptureFrozenEconomicsResult>;
  readonly openAddition: (
    input: FormatAdditionOpenInput,
  ) => Promise<FormatAdditionOpenResult>;
}

export interface RunFormatAdditionInput extends OpenFormatAdditionInput {
  readonly deadlineAtMs: number;
  readonly allowNewPaidStep: boolean;
  readonly signal?: AbortSignal;
}

export interface FormatAdditionDurableContext {
  readonly operationId: string;
  readonly requestId: string;
  readonly sourceOrigin: "new_flow_1_1" | "legacy_campaign";
  readonly sourceRegistrationOperationId: string;
  readonly sourceArtifactId: string;
  readonly sourceChecksumSha256: string;
  readonly selection: unknown;
  readonly frozenEconomics: unknown;
}

export interface FormatAdditionExpansionInput {
  readonly storeId: string;
  readonly campaignId: string;
  readonly operationId: string;
  readonly authorization: AuthorizationContext;
  readonly selection: ExpansionSelection;
  readonly frozen: FrozenEconomics;
  readonly acquisitionId: string;
  readonly attemptReference: string;
  readonly attemptTarget: "initial" | "retry";
  readonly deadlineAtMs: number;
  readonly expansionStatus: "pending" | "in_progress" | "done" | "failed" | "abandoned";
  readonly allowNewPaidStep: boolean;
  readonly signal?: AbortSignal;
}

export type FormatAdditionDeliveryOutcome =
  | { readonly kind: "delivered"; readonly idempotent: boolean }
  | { readonly kind: "processing"; readonly reason: string }
  | { readonly kind: "absent" | "invalid" | "indeterminate" }
  | { readonly kind: "failed"; readonly code: string; readonly reason: string };

export type FormatAdditionFinalizationOutcome =
  | { readonly kind: "refunded" }
  | { readonly kind: "delivered"; readonly reason: string }
  | { readonly kind: "unknown"; readonly reason: string }
  | { readonly kind: "blocked"; readonly reason: string };

export interface FormatAdditionExecutionDeps {
  readonly readDurableContext: (input: {
    readonly storeId: string;
    readonly campaignId: string;
    readonly operationId: string;
  }) => Promise<
    | { readonly kind: "found"; readonly context: FormatAdditionDurableContext }
    | { readonly kind: "missing" }
    | { readonly kind: "read_failed"; readonly reason: string }
  >;
  readonly runExpansion: (
    input: FormatAdditionExpansionInput,
  ) => Promise<StepExecutionOutcome>;
  readonly deliverVertical: (input: {
    readonly storeId: string;
    readonly campaignId: string;
    readonly operationId: string;
    readonly authorization: AuthorizationContext;
  }) => Promise<FormatAdditionDeliveryOutcome>;
  readonly finalizeFailure: (input: {
    readonly storeId: string;
    readonly campaignId: string;
    readonly operationId: string;
    readonly authorization: AuthorizationContext;
    readonly reason: string;
  }) => Promise<FormatAdditionFinalizationOutcome>;

  readonly prepare: (input: {
    readonly source: {
      readonly storeId: string;
      readonly campaignId: string;
      readonly operationId: string;
      readonly role: "square_original";
    };
    readonly preparedOperationId: string;
    readonly authorization: AuthorizationContext;
  }) => Promise<PrepareSquareResult>;
  readonly control: Pick<
    ProductTwoStageOperationClient,
    "acquire" | "finish" | "recordOutcome" | "resume" | "getOperationView"
  >;
  readonly clock: () => number;
  readonly callId: () => string;
}

export type FormatAdditionDeps = FormatAdditionOpeningDeps &
  FormatAdditionExecutionDeps;

export type OpenFormatAdditionResult =
  | {
      readonly ok: true;
      readonly kind: "opened";
      readonly state: "open";
      readonly operationId: string;
      readonly requestId: string;
      readonly idempotent: boolean;
      readonly frozen: FrozenEconomics;
      readonly sourceRegistrationOperationId: string;
      readonly squareArtifactId: string;
    }
  | {
      readonly ok: true;
      readonly kind: "replay";
      readonly state: FormatAdditionReadState | "unknown";
      readonly operationId: string;
      readonly requestId: string;
      readonly refunded: boolean;
    }
  | {
      readonly ok: false;
      readonly code: string;
      readonly reason: string;
      readonly detail?: string;
    };

export type FormatAdditionRunResult =
  | {
      readonly ok: true;
      readonly kind: "delivered";
      readonly operationId: string;
      readonly requestId: string;
      readonly idempotent: boolean;
    }
  | {
      readonly ok: true;
      readonly kind: "processing";
      readonly operationId: string;
      readonly requestId: string;
      readonly state: string;
      readonly reason?: string;
    }
  | {
      readonly ok: true;
      readonly kind: "refunded" | "unknown";
      readonly operationId: string;
      readonly requestId: string;
      readonly reason?: string;
    }
  | {
      readonly ok: false;
      readonly code: string;
      readonly reason: string;
      readonly detail?: string;
    };

export const FORMAT_ADDITION_OPEN_REASON = Object.freeze({
  linkReadFailed: "link_read_failed",
  linkIdentityIncomplete: "link_identity_incomplete",
  invalidConfirmedChecksum: "invalid_confirmed_checksum",
  confirmedChecksumMismatch: "confirmed_source_checksum_mismatch",
  gateBlocked: "gate_blocked",
  sourceBridgeFailed: "source_bridge_failed",
  frozenEconomicsFailed: "frozen_economics_failed",
  rpcFailed: "rpc_failed",
} as const);
