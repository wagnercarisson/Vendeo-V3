// @vitest-environment node
import { describe, expect, it } from "vitest";
import { resolveCampaignGenerationOrigin } from "../origin";

describe("resolveCampaignGenerationOrigin", () => {
  it("returns two_stage only for the exact pair", () => {
    expect(
      resolveCampaignGenerationOrigin({
        generationOrigin: "9_16_two_stage",
        generationContractVersion: "f60.5-two-stage-9-16-v1",
      }),
    ).toEqual({ kind: "two_stage_9_16" });
  });

  it("returns historical when both keys are absent or undefined", () => {
    expect(resolveCampaignGenerationOrigin({})).toEqual({ kind: "historical" });
    expect(
      resolveCampaignGenerationOrigin({
        generationOrigin: undefined,
        generationContractVersion: undefined,
      }),
    ).toEqual({ kind: "historical" });
  });

  it("returns indeterminate for malformed/partial pairs and ignores format", () => {
    expect(
      resolveCampaignGenerationOrigin({
        generationOrigin: "9_16_two_stage",
        generationContractVersion: "f60.5-two-stage-9-16-v1",
        campaignFormat: "1:1",
      }),
    ).toEqual({ kind: "two_stage_9_16" });
    expect(
      resolveCampaignGenerationOrigin({ generationOrigin: "9_16_two_stage" }),
    ).toMatchObject({ kind: "indeterminate" });
    expect(
      resolveCampaignGenerationOrigin({
        generationOrigin: null,
        generationContractVersion: "f60.5-two-stage-9-16-v1",
      }),
    ).toMatchObject({ kind: "indeterminate" });
    expect(
      resolveCampaignGenerationOrigin({
        generationOrigin: "9_16_two_stage",
        generationContractVersion: "unknown",
      }),
    ).toMatchObject({ kind: "indeterminate" });
  });
});
