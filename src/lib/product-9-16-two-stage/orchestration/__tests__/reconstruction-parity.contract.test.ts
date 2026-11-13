// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildNineSixteenResumeContext } from "../resume-context";

const briefing = {
  backgroundDirection: "studio",
  product: { name: "Produto", description: "Desc" },
  commercial: { intent: "offer", discountedPriceText: "R$ 10,00" },
  constraints: { mandatoryArtworkText: null },
} as never;

describe("reconstruction parity", () => {
  it("uses the same briefingText representation as the route builder", () => {
    const built = buildNineSixteenResumeContext({
      briefing,
      campaignIntent: "offer" as never,
      backgroundDirection: "studio" as never,
      identityDirective: "direção",
      identityContext: { palette: ["#000"] },
      copyContext: { storeName: "Loja" } as never,
      economicSnapshot: { usdBrlRateAtGeneration: null, creditValueBrlAtGeneration: null },
      inputFiles: [],
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.context.briefingText).toBe(JSON.stringify(briefing));
    expect(built.context.identityDirective).toBe("direção");
    expect(built.context.identityContext).toEqual({ palette: ["#000"] });
  });
});
