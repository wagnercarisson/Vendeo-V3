import { describe, it, expect } from "vitest";
import { getPreFillFromCnpj } from "../cnpj-address-mapper";
import type { CnpjLookupData } from "@/lib/cnpj/lookup-providers/types";

describe("getPreFillFromCnpj", () => {
  it("maps complete CNPJ data to billing address fields", () => {
    const data: CnpjLookupData = {
      cnpj_normalized: "12345678000195",
      razao_social: "Empresa Ltda",
      nome_fantasia: "Empresa",
      situacao_cadastral: "ativa",
      cep: "01001000",
      logradouro: "Rua Exemplo",
      numero: "100",
      complemento: "Sala 5",
      bairro: "Centro",
      cidade: "São Paulo",
      uf: "SP",
      cnae_principal: "47.11-3-00",
      cnae_descricao: "Comércio varejista",
      data_situacao: "2020-01-01",
      data_abertura: "2010-01-01",
      porte: "ME",
    };

    const result = getPreFillFromCnpj(data);
    expect(result.billing_address_street).toBe("Rua Exemplo");
    expect(result.billing_address_number).toBe("100");
    expect(result.billing_address_complement).toBe("Sala 5");
    expect(result.billing_address_neighborhood).toBe("Centro");
    expect(result.billing_address_city).toBe("São Paulo");
    expect(result.billing_address_state).toBe("SP");
    expect(result.billing_address_zipcode).toBe("01001000");
    expect(Object.keys(result)).toHaveLength(7);
  });

  it("handles partial data without throwing", () => {
    const data: CnpjLookupData = {
      cnpj_normalized: "12345678000195",
      razao_social: "Empresa Ltda",
      nome_fantasia: null,
      situacao_cadastral: "ativa",
      cep: null,
      logradouro: "Rua Exemplo",
      numero: null,
      complemento: null,
      bairro: null,
      cidade: null,
      uf: null,
      cnae_principal: null,
      cnae_descricao: null,
      data_situacao: null,
      data_abertura: null,
      porte: null,
    };

    const result = getPreFillFromCnpj(data);
    expect(result.billing_address_street).toBe("Rua Exemplo");
    expect(result.billing_address_number).toBeUndefined();
    expect(result.billing_address_complement).toBeUndefined();
  });

  it("returns empty object for empty data", () => {
    const data: CnpjLookupData = {
      cnpj_normalized: "12345678000195",
      razao_social: "Empresa Ltda",
      nome_fantasia: null,
      situacao_cadastral: "ativa",
      cep: null,
      logradouro: null,
      numero: null,
      complemento: null,
      bairro: null,
      cidade: null,
      uf: null,
      cnae_principal: null,
      cnae_descricao: null,
      data_situacao: null,
      data_abertura: null,
      porte: null,
    };

    const result = getPreFillFromCnpj(data);
    expect(Object.keys(result)).toHaveLength(0);
  });
});
