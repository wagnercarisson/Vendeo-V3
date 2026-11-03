import { describe, expect, it } from "vitest";

import { es419NovidadesMessages } from "../catalogs/es-419";
import { ptBRNovidadesMessages } from "../catalogs/pt-BR";

type FlatCatalog = Record<string, string>;

function flatten(value: unknown, prefix = ""): FlatCatalog {
  const result: FlatCatalog = {};
  if (typeof value !== "object" || value === null) {
    if (typeof value === "string") result[prefix] = value;
    return result;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    Object.assign(result, flatten(child, path));
  }
  return result;
}

function placeholders(text: string): string[] {
  return [...text.matchAll(/\{[a-zA-Z0-9_]+\}/g)]
    .map((match) => match[0])
    .sort();
}

const EXPECTED_PT_KEYS = [
  "breadcrumbHome",
  "card.categoryFeature",
  "card.categoryFix",
  "card.categoryImprovement",
  "card.important",
  "emptyBody",
  "emptyTitle",
  "listEmpty",
  "title",
].sort();

describe("catálogos do namespace de novidades pt-BR e es-419", () => {
  it("têm exatamente as mesmas chaves e namespaces", () => {
    const ptKeys = Object.keys(flatten(ptBRNovidadesMessages)).sort();
    const esKeys = Object.keys(flatten(es419NovidadesMessages)).sort();

    expect(esKeys).toEqual(ptKeys);
  });

  it("não têm valores vazios em nenhum idioma", () => {
    for (const catalog of [
      ptBRNovidadesMessages,
      es419NovidadesMessages,
    ]) {
      for (const [key, value] of Object.entries(flatten(catalog))) {
        expect(value.trim(), `valor vazio em ${key}`).not.toBe("");
      }
    }
  });

  it("mantém o mesmo conjunto de placeholders por chave", () => {
    const pt = flatten(ptBRNovidadesMessages);
    const es = flatten(es419NovidadesMessages);

    for (const [key, value] of Object.entries(pt)) {
      expect(
        placeholders(es[key] ?? ""),
        `placeholders divergentes em ${key}`,
      ).toEqual(placeholders(value));
    }
  });

  it("não declara placeholders (nenhum texto é interpolado)", () => {
    for (const [key, value] of Object.entries(
      flatten(ptBRNovidadesMessages),
    )) {
      expect(placeholders(value), `placeholder inesperado em ${key}`).toEqual(
        [],
      );
    }
  });

  it("são congelados no objeto raiz e no namespace card", () => {
    for (const catalog of [
      ptBRNovidadesMessages,
      es419NovidadesMessages,
    ]) {
      expect(Object.isFrozen(catalog)).toBe(true);
      expect(Object.isFrozen(catalog.card)).toBe(true);
    }
  });

  it("pt-BR contém exatamente as chaves contratadas", () => {
    expect(Object.keys(flatten(ptBRNovidadesMessages)).sort()).toEqual(
      EXPECTED_PT_KEYS,
    );
  });

  it("preserva os textos fixos atuais e os equivalentes es-419", () => {
    expect(ptBRNovidadesMessages.title).toBe("Novidades");
    expect(ptBRNovidadesMessages.breadcrumbHome).toBe("Dashboard");
    expect(ptBRNovidadesMessages.emptyTitle).toBe(
      "Nenhuma novidade por enquanto",
    );
    expect(ptBRNovidadesMessages.listEmpty).toBe(
      "Nenhuma novidade por enquanto.",
    );
    expect(ptBRNovidadesMessages.card.categoryFeature).toBe(
      "Nova funcionalidade",
    );
    expect(ptBRNovidadesMessages.card.categoryImprovement).toBe("Melhoria");
    expect(ptBRNovidadesMessages.card.categoryFix).toBe("Correção");
    expect(ptBRNovidadesMessages.card.important).toBe("Importante");

    expect(es419NovidadesMessages.title).toBe("Novedades");
    expect(es419NovidadesMessages.breadcrumbHome).toBe("Panel");
    expect(es419NovidadesMessages.card.categoryFeature).toBe(
      "Nueva funcionalidad",
    );
    expect(es419NovidadesMessages.card.categoryImprovement).toBe("Mejora");
    expect(es419NovidadesMessages.card.categoryFix).toBe("Corrección");
    expect(es419NovidadesMessages.card.important).toBe("Importante");
  });
});
