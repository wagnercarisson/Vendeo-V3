import { describe, it, expect } from "vitest";
import {
  normalizeCnaeSubclasse,
  deriveCnaeClasse,
  cnaeCompatibilityFor,
  assertNoCnaeContradictions,
  CNAE_SEGMENT_MAP,
  type CnaeCodes,
  type SegmentCnaeMap,
} from "../cnae-mapping";

// Todos os códigos CNAE usados nos testes foram validados na CONCLA/IBGE
// (busca online CNAE-Subclasses 2.3, https://concla.ibge.gov.br/busca-online-cnae.html)
// em 2026-08-17 — nenhum código ilustrativo do alinhamento foi copiado.

describe("normalizeCnaeSubclasse (test 37-38)", () => {
  it("normaliza 7 dígitos removendo pontuação (ex. 4781-4/00 → 4781400)", () => {
    expect(normalizeCnaeSubclasse("4781-4/00")).toBe("4781400");
  });

  it("aceita entrada já normalizada", () => {
    expect(normalizeCnaeSubclasse("4781400")).toBe("4781400");
  });

  it("retorna null quando não resultar em exatamente 7 dígitos", () => {
    expect(normalizeCnaeSubclasse("47814")).toBeNull(); // 5 (classe, sem subclasse)
    expect(normalizeCnaeSubclasse("4781-4/0")).toBeNull(); // 6
    expect(normalizeCnaeSubclasse("47814000")).toBeNull(); // 8
    expect(normalizeCnaeSubclasse("")).toBeNull();
    expect(normalizeCnaeSubclasse("não-numérico")).toBeNull();
  });
});

describe("deriveCnaeClasse (test 39)", () => {
  it("deriva a classe 4+DV (5 primeiros caracteres)", () => {
    expect(deriveCnaeClasse("4781400")).toBe("47814");
  });
});

describe("cnaeCompatibilityFor (tests 40-44, 46)", () => {
  it("retorna compatible para subclasse exata POSITIVA", () => {
    expect(cnaeCompatibilityFor("moda-calcados-acessorios", "4781-4/00")).toBe("compatible");
  });

  it("retorna compatible via CLASSE positiva cobrindo subclasse não listada", () => {
    // 4761-0/01 (livros) não está nas subclasses positivas de variedades-utilidades,
    // mas a classe 47610 está — a classe cobre todas as subclasses dela.
    expect(cnaeCompatibilityFor("variedades-utilidades", "4761-0/01")).toBe("compatible");
  });

  it("retorna incompatible explícito via CLASSE negativa", () => {
    // 5611-2/01 (restaurantes e similares) — classe 56112 negativa em moda.
    expect(cnaeCompatibilityFor("moda-calcados-acessorios", "5611-2/01")).toBe("incompatible");
  });

  it("subclasse exata NEGATIVA não contamina as demais subclasses da classe", () => {
    // 47890 é classe POSITIVA de variedades-utilidades; 4789009 (armas e munições)
    // é subclasse NEGATIVA. As demais subclasses seguem a classe.
    expect(cnaeCompatibilityFor("variedades-utilidades", "4789-0/09")).toBe("incompatible");
    expect(cnaeCompatibilityFor("variedades-utilidades", "4789-0/01")).toBe("compatible");
    expect(cnaeCompatibilityFor("variedades-utilidades", "4789-0/99")).toBe("compatible");
  });

  it("precedência: negative.subclasses vence positive.classes", () => {
    // 47890 em compatible.classes (variedades) e 4789009 em incompatible.subclasses
    // → subclasse exata NEGATIVA prevalece sobre a classe POSITIVA.
    const map = CNAE_SEGMENT_MAP["variedades-utilidades"];
    expect(map.compatible.classes).toContain("47890");
    expect(map.incompatible.subclasses).toContain("4789009");
    expect(cnaeCompatibilityFor("variedades-utilidades", "4789-0/09")).toBe("incompatible");
  });

  it("precedência: positive.subclasses vence negative.classes", () => {
    // 47717 em incompatible.classes (petshop) e 4771704 (medicamentos veterinários)
    // em compatible.subclasses → subclasse exata POSITIVA prevalece sobre a classe NEGATIVA.
    const map = CNAE_SEGMENT_MAP["petshop"];
    expect(map.incompatible.classes).toContain("47717");
    expect(map.compatible.subclasses).toContain("4771704");
    expect(cnaeCompatibilityFor("petshop", "4771-7/04")).toBe("compatible");
    // mas uma subclasse de farmácia humana segue a classe negativa
    expect(cnaeCompatibilityFor("petshop", "4771-7/01")).toBe("incompatible");
  });

  it("retorna unknown para CNAE válido fora das listas", () => {
    // 4711301 (hipermercados) não está em nenhuma lista de moda.
    expect(cnaeCompatibilityFor("moda-calcados-acessorios", "4711-3/01")).toBe("unknown");
  });

  it("retorna unknown para null ou CNAE inválido (sem 7 dígitos)", () => {
    expect(cnaeCompatibilityFor("moda-calcados-acessorios", null)).toBe("unknown");
    expect(cnaeCompatibilityFor("moda-calcados-acessorios", "47814")).toBe("unknown");
    expect(cnaeCompatibilityFor("moda-calcados-acessorios", "")).toBe("unknown");
  });

  it("retorna unknown para o segmento outros (conjuntos vazios, nunca penaliza)", () => {
    const outros = CNAE_SEGMENT_MAP["outros"];
    expect(outros.compatible.classes).toHaveLength(0);
    expect(outros.compatible.subclasses).toHaveLength(0);
    expect(outros.incompatible.classes).toHaveLength(0);
    expect(outros.incompatible.subclasses).toHaveLength(0);
    expect(cnaeCompatibilityFor("outros", "4781-4/00")).toBe("unknown");
  });

  it("retorna unknown para segmento fora do enum (chave ausente)", () => {
    expect(cnaeCompatibilityFor("segmento-inexistente", "4781-4/00")).toBe("unknown");
  });
});

