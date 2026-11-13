import type { ProviderFailureClass } from "../types";

export type ModuleOutcome =
  | { readonly kind: "completed" }
  | { readonly kind: "reused" }
  | { readonly kind: "expanded" }
  | { readonly kind: "provider_failure"; readonly failureClass: ProviderFailureClass }
  | { readonly kind: "definitive_failure" }
  | { readonly kind: "unknown_result" }
  | { readonly kind: "invalid_output" }
  | { readonly kind: "persistence_failed" }
  | { readonly kind: "readback_failed" }
  | { readonly kind: "conflict" }
  | { readonly kind: "existing_artifact_conflict" }
  | { readonly kind: "snapshot_failed"; readonly transient: boolean }
  | { readonly kind: "content_divergence" }
  | { readonly kind: "frozen_state_conflict" }
  | { readonly kind: "blocked"; readonly transient: boolean }
  | { readonly kind: "invalid_input" }
  | { readonly kind: "authorization_denied" }
  | { readonly kind: "operation_identity_conflict" }
  | { readonly kind: "query_only" }
  | { readonly kind: "operation_terminal" }
  | { readonly kind: "invalid_envelope" };

export type ControlDisposition =
  | {
      readonly finishStatus: "completed" | "failed";
      readonly finishFailureClass: ProviderFailureClass | null;
      readonly recordOutcome: "failed" | "unknown" | null;
      readonly financial: "none" | "refund_once";
      readonly reconcileFirst: boolean;
      readonly noEffect: boolean;
    };

export function mapModuleOutcomeToControl(outcome: ModuleOutcome): ControlDisposition {
  switch (outcome.kind) {
    case "completed":
    case "reused":
    case "expanded":
      return {
        finishStatus: "completed",
        finishFailureClass: null,
        recordOutcome: null,
        financial: "none",
        reconcileFirst: false,
        noEffect: false,
      };
    case "provider_failure":
      if (outcome.failureClass === "transient") {
        return {
          finishStatus: "failed",
          finishFailureClass: "transient",
          recordOutcome: null,
          financial: "none",
          reconcileFirst: false,
          noEffect: false,
        };
      }
      if (outcome.failureClass === "unknown") {
        return {
          finishStatus: "failed",
          finishFailureClass: "unknown",
          recordOutcome: "unknown",
          financial: "none",
          reconcileFirst: false,
          noEffect: false,
        };
      }
      return {
        finishStatus: "failed",
        finishFailureClass: "definitive",
        recordOutcome: "failed",
        financial: "refund_once",
        reconcileFirst: true,
        noEffect: false,
      };
    case "definitive_failure":
    case "invalid_output":
    case "content_divergence":
    case "frozen_state_conflict":
    case "existing_artifact_conflict":
    case "invalid_input":
    case "authorization_denied":
      return {
        finishStatus: "failed",
        finishFailureClass: "definitive",
        recordOutcome: "failed",
        financial: "refund_once",
        reconcileFirst: true,
        noEffect: false,
      };
    case "unknown_result":
      return {
        finishStatus: "failed",
        finishFailureClass: "unknown",
        recordOutcome: "unknown",
        financial: "none",
        reconcileFirst: false,
        noEffect: false,
      };
    case "persistence_failed":
    case "readback_failed":
    case "conflict":
      return {
        finishStatus: "failed",
        finishFailureClass: "definitive",
        recordOutcome: "failed",
        financial: "refund_once",
        reconcileFirst: true,
        noEffect: false,
      };
    case "snapshot_failed":
    case "blocked":
      if (outcome.transient) {
        return {
          finishStatus: "failed",
          finishFailureClass: "transient",
          recordOutcome: null,
          financial: "none",
          reconcileFirst: false,
          noEffect: false,
        };
      }
      return {
        finishStatus: "failed",
        finishFailureClass: "definitive",
        recordOutcome: "failed",
        financial: "refund_once",
        reconcileFirst: true,
        noEffect: false,
      };
    case "operation_identity_conflict":
    case "query_only":
    case "operation_terminal":
    case "invalid_envelope":
      return {
        finishStatus: "failed",
        finishFailureClass: null,
        recordOutcome: null,
        financial: "none",
        reconcileFirst: false,
        noEffect: true,
      };
  }
}

export function isNoEffectOutcome(outcome: ModuleOutcome): boolean {
  return mapModuleOutcomeToControl(outcome).noEffect;
}
