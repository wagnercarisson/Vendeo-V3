import { describe, it, expect } from "vitest";
import {
  formatCnpj,
  formatCnpjInput,
  hasInvalidCnpjChars,
} from "../input-mask";

const INVALID = "CNPJ inválido";

describe("hasInvalidCnpjChars", () => {
  it("detects emoji", () => {
    expect(hasInvalidCnpjChars("12.ABC.345/01DE-35😀")).toBe(true);
  });

  it("detects accented letters", () => {
    expect(hasInvalidCnpjChars("12.ÁBC.345/01DE-35")).toBe(true);
  });

  it("detects symbols", () => {
    expect(hasInvalidCnpjChars("12.ABC.345/01DE-35!")).toBe(true);
  });

  it("accepts known formatting, letters and digits", () => {
    expect(hasInvalidCnpjChars(" 12. ABC. 345/01DE-35 ")).toBe(false);
  });

  it("accepts an empty string", () => {
    expect(hasInvalidCnpjChars("")).toBe(false);
  });
});

describe("formatCnpjInput", () => {
  it("applies the progressive mask while typing", () => {
    expect(formatCnpjInput("12abc")).toBe("12.ABC");
  });

  it("formats a pasted alphanumeric CNPJ", () => {
    expect(formatCnpjInput("12.abc.345/01de-35", "")).toBe("12.ABC.345/01DE-35");
  });

  it("formats partial numeric input", () => {
    expect(formatCnpjInput("12345", "")).toBe("12.345");
  });

  it("truncates input beyond the canonical limit", () => {
    expect(formatCnpjInput("12ABC34501DE3599", "")).toBe("12.ABC.345/01DE-35");
  });

  it("keeps the previous value when an unknown character arrives", () => {
    expect(formatCnpjInput("12.ABC.345/01DE-35😀", "12.ABC")).toBe("12.ABC");
  });

  it("returns an empty previous value by default for hostile input", () => {
    expect(formatCnpjInput("12.ABC.345/01DE-35😀")).toBe("");
  });

  it("never exceeds 18 formatted characters", () => {
    expect(formatCnpjInput("12ABC34501DE35", "").length).toBe(18);
  });
});

describe("formatCnpj", () => {
  it("formats a canonical alphanumeric CNPJ", () => {
    expect(formatCnpj("12ABC34501DE35")).toBe("12.ABC.345/01DE-35");
  });

  it("formats a canonical numeric CNPJ unchanged", () => {
    expect(formatCnpj("12345678000195")).toBe("12.345.678/0001-95");
  });

  it("is fail-closed for non-canonical input", () => {
    expect(formatCnpj("curto")).toBe(INVALID);
    expect(formatCnpj("12abc34501de35")).toBe(INVALID);
  });
});
