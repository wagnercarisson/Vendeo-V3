// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildNineSixteenResumeContext } from "../resume-context";

const briefing = {
  backgroundDirection: "studio",
  product: { name: "Produto" },
  commercial: { intent: "offer" },
  constraints: { mandatoryArtworkText: null },
} as never;

const input = {
  briefing,
  campaignIntent: "offer" as never,
  backgroundDirection: "studio" as never,
  identityDirective: null,
  identityContext: null,
  copyContext: { storeName: "Loja" } as never,
  economicSnapshot: { usdBrlRateAtGeneration: 5.1, creditValueBrlAtGeneration: 1 },
  inputFiles: [],
};

describe("resume context", () => {
  it("uses the exact JSON.stringify briefing and keeps identity outside", () => {
    const result = buildNineSixteenResumeContext(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.context.briefingText).toBe(JSON.stringify(briefing));
    expect(Object.prototype.hasOwnProperty.call(result.context.briefing, "identity")).toBe(false);
    expect(Object.isFrozen(result.context)).toBe(true);
  });

  it("rejects identity inside briefing", () => {
    expect(
      buildNineSixteenResumeContext({
        ...input,
        briefing: Object.assign({}, briefing as Record<string, unknown>, { identity: {} }) as never,
      }),
    ).toEqual({ ok: false, reason: "identity_inside_briefing" });
  });
});
