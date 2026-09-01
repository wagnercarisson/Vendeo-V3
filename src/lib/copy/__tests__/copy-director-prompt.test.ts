import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

function readPrompt(name: string): string {
  return readFileSync(path.join(process.cwd(), "prompts", name), "utf-8");
}

const PROMPTS = [
  "campaign-copy-director.md",
  "campaign-copy-director-offer.md",
  "campaign-copy-director-spotlight.md",
  "campaign-copy-director-exclusive.md",
];

// Âncoras conceituais do bloco "Precisão comercial" (D3/D6) — NÃO lista longa de tokens.
const SECTION_HEADER = "### Precisão comercial";
const PROTECTED_FACTS = "fatos protegidos";
const NO_INFERENCE = "Não transforme inferências em fatos comerciais";
const SALES_CONDITIONS = "entrega, frete, retirada, compra online";
const PAYMENT_STOCK = "parcelamento, garantia, estoque, últimas unidades";
const CREATIVITY_ALLOWED = "Pode criar desejo, urgência emocional";
const NEUTRAL_CTAS = [
  "Visite a loja",
  "Confira na loja",
  "Fale com a equipe",
  "Venha conhecer",
];

describe("copy director prompt — Precisão comercial (D3/D6)", () => {
  it("1: os 4 prompts contêm a seção '### Precisão comercial'", () => {
    for (const name of PROMPTS) {
      const prompt = readPrompt(name);
      expect(prompt, `${name} sem a seção Precisão comercial`).toContain(SECTION_HEADER);
    }
  });

  it("2: os 4 prompts tratam informações comerciais como fatos protegidos e não transformam inferências em fatos", () => {
    for (const name of PROMPTS) {
      const prompt = readPrompt(name);
      expect(prompt, `${name} sem 'fatos protegidos'`).toContain(PROTECTED_FACTS);
      expect(prompt, `${name} sem a regra de não-inferência`).toContain(NO_INFERENCE);
    }
  });

  it("3: os 4 prompts delimitam as condições proibidas por categoria (entrega/frete/retirada/compra online e parcelamento/garantia/estoque/últimas unidades)", () => {
    for (const name of PROMPTS) {
      const prompt = readPrompt(name);
      expect(prompt, `${name} sem as condições de entrega/frete/retirada/compra online`).toContain(
        SALES_CONDITIONS
      );
      expect(prompt, `${name} sem as condições de parcelamento/garantia/estoque/últimas unidades`).toContain(
        PAYMENT_STOCK
      );
    }
  });

  it("4: os 4 prompts permitem explicitamente criatividade emocional (bloqueio é de fatos comerciais, não linguagem)", () => {
    for (const name of PROMPTS) {
      const prompt = readPrompt(name);
      expect(prompt, `${name} sem permissão explícita de criatividade`).toContain(
        CREATIVITY_ALLOWED
      );
    }
  });

  it("5: os 4 prompts oferecem os CTAs neutros de loja física quando o canal de compra não foi informado", () => {
    for (const name of PROMPTS) {
      const prompt = readPrompt(name);
      for (const cta of NEUTRAL_CTAS) {
        expect(prompt, `${name} sem o CTA neutro '${cta}'`).toContain(cta);
      }
    }
  });

  it("6 (negativo): nenhum dos 4 prompts contém 'Clique e compre' (exemplo de e-commerce removido em base/offer e ausente nos demais)", () => {
    for (const name of PROMPTS) {
      const prompt = readPrompt(name);
      expect(prompt, `${name} ainda contém o CTA antigo 'Clique e compre!'`).not.toContain(
        "Clique e compre!"
      );
      expect(prompt, `${name} ainda contém a string 'Clique e compre'`).not.toContain(
        "Clique e compre"
      );
    }
  });
});