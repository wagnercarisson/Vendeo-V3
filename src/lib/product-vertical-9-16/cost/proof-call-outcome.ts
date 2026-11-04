/**
 * F59 — Avaliação PURA de uma chamada da prova de provider.
 *
 * Regras de segurança da prova:
 * - dimensão devolvida divergente ⇒ reprova a chamada e PARA (preserva o custo);
 * - sem NENHUM custo real apurado (reportado ou calculado por usage) ⇒
 *   `cost_unverified`, exige reconciliação e PARA;
 * - confirmação do multiplicador só é possível com custo efetivamente apurado.
 */

import { PROVIDER_SIZE } from "../dimensions";

export type ProofCallOutcome =
  | "succeeded"
  | "dimension_mismatch"
  | "cost_unverified";

export interface ProofCallEvaluationInput {
  readonly requestedSize: string;
  readonly returnedWidth: number | null;
  readonly returnedHeight: number | null;
  readonly providerReportedUsd: number | null;
  readonly calculatedFromUsageUsd: number | null;
  readonly estimatedUsd: number;
}

export interface ProofCallEvaluation {
  readonly outcome: ProofCallOutcome;
  readonly dimensionMatches: boolean;
  readonly costVerified: boolean;
  readonly chargedUsd: number;
  readonly stop: boolean;
}

function expectedDimensions(
  requestedSize: string,
): readonly [number, number] | null {
  if (requestedSize === PROVIDER_SIZE) return [1152, 2048];
  if (requestedSize === "1024x1024") return [1024, 1024];
  return null;
}

function isKnownCost(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export function evaluateProofCall(
  input: ProofCallEvaluationInput,
): ProofCallEvaluation {
  const expected = expectedDimensions(input.requestedSize);
  const dimensionMatches =
    expected !== null &&
    input.returnedWidth === expected[0] &&
    input.returnedHeight === expected[1];

  const providerKnown = isKnownCost(input.providerReportedUsd);
  const calculatedKnown = isKnownCost(input.calculatedFromUsageUsd);
  const costVerified = providerKnown || calculatedKnown;

  const candidates = [input.estimatedUsd];
  if (providerKnown) candidates.push(input.providerReportedUsd);
  if (calculatedKnown) candidates.push(input.calculatedFromUsageUsd);
  const chargedUsd = Number(Math.max(...candidates).toFixed(6));

  const outcome: ProofCallOutcome = !dimensionMatches
    ? "dimension_mismatch"
    : !costVerified
      ? "cost_unverified"
      : "succeeded";

  return Object.freeze({
    outcome,
    dimensionMatches,
    costVerified,
    chargedUsd,
    stop: outcome !== "succeeded",
  });
}
