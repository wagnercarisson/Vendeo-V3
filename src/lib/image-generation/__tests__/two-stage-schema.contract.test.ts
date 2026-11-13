// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  ContinueGenerationRequestSchema,
  GenerationPhaseEvent,
  TwoStageGenerationPhase,
} from "../schema";

describe("two-stage schema", () => {
  it("accepts distinct requestIds and rejects content/second format", () => {
    const valid = {
      operationId: "33333333-3333-4333-8333-333333333333",
      requestIds: {
        base: "11111111-1111-4111-8111-111111111111",
        expansion: "22222222-2222-4222-8222-222222222222",
      },
    };
    expect(ContinueGenerationRequestSchema.safeParse(valid).success).toBe(true);
    expect(
      ContinueGenerationRequestSchema.safeParse({
        ...valid,
        requestIds: { base: valid.requestIds.base, expansion: valid.requestIds.base },
      }).success,
    ).toBe(false);
    expect(
      ContinueGenerationRequestSchema.safeParse({ ...valid, briefing: "novo" }).success,
    ).toBe(false);
    expect(
      ContinueGenerationRequestSchema.safeParse({ ...valid, campaignFormat: "1:1" }).success,
    ).toBe(false);
  });

  it("keeps existing phases and adds the two-stage phases", () => {
    const phase: TwoStageGenerationPhase = "campaign_expansion";
    const event: GenerationPhaseEvent = { phase, status: "running" };
    expect(event.phase).toBe("campaign_expansion");
  });
});
