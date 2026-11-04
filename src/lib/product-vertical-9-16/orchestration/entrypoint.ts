import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { ImageModelPairConfig } from "@/lib/ai/image-model-pair";
import { ImagePairPricingService } from "@/lib/ai-cost/image-pair-pricing";
import {
  runProductOneToOneGeneration,
  type ProductOneToOneArtifactOps,
  type ProductOneToOneGenerationDeps,
  type ProductOneToOneGenerationInput,
} from "@/lib/product-1-1/orchestration/generation-orchestrator";
import {
  projectDeliveredCampaign,
  type ProjectDeliveredCampaignInput,
  type ProjectDeliveredCampaignResult,
} from "@/lib/product-1-1/orchestration/project-delivered-campaign";

import { VerticalArtifactStore } from "../artifact/artifact-store";
import { artifactStoragePath } from "../artifact/artifact-path";
import {
  composeVerticalProductPrompt,
} from "../prompt/composition";
import { PROVIDER_SIZE } from "../dimensions";
import type { ProofBudget } from "../cost/vertical-estimate";
import {
  createVerticalAttemptCostResolver,
  createVerticalCostGuard,
  VERTICAL_COST_PROFILE_VERSION,
  type VerticalResolvePair,
} from "./cost-profile";

/**
 * F59 — Entrypoint do Produto vertical 9:16.
 *
 * Apenas COMPÕE as dependências da engine existente. Não duplica crédito,
 * fence, falha, retry ou recuperação; a engine é a única dona dessas decisões.
 */

export interface ProductVertical9x16GenerationDeps
  extends Omit<
    ProductOneToOneGenerationDeps,
    | "composePrompt"
    | "imageSize"
    | "artifact"
    | "projectDeliveredCampaign"
    | "resolveAttemptCost"
    | "beforeReservation"
  > {
  readonly artifact?: ProductOneToOneArtifactOps;
  readonly resolvePair?: VerticalResolvePair;
  readonly budget?: ProofBudget;
}

export function verticalExpectedArtifactPath(
  storeId: string,
  campaignId: string,
  operationId: string,
): string {
  return artifactStoragePath(storeId, campaignId, operationId);
}

export function makeVerticalProjection(
  storeId: string,
  campaignId: string,
  operationId: string,
  deps: { readonly client?: SupabaseClient } = {},
): (
  input: ProjectDeliveredCampaignInput,
) => Promise<ProjectDeliveredCampaignResult> {
  const expectedArtifactPath = verticalExpectedArtifactPath(
    storeId,
    campaignId,
    operationId,
  );
  return (input) =>
    projectDeliveredCampaign(
      { ...input, expectedArtifactPath },
      { client: deps.client },
    );
}

export async function runProductVertical9x16Generation(
  input: ProductOneToOneGenerationInput,
  deps: ProductVertical9x16GenerationDeps = {},
): Promise<Response> {
  const { resolvePair: injectedResolvePair, budget, artifact, ...engineDeps } =
    deps;

  const pricingService = new ImagePairPricingService(deps.client);
  const resolvePair: VerticalResolvePair =
    injectedResolvePair ??
    ((config: ImageModelPairConfig) => pricingService.resolveCost(config));

  const profile: ProductOneToOneGenerationDeps = {
    ...engineDeps,
    composePrompt: (compositionInput) =>
      composeVerticalProductPrompt(compositionInput),
    imageSize: PROVIDER_SIZE,
    artifact:
      artifact ?? new VerticalArtifactStore({ client: deps.client }),
    projectDeliveredCampaign: makeVerticalProjection(
      input.storeId,
      input.campaignId,
      input.operationId,
      { client: deps.client },
    ),
    beforeReservation: createVerticalCostGuard({ resolvePair, budget }),
    resolveAttemptCost: createVerticalAttemptCostResolver({ resolvePair }),
    client: deps.client,
  };

  return runProductOneToOneGeneration(input, profile);
}

export { VERTICAL_COST_PROFILE_VERSION };
