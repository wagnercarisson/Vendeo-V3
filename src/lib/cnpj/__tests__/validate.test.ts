import { describe, it, expect } from "vitest";
import { validateCnpj } from "../validate";

describe("validateCnpj", () => {
  it("returns normalized for valid CNPJ with punctuation", () => {
    const result = validateCnpj("12.345.678/0001-90");
    expect(result).not.toBeInstanceOf(Error);
    expect((result as { normalized: string }).normalized).toBe("12345678000190");
  });

  it("returns normalized for valid CNPJ with digits only", () => {
    const result = validateCnpj("12345678000190");
    expect(result).not.toBeInstanceOf(Error);
    expect((result as { normalized: string }).normalized).toBe("12345678000190");
  });

  it("returns error for invalid check digits", () => {
    const result = validateCnpj("12.345.678/0001-00");
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toBe("CNPJ inv\u00e1lido");
  });

  it("returns error for short CNPJ", () => {
    const result = validateCnpj("12.345.678/0001");
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toBe("CNPJ deve ter 14 d\u00edgitos");
  });

  it("returns error for long CNPJ", () => {
    const result = validateCnpj("12.345.678/0001-9000");
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toBe("CNPJ deve ter 14 d\u00edgitos");
  });

  it("returns error for known sequence 11...", () => {
    const result = validateCnpj("11.111.111/0001-11");
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toBe("CNPJ inv\u00e1lido");
  });

  it("returns error for known sequence 00...", () => {
    const result = validateCnpj("00.000.000/0001-00");
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toBe("CNPJ inv\u00e1lido");
  });

  it("returns error for empty string", () => {
    const result = validateCnpj("");
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toBe("CNPJ deve ter 14 d\u00edgitos");
  });

  it("returns error for letters", () => {
    const result = validateCnpj("AB.CDE.FGH/0001-00");
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toBe("CNPJ deve ter 14 d\u00edgitos");
  });
});
