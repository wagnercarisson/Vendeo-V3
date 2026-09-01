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
//
// Numeração canônica conforme tasks.md §16 (Testes 37–46, D9). Os códigos
// ilustrativos do §16 (ex.: "4781400" como subclasse negativa de "47814") são
// exercitados com os equivalentes reais do CNAE_SEGMENT_MAP validados na
// CONCLA/IBGE (ex.: "4789009" subclasse negativa dentro da classe positiva "47890"
// em variedades-utilidades — mesma semântica de granularidade/precedência).

describe("Teste 37 — normalização da subclasse (7 dígitos + DV)", () => {
  it('normaliza "4781-4/00" → "4781400" (remove pontuação, 7 dígitos + DV)', () => {
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

describe("Teste 38 — derivação da classe (4 dígitos + DV); classe × subclasse separadas", () => {
  it('deriva "4781400" → "47814" (5 primeiros caracteres = 4 dígitos + DV)', () => {
    expect(deriveCnaeClasse("4781400")).toBe("47814");
  });

  it("representa classe e subclasse em conjuntos separados no mapa (granularidade distinta)", () => {
    const moda = CNAE_SEGMENT_MAP["moda-calcados-acessorios"];
    expect(moda.compatible.classes).toContain("47814"); // classe (4+DV)
    expect(moda.compatible.subclasses).toContain("4781400"); // subclasse (7)
    expect(moda.compatible.classes).not.toContain("4781400"); // nunca mistura granularidade
    expect(moda.compatible.subclasses).not.toContain("47814");
  });
});

describe("Teste 39 — CNAE na lista positiva → compatible", () => {
  it("retorna compatible para subclasse exata POSITIVA", () => {
    expect(cnaeCompatibilityFor("moda-calcados-acessorios", "4781-4/00")).toBe("compatible");
  });

  it("retorna compatible via CLASSE positiva cobrindo subclasse não listada", () => {
    // 4761-0/01 (livros) não está nas subclasses positivas de variedades-utilidades,
    // mas a classe 47610 está — a classe cobre todas as subclasses dela.
    expect(cnaeCompatibilityFor("variedades-utilidades", "4761-0/01")).toBe("compatible");
  });
});

describe("Teste 40 — CNAE na lista negativa explícita → incompatible", () => {
  it("retorna incompatible via CLASSE negativa explícita", () => {
    // 5611-2/01 (restaurantes e similares) — classe 56112 negativa em moda.
    expect(cnaeCompatibilityFor("moda-calcados-acessorios", "5611-2/01")).toBe("incompatible");
  });

  it("retorna incompatible via SUBCLASSE negativa explícita", () => {
    // 4789-0/09 (armas e munições) — subclasse negativa explícita em variedades-utilidades.
    expect(cnaeCompatibilityFor("variedades-utilidades", "4789-0/09")).toBe("incompatible");
  });
});

describe("Teste 41 — granularidade exata: subclasse negativa não contamina a classe", () => {
  it("subclasse exata NEGATIVA não torna as demais subclasses da classe incompatíveis", () => {
    // 47890 é classe POSITIVA de variedades-utilidades; 4789009 (armas e munições)
    // é subclasse NEGATIVA. As demais subclasses seguem a classe — para cobrir a
    // inteira, a CLASSE (47890) precisa estar listada, não apenas a subclasse.
    expect(cnaeCompatibilityFor("variedades-utilidades", "4789-0/09")).toBe("incompatible");
    expect(cnaeCompatibilityFor("variedades-utilidades", "4789-0/01")).toBe("compatible");
    expect(cnaeCompatibilityFor("variedades-utilidades", "4789-0/99")).toBe("compatible");
  });
});

describe("Teste 42 — precedência de subclasse fina (exceção fina vence)", () => {
  it("negative.subclasses vence positive.classes — exceção fina vence, demais seguem a classe", () => {
    // 47890 em compatible.classes (variedades) e 4789009 em incompatible.subclasses
    // → subclasse exata NEGATIVA prevalece sobre a classe POSITIVA (exceção fina).
    const map = CNAE_SEGMENT_MAP["variedades-utilidades"];
    expect(map.compatible.classes).toContain("47890");
    expect(map.incompatible.subclasses).toContain("4789009");
    expect(cnaeCompatibilityFor("variedades-utilidades", "4789-0/09")).toBe("incompatible");
    // demais subclasses da classe seguem a classe
    expect(cnaeCompatibilityFor("variedades-utilidades", "4789-0/99")).toBe("compatible");
  });
});

describe("Teste 43 — não-contradição: mesmo código nas listas positiva e negativa → erro (build/CI)", () => {
  it("não lança para o mapa real (sem contradições)", () => {
    expect(() => assertNoCnaeContradictions()).not.toThrow();
  });

  it("lança Error quando o mesmo código (CLASSE) está nas listas positiva e negativa do mesmo segmento", () => {
    const contradictory: SegmentCnaeMap = {
      "moda-calcados-acessorios": {
        compatible: { classes: ["47814"], subclasses: ["4781400"] },
        incompatible: { classes: ["47814"], subclasses: [] }, // 47814 em ambas as listas de classes
      },
    };
    expect(() => assertNoCnaeContradictions(contradictory)).toThrow(/47814/);
  });

  it("lança Error quando o mesmo código (SUBCLASSE) está nas listas positiva e negativa", () => {
    const contradictory: SegmentCnaeMap = {
      petshop: {
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
});

describe("Teste 44 — CNAE fora de ambas as listas → unknown; nulo/sem 7 dígitos → unknown", () => {
  it("retorna unknown para CNAE válido fora das listas", () => {
    // 4711301 (hipermercados) não está em nenhuma lista de moda.
    expect(cnaeCompatibilityFor("moda-calcados-acessorios", "4711-3/01")).toBe("unknown");
  });

  it("retorna unknown para null", () => {
    expect(cnaeCompatibilityFor("moda-calcados-acessorios", null)).toBe("unknown");
  });

  it("retorna unknown para CNAE sem 7 dígitos", () => {
    expect(cnaeCompatibilityFor("moda-calcados-acessorios", "47814")).toBe("unknown");
    expect(cnaeCompatibilityFor("moda-calcados-acessorios", "")).toBe("unknown");
  });

  it("retorna unknown para segmento fora do enum (chave ausente)", () => {
    expect(cnaeCompatibilityFor("segmento-inexistente", "4781-4/00")).toBe("unknown");
  });
});

describe("Teste 45 — segmento sem listas (outros) → unknown, nunca penaliza", () => {
  it("outros mantém os quatro conjuntos vazios", () => {
    const outros = CNAE_SEGMENT_MAP["outros"];
    expect(outros.compatible.classes).toHaveLength(0);
    expect(outros.compatible.subclasses).toHaveLength(0);
    expect(outros.incompatible.classes).toHaveLength(0);
    expect(outros.incompatible.subclasses).toHaveLength(0);
  });

  it("cnaeCompatibilityFor('outros', ...) → unknown (neutro, sem penalizar)", () => {
    expect(cnaeCompatibilityFor("outros", "4781-4/00")).toBe("unknown");
  });
});

describe("Teste 46 — ordem de match: negative.subclasses → positive.subclasses → negative.classes → positive.classes → unknown", () => {
  it("subclasse exata (7) é checada antes da classe (4+DV) — ambos os sentidos", () => {
    // positive.subclasses vence negative.classes:
    // 47717 em incompatible.classes (petshop) e 4771704 (medicamentos veterinários)
    // em compatible.subclasses → subclasse exata POSITIVA prevalece sobre a classe NEGATIVA.
    const map = CNAE_SEGMENT_MAP["petshop"];
    expect(map.incompatible.classes).toContain("47717");
    expect(map.compatible.subclasses).toContain("4771704");
    expect(cnaeCompatibilityFor("petshop", "4771-7/04")).toBe("compatible");
    // mas uma subclasse de farmácia humana segue a classe negativa
    expect(cnaeCompatibilityFor("petshop", "4771-7/01")).toBe("incompatible");
  });

  it("percorre a ordem completa: cada estágio do match é atingido por um caso real", () => {
    // 1. negative.subclasses → incompatible (antes da classe positiva 47890)
    expect(cnaeCompatibilityFor("variedades-utilidades", "4789-0/09")).toBe("incompatible");
    // 2. positive.subclasses → compatible (antes da classe negativa 47717)
    expect(cnaeCompatibilityFor("petshop", "4771-7/04")).toBe("compatible");
    // 3. negative.classes → incompatible (subclasse não listada, 56112 classe negativa em moda)
    expect(cnaeCompatibilityFor("moda-calcados-acessorios", "5611-2/01")).toBe("incompatible");
    // 4. positive.classes → compatible (subclasse não listada, 47610 classe positiva em variedades)
    expect(cnaeCompatibilityFor("variedades-utilidades", "4761-0/01")).toBe("compatible");
    // 5. senão → unknown
    expect(cnaeCompatibilityFor("moda-calcados-acessorios", "4711-3/01")).toBe("unknown");
  });
});

// Validação estrutural suplementar do mapa (formato 5/7 dígitos) — não numerada no §16,
// mas pega erro de digitação de código sem depender de caso de uso específico.
describe("Formato estrutural do CNAE_SEGMENT_MAP (suplementar)", () => {
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