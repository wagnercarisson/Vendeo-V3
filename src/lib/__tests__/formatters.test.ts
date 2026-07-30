import { describe, it, expect } from "vitest";
import { formatDateBR, formatDateTimeBR, formatDateTimeFullBR, formatCurrencyBRL } from "@/lib/formatters";

describe("formatDateBR", () => {
  it("formata data ISO como dd/mm/aaaa no horário de Brasília", () => {
    const result = formatDateBR("2026-07-30T12:00:00Z");
    expect(result).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });

  it("formata data sem hora", () => {
    const result = formatDateBR("2026-07-30");
    expect(result).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });
});

describe("formatDateTimeBR", () => {
  it("formata data ISO como dd/mm/aaaa, hh:mm no horário de Brasília", () => {
    const result = formatDateTimeBR("2026-07-30T12:00:00Z");
    expect(result).toMatch(/^\d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}$/);
    expect(result).toContain("09:00");
  });
});

describe("formatDateTimeFullBR", () => {
  it("formata data ISO como dd/mm/aaaa, hh:mm:ss no horário de Brasília", () => {
    const result = formatDateTimeFullBR("2026-07-30T12:00:00Z");
    expect(result).toMatch(/^\d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}:\d{2}$/);
    expect(result).toContain("09:00");
  });
});

describe("formatCurrencyBRL (existente)", () => {
  it("formata centavos como moeda BRL", () => {
    expect(formatCurrencyBRL(1500)).toMatch(/^R\$\s*15,00$/);
  });
});
