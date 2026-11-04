// @vitest-environment node
import { describe, expect, it } from "vitest";

import { evaluateProofCall } from "../cost/proof-call-outcome";
import {
  createProofBudget,
  recordCall,
} from "../cost/vertical-estimate";

/**
 * Simulação do pipeline de decisão do harness, sem provider:
 * avaliação da chamada → cobrança no orçamento → estado de parada.
 */
describe("F59 — simulação do harness (sem provider)", () => {
  it("sucesso com custo reportado mantém a prova seguindo", () => {
    const evaluation = evaluateProofCall({
      requestedSize: "1152x2048",
      returnedWidth: 1152,
      returnedHeight: 2048,
      providerReportedUsd: 0.09,
      calculatedFromUsageUsd: null,
      estimatedUsd: 0.11,
    });
    const budget = recordCall(
      createProofBudget({ capUsd: 3, plannedCalls: 8 }),
      {
        estimatedUsd: 0.11,
        providerReportedUsd: 0.09,
        calculatedFromUsageUsd: null,
        target: "primary",
        costVerified: evaluation.costVerified,
      },
    );

    expect(evaluation.outcome).toBe("succeeded");
    expect(evaluation.stop).toBe(false);
    expect(budget.totalChargedUsd).toBe(0.11);
    expect(budget.requiresReconciliation).toBe(false);
    expect(budget.costUnverifiedCalls).toBe(0);
  });

  it("dimensão divergente para a matriz preservando o custo", () => {
    const evaluation = evaluateProofCall({
      requestedSize: "1152x2048",
      returnedWidth: 1024,
      returnedHeight: 1024,
      providerReportedUsd: 0.09,
      calculatedFromUsageUsd: null,
      estimatedUsd: 0.11,
    });
    const budget = recordCall(
      createProofBudget({ capUsd: 3, plannedCalls: 8 }),
      {
        estimatedUsd: 0.11,
        providerReportedUsd: 0.09,
        calculatedFromUsageUsd: null,
        target: "primary",
        costVerified: evaluation.costVerified,
      },
    );

    expect(evaluation.outcome).toBe("dimension_mismatch");
    expect(evaluation.stop).toBe(true);
    expect(budget.executedCalls).toBe(1);
    expect(budget.totalChargedUsd).toBe(0.11);
  });

  it("custo não apurado exige reconciliação e para a matriz", () => {
    const evaluation = evaluateProofCall({
      requestedSize: "1152x2048",
      returnedWidth: 1152,
      returnedHeight: 2048,
      providerReportedUsd: null,
      calculatedFromUsageUsd: null,
      estimatedUsd: 0.11,
    });
    const budget = recordCall(
      createProofBudget({ capUsd: 3, plannedCalls: 8 }),
      {
        estimatedUsd: 0.11,
        providerReportedUsd: null,
        calculatedFromUsageUsd: null,
        target: "primary",
        costVerified: evaluation.costVerified,
      },
    );

    expect(evaluation.outcome).toBe("cost_unverified");
    expect(evaluation.stop).toBe(true);
    expect(budget.totalChargedUsd).toBe(0.11);
    expect(budget.costUnverifiedCalls).toBe(1);
    expect(budget.requiresReconciliation).toBe(true);
    expect(budget.stopReason).toBe("cost_unknown");
  });
});
