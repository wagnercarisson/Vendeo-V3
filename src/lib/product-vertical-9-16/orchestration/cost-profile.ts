import type { ImageModelPairConfig } from "@/lib/ai/image-model-pair";
import type {
  ImagePairAttemptCost,
  ImagePairCostResolution,
} from "@/lib/ai-cost/image-pair-pricing";
import type { AttemptCostResolver } from "@/lib/product-1-1/orchestration/instrumentation";
import {
  assertVerticalEstimate,
  canAfford,
  estimateVerticalCall,
  type ProofBudget,
  type VerticalEstimate,
} from "../cost/vertical-estimate";

/**
 * F59 — Perfil de custo do vertical.
 *
 * A estimativa pré-chamada usa a tarifa REAL (`image_unit_usd`) da resolução do
 * par compartilhado, com o multiplicador vertical 2,5. `versionId`, `costSource`
 * e `pricing` são preservados; apenas `costUsd` vira a estimativa vertical.
 */
export const VERTICAL_COST_PROFILE_VERSION =
  "f59-vertical-9-16-cost-v1" as const;

export interface VerticalResolvePair {
  (config: ImageModelPairConfig): Promise<ImagePairCostResolution>;
}

function verticalCostForTarget(
  target: ImagePairAttemptCost,
): ImagePairAttemptCost {
  const vertical = estimateVerticalCall({
    model: target.model,
    quality: target.quality,
    imageUnitUsd: target.costUsd,
  });
  return {
    ...target,
    costUsd: vertical.available ? vertical.estimatedUsd : null,
  };
}

export function createVerticalAttemptCostResolver(deps: {
  readonly resolvePair: VerticalResolvePair;
  readonly onEstimate?: (estimate: VerticalEstimate) => void;
}): AttemptCostResolver {
  return async (config) => {
    const resolution = await deps.resolvePair(config);
    const adjust = (target: ImagePairAttemptCost): ImagePairAttemptCost => {
      const estimate = estimateVerticalCall({
        model: target.model,
        quality: target.quality,
        imageUnitUsd: target.costUsd,
      });
      deps.onEstimate?.(estimate);
      return verticalCostForTarget(target);
    };
    return {
      primary: adjust(resolution.primary),
      fallback: adjust(resolution.fallback),
    };
  };
}

export class VerticalProofBudgetExceededError extends Error {
  readonly code = "proof_budget_exceeded" as const;

  constructor() {
    super("proof_budget_exceeded");
    this.name = "VerticalProofBudgetExceededError";
  }
}

/**
 * Guarda PRÉ-RESERVA: exige estimativa vertical para principal E fallback e,
 * quando há orçamento, verifica se ele cobre o maior dos dois. Não reserva,
 * não chama provider e não escreve nada.
 */
export function createVerticalCostGuard(deps: {
  readonly resolvePair: VerticalResolvePair;
  readonly budget?: ProofBudget;
}): (config: ImageModelPairConfig) => Promise<void> {
  return async (config) => {
    const resolution = await deps.resolvePair(config);

    const primary = assertVerticalEstimate(
      estimateVerticalCall({
        model: resolution.primary.model,
        quality: resolution.primary.quality,
        imageUnitUsd: resolution.primary.costUsd,
      }),
    );
    const fallback = assertVerticalEstimate(
      estimateVerticalCall({
        model: resolution.fallback.model,
        quality: resolution.fallback.quality,
        imageUnitUsd: resolution.fallback.costUsd,
      }),
    );

    if (!deps.budget) return;
    const estimatedUsd = Math.max(primary.estimatedUsd, fallback.estimatedUsd);
    if (!canAfford(deps.budget, estimatedUsd).ok) {
      throw new VerticalProofBudgetExceededError();
    }
  };
}

/** Reexport para inspeção/teste sem acoplar ao módulo de estimativa. */

