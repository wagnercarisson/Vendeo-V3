import { describe, it, expect } from "vitest";
import { normalizeCnpj } from "../normalize";

describe("normalizeCnpj", () => {
  it("removes punctuation from numeric CNPJ", () => {
    expect(normalizeCnpj("12.345.678/0001-90")).toBe("12345678000190");
  });

  it("keeps letters and uppercases them", () => {
    expect(normalizeCnpj("12.abc.345/01de-35")).toBe("12ABC34501DE35");
  });

  it("preserves letters instead of discarding them", () => {
    expect(normalizeCnpj("AB.CDE.FGH/0001-00")).toBe("ABCDEFGH000100");
  });

  it("removes known formatting and surrounding spaces", () => {
    expect(normalizeCnpj(" 12. ABC. 345/01DE-35 ")).toBe("12ABC34501DE35");
  });

  it("does not discard unknown accented characters", () => {
    const normalized = normalizeCnpj("12.ÁBC.345/01DE-35");
    expect(normalized).toContain("Á");
    expect(normalized).toBe("12ÁBC34501DE35");
  });

  it("does not discard emoji characters", () => {
    const normalized = normalizeCnpj("12.ABC.345/01DE-35😀");
    expect(normalized).toContain("😀");
    expect(normalized).not.toMatch(/^[A-Z0-9]{12}[0-9]{2}$/);
  });

  it("does not use locale-aware uppercasing for non-ASCII letters", () => {
    expect(normalizeCnpj("ß")).toBe("ß");
  });
});
