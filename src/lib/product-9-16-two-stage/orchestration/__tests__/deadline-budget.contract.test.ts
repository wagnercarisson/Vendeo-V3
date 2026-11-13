// @vitest-environment node
import { describe, expect, it } from "vitest";
import { canAffordStep, computeInvocationDeadline, STEP_FLOOR_MS } from "../deadline-budget";
import { mapModuleOutcomeToControl } from "../failure-mapping";

describe("deadline budget", () => {
  it("uses one absolute deadline and never extends it", () => {
    const start = 1_000;
    expect(computeInvocationDeadline(start)).toBe(start + 240_000);
    expect(computeInvocationDeadline(start, 10_000)).toBe(start + 10_000);
    expect(computeInvocationDeadline(start, 999_999)).toBe(start + 240_000);
  });

  it("requires the stage floor", () => {
    expect(canAffordStep(0, STEP_FLOOR_MS.base + 20_000, "base")).toBe(true);
    expect(canAffordStep(0, STEP_FLOOR_MS.base + 19_999, "base")).toBe(false);
  });
});

describe("failure mapping", () => {
  it("never refunds unknown and refunds definitive once", () => {
    expect(mapModuleOutcomeToControl({ kind: "unknown_result" })).toMatchObject({
      finishFailureClass: "unknown",
      recordOutcome: "unknown",
      financial: "none",
    });
    expect(mapModuleOutcomeToControl({ kind: "definitive_failure" })).toMatchObject({
      finishFailureClass: "definitive",
      recordOutcome: "failed",
      financial: "refund_once",
    });
  });

  it("treats F60 no-effect codes as no effect", () => {
    expect(mapModuleOutcomeToControl({ kind: "query_only" }).noEffect).toBe(true);
    expect(mapModuleOutcomeToControl({ kind: "operation_identity_conflict" }).noEffect).toBe(true);
  });
});
