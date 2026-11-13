// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { NineSixteenEvent } from "../types";

function classify(event: NineSixteenEvent): string {
  switch (event.type) {
    case "phase":
      return "phase";
    case "processing":
      return "processing";
    case "result":
      return "result";
    case "error":
      return "error";
    case "unknown":
      return "unknown";
    default: {
      const never: never = event;
      return never;
    }
  }
}

describe("orchestration event contract", () => {
  it("narrows processing separately from terminals", () => {
    const processing: NineSixteenEvent = {
      type: "processing",
      campaignId: "c",
      operationId: "o",
      state: "between_steps",
      nextStep: "base",
      canContinue: true,
    };
    expect(classify(processing)).toBe("processing");
    expect(classify({ type: "result", campaignId: "c", operationId: "o", campaignUrl: "/x" })).toBe("result");
    expect(
      classify({ type: "unknown", campaignId: "c", operationId: "o", reference: "r" }),
    ).toBe("unknown");
  });
});
