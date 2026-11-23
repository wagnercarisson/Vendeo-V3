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
  "formatAddition.action",
  "formatAddition.cancel",
  "formatAddition.confirm",
  "formatAddition.cost",
  "formatAddition.delivered",
  "formatAddition.description",
  "formatAddition.failed",
  "formatAddition.incompatible.artifactInvalid",
  "formatAddition.incompatible.campaignNotReady",
  "formatAddition.incompatible.formatNotSquare",
  "formatAddition.incompatible.pathNotCanonical",
  "formatAddition.incompatible.sourceOriginInvalid",
  "formatAddition.incompatible.unsupportedDimensions",
  "formatAddition.incompatible.unsupportedMime",
  "formatAddition.processing",
  "formatAddition.readUnavailable.artifactAbsent",
  "formatAddition.readUnavailable.artifactIndeterminate",
  "formatAddition.readUnavailable.identityConflict",
  "formatAddition.readUnavailable.readFailed",
  "formatAddition.refunded",
  "formatAddition.retry",
  "formatAddition.selection",
  "formatAddition.title",
  "formatAddition.tracking",
  "formatAddition.unavailable",
  "formatAddition.unknown",
  "publicationKit",
  "formats.activeLabel",
  "formats.explanations.delivered",
  "formats.explanations.deliveredActive",
  "formats.explanations.notDelivered",
  "formats.explanations.notRequested",
  "formats.explanations.processing",
  "formats.explanations.refunded",
  "formats.explanations.unavailable",
  "formats.explanations.unknown",
  "formats.formats.1:1.name",
  "formats.formats.9:16.name",
  "formats.groupLabel",
  "formats.infoAria",
  "formats.labels.delivered",
  "formats.labels.notDelivered",
  "formats.labels.notRequested",
  "formats.labels.processing",
  "formats.labels.refunded",
  "formats.labels.unavailable",
  "formats.labels.unknown",
  "jointNotes.finalizationPending",
  "jointNotes.invalidRequest",
  "jointNotes.partialProcessing",
  "jointNotes.partialRefunded",
  "jointNotes.partialUnconfirmed",
  "jointNotes.processing",
  "jointNotes.refunded",
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
      // F61 — catálogo compartilhado e notas conjuntas congelados.
      expect(Object.isFrozen(catalog.formats)).toBe(true);
      expect(Object.isFrozen(catalog.formats.formats)).toBe(true);
      expect(Object.isFrozen(catalog.formats.labels)).toBe(true);
      expect(Object.isFrozen(catalog.formats.explanations)).toBe(true);
      expect(Object.isFrozen(catalog.jointNotes)).toBe(true);
      // F62 — textos da adição vertical congelados em todos os níveis.
      expect(Object.isFrozen(catalog.formatAddition)).toBe(true);
      expect(Object.isFrozen(catalog.formatAddition.incompatible)).toBe(true);
      expect(Object.isFrozen(catalog.formatAddition.readUnavailable)).toBe(true);
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

  it("F62 — cobre custo, confirmação, acompanhamento, retomada e rollback", () => {
    for (const catalog of [
      ptBRCampaignDetailMessages,
      es419CampaignDetailMessages,
    ]) {
      const messages = catalog.formatAddition;

      expect(messages.cost).toMatch(/1 cr[eé]dito/);
      expect(messages.confirm.trim()).not.toBe("");
      expect(messages.cancel.trim()).not.toBe("");
      expect(messages.processing.trim()).not.toBe("");
      expect(messages.tracking.trim()).not.toBe("");
      expect(messages.retry.trim()).not.toBe("");
      expect(messages.delivered.trim()).not.toBe("");
      expect(messages.refunded.trim()).not.toBe("");
      expect(messages.unknown.trim()).not.toBe("");
      expect(messages.failed.trim()).not.toBe("");
      expect(messages.unavailable.trim()).not.toBe("");
      expect(messages.selection.trim()).not.toBe("");
    }

    expect(ptBRCampaignDetailMessages.formatAddition.cost).toBe(
      "Custo: 1 crédito",
    );
    expect(es419CampaignDetailMessages.formatAddition.cost).toBe(
      "Costo: 1 crédito",
    );
  });

  it("F62 — incompatibilidade e indisponibilidade têm texto por motivo", () => {
    for (const catalog of [
      ptBRCampaignDetailMessages,
      es419CampaignDetailMessages,
    ]) {
      const messages = catalog.formatAddition;

      for (const value of Object.values(messages.incompatible)) {
        expect(value.trim()).not.toBe("");
      }
      for (const value of Object.values(messages.readUnavailable)) {
        expect(value.trim()).not.toBe("");
      }
    }

    // Itens ausentes/indisponíveis são distintos e não prometem adaptação.
    expect(ptBRCampaignDetailMessages.formatAddition.readUnavailable.artifactAbsent).not.toBe(
      ptBRCampaignDetailMessages.formatAddition.readUnavailable.readFailed,
    );
  });

  it("F62 — não promete adaptação futura, 1080, conversão ou emoji", () => {
    const forbidden = [
      /1080/,
      /convert(er|ir|ersión|sión)/i,
      /redimension/i,
      /adapt(ar|ación|ação)/i,
      /em breve/i,
      /pr[óo]ximamente/i,
      /futuro/i,
    ];
    const emoji =
      /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;

    for (const catalog of [
      ptBRCampaignDetailMessages,
      es419CampaignDetailMessages,
    ]) {
      const text = Object.values(flatten(catalog)).join("\n");

      for (const pattern of forbidden) {
        expect(text).not.toMatch(pattern);
      }
      expect(text).not.toMatch(emoji);
    }
  });
});
