import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthorizationContext } from "@/lib/campaign/composition-artifacts/types";
import { retrieveCompositionArtifact } from "@/lib/campaign/composition-artifacts/retrieve";
import { readSquareBaseFrozenState } from "@/lib/campaign/square-base/frozen-state";
import {
  decideReuseAdmissibility,
  probeSquareBaseTarget,
  type ProbeSquareBaseDeps,
} from "@/lib/campaign/square-base/gate";
import { isCompatibleExpansionArtifact } from "@/lib/campaign/vertical-expansion/reuse-compatibility";
import { verifyExpansionReuseEvidence } from "@/lib/campaign/vertical-expansion/reuse-evidence";

export type ReconcileResult =
  | { readonly kind: "completed" }
  | { readonly kind: "definitive"; readonly reason: string }
  | { readonly kind: "unknown"; readonly reason: string };

export interface ReconcileBaseInput {
  readonly storeId: string;
  readonly campaignId: string;
  readonly operationId: string;
  readonly authorization: AuthorizationContext;
}

export interface ReconcileDeps {
  readonly client?: SupabaseClient;
  readonly readFrozenState?: typeof readSquareBaseFrozenState;
  readonly probeBase?: typeof probeSquareBaseTarget;
  readonly retrieve?: typeof retrieveCompositionArtifact;
  readonly verifyEvidence?: typeof verifyExpansionReuseEvidence;
  readonly probeDeps?: ProbeSquareBaseDeps;
}

export async function reconcileBaseArtifact(
  input: ReconcileBaseInput,
  deps: ReconcileDeps = {},
): Promise<ReconcileResult> {
  const readFrozen = deps.readFrozenState ?? readSquareBaseFrozenState;
  const probe = deps.probeBase ?? probeSquareBaseTarget;
  try {
    const frozen = await readFrozen(
      { campaignId: input.campaignId, operationId: input.operationId },
      deps.client === undefined ? {} : { client: deps.client },
    );
    if (frozen.kind !== "complete" && frozen.kind !== "repairable") {
      return {
        kind: "definitive",
        reason:
          frozen.kind === "indeterminate"
            ? "frozen_state_indeterminate"
            : "artifact_without_frozen_state",
      };
    }
    const outcome = await probe(
      {
        destination: {
          storeId: input.storeId,
          campaignId: input.campaignId,
          operationId: input.operationId,
          role: "square_original",
        },
        authorization: input.authorization,
        allowAdoption: true,
      },
      deps.probeDeps ?? {},
    );
    const decision = decideReuseAdmissibility(outcome, frozen.kind);
    if (decision.kind === "reuse") return { kind: "completed" };
    if (decision.kind === "blocked") {
      return decision.reason === "pre_call_probe_indeterminate"
        ? { kind: "unknown", reason: decision.reason }
        : { kind: "definitive", reason: decision.reason };
    }
    if (decision.kind === "conflict") {
      return { kind: "definitive", reason: decision.reason };
    }
    return { kind: "definitive", reason: "artifact_absent" };
  } catch {
    return { kind: "unknown", reason: "reconciliation_read_failed" };
  }
}

export async function reconcileExpansionArtifact(
  input: ReconcileBaseInput,
  deps: ReconcileDeps = {},
): Promise<ReconcileResult> {
  const retrieve = deps.retrieve ?? retrieveCompositionArtifact;
  const verifyEvidence = deps.verifyEvidence ?? verifyExpansionReuseEvidence;
  try {
    const [source, vertical] = await Promise.all([
      retrieve(
        {
          identity: {
            storeId: input.storeId,
            campaignId: input.campaignId,
            operationId: input.operationId,
            role: "square_prepared",
          },
          authorization: input.authorization,
        },
        deps.client === undefined ? {} : { client: deps.client },
      ),
      retrieve(
        {
          identity: {
            storeId: input.storeId,
            campaignId: input.campaignId,
            operationId: input.operationId,
            role: "vertical",
          },
          authorization: input.authorization,
        },
        deps.client === undefined ? {} : { client: deps.client },
      ),
    ]);
    if (source.kind === "indeterminate" || vertical.kind === "indeterminate") {
      return { kind: "unknown", reason: "reconciliation_indeterminate" };
    }
    if (source.kind !== "integral" || vertical.kind !== "integral") {
      return { kind: "definitive", reason: "artifact_absent" };
    }
    if (
      !isCompatibleExpansionArtifact({
        artifact: vertical.artifact,
        source: source.artifact,
      })
    ) {
      return { kind: "definitive", reason: "artifact_incompatible" };
    }
    const evidence = await verifyEvidence(
      vertical.artifact,
      source.artifact,
      deps.client === undefined ? {} : { client: deps.client },
    );
    if (evidence.kind !== "verified") {
      return evidence.reason === "indeterminate"
        ? { kind: "unknown", reason: "evidence_indeterminate" }
        : { kind: "definitive", reason: "evidence_not_verified" };
    }
    return { kind: "completed" };
  } catch {
    return { kind: "unknown", reason: "reconciliation_read_failed" };
  }
}
