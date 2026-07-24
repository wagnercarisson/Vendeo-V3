// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { inferIntent } from "../use-campaign-form";

describe("inferIntent", () => {
  it("returns 'offer' when both original and discounted prices are present (DE+POR)", () => {
    expect(inferIntent(10000, 5000)).toBe("offer");
  });

  it("returns 'spotlight' when only discounted price is present", () => {
    expect(inferIntent(0, 5000)).toBe("spotlight");
  });

  it("returns 'exclusive' when no prices are present (undefined/null)", () => {
    expect(inferIntent(0, undefined)).toBe("exclusive");
    expect(inferIntent(0, null)).toBe("exclusive");
  });

  it("returns 'exclusive' when both prices are zero", () => {
    expect(inferIntent(0, 0)).toBe("exclusive");
  });
});
