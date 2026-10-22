import { describe, it, expect } from "vitest";
import { maskCnpj } from "../mask";

const INVALID = "CNPJ inválido";

describe("maskCnpj", () => {
  it("masks numeric CNPJ correctly", () => {
    expect(maskCnpj("12345678000195")).toBe("**.***.***/0001-**");
  });

  it("preserves a numeric branch suffix", () => {
    expect(maskCnpj("22345678000211")).toBe("**.***.***/0002-**");
  });

  it("preserves an alphanumeric suffix", () => {
    expect(maskCnpj("12ABC34501DE35")).toBe("**.***.***/01DE-**");
  });

  it("is fail-closed for lowercase input", () => {
    const result = maskCnpj("12abc34501de35");
    expect(result).toBe(INVALID);
    expect(result).not.toContain("12abc34501de35");
  });

  it("is fail-closed for truncated input", () => {
    expect(maskCnpj("12ABC")).toBe(INVALID);
  });

  it("is fail-closed for input with unknown characters", () => {
    const result = maskCnpj("12.ABC.345/01DE-35😀");
    expect(result).toBe(INVALID);
    expect(result).not.toContain("01DE");
  });
});
