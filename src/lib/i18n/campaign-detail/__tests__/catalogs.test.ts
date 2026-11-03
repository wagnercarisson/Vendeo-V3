import { describe, expect, it } from "vitest";

import { es419CampaignDetailMessages } from "../catalogs/es-419";
import { ptBRCampaignDetailMessages } from "../catalogs/pt-BR";

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
  "breadcrumbCampaigns",
  "copy.ariaPrefix",
  "copy.copy",
  "copy.copied",
  "copy.targets.caption",
  "copy.targets.cta",
  "copy.targets.hashtags",
  "copy.targets.title",
  "createdAtLabel",
  "disclaimer",
  "downloadOriginal",
  "editedBadge",
  "fallbackTitle",
  "publicationKit",
].sort();

describe("catálogos do namespace da campanha pronta pt-BR e es-419", () => {
  it("têm exatamente as mesmas chaves e namespaces", () => {
    const ptKeys = Object.keys(flatten(ptBRCampaignDetailMessages)).sort();
    const esKeys = Object.keys(flatten(es419CampaignDetailMessages)).sort();

    expect(esKeys).toEqual(ptKeys);
  });

  it("não têm valores vazios em nenhum idioma", () => {
    for (const catalog of [
      ptBRCampaignDetailMessages,
      es419CampaignDetailMessages,
    ]) {
      for (const [key, value] of Object.entries(flatten(catalog))) {
        expect(value.trim(), `valor vazio em ${key}`).not.toBe("");
      }
    }
  });

  it("mantém o mesmo conjunto de placeholders por chave", () => {
    const pt = flatten(ptBRCampaignDetailMessages);
    const es = flatten(es419CampaignDetailMessages);

    for (const [key, value] of Object.entries(pt)) {
      expect(
        placeholders(es[key] ?? ""),
        `placeholders divergentes em ${key}`,
      ).toEqual(placeholders(value));
    }
  });

  it("não declara placeholders (nenhum texto é interpolado)", () => {
    for (const [key, value] of Object.entries(
      flatten(ptBRCampaignDetailMessages),
    )) {
      expect(placeholders(value), `placeholder inesperado em ${key}`).toEqual(
        [],
      );
    }
  });

  it("são congelados no objeto raiz, em copy e em copy.targets", () => {
    for (const catalog of [
      ptBRCampaignDetailMessages,
      es419CampaignDetailMessages,
    ]) {
      expect(Object.isFrozen(catalog)).toBe(true);
      expect(Object.isFrozen(catalog.copy)).toBe(true);
      expect(Object.isFrozen(catalog.copy.targets)).toBe(true);
    }
  });

  it("pt-BR contém exatamente as chaves contratadas", () => {
    expect(Object.keys(flatten(ptBRCampaignDetailMessages)).sort()).toEqual(
      EXPECTED_PT_KEYS,
    );
  });

  it("preserva os textos fixos atuais em pt-BR", () => {
    expect(ptBRCampaignDetailMessages.breadcrumbCampaigns).toBe("Campanhas");
    expect(ptBRCampaignDetailMessages.fallbackTitle).toBe("Campanha");
    expect(ptBRCampaignDetailMessages.createdAtLabel).toBe("Criada em");
    expect(ptBRCampaignDetailMessages.publicationKit).toBe("Kit de Publicação");
    expect(ptBRCampaignDetailMessages.editedBadge).toBe("Editado");
    expect(ptBRCampaignDetailMessages.downloadOriginal).toBe("Baixar Original");
    expect(ptBRCampaignDetailMessages.disclaimer).toBe(
      "Use apenas materiais que você tem autorização para divulgar. Revise textos, preços e imagens antes de publicar: a IA pode cometer erros.",
    );
    expect(ptBRCampaignDetailMessages.copy.copy).toBe("Copiar");
    expect(ptBRCampaignDetailMessages.copy.copied).toBe("Copiado!");
    expect(ptBRCampaignDetailMessages.copy.ariaPrefix).toBe("Copiar");
    expect(ptBRCampaignDetailMessages.copy.targets).toEqual({
      caption: "caption",
      hashtags: "hashtags",
      cta: "Chamada",
      title: "título",
    });
  });

  it("usa a forma única espanhola contratada", () => {
    expect(es419CampaignDetailMessages.breadcrumbCampaigns).toBe("Campañas");
    expect(es419CampaignDetailMessages.fallbackTitle).toBe("Campaña");
    expect(es419CampaignDetailMessages.createdAtLabel).toBe("Creada el");
    expect(es419CampaignDetailMessages.publicationKit).toBe(
      "Kit de Publicación",
    );
    expect(es419CampaignDetailMessages.editedBadge).toBe("Editado");
    expect(es419CampaignDetailMessages.downloadOriginal).toBe(
      "Descargar original",
    );
    expect(es419CampaignDetailMessages.copy.copied).toBe("¡Copiado!");
    expect(es419CampaignDetailMessages.copy.targets.caption).toBe(
      "texto de la publicación",
    );
    expect(es419CampaignDetailMessages.copy.targets.cta).toBe("Llamada");
  });
});
