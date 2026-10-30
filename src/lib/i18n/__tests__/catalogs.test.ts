import { describe, expect, it } from "vitest";

import { es419Messages } from "../catalogs/es-419";
import { ptBRMessages } from "../catalogs/pt-BR";

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
  "common.save",
  "common.retry",
  "common.loading",
  "shell.nav.dashboard",
  "shell.nav.campaigns",
  "shell.nav.store",
  "shell.nav.account",
  "shell.nav.news",
  "shell.nav.ariaLabel",
  "shell.drawer.close",
  "shell.drawer.dialogLabel",
  "shell.topbar.openMenu",
  "shell.topbar.newCampaign",
  "shell.topbar.newCampaignAria",
  "shell.account.trigger",
  "shell.account.fallbackUser",
  "shell.account.settings",
  "shell.account.logout",
  "shell.badge.available",
  "shell.badge.view",
  "shell.notifications.label",
  "shell.notifications.unread",
  "settings.title",
  "settings.breadcrumbDashboard",
  "settings.languageSection",
  "settings.optionPtBr",
  "settings.optionEs419",
  "settings.saved",
  "settings.saving",
  "settings.reload",
  "settings.login",
  "settings.error.load",
  "settings.error.validation",
  "settings.error.session",
  "settings.error.forbidden",
  "settings.error.conflict",
  "settings.error.unavailable",
  "settings.error.connection",
].sort();

describe("catálogos pt-BR e es-419", () => {
  it("têm exatamente as mesmas chaves e namespaces", () => {
    const ptKeys = Object.keys(flatten(ptBRMessages)).sort();
    const esKeys = Object.keys(flatten(es419Messages)).sort();

    expect(esKeys).toEqual(ptKeys);
  });

  it("não têm valores vazios em nenhum idioma", () => {
    for (const catalog of [ptBRMessages, es419Messages]) {
      for (const [key, value] of Object.entries(flatten(catalog))) {
        expect(value.trim(), `valor vazio em ${key}`).not.toBe("");
      }
    }
  });

  it("mantêm o mesmo conjunto de placeholders por chave", () => {
    const pt = flatten(ptBRMessages);
    const es = flatten(es419Messages);

    for (const [key, value] of Object.entries(pt)) {
      expect(placeholders(es[key] ?? ""), `placeholders divergentes em ${key}`).toEqual(
        placeholders(value),
      );
    }

    expect(placeholders(pt["shell.notifications.unread"])).toEqual(["{count}"]);
    expect(placeholders(es["shell.notifications.unread"])).toEqual(["{count}"]);
  });

  it("são congelados no objeto raiz e em cada namespace", () => {
    for (const catalog of [ptBRMessages, es419Messages]) {
      expect(Object.isFrozen(catalog)).toBe(true);
      expect(Object.isFrozen(catalog.common)).toBe(true);
      expect(Object.isFrozen(catalog.shell)).toBe(true);
      expect(Object.isFrozen(catalog.settings)).toBe(true);
    }
  });

  it("pt-BR contém exatamente as chaves contratadas", () => {
    expect(Object.keys(flatten(ptBRMessages)).sort()).toEqual(EXPECTED_PT_KEYS);
  });
});
