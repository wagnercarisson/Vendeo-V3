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

  it("45-05 transversal (a): prosa editorial além dos placeholders + slots como linha inteira nos 4 .md (sem template seco)", () => {
    for (const name of PROMPTS) {
      const prompt = readPrompt(name);
      const lines = prompt.split("\n");
      const nonPlaceholderLines = lines.filter((line) => !line.includes("{{")).length;
      const placeholderLines = lines.filter((line) => line.includes("{{")).length;
      expect(nonPlaceholderLines, `${name}: template seco de micro-placeholders`).toBeGreaterThanOrEqual(40);
      expect(placeholderLines, `${name}: sem prosa além dos slots`).toBeLessThan(nonPlaceholderLines / 2);
      for (const slot of BLOCK_SLOTS) {
        expect(prompt, `${name}: slot {{${slot}}} não está como linha inteira`).toMatch(
          new RegExp(`^\\{\\{${slot}\\}\\}$`, "m")
        );
      }
    }
  });

  it("45-05 transversal (b): 8 slots idênticos por arquivo e naturezas condicionais apenas como slot (sem tabela/heading literal)", () => {
    for (const name of PROMPTS) {
      const prompt = readPrompt(name);
      for (const slot of BLOCK_SLOTS) {
        expect(prompt, `${name}: sem o slot {{${slot}}}`).toContain(`{{${slot}}}`);
      }
      expect(prompt, `${name}: heading literal do aviso no template`).not.toContain("## Aviso Ilustrativo");
      expect(prompt, `${name}: heading literal do texto obrigatório no template`).not.toContain("## Texto Obrigatório na Arte");
      expect(prompt, `${name}: linha de tabela do aviso`).not.toMatch(/\| \*\*Aviso ilustrativo/);
      expect(prompt, `${name}: linha de tabela da validade`).not.toMatch(/\| \*\*Validade\*\*/);
    }
  });

  it("45-05 transversal (c): seções editoriais fixas com heading próprio + DNA por intent (base/offer promocional; spotlight sem validade; exclusive sem preço)", () => {
    for (const name of PROMPTS) {
      const prompt = readPrompt(name);
      expect(prompt, `${name}: sem persona do diretor`).toContain("Diretor de Marketing da {{storeName}}");
      expect(prompt, `${name}: sem heading fixo de fatos`).toContain("## Fatos da Campanha");
      expect(prompt, `${name}: sem heading fixo de produto/referências`).toContain("## Produto e Imagens de Referência");
      expect(prompt, `${name}: sem heading fixo de identidade`).toContain("## Identidade da Loja");
      expect(prompt, `${name}: sem heading fixo de direção criativa`).toContain("## Direção Criativa Contextual");
    }

    for (const name of ["campaign-image-director.md", "campaign-image-director-offer.md"]) {
      const prompt = readPrompt(name);
      expect(prompt, `${name}: base/offer sem framing promocional`).toContain("preço com desconto informado nos fatos");
      expect(prompt, `${name}: base/offer sem validade`).not.toMatch(/[Vv]alidade/);
    }

    const spotlight = readPrompt("campaign-image-director-spotlight.md");
    expect(spotlight, "spotlight com validade").not.toMatch(/[Vv]alidade/);
    expect(spotlight, "spotlight sem preço de desconto").not.toContain("preço com desconto");

    const exclusive = readPrompt("campaign-image-director-exclusive.md");
    expect(exclusive, "exclusive sem preço com desconto").not.toContain("Preço com desconto");
    expect(exclusive, "exclusive sem preço de desconto").not.toContain("preço com desconto");
    expect(exclusive, "exclusive sem DE/POR").not.toContain("DE/POR");
  });

  it("F45-06 (revisão humana): ajustes spotlight — badge informado obrigatório, CTA sem repetir badge, linha de identidade simples no .md", () => {
    const spotlight = readPrompt("campaign-image-director-spotlight.md");
    // (1) Badge informado nos fatos → DEVE ser incorporado (não mais opcional).
    expect(spotlight, "spotlight sem badge obrigatório quando informado").toContain(
      "Quando houver badge informado nos fatos, incorporá-lo à arte"
    );
    // Sem badge informado, apoio discreto é opcional e não inventa promessa comercial.
    expect(spotlight, "spotlight sem a regra do apoio opcional sem promessa").toContain(
      "Sem badge informado, um apoio visual discreto é opcional"
    );
    // (2) Linha de composição de identidade simplificada (sem repetir a seção).
    expect(spotlight, "spotlight sem linha de identidade simples").toContain(
      "A campanha deve ser assinada pela loja — ver a seção \"Identidade da Loja\""
    );
    // (5) CTA não repete literalmente o badge.
    expect(spotlight, "spotlight sem regra de CTA × badge").toContain(
      "O CTA não deve repetir literalmente o texto do badge"
    );
  });

  it("F45-06b (revisão humana): ajustes exclusive/offer/base — badge obrigatório, CTA complementa, identidade simples, sem flag técnico/flores no exclusive, sem flat-design rígido, numeração contínua", () => {
    const exclusive = readPrompt("campaign-image-director-exclusive.md");
    // (1) Exclusividade sem inventar fatos: "edição limitada" só se explícito.
    expect(exclusive, "exclusive sem persona de valor percebido premium").toContain("valor percebido premium");
    expect(exclusive, "exclusive sem guarda de edição limitada/explícito").toContain(
      "somente quando estiverem explícitas no briefing"
    );
    // (2) Badge informado → obrigatório; sem badge → sem selo/promessa inventada.
    expect(exclusive, "exclusive sem badge obrigatório").toContain(
      "Quando houver badge informado nos fatos, incorporá-lo à arte"
    );
    expect(exclusive, "exclusive sem proibição de selo/promessa sem badge").toContain(
      "Sem badge informado, não inventar selo nem promessa promocional"
    );
    expect(exclusive, "exclusive sem badge promocional banido").toContain("NÃO usar badges promocionais");
    // (3) CTA complementa e não repete badge.
    expect(exclusive, "exclusive sem CTA × badge").toContain(
      "O CTA não deve repetir literalmente o texto do badge"
    );
    // (4) Linha de identidade simples (fidelidade/preservação concentradas na seção/bloco).
    expect(exclusive, "exclusive sem linha de identidade simples").toContain(
      "A campanha deve ser assinada pela loja — ver a seção \"Identidade da Loja\""
    );
    // (5) Sem o flag técnico preserveImageContext=true no .md e sem full-bleed fixo.
    expect(exclusive, "exclusive ainda menciona preserveImageContext=true").not.toContain("preserveImageContext=true");
    // (6) Sem especialização dura de segmento/categoria no prompt fixo.
    expect(exclusive, "exclusive ainda tem segmento outros").not.toContain('segmento for "outros"');
    expect(exclusive, "exclusive ainda tem flores-arranjos").not.toContain("flores-arranjos");
    // (7) Flat-design rígido removido → composição limpa/profissional com luz/sombra natural.
    expect(exclusive, "exclusive ainda proíbe sombras complexas").not.toContain("sombras complexas");
    expect(exclusive, "exclusive sem composição premium").toContain(
      "Composição limpa e profissional, sem efeitos gráficos artificiais ou gradientes agressivos — luz natural, profundidade e sombras do produto são permitidas"
    );
    // (8) Numeração contínua 1..6 (sem repetição/omissão).
    for (const n of [1, 2, 3, 4, 5, 6]) {
      expect(exclusive, `exclusive sem item ${n} na composição`).toMatch(
        new RegExp(`^${n}\\. \\*\\*`, "m")
      );
    }
    expect(exclusive, "exclusive com número repetido na composição").not.toMatch(/^5\. \*\*Badge/m);

    // Offer/base: identidade simples, badge obrigatório, CTA × badge, composição premium.
    for (const name of ["campaign-image-director.md", "campaign-image-director-offer.md"]) {
      const prompt = readPrompt(name);
      expect(prompt, `${name}: sem linha de identidade simples`).toContain(
        "A campanha deve ser assinada pela loja — ver a seção \"Identidade da Loja\""
      );
      expect(prompt, `${name}: badge promocional ainda opcional`).not.toContain(
        "ele pode ser integrado se presente"
      );
      expect(prompt, `${name}: sem badge obrigatório`).toContain(
        "Quando houver badge promocional informado nos fatos, incorporá-lo à arte"
      );
      expect(prompt, `${name}: sem CTA × badge`).toContain(
        "O CTA não deve repetir literalmente o texto do badge"
      );
      expect(prompt, `${name}: ainda com flat-design rígido`).not.toContain("sombras complexas");
      expect(prompt, `${name}: sem composição premium`).toContain(
        "Composição limpa e profissional, sem efeitos gráficos artificiais ou gradientes agressivos"
      );
    }
  });
});
