import { describe, it, expect } from "vitest";
import { evaluateFreemiumEligibility, normalizeCity } from "../freemium-risk-service";
import type { FreemiumEligibilityInput } from "../types";

function makeInput(overrides: Partial<FreemiumEligibilityInput> = {}): FreemiumEligibilityInput {
  return {
    cnpj: "12345678000190",
    storeName: "Minha Loja",
    city: "São Paulo",
    state: "SP",
    segment: "moda-calcados-acessorios",
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
    // D9: com officialData, cnaeCompatible é preenchido via cnae-mapping
    // (moda-calcados-acessorios + 4781-4/00 → compatible) — não bloqueia approval
    expect(result.signals.cnaeCompatible).toBe("compatible");
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

describe("Teste 22 — INAPTA → review situacao_nao_ativa (D8, corrige lacuna F33)", () => {
  it("REVIEW when INAPTA → situacao_nao_ativa", () => {
    const input = makeInput({
      officialData: { ...makeInput().officialData!, situacao_cadastral: "INAPTA" },
    });

    const result = evaluateFreemiumEligibility(input);
    expect(result.decision).toBe("review");
    expect(result.reasons).toContain("situacao_nao_ativa");
    expect(result.reasons).not.toContain("situacao_suspensa");
  });
});

describe("Teste 23 — SUSPENSA → review situacao_nao_ativa (D8, substitui situacao_suspensa no motor)", () => {
  it("REVIEW when SUSPENSA → situacao_nao_ativa", () => {
    const input = makeInput({
      officialData: { ...makeInput().officialData!, situacao_cadastral: "SUSPENSA" },
    });

    const result = evaluateFreemiumEligibility(input);
    expect(result.decision).toBe("review");
    expect(result.reasons).toContain("situacao_nao_ativa");
  });
});

describe("Teste 24 — BAIXADA/NULA continuam reject (D8)", () => {
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
});

describe("Teste 25 — situação não-vazia genérica ≠ ATIVA/BAIXADA/NULA → review; ausente → defer (D8/D10)", () => {
  it("REVIEW quando situação não-vazia desconhecida (ex.: CANCELADA) → situacao_nao_ativa", () => {
    const input = makeInput({
      officialData: { ...makeInput().officialData!, situacao_cadastral: "CANCELADA" },
    });

    const result = evaluateFreemiumEligibility(input);
    expect(result.decision).toBe("review");
    expect(result.reasons).toContain("situacao_nao_ativa");
  });

  it("DEFER when situação absent in resolved response → dados_oficiais_incompletos", () => {
    const input = makeInput({
      officialData: { ...makeInput().officialData!, situacao_cadastral: "" },
    });

    const result = evaluateFreemiumEligibility(input);
    expect(result.decision).toBe("defer");
    expect(result.reasons).toContain("dados_oficiais_incompletos");
    expect(result.score).toBe(0);
  });
});

describe("Teste 27 — cidade/UF preenchidas mas oficiais ausentes → review localizacao_oficial_indisponivel (D7/D10)", () => {
  it("REVIEW when cidade filled but official cidade absent", () => {
    const input = makeInput({
      officialData: { ...makeInput().officialData!, cidade: null },
    });

    const result = evaluateFreemiumEligibility(input);
    expect(result.decision).toBe("review");
    expect(result.reasons).toContain("localizacao_oficial_indisponivel");
  });

  it("REVIEW when state filled but official uf absent", () => {
    const input = makeInput({
      officialData: { ...makeInput().officialData!, uf: null },
    });

    const result = evaluateFreemiumEligibility(input);
    expect(result.decision).toBe("review");
    expect(result.reasons).toContain("localizacao_oficial_indisponivel");
  });
});

describe("Teste 28 — cidade/UF informadas × oficiais divergentes → review (D10)", () => {
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

  it("REVIEW when nome_divergente (regressão D10)", () => {
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
});

describe("Teste 29 — CNAE compatible → segue avaliação (sem revisão por CNAE) (D9)", () => {
  it("APPROVE com CNAE compatible sem revisão por CNAE", () => {
    const result = evaluateFreemiumEligibility(makeInput());
    expect(result.signals.cnaeCompatible).toBe("compatible");
    expect(result.decision).toBe("approved");
    expect(result.reasons).toEqual([]);
  });
});

describe("Teste 30 — CNAE incompatible → review segmento_cnae_divergente (nunca reject) (D9)", () => {
  it("REVIEW when CNAE incompatible → segmento_cnae_divergente", () => {
    const input = makeInput({
      segment: "variedades-utilidades",
      officialData: {
        ...makeInput().officialData!,
        cnae_principal: "4789-0/09", // subclasse negativa de variedades (armas e munições)
      },
    });

    const result = evaluateFreemiumEligibility(input);
    expect(result.decision).toBe("review");
    expect(result.reasons).toContain("segmento_cnae_divergente");
    expect(result.signals.cnaeCompatible).toBe("incompatible");
  });
});

describe("Teste 31 — CNAE unknown (ausente/inválido/fora das listas) → neutro (D9)", () => {
  it("APPROVE when CNAE unknown (segment outros) → neutro", () => {
    const input = makeInput({ segment: "outros" });

    const result = evaluateFreemiumEligibility(input);
    expect(result.decision).toBe("approved");
    expect(result.reasons).toEqual([]);
    expect(result.signals.cnaeCompatible).toBe("unknown");
  });

  it("cnaeCompatible null quando não há officialData", () => {
    const input = makeInput({
      officialData: null,
      lookupOutcome: "unavailable",
    });

    const result = evaluateFreemiumEligibility(input);
    expect(result.signals.cnaeCompatible).toBeNull();
  });
});

describe("Teste 32 — ordem do motor: situação não ATIVA antes de raiz/nome/cidade/UF (D10)", () => {
  it("situação não-ativa vence root_already_used (situação avaliada antes da raiz)", () => {
    const input = makeInput({
      rootEligible: false,
      officialData: { ...makeInput().officialData!, situacao_cadastral: "INAPTA" },
    });

    const result = evaluateFreemiumEligibility(input);
    expect(result.decision).toBe("review");
    expect(result.reasons).toContain("situacao_nao_ativa");
    expect(result.reasons).not.toContain("root_already_used");
  });

  it("situação não-ativa vence nome divergente", () => {
    const input = makeInput({
      storeName: "Nome Completamente Diferente",
      officialData: {
        ...makeInput().officialData!,
        situacao_cadastral: "SUSPENSA",
        razao_social: "RAZAO SOCIAL DIFERENTE LTDA",
        nome_fantasia: null,
      },
    });

    const result = evaluateFreemiumEligibility(input);
    expect(result.reasons).toContain("situacao_nao_ativa");
    expect(result.reasons).not.toContain("nome_divergente");
  });

  it("situação não-ativa vence cidade/UF divergentes", () => {
    const input = makeInput({
      city: "Campinas",
      state: "RJ",
      officialData: {
        ...makeInput().officialData!,
        situacao_cadastral: "INAPTA",
        cidade: "São Paulo",
        uf: "SP",
      },
    });

    const result = evaluateFreemiumEligibility(input);
    expect(result.reasons).toContain("situacao_nao_ativa");
    expect(result.reasons).not.toContain("cidade_divergente");
    expect(result.reasons).not.toContain("uf_divergente");
  });
});

describe("Teste 33 — api_unavailable/sem dados → defer (não falso negativo) (D10)", () => {
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
});
