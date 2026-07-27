import { describe, it, expect } from "vitest";
import { maskCnpj } from "../mask";

describe("maskCnpj", () => {
  it("masks CNPJ correctly", () => {
    expect(maskCnpj("12345678000190")).toBe("**.***.***/0001-**");
  });

  it("preserves suffix YYYY", () => {
    expect(maskCnpj("22345678000211")).toBe("**.***.***/0002-**");
  });
});
