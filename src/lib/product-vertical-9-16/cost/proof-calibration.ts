/**
 * F59 — Resumo de calibração da prova de provider.
 *
 * A calibração compara o custo REAL apurado (reportado ou calculado por usage)
 * com a estimativa pré-chamada. O valor cobrado contra o teto (que usa o máximo
 * entre estimativa e custo real) NÃO é usado como custo real.
 */

export type ProofCalibrationStatus =
  | "succeeded"
  | "dimension_mismatch"
  | "cost_unverified"
  | "unknown"
  | "unsupported_dimension";

export interface ProofCalibrationCall {
  readonly status: ProofCalibrationStatus;
  readonly estimatedUsd: number;
  readonly providerReportedUsd: number | null;
  readonly calculatedFromUsageUsd: number | null;
}

export type ProofCalibrationVerdict =
  | "confirmed_conservative"
  | "adjustment_proposed"
  | "not_calibrated";

export interface ProofCalibrationSummary {
  readonly callsWithActualCost: number;
  readonly totalActualUsd: number;
  readonly totalEstimatedUsd: number;
  readonly actualDeviationUsd: number;
  readonly maxActualRatio: number;
  readonly proposedMultiplier: number | null;
  readonly verdict: ProofCalibrationVerdict;
}

function actualCost(call: ProofCalibrationCall): number | null {
  if (call.status !== "succeeded") return null;
  if (
    typeof call.providerReportedUsd === "number" &&
    Number.isFinite(call.providerReportedUsd) &&
    call.providerReportedUsd >= 0
  ) {
    return call.providerReportedUsd;
  }
  if (
    typeof call.calculatedFromUsageUsd === "number" &&
    Number.isFinite(call.calculatedFromUsageUsd) &&
    call.calculatedFromUsageUsd >= 0
  ) {
    return call.calculatedFromUsageUsd;
  }
  return null;
}

export function summarizeProofCalibration(
  calls: readonly ProofCalibrationCall[],
  provisionalMultiplier = 2.5,
): ProofCalibrationSummary {
  let callsWithActualCost = 0;
  let totalActualUsd = 0;
  let totalEstimatedUsd = 0;
  let maxActualRatio = 0;

  for (const call of calls) {
    const actual = actualCost(call);
    if (actual === null) continue;
    callsWithActualCost += 1;
    totalActualUsd += actual;
    totalEstimatedUsd += call.estimatedUsd;
    if (call.estimatedUsd > 0) {
      maxActualRatio = Math.max(maxActualRatio, actual / call.estimatedUsd);
    }
  }

  if (callsWithActualCost === 0) {
    return Object.freeze({
      callsWithActualCost: 0,
      totalActualUsd: 0,
      totalEstimatedUsd: 0,
      actualDeviationUsd: 0,
      maxActualRatio: 0,
      proposedMultiplier: null,
      verdict: "not_calibrated" as const,
    });
  }

  const totalActual = Number(totalActualUsd.toFixed(6));
  const totalEstimated = Number(totalEstimatedUsd.toFixed(6));
  const maxRatio = Number(maxActualRatio.toFixed(6));
  const adjustmentProposed = maxRatio > 1;

  return Object.freeze({
    callsWithActualCost,
    totalActualUsd: totalActual,
    totalEstimatedUsd: totalEstimated,
    actualDeviationUsd: Number((totalActual - totalEstimated).toFixed(6)),
    maxActualRatio: maxRatio,
    proposedMultiplier: adjustmentProposed
      ? Math.ceil(provisionalMultiplier * maxRatio * 100) / 100
      : provisionalMultiplier,
    verdict: adjustmentProposed
      ? ("adjustment_proposed" as const)
      : ("confirmed_conservative" as const),
  });
}
