import { describe, expect, it } from "vitest";

import { es419CampaignListMessages } from "../catalogs/es-419";
import { ptBRCampaignListMessages } from "../catalogs/pt-BR";

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
  "actions.download",
  "actions.open",
  "empty.noCampaignsBody",
  "empty.noCampaignsCta",
  "empty.noCampaignsTitle",
  "empty.searchBody",
  "empty.searchTitle",
  "filters.period30d",
  "filters.period7d",
  "filters.period90d",
  "filters.periodAll",
  "filters.periodLabel",
  "filters.periodYear",
  "filters.sortLabel",
  "filters.sortNameAsc",
  "filters.sortNameDesc",
  "filters.sortNewest",
  "filters.sortOldest",
  "filters.statusAll",
  "filters.statusError",
  "filters.statusReady",
  "noStore.body",
  "noStore.cta",
  "noStore.title",
  "pagination.next",
  "pagination.previous",
  "search.ariaLabel",
  "search.placeholder",
  "status.error",
  "status.incomplete",
  "status.ready",
  "title",
].sort();

const NAMESPACES = [
  "search",
  "filters",
  "status",
  "actions",
  "empty",
  "noStore",
  "pagination",
] as const;

describe("catálogos do namespace da listagem pt-BR e es-419", () => {
  it("têm exatamente as mesmas chaves e namespaces", () => {
    const ptKeys = Object.keys(flatten(ptBRCampaignListMessages)).sort();
    const esKeys = Object.keys(flatten(es419CampaignListMessages)).sort();

    expect(esKeys).toEqual(ptKeys);
  });

  it("não têm valores vazios em nenhum idioma", () => {
    for (const catalog of [
      ptBRCampaignListMessages,
      es419CampaignListMessages,
    ]) {
      for (const [key, value] of Object.entries(flatten(catalog))) {
        expect(value.trim(), `valor vazio em ${key}`).not.toBe("");
      }
    }
  });

  it("mantém o mesmo conjunto de placeholders por chave", () => {
    const pt = flatten(ptBRCampaignListMessages);
    const es = flatten(es419CampaignListMessages);

    for (const [key, value] of Object.entries(pt)) {
      expect(
        placeholders(es[key] ?? ""),
        `placeholders divergentes em ${key}`,
      ).toEqual(placeholders(value));
    }
  });

  it("não declara placeholders (nenhum texto é interpolado)", () => {
    for (const [key, value] of Object.entries(
      flatten(ptBRCampaignListMessages),
    )) {
      expect(placeholders(value), `placeholder inesperado em ${key}`).toEqual(
        [],
      );
    }
  });

  it("são congelados no objeto raiz e em cada namespace", () => {
    for (const catalog of [
      ptBRCampaignListMessages,
      es419CampaignListMessages,
    ]) {
      expect(Object.isFrozen(catalog)).toBe(true);
      for (const namespace of NAMESPACES) {
        expect(
          Object.isFrozen(catalog[namespace]),
          `${namespace} não congelado`,
        ).toBe(true);
      }
    }
  });

  it("pt-BR contém exatamente as chaves contratadas", () => {
    expect(Object.keys(flatten(ptBRCampaignListMessages)).sort()).toEqual(
      EXPECTED_PT_KEYS,
    );
  });

  it("expõe os rótulos acessíveis contratados", () => {
    expect(ptBRCampaignListMessages.search.ariaLabel).toBe("Buscar campanhas");
    expect(ptBRCampaignListMessages.filters.periodLabel).toBe("Período");
    expect(ptBRCampaignListMessages.filters.sortLabel).toBe("Ordenar por");
    expect(es419CampaignListMessages.search.ariaLabel).toBe("Buscar campañas");
    expect(es419CampaignListMessages.filters.periodLabel).toBe("Período");
    expect(es419CampaignListMessages.filters.sortLabel).toBe("Ordenar por");
  });

  it("preserva os textos pt-BR existentes e a distinção de status", () => {
    expect(ptBRCampaignListMessages.title).toBe("Campanhas");
    expect(ptBRCampaignListMessages.filters.statusAll).toBe("Todas");
    expect(ptBRCampaignListMessages.filters.statusReady).toBe("Prontas");
    expect(ptBRCampaignListMessages.filters.statusError).toBe("Erro");
    expect(ptBRCampaignListMessages.status.ready).toBe("Pronta");
    expect(ptBRCampaignListMessages.status.incomplete).toBe("Não concluída");
    expect(ptBRCampaignListMessages.status.error).toBe("Erro");
    expect(ptBRCampaignListMessages.actions.open).toBe("Abrir");
    expect(ptBRCampaignListMessages.actions.download).toBe("Baixar");
    expect(ptBRCampaignListMessages.pagination.previous).toBe("<< Anterior");
    expect(ptBRCampaignListMessages.pagination.next).toBe("Próximo >>");
  });
});
