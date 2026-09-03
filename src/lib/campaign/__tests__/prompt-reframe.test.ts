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

// Arquivos reescritos na estrutura editorial + blocos (45-03): base e offer.
const REWRITTEN = [
  "campaign-image-director.md",
  "campaign-image-director-offer.md",
];

// Arquivos NÃO reescritos (escopo do 45-04): mantêm as âncoras atuais.
const LEGACY_INTENTS = [
  "campaign-image-director-spotlight.md",
  "campaign-image-director-exclusive.md",
];

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

// Âncoras atuais — válidas apenas para spotlight/exclusive (não reescritos).
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

  it("17-base/offer: estrutura editorial fixa + os 8 slots de bloco, sem micro-tabela/Notas Adicionais/cauda incondicional (45-03)", () => {
    for (const name of REWRITTEN) {
      const prompt = readPrompt(name);
      // Âncoras editoriais fixas preservadas (anti-invenção, hierarquia, flat/publicável).
      expect(prompt, `${name} sem instrução anti-invenção`).toContain("NÃO inventar preços, descontos");
      expect(prompt, `${name} sem hierarquia visual clara`).toContain("Manter hierarquia visual clara");
      expect(prompt, `${name} sem regra de arte publicável`).toContain("publicável como arte final de campanha");
      expect(prompt, `${name} sem persona do diretor`).toContain("Diretor de Marketing da {{storeName}}");
      // Slots de bloco nomeados (um por linha).
      for (const slot of BLOCK_SLOTS) {
        expect(prompt, `${name} sem o slot {{${slot}}}`).toContain(`{{${slot}}}`);
      }
      // Ausência da micro-tabela sempre-presente e das Notas Adicionais cruas.
      expect(prompt, `${name} ainda tem a micro-tabela`).not.toContain("| **Loja** |");
      expect(prompt, `${name} ainda tem a linha de tabela do aviso`).not.toContain(LINHA_TABELA_AVISO);
      expect(prompt, `${name} ainda tem Notas Adicionais`).not.toContain("## Notas Adicionais");
      // Cauda incondicional antiga movida para dentro dos blocos montados.
      expect(prompt, `${name} com a cauda antiga do aviso`).not.toContain(LINHA_AVISO_SEPARADO);
      expect(prompt, `${name} com a cauda antiga do texto obrigatório`).not.toContain(LINHA_MANTIDA);
      expect(prompt, `${name} com {{validity}} solto`).not.toContain(LINHA_VALIDADE);
    }
  });

  it("17-spotlight/exclusive: âncoras atuais mantidas (arquivos não reescritos até o 45-04)", () => {
    for (const name of LEGACY_INTENTS) {
      const prompt = readPrompt(name);
      expect(prompt, `${name} sem a instrução de aviso separado`).toContain(LINHA_AVISO_SEPARADO);
      expect(prompt, `${name} sem a linha condicional do campo`).toContain(LINHA_MANTIDA);
      expect(prompt, `${name} sem a linha de tabela do aviso`).toContain(LINHA_TABELA_AVISO);
    }
  });

  it("check A: validade vive no slot campaignFactsSection de base/offer; {{validity}} solto ausente nos 4 (45-03)", () => {
    for (const name of REWRITTEN) {
      const prompt = readPrompt(name);
      expect(prompt, `${name} sem o slot de fatos`).toContain("{{campaignFactsSection}}");
      expect(prompt, `${name} com {{validity}} solto`).not.toContain(LINHA_VALIDADE);
    }
    for (const name of LEGACY_INTENTS) {
      expect(readPrompt(name), `${name} com linha de validade`).not.toContain(LINHA_VALIDADE);
    }
  });

  it("check B: singular alinhado à constante (fonte única via variável), sem plural, sem literal canônico duplicado", () => {
    expect(ILLUSTRATIVE_NOTICE_TEXT).toBe("Imagem meramente ilustrativa");
    for (const name of PROMPTS) {
      const prompt = readPrompt(name);
      expect(prompt, `${name} contém plural`).not.toContain("Imagens meramente ilustrativas");
      expect(prompt, `${name} duplica o literal canônico`).not.toContain("Imagem meramente ilustrativa");
    }
    // spot/exclusive interpolam o aviso pela chave legada; base/offer via slot de bloco.
    for (const name of LEGACY_INTENTS) {
      expect(readPrompt(name), `${name} sem o placeholder ilustrativo`).toContain("{{illustrativeNotice}}");
    }
    for (const name of REWRITTEN) {
      expect(readPrompt(name), `${name} sem o slot de aviso`).toContain("{{illustrativeNoticeSection}}");
    }
  });

  it("21 (F41-21): hierarquia 1+N — spot/exclusive mantêm o bloco descritivo; base/offer delegam ao productReferenceSection (45-03)", () => {
    for (const name of LEGACY_INTENTS) {
      const prompt = readPrompt(name);
      expect(prompt, `${name} sem bloco 1+N`).toContain("Quando houver mais de uma imagem de produto");
      expect(prompt, `${name} sem instrução de apoio comercial real`).toContain(
        "apoio comercial real da composição"
      );
      expect(prompt, `${name} sem proibição de reduzir a ícones/texto`).toContain(
        "Não reduza as imagens adicionais a cores, ícones, etiquetas ou texto"
      );
    }
    for (const name of REWRITTEN) {
      const prompt = readPrompt(name);
      expect(prompt, `${name} sem o slot de produto/referências`).toContain("{{productReferenceSection}}");
      expect(prompt, `${name} ainda com o bloco 1+N inline`).not.toContain("Quando houver mais de uma imagem de produto");
    }
    for (const name of PROMPTS) {
      expect(readPrompt(name), `${name} com linha antiga`).not.toContain("referência visual fiel");
    }
  });
});
