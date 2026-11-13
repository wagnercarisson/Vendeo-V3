import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthorizationContext } from "@/lib/campaign/composition-artifacts/types";
import type { PrepareSquareResult } from "@/lib/campaign/square-preparation/types";
import type { StepExecutionOutcome } from "./types";

export interface PreparationStepInput {
  readonly storeId: string;
  readonly campaignId: string;
  readonly operationId: string;
  readonly authorization: AuthorizationContext;
}

export interface PreparationStepDeps {
  readonly prepare: (
    input: {
      source: {
        storeId: string;
        campaignId: string;
        operationId: string;
        role: "square_original";
      };
      preparedOperationId: string;
      authorization: AuthorizationContext;
    },
    deps?: { client?: SupabaseClient },
  ) => Promise<PrepareSquareResult>;
  readonly client?: SupabaseClient;
}

export async function runPreparationStep(
  input: PreparationStepInput,
  deps: PreparationStepDeps,
): Promise<StepExecutionOutcome> {
  const result = await deps.prepare(
    {
      source: {
        storeId: input.storeId,
        campaignId: input.campaignId,
        operationId: input.operationId,
        role: "square_original",
      },
      preparedOperationId: input.operationId,
      authorization: input.authorization,
    },
    deps.client === undefined ? {} : { client: deps.client },
  );
  switch (result.kind) {
    case "prepared":
      return { kind: "completed" };
    case "source_unavailable":
      return result.reason === "indeterminate"
        ? { kind: "processing", state: "preparation_retry", nextStep: "expansion", canContinue: true }
        : { kind: "definitive", reason: `source_${result.reason}` };
    case "indeterminate":
      return { kind: "processing", state: "preparation_retry", nextStep: "expansion", canContinue: true };
    case "transform_failed":
    case "conflict":
    case "persistence_failed":
    case "readback_failed":
    case "invalid_input":
    case "authorization_denied":
      return { kind: "definitive", reason: result.kind };
  }
}
