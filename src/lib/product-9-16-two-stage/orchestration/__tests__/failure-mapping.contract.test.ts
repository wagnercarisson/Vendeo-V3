// @vitest-environment node
import { describe, expect, it } from "vitest";
import { mapModuleOutcomeToControl } from "../failure-mapping";

describe("failure mapping D6", () => {
  it("maps known final failure to failed/definitive + refund", () => {
    expect(mapModuleOutcomeToControl({ kind: "definitive_failure" })).toMatchObject({
      finishStatus: "failed",
      finishFailureClass: "definitive",
      recordOutcome: "failed",
      financial: "refund_once",
    });
  });

  it("maps unknown to no refund", () => {
    expect(mapModuleOutcomeToControl({ kind: "unknown_result" })).toMatchObject({
      finishFailureClass: "unknown",
      recordOutcome: "unknown",
      financial: "none",
    });
  });

  it("maps pre-call transient without outcome", () => {
    expect(
      mapModuleOutcomeToControl({ kind: "blocked", transient: true }),
    ).toMatchObject({ finishFailureClass: "transient", recordOutcome: null, financial: "none" });
  });

  it("maps F60 no-effect codes", () => {
    expect(mapModuleOutcomeToControl({ kind: "query_only" }).noEffect).toBe(true);
    expect(mapModuleOutcomeToControl({ kind: "operation_terminal" }).noEffect).toBe(true);
  });
});
