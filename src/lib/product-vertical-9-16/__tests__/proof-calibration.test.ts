// @vitest-environment node
import { describe, expect, it } from "vitest";

import { summarizeProofCalibration } from "../cost/proof-calibration";

const BASE = {
  status: "succeeded" as const,
  providerReportedUsd: null,
  calculatedFromUsageUsd: null,
};

describe("F59 — resumo de calibração da prova", () => {
  it("confirma conservador quando o custo real fica abaixo da estimativa", () => {
    const summary = summarizeProofCalibration([
      {
        ...BASE,
        estimatedUsd: 0.11,
        calculatedFromUsageUsd: 0.029185,
      },
      {
        ...BASE,
        estimatedUsd: 0.105,
        calculatedFromUsageUsd: 0.022785,
      },
    ]);

    expect(summary.callsWithActualCost).toBe(2);
    expect(summary.totalActualUsd).toBe(0.05197);
    expect(summary.totalEstimatedUsd).toBe(0.215);
    expect(summary.actualDeviationUsd).toBe(-0.16303);
    expect(summary.maxActualRatio).toBe(0.265318);
    expect(summary.proposedMultiplier).toBe(2.5);
    expect(summary.verdict).toBe("confirmed_conservative");
  });

  it("propõe ajuste quando o custo real supera a estimativa", () => {
    const summary = summarizeProofCalibration([
      {
        ...BASE,
        estimatedUsd: 0.1,
        calculatedFromUsageUsd: 0.13,
      },
    ]);

    expect(summary.verdict).toBe("adjustment_proposed");
    expect(summary.maxActualRatio).toBe(1.3);
    expect(summary.proposedMultiplier).toBe(3.25);
  });

  it("usa custo reportado quando presente e calculado como fallback", () => {
    const summary = summarizeProofCalibration([
      {
        ...BASE,
        estimatedUsd: 0.1,
        providerReportedUsd: 0.08,
        calculatedFromUsageUsd: 0.12,
      },
      {
        ...BASE,
        estimatedUsd: 0.1,
        calculatedFromUsageUsd: 0.09,
      },
    ]);

    expect(summary.callsWithActualCost).toBe(2);
    expect(summary.totalActualUsd).toBe(0.17);
    expect(summary.maxActualRatio).toBe(0.9);
  });

  it("não calibra sem custo real, mesmo com estimativa", () => {
    const summary = summarizeProofCalibration([
      {
        ...BASE,
        estimatedUsd: 0.1,
        providerReportedUsd: null,
        calculatedFromUsageUsd: null,
      },
      {
        ...BASE,
        status: "cost_unverified",
        estimatedUsd: 0.1,
      },
    ]);

    expect(summary.callsWithActualCost).toBe(0);
    expect(summary.verdict).toBe("not_calibrated");
    expect(summary.proposedMultiplier).toBeNull();
  });
});
