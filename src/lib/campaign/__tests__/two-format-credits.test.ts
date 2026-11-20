import { describe, expect, it } from "vitest";

import {
  TWO_FORMAT_CAMPAIGN_CREDITS,
  resolvePresentedCredits,
} from "../two-format-credits";

describe("F60.7 C2 — créditos apresentados", () => {
  it("conjunto usa 2 créditos, independentemente do custo individual", () => {
    expect(resolvePresentedCredits("1:1+9:16", 1)).toBe(TWO_FORMAT_CAMPAIGN_CREDITS);
    expect(resolvePresentedCredits("1:1+9:16", 7)).toBe(2);
    expect(resolvePresentedCredits("1:1+9:16", undefined)).toBe(2);
  });

  it("individuais preservam o custo de campaign_generation", () => {
    expect(resolvePresentedCredits("1:1", 1)).toBe(1);
    expect(resolvePresentedCredits("9:16", 3)).toBe(3);
  });

  it("custo individual desconhecido permanece indefinido (gate preservado)", () => {
    expect(resolvePresentedCredits("1:1", undefined)).toBeUndefined();
    expect(resolvePresentedCredits(undefined, undefined)).toBeUndefined();
    expect(resolvePresentedCredits(null, null)).toBeUndefined();
  });
});
