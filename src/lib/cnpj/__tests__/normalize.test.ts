import { describe, it, expect } from "vitest";
import { normalizeCnpj } from "../normalize";

describe("normalizeCnpj", () => {
  it("removes punctuation", () => {
    expect(normalizeCnpj("12.345.678/0001-90")).toBe("12345678000190");
  });

  it("removes non-digit characters", () => {
    expect(normalizeCnpj("12.345.678/0001-90-abc")).toBe("12345678000190");
  });
});
