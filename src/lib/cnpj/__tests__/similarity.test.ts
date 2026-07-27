import { describe, it, expect } from "vitest";
import { compareBusinessName } from "../similarity";

describe("compareBusinessName", () => {
  it("returns high score for identical names", () => {
    const result = compareBusinessName("Loja ABC LTDA", "Loja ABC LTDA");
    expect(result.bestScore).toBeGreaterThanOrEqual(0.8);
    expect(result.label).toBe("match");
  });

  it("returns low score for different names without error", () => {
    const result = compareBusinessName("Minha Loja", "ABC Com\u00e9rcio Ltda");
    expect(result.bestScore).toBeLessThan(0.8);
    expect(result.label).toBe("mismatch");
    expect(result).not.toBeInstanceOf(Error);
  });
});
