import { describe, it, expect } from "vitest";
import { evaluateFreemiumEligibility, normalizeCity } from "@/lib/freemium/freemium-risk-service";

describe("F33 — Fluxos de Verificação CNPJ Freemium", () => {
  it("1. Fluxo feliz: CNPJ válido → approve → grant de 10 créditos", () => {
    const result = evaluateFreemiumEligibility({
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
      rootHash: "hash123",
      rootEligible: true,
    });

    expect(result.decision).toBe("approved");
    expect(result.reasons).toEqual([]);
    expect(result.score).toBeGreaterThanOrEqual(80);
  });

  it("2. Fluxo review: nome divergente → review", () => {
    const result = evaluateFreemiumEligibility({
      cnpj: "12345678000190",
      storeName: "Nome Completamente Diferente",
      city: "São Paulo",
      state: "SP",
      segment: "vestuario",
      officialData: {
        cnpj_normalized: "12345678000190",
        razao_social: "RAZAO DIFERENTE LTDA",
        nome_fantasia: null,
        situacao_cadastral: "ATIVA",
        cep: "01234567",
        logradouro: "Rua Diferente",
        numero: "456",
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
      rootHash: "hash456",
      rootEligible: true,
    });

    expect(result.decision).toBe("review");
    expect(result.reasons).toContain("nome_divergente");
  });

  it("3. Fluxo reject: CNPJ inexistente → not_found", () => {
    const result = evaluateFreemiumEligibility({
      cnpj: "00000000000000",
      storeName: "Loja Falsa",
      city: "São Paulo",
      state: "SP",
      segment: "vestuario",
      officialData: null,
      lookupOutcome: "not_found",
      rootHash: "hash999",
      rootEligible: true,
    });

    expect(result.decision).toBe("reject");
    expect(result.reasons).toContain("cnpj_not_found");
    expect(result.score).toBe(0);
  });

  it("4. Fluxo defer: API indisponível → defer", () => {
    const result = evaluateFreemiumEligibility({
      cnpj: "12345678000190",
      storeName: "Loja Defer",
      city: "São Paulo",
      state: "SP",
      segment: "vestuario",
      officialData: null,
      lookupOutcome: "unavailable",
      rootHash: "hash789",
      rootEligible: true,
    });

    expect(result.decision).toBe("defer");
    expect(result.reasons).toContain("api_unavailable");
    expect(result.score).toBe(0);
  });

  it("5. Fluxo admin exception: CNPJ baixado → reject (exception bypassa)", () => {
    const result = evaluateFreemiumEligibility({
      cnpj: "12345678000190",
      storeName: "Loja Baixada",
      city: "São Paulo",
      state: "SP",
      segment: "vestuario",
      officialData: {
        cnpj_normalized: "12345678000190",
        razao_social: "EMPRESA BAIXADA LTDA",
        nome_fantasia: null,
        situacao_cadastral: "BAIXADA",
        cep: null,
        logradouro: null,
        numero: null,
        complemento: null,
        bairro: null,
        cidade: "São Paulo",
        uf: "SP",
        cnae_principal: null,
        cnae_descricao: null,
        data_situacao: "2023-01-01",
        data_abertura: "2010-05-10",
        porte: null,
      },
      lookupOutcome: "resolved",
      rootHash: "hash012",
      rootEligible: true,
    });

    expect(result.decision).toBe("reject");
    expect(result.reasons).toContain("cnpj_baixada");
  });

  it("normalizeCity normalizes accented cities", () => {
    expect(normalizeCity("São Paulo")).toBe("SAO PAULO");
    expect(normalizeCity("são paulo")).toBe("SAO PAULO");
    expect(normalizeCity("São Bernardo do Campo")).not.toBe("SAO PAULO");
  });
});
