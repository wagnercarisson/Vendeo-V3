import { describe, expect, it } from "vitest";

import { es419CampaignFormatMessages } from "../catalogs/es-419";
import { ptBRCampaignFormatMessages } from "../catalogs/pt-BR";

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

const EXPECTED_KEYS = [
  "activeLabel",
  "explanations.delivered",
  "explanations.deliveredActive",
  "explanations.notDelivered",
  "explanations.notRequested",
  "explanations.processing",
  "explanations.refunded",
  "explanations.unavailable",
  "explanations.unknown",
  "formats.1:1.name",
  "formats.9:16.name",
  "groupLabel",
  "infoAria",
  "labels.delivered",
  "labels.notDelivered",
  "labels.notRequested",
  "labels.processing",
  "labels.refunded",
  "labels.unavailable",
  "labels.unknown",
].sort();

const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

describe("catálogo compartilhado de formatos pt-BR e es-419", () => {
  it("tem exatamente as mesmas chaves nos dois idiomas", () => {
    expect(Object.keys(flatten(es419CampaignFormatMessages)).sort()).toEqual(
      Object.keys(flatten(ptBRCampaignFormatMessages)).sort(),
    );
  });

  it("pt-BR contém exatamente as chaves contratadas", () => {
    expect(Object.keys(flatten(ptBRCampaignFormatMessages)).sort()).toEqual(
      EXPECTED_KEYS,
    );
  });

  it("não tem valores vazios", () => {
    for (const catalog of [
      ptBRCampaignFormatMessages,
      es419CampaignFormatMessages,
    ]) {
      for (const [key, value] of Object.entries(flatten(catalog))) {
        expect(value.trim(), `valor vazio em ${key}`).not.toBe("");
      }
    }
  });

  it("infoAria não contém placeholder (o componente concatena o nome)", () => {
    expect(placeholders(ptBRCampaignFormatMessages.infoAria)).toEqual([]);
    expect(placeholders(es419CampaignFormatMessages.infoAria)).toEqual([]);
    expect(ptBRCampaignFormatMessages.infoAria).not.toContain("{");
    expect(es419CampaignFormatMessages.infoAria).not.toContain("{");
  });

  it("nenhum texto declara placeholder", () => {
    for (const catalog of [
      ptBRCampaignFormatMessages,
      es419CampaignFormatMessages,
    ]) {
      for (const [key, value] of Object.entries(flatten(catalog))) {
        expect(placeholders(value), `placeholder em ${key}`).toEqual([]);
      }
    }
  });

  it("é congelado em todos os níveis", () => {
    for (const catalog of [
      ptBRCampaignFormatMessages,
      es419CampaignFormatMessages,
    ]) {
      expect(Object.isFrozen(catalog)).toBe(true);
      expect(Object.isFrozen(catalog.formats)).toBe(true);
      expect(Object.isFrozen(catalog.formats["1:1"])).toBe(true);
      expect(Object.isFrozen(catalog.formats["9:16"])).toBe(true);
      expect(Object.isFrozen(catalog.labels)).toBe(true);
      expect(Object.isFrozen(catalog.explanations)).toBe(true);
    }
  });

  it("preserva os textos canônicos aprovados", () => {
    expect(ptBRCampaignFormatMessages.groupLabel).toBe("Formatos da campanha");
    expect(ptBRCampaignFormatMessages.activeLabel).toBe("Selecionado");
    expect(ptBRCampaignFormatMessages.infoAria).toBe(
      "Ver explicação do formato",
    );
    expect(ptBRCampaignFormatMessages.formats["1:1"].name).toBe(
      "Quadrado 1:1",
    );
    expect(ptBRCampaignFormatMessages.formats["9:16"].name).toBe(
      "Vertical 9:16",
    );
    expect(ptBRCampaignFormatMessages.labels).toEqual({
      delivered: "Disponível",
      processing: "Processando",
      notRequested: "Não incluído",
      notDelivered: "Não entregue",
      refunded: "Crédito devolvido",
      unknown: "Não foi possível confirmar",
      unavailable: "Indisponível",
    });
    expect(ptBRCampaignFormatMessages.explanations).toEqual({
      delivered: "Este formato está disponível nesta campanha.",
      deliveredActive: "Este é o formato exibido agora.",
      processing: "Este formato está sendo processado.",
      notRequested: "Esta campanha foi criada apenas neste formato.",
      notDelivered: "Este formato foi solicitado, mas não foi entregue.",
      refunded:
        "Este formato não está disponível e o crédito foi devolvido.",
      unknown: "Não foi possível confirmar o estado deste formato.",
      unavailable: "As informações deste formato não estão disponíveis.",
    });

    expect(es419CampaignFormatMessages.groupLabel).toBe(
      "Formatos de la campaña",
    );
    expect(es419CampaignFormatMessages.activeLabel).toBe("Seleccionado");
    expect(es419CampaignFormatMessages.formats["1:1"].name).toBe(
      "Cuadrado 1:1",
    );
    expect(es419CampaignFormatMessages.formats["9:16"].name).toBe(
      "Vertical 9:16",
    );
  });

  it("proíbe 'Não gerado'/'No generado', '+' e emojis", () => {
    for (const [key, value] of Object.entries({
      ...flatten(ptBRCampaignFormatMessages),
      ...flatten(es419CampaignFormatMessages),
    })) {
      expect(value, `texto proibido em ${key}`).not.toMatch(/Não gerado/i);
      expect(value, `texto proibido em ${key}`).not.toMatch(/No generado/i);
      expect(value, `sinal '+' em ${key}`).not.toContain("+");
      expect(EMOJI.test(value), `emoji em ${key}`).toBe(false);
    }
  });
});
