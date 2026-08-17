import { describe, it, expect } from "vitest";
import { evaluateFreemiumEligibility, normalizeCity } from "../freemium-risk-service";
import type { FreemiumEligibilityInput } from "../types";

function makeInput(overrides: Partial<FreemiumEligibilityInput> = {}): FreemiumEligibilityInput {
  return {
    cnpj: "12345678000190",
    storeName: "Minha Loja",
    city: "São Paulo",
    state: "SP",
    segment: "vestuario",
    officialData: {
      cnpj_normalized: "12345678000190",
      razao_social: "MINHA LOJA LTDA",
      nome_fantasia: "Minha Loja",
      situacao_cadastral: "ATIVA",
      cep: "01234567",
      logradouro: "Rua Exemplo",
      numero: "123",
      complemento: null,
      bairro: "Centro",
      cidade: "São Paulo",
      uf: "SP",
      cnae_principal: "4781-4/00",
      cnae_descricao: null,
      data_situacao: "2020-01-01",
      data_abertura: "2010-05-10",
      porte: "ME",
    },
    lookupOutcome: "resolved",
    rootHash: "abc123",
    rootEligible: true,
    ...overrides,
  };
}

describe("normalizeCity", () => {
  it("normalizes accented cities for comparison", () => {
    expect(normalizeCity("São Paulo")).toBe("SAO PAULO");
    expect(normalizeCity("são paulo")).toBe("SAO PAULO");
  });

  it("detects different cities", () => {
    expect(normalizeCity("São Paulo")).not.toBe(normalizeCity("São Bernardo do Campo"));
  });
});

describe("evaluateFreemiumEligibility", () => {
  it("exposes tri-state cnaeCompatible signal (D9/D10 contract)", () => {
    const result = evaluateFreemiumEligibility(makeInput());

    // Type-level contract (D9/D10): cnaeCompatible é "compatible" | "incompatible" | "unknown" | null
    const cnaeCompatible: "compatible" | "incompatible" | "unknown" | null =
      result.signals.cnaeCompatible;
    expect(["compatible", "incompatible", "unknown", null]).toContain(cnaeCompatible);
  });

  it("APPROVE when all signals are positive", () => {
    const result = evaluateFreemiumEligibility(makeInput());

    expect(result.decision).toBe("approved");
    expect(result.reasons).toEqual([]);
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.signals.cnpjExists).toBe(true);
    expect(result.signals.rootEligible).toBe(true);
    expect(result.signals.cnaeCompatible).toBeNull();
  });

  it("APPROVE via nome fantasia when storeName matches fantasy name", () => {
    const input = makeInput({
      storeName: "Minha Loja",
      officialData: {
        ...makeInput().officialData!,
        razao_social: "RAZAO SOCIAL COMPLETAMENTE DIFERENTE LTDA",
        nome_fantasia: "Minha Loja",
      },
    });

    const result = evaluateFreemiumEligibility(input);
    expect(result.decision).toBe("approved");
    expect(result.signals.nameSimilarity).toBeGreaterThanOrEqual(0.6);
  });

  it("REJECT when not_found", () => {
    const input = makeInput({
      officialData: null,
      lookupOutcome: "not_found",
    });

    const result = evaluateFreemiumEligibility(input);
    expect(result.decision).toBe("reject");
    expect(result.reasons).toContain("cnpj_not_found");
  });

  it("REJECT when BAIXADA", () => {
    const input = makeInput({
      officialData: { ...makeInput().officialData!, situacao_cadastral: "BAIXADA" },
    });

    const result = evaluateFreemiumEligibility(input);
    expect(result.decision).toBe("reject");
    expect(result.reasons).toContain("cnpj_baixada");
  });

  it("REJECT when NULA", () => {
    const input = makeInput({
      officialData: { ...makeInput().officialData!, situacao_cadastral: "NULA" },
    });

    const result = evaluateFreemiumEligibility(input);
    expect(result.decision).toBe("reject");
    expect(result.reasons).toContain("cnpj_nula");
  });

  it("REJECT when root_already_used", () => {
    const input = makeInput({ rootEligible: false });

    const result = evaluateFreemiumEligibility(input);
    expect(result.decision).toBe("reject");
    expect(result.reasons).toContain("root_already_used");
  });

  it("REVIEW when SUSPENSA", () => {
    const input = makeInput({
      officialData: { ...makeInput().officialData!, situacao_cadastral: "SUSPENSA" },
    });

    const result = evaluateFreemiumEligibility(input);
    expect(result.decision).toBe("review");
    expect(result.reasons).toContain("situacao_suspensa");
  });

  it("REVIEW when nome_divergente", () => {
    const input = makeInput({
      storeName: "Nome Completamente Diferente",
      officialData: {
        ...makeInput().officialData!,
        razao_social: "RAZAO SOCIAL DIFERENTE LTDA",
        nome_fantasia: null,
      },
    });

    const result = evaluateFreemiumEligibility(input);
    expect(result.decision).toBe("review");
    expect(result.reasons).toContain("nome_divergente");
  });

  it("REVIEW when cidade_divergente", () => {
    const input = makeInput({
      city: "Campinas",
      officialData: { ...makeInput().officialData!, cidade: "São Paulo" },
    });

    const result = evaluateFreemiumEligibility(input);
    expect(result.decision).toBe("review");
    expect(result.reasons).toContain("cidade_divergente");
  });

  it("REVIEW when uf_divergente", () => {
    const input = makeInput({
      state: "RJ",
      officialData: { ...makeInput().officialData!, uf: "SP" },
    });

    const result = evaluateFreemiumEligibility(input);
    expect(result.decision).toBe("review");
    expect(result.reasons).toContain("uf_divergente");
  });

  it("DEFER when api_unavailable", () => {
    const input = makeInput({
      officialData: null,
      lookupOutcome: "unavailable",
      rootEligible: true,
    });

    const result = evaluateFreemiumEligibility(input);
    expect(result.decision).toBe("defer");
    expect(result.reasons).toContain("api_unavailable");
  });
});
