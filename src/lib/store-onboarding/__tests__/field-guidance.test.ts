import { describe, it, expect } from "vitest";
import {
  TONE_OF_VOICE_DESCRIPTIONS,
  TONE_OF_VOICE_OPTIONS,
  TONE_OF_VOICE_HINT,
  TONE_OF_VOICE_COMPLEMENTS_HINT,
  STORE_NAME_HINT,
  FISCAL_SECTION_LABEL,
  FISCAL_SECTION_HELPER,
  POSITIONING_LABEL,
  POSITIONING_SECONDARY_LABEL,
  POSITIONING_PLACEHOLDER,
  POSITIONING_EXAMPLE,
  POSITIONING_IDENTITY_HINT,
  SHORT_DESCRIPTION_HINT,
  SLOGAN_HINT,
  RECOMMENDED_LABEL,
  OPTIONAL_LABEL,
} from "../field-guidance";

describe("store field-guidance — conteúdo puro (F49, D3/D4/D5/D6/D7/D14)", () => {
  it("tem exatamente as 9 descrições de tom de voz, todas não vazias", () => {
    const keys = Object.keys(TONE_OF_VOICE_DESCRIPTIONS).sort();
    expect(keys).toEqual(
      [
        "acolhedor",
        "divertido",
        "elegante",
        "jovem",
        "luxuoso",
        "moderno",
        "popular",
        "profissional",
        "tradicional",
      ].sort(),
    );
    for (const value of Object.values(TONE_OF_VOICE_DESCRIPTIONS)) {
      expect(value.trim().length).toBeGreaterThan(0);
    }
  });

  it("opções, descrições e união tipada permanecem sincronizadas (9 e mesmo conjunto)", () => {
    const optionValues = TONE_OF_VOICE_OPTIONS.map((o) => o.value).sort();
    const descriptionKeys = Object.keys(TONE_OF_VOICE_DESCRIPTIONS).sort();
    expect(optionValues).toEqual(descriptionKeys);
    expect(optionValues).toHaveLength(9);
    for (const option of TONE_OF_VOICE_OPTIONS) {
      expect(option.label.trim().length).toBeGreaterThan(0);
    }
  });

  it("descreve profissional, moderno, luxuoso e popular com as frases canônicas", () => {
    expect(TONE_OF_VOICE_DESCRIPTIONS.profissional).toBe(
      "Direta, confiável e sem exageros.",
    );
    expect(TONE_OF_VOICE_DESCRIPTIONS.moderno).toBe(
      "Atual, objetiva e com energia contemporânea.",
    );
    expect(TONE_OF_VOICE_DESCRIPTIONS.luxuoso).toBe(
      "Sofisticada, exclusiva e com senso de premium.",
    );
    expect(TONE_OF_VOICE_DESCRIPTIONS.popular).toBe(
      "Simples, acessível e próxima do dia a dia.",
    );
  });

  it("exporta hints e labels obrigatórios não vazios", () => {
    for (const text of [
      STORE_NAME_HINT,
      FISCAL_SECTION_LABEL,
      FISCAL_SECTION_HELPER,
      TONE_OF_VOICE_HINT,
      TONE_OF_VOICE_COMPLEMENTS_HINT,
      POSITIONING_LABEL,
      POSITIONING_SECONDARY_LABEL,
      POSITIONING_PLACEHOLDER,
      POSITIONING_EXAMPLE,
      POSITIONING_IDENTITY_HINT,
      SHORT_DESCRIPTION_HINT,
      SLOGAN_HINT,
      RECOMMENDED_LABEL,
      OPTIONAL_LABEL,
    ]) {
      expect(text.trim().length).toBeGreaterThan(0);
    }
  });

  it("SLOGAN_HINT deixa claro que o campo é para quem já utiliza um slogan", () => {
    expect(SLOGAN_HINT).toContain("se sua loja já utiliza um");
  });

  it("POSITIONING_EXAMPLE expõe a estrutura [categoria]/[público]/[diferencial]", () => {
    expect(POSITIONING_EXAMPLE).toContain("[categoria]");
    expect(POSITIONING_EXAMPLE).toContain("[público]");
    expect(POSITIONING_EXAMPLE).toContain("[diferencial]");
  });
});
