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

// Conjunto FINAL de placeholders consumido pelos 4 templates (45-04 D5): os 8
// slots de bloco contextual + prosa garantida (storeName/productName/brandColor).
const ALLOWED_PLACEHOLDERS = new Set([
  "campaignFactsSection",
  "commercialDetailsSection",
  "requiredArtworkTextSection",
  "illustrativeNoticeSection",
  "identityReferenceSection",
  "productReferenceSection",
  "constraintsSection",
  "creativeDirectionSection",
  "storeName",
  "productName",
  "brandColor",
]);

const BLOCK_SLOTS = [
  "campaignFactsSection",
  "commercialDetailsSection",
  "requiredArtworkTextSection",
  "illustrativeNoticeSection",
  "identityReferenceSection",
  "productReferenceSection",
  "constraintsSection",
  "creativeDirectionSection",
];

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

  it("17: os 4 prompts na estrutura editorial fixa + os 8 slots de bloco, sem micro-tabela/Notas Adicionais/cauda incondicional (45-03/45-04)", () => {
    for (const name of PROMPTS) {
      const prompt = readPrompt(name);
      // Âncoras editoriais fixas preservadas (anti-invenção, hierarquia, flat/publicável).
      expect(prompt, `${name} sem instrução anti-invenção`).toContain("NÃO inventar");
      expect(prompt, `${name} sem hierarquia visual clara`).toContain("Manter hierarquia visual clara");
      expect(prompt, `${name} sem regra de arte publicável`).toContain("publicável como arte final de campanha");
      expect(prompt, `${name} sem persona do diretor`).toContain("Diretor de Marketing da {{storeName}}");
      // Slots de bloco nomeados (um por linha).
      for (const slot of BLOCK_SLOTS) {
        expect(prompt, `${name} sem o slot {{${slot}}}`).toContain(`{{${slot}}}`);
      }
      // Ausência da micro-tabela sempre-presente e das Notas Adicionais cruas.
      expect(prompt, `${name} ainda tem a micro-tabela`).not.toContain("| **Loja** |");
      expect(prompt, `${name} ainda tem a linha de tabela do aviso`).not.toContain("| **Aviso ilustrativo** |");
      expect(prompt, `${name} ainda tem Notas Adicionais`).not.toContain("## Notas Adicionais");
      // Cauda incondicional antiga movida para dentro dos blocos montados.
      expect(prompt, `${name} com a cauda antiga do aviso`).not.toContain(
        'exiba "{{illustrativeNotice}}" em texto mínimo'
      );
      expect(prompt, `${name} com a cauda antiga do texto obrigatório`).not.toContain("{{mandatoryArtworkText}}");
      expect(prompt, `${name} com {{validity}} solto`).not.toContain("{{validity}}");
      // Nenhuma chave legada da transição (45-03) sobrevive nos templates (D5).
      expect(prompt, `${name} com chave legada {{discountedPrice}}`).not.toContain("{{discountedPrice}}");
      expect(prompt, `${name} com chave legada {{commercialRepertoire}}`).not.toContain("{{commercialRepertoire}}");
    }
  });

  it("check A: validade não vive no .md (nem linha solta nem chave); slot de fatos presente nos 4 (45-04)", () => {
    for (const name of PROMPTS) {
      const prompt = readPrompt(name);
      expect(prompt, `${name} sem o slot de fatos`).toContain("{{campaignFactsSection}}");
      expect(prompt, `${name} com {{validity}} solto`).not.toContain("{{validity}}");
      expect(prompt, `${name} com linha literal de validade`).not.toContain("**Validade da oferta:**");
    }
  });

  it("check B: singular alinhado à constante (fonte única via variável), sem plural, sem literal canônico duplicado", () => {
    expect(ILLUSTRATIVE_NOTICE_TEXT).toBe("Imagem meramente ilustrativa");
    for (const name of PROMPTS) {
      const prompt = readPrompt(name);
      expect(prompt, `${name} contém plural`).not.toContain("Imagens meramente ilustrativas");
      expect(prompt, `${name} duplica o literal canônico`).not.toContain("Imagem meramente ilustrativa");
      expect(prompt, `${name} sem o slot de aviso`).toContain("{{illustrativeNoticeSection}}");
    }
  });

  it("check C: todo placeholder dos 4 .md está no conjunto FINAL (8 slots + prosa garantida — D5)", () => {
    for (const name of PROMPTS) {
      const prompt = readPrompt(name);
      const found = [...prompt.matchAll(/\{\{([a-zA-Z]+)\}\}/g)].map((m) => m[1]);
      expect(new Set(found), `${name} com placeholders fora do conjunto final`).toEqual(ALLOWED_PLACEHOLDERS);
    }
  });

  it("check D: DNA do diretor por intent preservado — spotlight sem urgência/DE/POR; exclusive sem preço e badge não promocional", () => {
    const spotlight = readPrompt("campaign-image-director-spotlight.md");
    expect(spotlight, "spotlight sem tom de destaque sem urgência").toContain("sem urgência");
    expect(spotlight, "spotlight sem proibição de urgência/escassez").toContain("NÃO criar senso de urgência ou escassez");
    expect(spotlight, "spotlight sem proibição de DE/POR").toContain("NÃO usar formato DE/POR");
    expect(spotlight, "spotlight com validade").not.toMatch(/[Vv]alidade/);
    expect(spotlight, "spotlight com preço em formato DE/POR").not.toContain("Preço com desconto");

    const exclusive = readPrompt("campaign-image-director-exclusive.md");
    expect(exclusive, "exclusive sem sem divulgação de preço").toContain("sem divulgação de preço");
    expect(exclusive, "exclusive sem proibição de preço").toContain("NÃO exibir preço");
    expect(exclusive, "exclusive sem badge não promocional").toContain("NÃO usar badges promocionais");
    expect(exclusive, "exclusive com DE/POR").not.toContain("DE/POR");
    expect(exclusive, "exclusive com preço com desconto").not.toContain("Preço com desconto");
  });

  it("21 (F41-21): hierarquia 1+N delegada ao productReferenceSection nos 4 prompts (45-04)", () => {
    for (const name of PROMPTS) {
      const prompt = readPrompt(name);
      expect(prompt, `${name} sem o slot de produto/referências`).toContain("{{productReferenceSection}}");
      expect(prompt, `${name} ainda com o bloco 1+N inline`).not.toContain("Quando houver mais de uma imagem de produto");
      expect(prompt, `${name} com linha antiga`).not.toContain("referência visual fiel");
    }
  });
});
