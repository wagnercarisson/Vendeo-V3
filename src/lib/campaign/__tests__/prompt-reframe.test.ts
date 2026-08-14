import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { ILLUSTRATIVE_NOTICE_TEXT } from "@/lib/campaign/constants";

function readPrompt(name: string): string {
  return readFileSync(path.join(process.cwd(), "prompts", name), "utf-8");
}

const PROMPTS = [
  "campaign-image-director.md",
  "campaign-image-director-offer.md",
  "campaign-image-director-spotlight.md",
  "campaign-image-director-exclusive.md",
];

const BLOCO_CONDICIONAL =
  'Quando houver texto obrigatório/aviso legal informado, exiba exatamente esse texto na arte. Se o aviso for "Imagem meramente ilustrativa", posicione-o com tipografia mínima, mas visível e legível, em área lateral horizontal ou vertical, sem competir com oferta, produto e preço.';
const LINHA_MANTIDA =
  'Se o campo "Texto obrigatório na arte" estiver preenchido ({{mandatoryArtworkText}}), inclua esse texto na arte de forma visível e legível, em tipografia mínima adequada para leitura em dispositivo móvel. Não o repita na legenda.';
const LINHA_VALIDADE = "**Validade da oferta:** {{validity}}";

describe("prompt reframe D6 (testes 16-17 + checks de conteúdo)", () => {
  it("16: os 4 prompts NÃO contêm a imposição SEMPRE fixa", () => {
    for (const name of PROMPTS) {
      const prompt = readPrompt(name);
      expect(
        prompt,
        `${name} ainda contém a imposição fixa`
      ).not.toContain("SEMPRE acrescente a arte o seguinte texto");
    }
  });

  it("17: os 4 prompts contêm o bloco condicional e a linha mantida ({{mandatoryArtworkText}})", () => {
    for (const name of PROMPTS) {
      const prompt = readPrompt(name);
      expect(prompt, `${name} sem bloco condicional`).toContain(BLOCO_CONDICIONAL);
      expect(prompt, `${name} sem a linha condicional do campo`).toContain(LINHA_MANTIDA);
    }
  });

  it("check A: linha de validade intacta em director/offer e ausente em spotlight/exclusive (D5)", () => {
    expect(readPrompt("campaign-image-director.md")).toContain(LINHA_VALIDADE);
    expect(readPrompt("campaign-image-director-offer.md")).toContain(LINHA_VALIDADE);
    expect(readPrompt("campaign-image-director-spotlight.md")).not.toContain(LINHA_VALIDADE);
    expect(readPrompt("campaign-image-director-exclusive.md")).not.toContain(LINHA_VALIDADE);
  });

  it("check B: singular alinhado à constante, sem plural, nos 4 prompts (F40-02)", () => {
    expect(ILLUSTRATIVE_NOTICE_TEXT).toBe("Imagem meramente ilustrativa");
    for (const name of PROMPTS) {
      const prompt = readPrompt(name);
      expect(prompt, `${name} contém plural`).not.toContain("Imagens meramente ilustrativas");
      expect(prompt, `${name} sem o singular canônico`).toContain("Imagem meramente ilustrativa");
    }
  });
});
