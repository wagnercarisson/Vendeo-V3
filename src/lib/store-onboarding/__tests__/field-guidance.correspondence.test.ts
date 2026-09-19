import { describe, it, expect } from "vitest";
import { computeTabUnlock } from "../tabs";
import {
  TONE_OF_VOICE_DESCRIPTIONS,
  TONE_OF_VOICE_HINT,
} from "../field-guidance";

const BASE_CONTEXT = {
  name: "Minha Loja",
  segment: "moda-calcados-acessorios",
  legalAccepted: true,
  storeId: "store-1",
  hasVisualDirection: false,
};

describe("store field-guidance — correspondência com computeTabUnlock (F49, D5/D14)", () => {
  it("tom de voz vazio mantém a regra real needs_tone_of_voice", () => {
    expect(
      computeTabUnlock("direcao-visual", {
        ...BASE_CONTEXT,
        toneOfVoice: "",
      }),
    ).toEqual({ unlocked: false, reason: "needs_tone_of_voice" });
  });

  it("com storeId + tom de voz preenchido a aba é liberada", () => {
    expect(
      computeTabUnlock("direcao-visual", {
        ...BASE_CONTEXT,
        toneOfVoice: "profissional",
      }),
    ).toEqual({ unlocked: true });
  });

  it("popular (não vazio) satisfaz a regra needs_tone_of_voice", () => {
    expect(
      computeTabUnlock("direcao-visual", {
        ...BASE_CONTEXT,
        toneOfVoice: "popular",
      }),
    ).toEqual({ unlocked: true });
  });

  it("cobre exatamente as 9 opções reais de tom de voz", () => {
    expect(Object.keys(TONE_OF_VOICE_DESCRIPTIONS).sort()).toEqual(
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
  });

  it("todas as descrições são não vazias e sem linguagem negativa", () => {
    for (const description of Object.values(TONE_OF_VOICE_DESCRIPTIONS)) {
      expect(description.trim().length).toBeGreaterThan(0);
      expect(description).not.toMatch(/não|nunca|evite/i);
    }
  });

  it("o hint do tom de voz é não vazio e positivo", () => {
    expect(TONE_OF_VOICE_HINT.trim().length).toBeGreaterThan(0);
    expect(TONE_OF_VOICE_HINT).toContain("comunica");
    expect(TONE_OF_VOICE_HINT).not.toMatch(/não|nunca|evite/i);
  });
});