describe("assertNoCnaeContradictions (test 45)", () => {
  it("não lança para o mapa real (sem contradições)", () => {
    expect(() => assertNoCnaeContradictions()).not.toThrow();
  });

  it("lança Error quando o mesmo código está nas listas positiva e negativa do mesmo segmento", () => {
    const contradictory: SegmentCnaeMap = {
      "moda-calcados-acessorios": {
        compatible: { classes: ["47814"], subclasses: ["4781400"] },
        incompatible: { classes: ["47814"], subclasses: [] }, // 47814 em ambas as listas de classes
      },
    };
    expect(() => assertNoCnaeContradictions(contradictory)).toThrow(/47814/);
  });

  it("lança Error também para subclasse idêntica nas listas pos+neg", () => {
    const contradictory: SegmentCnaeMap = {
      "petshop": {
        compatible: { classes: [], subclasses: ["4789004"] },
        incompatible: { classes: [], subclasses: ["4789004"] },
      },
    };
    expect(() => assertNoCnaeContradictions(contradictory)).toThrow(/4789004/);
  });

  it("permite overlap pai-filho (classe numa lista + subclasse dela em outra)", () => {
    // 47890 em compatible.classes + 4789009 em incompatible.subclasses — resolvido por precedência.
    const map: SegmentCnaeMap = {
      "variedades-utilidades": {
        compatible: { classes: ["47890"], subclasses: [] },
        incompatible: { classes: [], subclasses: ["4789009"] },
      },
    };
    expect(() => assertNoCnaeContradictions(map)).not.toThrow();
  });

  it("mapa real só contém códigos com formato válido (7 dígitos ou classe 5 dígitos)", () => {
    const validSubclasse = /^\d{7}$/;
    const validClasse = /^\d{5}$/;
    for (const [segment, entry] of Object.entries(CNAE_SEGMENT_MAP)) {
      for (const codes of [entry.compatible, entry.incompatible] satisfies CnaeCodes[]) {
        for (const c of codes.classes) expect(c, `${segment}: classe ${c}`).toMatch(validClasse);
        for (const s of codes.subclasses) expect(s, `${segment}: subclasse ${s}`).toMatch(validSubclasse);
      }
    }
  });
});