import { describe, expect, it } from "vitest";

import { es419DashboardMessages } from "../catalogs/es-419";
import { ptBRDashboardMessages } from "../catalogs/pt-BR";

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
  return [...text.matchAll(/\{[a-zA-Z0-9_]+\}/g)].map((match) => match[0]).sort();
}

const EXPECTED_PT_KEYS = [
  "greeting.morning",
  "greeting.afternoon",
  "greeting.evening",
  "greeting.neutral",
  "greeting.welcome",
  "greeting.nameSeparator",
  "header.subtitleDesktop",
  "header.subtitleMobile",
  "credits.sectionLabel",
  "credits.unitSingular",
  "credits.unitPlural",
  "credits.zero",
  "credits.unavailable",
  "credits.description",
  "credits.detailsLink",
  "credits.detailsAria",
  "campaigns.sectionLabel",
  "campaigns.format.square",
  "campaigns.format.vertical",
  "campaigns.countSingular",
  "campaigns.countPlural",
  "campaigns.emptyTitle",
  "campaigns.emptyBody",
  "campaigns.emptyCta",
  "campaigns.viewAll",
  "campaigns.open",
  "campaigns.failureTitle",
  "campaigns.failureBody",
  "campaigns.cardAria",
  "campaigns.orientation",
  "shortcut.title",
  "shortcut.cta",
  "news.sectionLabel",
  "news.view",
  "news.close",
  "banners.review",
  "banners.approved",
  "banners.approvedDismiss",
  "banners.readinessTitle",
  "banners.readinessCadastroFiscal",
  "banners.readinessBrandProfile",
  "banners.readinessCta",
  "loading.statusLabel",
  "noStore.title",
  "noStore.body",
  "noStore.cta",
].sort();

const NAMESPACES = [
  "greeting",
  "header",
  "credits",
  "campaigns",
  "shortcut",
  "news",
  "banners",
  "loading",
  "noStore",
] as const;

describe("catálogos do namespace dashboard pt-BR e es-419", () => {
  it("têm exatamente as mesmas chaves e namespaces", () => {
    const ptKeys = Object.keys(flatten(ptBRDashboardMessages)).sort();
    const esKeys = Object.keys(flatten(es419DashboardMessages)).sort();

    expect(esKeys).toEqual(ptKeys);
  });

  it("não têm valores vazios em nenhum idioma", () => {
    for (const catalog of [ptBRDashboardMessages, es419DashboardMessages]) {
      for (const [key, value] of Object.entries(flatten(catalog))) {
        expect(value.trim(), `valor vazio em ${key}`).not.toBe("");
      }
    }
  });

  it("mantêm o mesmo conjunto de placeholders por chave", () => {
    const pt = flatten(ptBRDashboardMessages);
    const es = flatten(es419DashboardMessages);

    for (const [key, value] of Object.entries(pt)) {
      expect(placeholders(es[key] ?? ""), `placeholders divergentes em ${key}`).toEqual(
        placeholders(value),
      );
    }
  });

  it("declara os placeholders contratados", () => {
    expect(placeholders(ptBRDashboardMessages.campaigns.cardAria)).toEqual([
      "{date}",
      "{product}",
    ]);
    expect(placeholders(es419DashboardMessages.campaigns.cardAria)).toEqual([
      "{date}",
      "{product}",
    ]);
    expect(placeholders(ptBRDashboardMessages.campaigns.countSingular)).toEqual(["{count}"]);
    expect(placeholders(ptBRDashboardMessages.campaigns.countPlural)).toEqual(["{count}"]);
  });

  it("são congelados no objeto raiz e em cada namespace", () => {
    for (const catalog of [ptBRDashboardMessages, es419DashboardMessages]) {
      expect(Object.isFrozen(catalog)).toBe(true);
      for (const namespace of NAMESPACES) {
        expect(Object.isFrozen(catalog[namespace]), `${namespace} não congelado`).toBe(true);
      }
    }
  });

  it("pt-BR contém exatamente as chaves contratadas", () => {
    expect(Object.keys(flatten(ptBRDashboardMessages)).sort()).toEqual(EXPECTED_PT_KEYS);
  });
});
