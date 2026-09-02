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

const LINHA_AVISO_SEPARADO =
  'Quando houver aviso ilustrativo, exiba "{{illustrativeNotice}}" em texto mínimo, legível e discreto, separado dos demais textos, preferencialmente nas laterais da arte.';
const LINHA_MANTIDA =
  'Se o campo "Texto obrigatório na arte" estiver preenchido ({{mandatoryArtworkText}}), inclua esse texto na arte de forma visível e legível, em tipografia mínima adequada para leitura em dispositivo móvel. Não o repita na legenda.';
const LINHA_TABELA_AVISO = "| **Aviso ilustrativo** | {{illustrativeNotice}} |";
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

  it("17: os 4 prompts contêm a instrução de aviso separado, a linha mantida ({{mandatoryArtworkText}}) e a linha de tabela do aviso ({{illustrativeNotice}})", () => {
    for (const name of PROMPTS) {
      const prompt = readPrompt(name);
      expect(prompt, `${name} sem a instrução de aviso separado`).toContain(LINHA_AVISO_SEPARADO);
      expect(prompt, `${name} sem a linha condicional do campo`).toContain(LINHA_MANTIDA);
      expect(prompt, `${name} sem a linha de tabela do aviso`).toContain(LINHA_TABELA_AVISO);
    }
  });

  it("check A: linha de validade intacta em director/offer e ausente em spotlight/exclusive (D5)", () => {
    expect(readPrompt("campaign-image-director.md")).toContain(LINHA_VALIDADE);
    expect(readPrompt("campaign-image-director-offer.md")).toContain(LINHA_VALIDADE);
    expect(readPrompt("campaign-image-director-spotlight.md")).not.toContain(LINHA_VALIDADE);
    expect(readPrompt("campaign-image-director-exclusive.md")).not.toContain(LINHA_VALIDADE);
  });

  it("check B: singular alinhado à constante (fonte única via variável), sem plural, nos 4 prompts (F40-02/quick 260902-kqo)", () => {
    expect(ILLUSTRATIVE_NOTICE_TEXT).toBe("Imagem meramente ilustrativa");
    for (const name of PROMPTS) {
      const prompt = readPrompt(name);
      expect(prompt, `${name} contém plural`).not.toContain("Imagens meramente ilustrativas");
      expect(prompt, `${name} duplica o literal canônico`).not.toContain("Imagem meramente ilustrativa");
      expect(prompt, `${name} sem o placeholder ilustrativo`).toContain("{{illustrativeNotice}}");
    }
  });

  it("21 (F41-21): bloco descritivo 1+N presente nos 4 prompts (D6)", () => {
    for (const name of PROMPTS) {
      const prompt = readPrompt(name);
      expect(prompt, `${name} sem bloco 1+N`).toContain("Quando houver mais de uma imagem de produto");
      expect(prompt, `${name} sem instrução de apoio comercial real`).toContain(
        "apoio comercial real da composição"
      );
      expect(prompt, `${name} sem proibição de reduzir a ícones/texto`).toContain(
        "Não reduza as imagens adicionais a cores, ícones, etiquetas ou texto"
      );
      expect(prompt, `${name} com linha antiga`).not.toContain("referência visual fiel");
    }
  });
});
