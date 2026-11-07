// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  VERTICAL_COST_MULTIPLIER,
  VERTICAL_PIXEL_AREA_RATIO,
  VERTICAL_PRICING_VERSION,
  VerticalEstimateMissingError,
  assertVerticalEstimate,
  canAfford,
  createProofBudget,
  estimateVerticalCall,
  recordCall,
  recordUnknownOutcome,
  remainingBudgetBlocks,
} from "../cost/vertical-estimate";

describe("F59 — estimativa vertical e orçamento da prova", () => {
  it("congela versão, razão de área e multiplicador provisório", () => {
    expect(VERTICAL_PRICING_VERSION).toBe("f59-vertical-9-16-v1");
    expect(VERTICAL_PIXEL_AREA_RATIO).toBe(2.25);
    expect(VERTICAL_COST_MULTIPLIER).toBe(2.5);
  });

  it("estima 0,03 × 2,5 = 0,075", () => {
    const estimate = estimateVerticalCall({
      model: "gpt-image-2",
      quality: "low",
      imageUnitUsd: 0.03,
    });
    expect(estimate).toEqual({
      available: true,
      estimatedUsd: 0.075,
      multiplier: 2.5,
      pixelAreaRatio: 2.25,
      pricingVersion: "f59-vertical-9-16-v1",
    });
  });

  it.each([null, undefined, 0, Number.NaN, Infinity, -1])(
    "fail-closed para imageUnitUsd=%s",
    (unitCost) => {
      const estimate = estimateVerticalCall({
        model: "gpt-image-2",
        quality: "low",
        imageUnitUsd: unitCost as number | null | undefined,
      });
      expect(estimate).toEqual({
        available: false,
        reason: "vertical_estimate_missing",
      });
      expect(() => assertVerticalEstimate(estimate)).toThrow(
        VerticalEstimateMissingError,
      );
    },
  );

  it("assertVerticalEstimate devolve a estimativa disponível", () => {
    const estimate = estimateVerticalCall({
      model: "gpt-image-2.5-sunburst",
      quality: "medium",
      imageUnitUsd: 0.12,
    });
    const asserted = assertVerticalEstimate(estimate);
    expect(asserted.estimatedUsd).toBe(0.3);
    expect(asserted.multiplier).toBe(2.5);
  });

  it("cria o orçamento fechado da prova (US$ 3,00 / 14 chamadas)", () => {
    const budget = createProofBudget({ capUsd: 3, plannedCalls: 14 });
    expect(budget).toEqual({
      capUsd: 3,
      plannedCalls: 14,
      remainingUsd: 3,
      executedCalls: 0,
      pendingCalls: 14,
      totalChargedUsd: 0,
      deviationUsd: 0,
      unknownCalls: 0,
      costUnverifiedCalls: 0,
      retryCalls: 0,
      fallbackCalls: 0,
      requiresReconciliation: false,
      stopReason: null,
      exhausted: false,
    });
    expect(Object.isFrozen(budget)).toBe(true);
  });

  it("bloqueia quando o saldo não cobre a chamada", () => {
    const budget = createProofBudget({ capUsd: 3, plannedCalls: 14 });
    expect(canAfford(budget, 0.075)).toEqual({ ok: true });
    expect(canAfford(budget, 3.01)).toEqual({
      ok: false,
      reason: "proof_budget_exceeded",
    });
    expect(remainingBudgetBlocks(budget, 3.01)).toBe("proof_budget_exceeded");
    expect(remainingBudgetBlocks(budget, 0.075)).toBeNull();
  });

  it("cobra o maior custo conhecido (reportado/calculado/estimado)", () => {
    const budget = createProofBudget({ capUsd: 3, plannedCalls: 14 });
    const after = recordCall(budget, {
      estimatedUsd: 0.075,
      providerReportedUsd: 0.09,
      calculatedFromUsageUsd: 0.11,
      target: "primary",
    });
    expect(after.totalChargedUsd).toBe(0.11);
    expect(after.remainingUsd).toBe(2.89);
    expect(after.deviationUsd).toBe(0.035);
    expect(after.executedCalls).toBe(1);
    expect(after.pendingCalls).toBe(13);
    expect(budget.totalChargedUsd).toBe(0);
  });

  it("cobra a estimativa quando só ela existe", () => {
    const budget = createProofBudget({ capUsd: 3, plannedCalls: 14 });
    const after = recordCall(budget, {
      estimatedUsd: 0.075,
      target: "primary",
    });
    expect(after.totalChargedUsd).toBe(0.075);
    expect(after.remainingUsd).toBe(2.925);
    expect(after.deviationUsd).toBe(0);
  });

  it("conta retry e fallback como chamadas executadas", () => {
    const budget = createProofBudget({ capUsd: 3, plannedCalls: 14 });
    const after = recordCall(budget, {
      estimatedUsd: 0.075,
      target: "fallback",
      isRetry: true,
    });
    expect(after.executedCalls).toBe(1);
    expect(after.retryCalls).toBe(1);
    expect(after.fallbackCalls).toBe(1);
    expect(after.pendingCalls).toBe(13);
  });

  it("para com pending quando o orçamento se esgota", () => {
    let budget = createProofBudget({ capUsd: 0.1, plannedCalls: 14 });
    budget = recordCall(budget, { estimatedUsd: 0.075, target: "primary" });
    expect(budget.exhausted).toBe(false);
    budget = recordCall(budget, { estimatedUsd: 0.075, target: "primary" });
    expect(budget.exhausted).toBe(true);
    expect(budget.stopReason).toBe("proof_budget_exceeded");
    expect(budget.pendingCalls).toBe(12);
    expect(remainingBudgetBlocks(budget, 0.075)).toBe("proof_budget_exceeded");
  });

  it("unknown cobra a estimativa, exige reconciliação e para a prova", () => {
    const budget = createProofBudget({ capUsd: 3, plannedCalls: 14 });
    const after = recordUnknownOutcome(budget, {
      estimatedUsd: 0.075,
      target: "primary",
    });
    expect(after.totalChargedUsd).toBe(0.075);
    expect(after.unknownCalls).toBe(1);
    expect(after.executedCalls).toBe(1);
    expect(after.requiresReconciliation).toBe(true);
    expect(after.stopReason).toBe("cost_unknown");
    expect(remainingBudgetBlocks(after, 0.075)).toBe("cost_unknown");
    expect(Object.isFrozen(after)).toBe(true);
    expect(budget.unknownCalls).toBe(0);
  });

  it("custo não apurado exige reconciliação e para a prova", () => {
    const budget = createProofBudget({ capUsd: 3, plannedCalls: 14 });
    const after = recordCall(budget, {
      estimatedUsd: 0.075,
      target: "primary",
      costVerified: false,
    });
    expect(after.costUnverifiedCalls).toBe(1);
    expect(after.requiresReconciliation).toBe(true);
    expect(after.stopReason).toBe("cost_unknown");
    expect(remainingBudgetBlocks(after, 0.075)).toBe("cost_unknown");
  });

  it("não muta o input e preserva a parada anterior", () => {
    const budget = createProofBudget({ capUsd: 3, plannedCalls: 14 });
    const unknown = recordUnknownOutcome(budget, {
      estimatedUsd: 0.075,
      target: "primary",
    });
    const after = recordCall(unknown, {
      estimatedUsd: 0.075,
      target: "primary",
    });
    expect(after.stopReason).toBe("cost_unknown");
    expect(budget).toEqual(createProofBudget({ capUsd: 3, plannedCalls: 14 }));
  });

  it("rejeita estimativa inválida no orçamento", () => {
    const budget = createProofBudget({ capUsd: 3, plannedCalls: 14 });
    expect(() =>
      recordCall(budget, { estimatedUsd: 0, target: "primary" }),
    ).toThrow(VerticalEstimateMissingError);
    expect(() =>
      recordUnknownOutcome(budget, { estimatedUsd: -1, target: "primary" }),
    ).toThrow(VerticalEstimateMissingError);
  });
});
