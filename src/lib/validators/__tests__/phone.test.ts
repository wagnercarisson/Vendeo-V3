import { describe, it, expect } from "vitest";
import { maskWhatsApp } from "../phone";

describe("maskWhatsApp", () => {
  it("retorna string vazia para entrada vazia", () => {
    expect(maskWhatsApp("")).toBe("");
  });

  it("formata 11 dígitos como (11) 99999-9999", () => {
    expect(maskWhatsApp("11999999999")).toBe("(11) 99999-9999");
  });

  it("trunca 12 dígitos em 11", () => {
    expect(maskWhatsApp("119999999999")).toBe("(11) 99999-9999");
  });

  it("mascara progressivamente entradas parciais", () => {
    expect(maskWhatsApp("119")).toBe("(11) 9");
    expect(maskWhatsApp("119999")).toBe("(11) 99999");
  });

  it("é idempotente para valor já mascarado (paste)", () => {
    expect(maskWhatsApp("(11) 99999-9999")).toBe("(11) 99999-9999");
  });

  it("remove caracteres não numéricos", () => {
    expect(maskWhatsApp("abc 11 99999-9999")).toBe("(11) 99999-9999");
  });

  it("mantém dígitos sem DDD enquanto tem menos de 3", () => {
    expect(maskWhatsApp("1")).toBe("1");
    expect(maskWhatsApp("11")).toBe("11");
  });
});
