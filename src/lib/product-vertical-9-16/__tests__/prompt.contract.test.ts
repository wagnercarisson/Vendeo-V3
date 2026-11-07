// @vitest-environment node
import { describe, expect, it } from "vitest";

import baselineJson from "@/lib/product-1-1/__tests__/fixtures/prompt-composition.baseline.json";
import {
  COMPOSER_VERSION,
  PROMPT_BLOCK_LABELS,
  PROMPT_BLOCK_ORDER,
  composeProductPrompt,
} from "@/lib/product-1-1/prompt-composition";
import {
  PRODUCT_1_1_PROMPT_POLICY_REGISTRY,
  resolveProductOneToOnePromptPolicies,
} from "@/lib/product-1-1/policies/registry";
import type {
  ProductPromptCompositionBriefing,
  ProductPromptPolicyResolutionInput,
  ResolvedProductPromptPolicies,
} from "@/lib/product-1-1/policies/types";
import { formato11Policy } from "@/lib/product-1-1/policies/formato-1-1";
import {
  SAFE_AREA_9_16_TOP_BOTTOM_VERSION,
  instagramTopBottomBandsForCanvas,
} from "../safe-area-experimental";
import {
  VERTICAL_PROMPT_BLOCK_LABELS,
  composeVerticalProductPrompt,
} from "../prompt/composition";
import {
  FORMATO_9_16_POLICY_VERSION,
  VERTICAL_COMPOSER_VERSION,
  resolveVerticalPromptPolicyVersions,
} from "../prompt/registry";

interface FrozenCase {
  readonly briefing: ProductPromptCompositionBriefing;
  readonly expected: {
    readonly text: string;
    readonly blocks: Readonly<Record<string, string>>;
    readonly policyVersions: Readonly<Record<string, string>>;
  };
}

interface FrozenBaseline {
  readonly promptBase: string;
  readonly references: readonly string[];
  readonly cases: readonly FrozenCase[];
}

const baseline = baselineJson as unknown as FrozenBaseline;
const fixture = baseline.cases[0];

function defaultInput() {
  return {
    briefing: fixture.briefing,
    promptBase: baseline.promptBase,
    references: baseline.references,
  };
}

const PALETTE_CONTRIBUTION = {
  block: PROMPT_BLOCK_LABELS.identity,
  lines: [
    'Regra legada\nPaleta da loja "Loja": cor principal #000000; cor de apoio #FFFFFF.',
  ],
} as const;

const NO_PALETTE_CONTRIBUTION = {
  block: PROMPT_BLOCK_LABELS.identity,
  lines: ["Regra legada sem paleta."],
} as const;

describe("F59 — seam aditivo do compositor (default 1:1 byte-idêntico)", () => {
  it("sem opções é deep-equal a opções vazias e ao baseline 1:1", () => {
    const withoutOptions = composeProductPrompt(defaultInput());
    const withEmptyOptions = composeProductPrompt(defaultInput(), {});

    expect(withEmptyOptions).toEqual(withoutOptions);
    expect(withEmptyOptions.text).toBe(withoutOptions.text);
    expect(withoutOptions.text).toBe(fixture.expected.text);
    expect(withoutOptions.blocks).toEqual(fixture.expected.blocks);
    expect(withoutOptions.policyVersions).toEqual(
      fixture.expected.policyVersions,
    );
  });

  it("mantém COMPOSER_VERSION e o tipo alargado aceita versão própria", () => {
    const standard = composeProductPrompt(defaultInput());
    expect(standard.composerVersion).toBe(COMPOSER_VERSION);
    expect(COMPOSER_VERSION).toBe("48.2.4-prompt-composer-v7");

    const custom = composeProductPrompt(defaultInput(), {
      composerVersion: "f59-vertical-9-16-composer-v14",
    });
    expect(custom.composerVersion).toBe("f59-vertical-9-16-composer-v14");
    expect(custom.text).toBe(standard.text);
  });

  it("preserva os 7 rótulos e a ordem dos blocos", () => {
    expect(Object.keys(PROMPT_BLOCK_LABELS)).toHaveLength(7);
    const composition = composeProductPrompt(defaultInput());
    const present = PROMPT_BLOCK_ORDER.filter(
      (label) => composition.blocks[label] !== undefined,
    );
    expect(Object.keys(composition.blocks)).toEqual(present);
  });

  it("usa o resolver injetado e espelha suas versões sem mutar o default", () => {
    const input = defaultInput();
    const resolver = (
      resolutionInput: ProductPromptPolicyResolutionInput,
    ): ResolvedProductPromptPolicies => {
      const base = resolveProductOneToOnePromptPolicies(resolutionInput);
      return {
        contributions: [
          ...base.contributions,
          {
            block: PROMPT_BLOCK_LABELS.intent,
            lines: ["EXTRA DO RESOLVEDOR"],
          },
        ],
        versions: { ...base.versions, custom: "custom-v1" },
      };
    };

    const standard = composeProductPrompt(input);
    const custom = composeProductPrompt(input, {
      resolver,
      composerVersion: "custom-composer",
    });

    expect(custom.blocks[PROMPT_BLOCK_LABELS.intent]).toBe(
      `${standard.blocks[PROMPT_BLOCK_LABELS.intent]}\nEXTRA DO RESOLVEDOR`,
    );
    for (const label of PROMPT_BLOCK_ORDER) {
      if (label === PROMPT_BLOCK_LABELS.intent) continue;
      expect(custom.blocks[label]).toBe(standard.blocks[label]);
    }
    expect(custom.policyVersions.custom).toBe("custom-v1");

    const after = composeProductPrompt(input);
    expect(after).toEqual(standard);
  });
});

describe("F59 — compositor editorial vertical 9:16", () => {
  it("registra as 9 versões sem mutar o registry 1:1", () => {
    const registryBefore = PRODUCT_1_1_PROMPT_POLICY_REGISTRY;
    const formatoBefore = PRODUCT_1_1_PROMPT_POLICY_REGISTRY.formato;
    const versions = resolveVerticalPromptPolicyVersions({
      briefing: fixture.briefing,
      references: baseline.references,
    });

    expect(PRODUCT_1_1_PROMPT_POLICY_REGISTRY).toBe(registryBefore);
    expect(PRODUCT_1_1_PROMPT_POLICY_REGISTRY.formato).toBe(formatoBefore);
    expect(versions).toEqual({
      intencao: "48.2.6-oferta-v2",
      formato: "f59-9-16-v12",
      tipoConteudo: "48.2.6-produto-v4",
      estrutura: "48.2.4-peca-unica-v1",
      tema: "48.2.4-tema-nenhum-v1",
      geral: "48.2.5-general-integrity-v1",
      fundo: "48.2.6-background-direction-v2",
      identidade: "48.2.6-identity-context-v1",
      safeArea: SAFE_AREA_9_16_TOP_BOTTOM_VERSION,
    });
    expect(Object.keys(versions)).toHaveLength(9);
    expect(versions.formato).toBe(FORMATO_9_16_POLICY_VERSION);
    expect(versions.formato).not.toBe(formato11Policy.version);
    expect(PRODUCT_1_1_PROMPT_POLICY_REGISTRY.formato?.["9:16"]).toBeUndefined();
  });

  it("compõe a estrutura editorial na ordem e com versão própria", () => {
    const composition = composeVerticalProductPrompt(defaultInput());

    expect(VERTICAL_COMPOSER_VERSION).toBe("f59-vertical-9-16-composer-v14");
    expect(composition.composerVersion).toBe(VERTICAL_COMPOSER_VERSION);
    expect(composition.promptBaseVersion).toBe("48.2.6-produto-1-1-v1");
    expect(composition.text.startsWith("Crie uma campanha de oferta")).toBe(
      true,
    );

    const labels = Object.keys(VERTICAL_PROMPT_BLOCK_LABELS);
    expect(labels).toEqual([
      "objective",
      "references",
      "data",
      "composition",
      "compositionPolicy",
    ]);
    const order = [
      "[REFERÊNCIAS]",
      "[DADOS DA CAMPANHA]",
      "[COMPOSIÇÃO]",
      "[COMPOSIÇÃO PARA INSTAGRAM]",
    ];
    let cursor = -1;
    for (const header of order) {
      const next = composition.text.indexOf(header);
      expect(next).toBeGreaterThan(cursor);
      cursor = next;
    }

    expect(Object.keys(composition.blocks)).toEqual([
      "OBJETIVO",
      "REFERÊNCIAS",
      "DADOS DA CAMPANHA",
      "COMPOSIÇÃO",
      "COMPOSIÇÃO PARA INSTAGRAM",
    ]);
    expect(composition.text).not.toContain("[IDENTIDADE E DIREÇÃO VISUAL]");
    expect(composition.text).not.toContain("[PRODUTO E IMAGENS DE REFERÊNCIA]");
    expect(composition.text).not.toContain("[INSTRUÇÕES DO PROMPT-BASE]");
  });

  it("emite o bloco único com as faixas de 5% superiores e 20% inferiores", () => {
    const composition = composeVerticalProductPrompt(defaultInput());
    const block = [
      "Os 5% superiores e os 20% inferiores são exclusivos para fundo. É PROIBIDO colocar qualquer texto nessa faixa, inclusive textos obrigatórios, avisos legais e validade da oferta. Preço, selo, CTA e ativo da loja também devem permanecer fora dessas áreas. Textos obrigatórios não devem funcionar como rodapé da imagem.",
      "",
      "Posicione o produto preferencialmente na parte inferior da composição. Produto, embalagem e complementos podem avançar nessas faixas, desde que permaneçam reconhecíveis e que nenhuma informação necessária para identificá-los fique comprometida.",
      "",
      "Evite concentrar informações importantes junto à borda inferior direita, onde podem aparecer controles da plataforma, sem reservar um espaço vazio específico para eles.",
      "",
      "Utilize todo o quadro para construir uma composição contínua e equilibrada. As margens protegem informações; não são faixas que devem ficar vazias.",
    ].join("\n");

    expect(composition.blocks["COMPOSIÇÃO PARA INSTAGRAM"]).toBe(block);
    expect(composition.text.split(block)).toHaveLength(2);
    expect(
      composition.text.match(/Os 5% superiores e os 20% inferiores são exclusivos/g),
    ).toHaveLength(1);
    expect(
      composition.text.match(/É PROIBIDO colocar qualquer texto nessa faixa/g),
    ).toHaveLength(1);
    expect(
      composition.text.match(
        /Preço, selo, CTA e ativo da loja também devem permanecer fora dessas áreas\./g,
      ),
    ).toHaveLength(1);
    expect(
      composition.text.match(
        /Textos obrigatórios não devem funcionar como rodapé da imagem\./g,
      ),
    ).toHaveLength(1);
    expect(block.match(/5%/g)).toHaveLength(1);
    expect(block.match(/20%/g)).toHaveLength(1);
    expect(block).not.toContain("15%");
    expect(block).not.toContain("Os 20% inferiores da imagem");
    expect(block).not.toContain(
      "É PROIBIDO colocar nessa faixa qualquer texto",
    );
    for (const oldToken of ["14%", "35%", "6%", "30%", "40%"]) {
      expect(block).not.toContain(oldToken);
    }
    expect(block).not.toMatch(/px|1152×2048|1080×1920|x=|y=|0,9375/);
    expect(composition.text).not.toContain("Canvas:");
    expect(composition.text).not.toContain("ÁREAS RESERVADAS");
    expect(composition.text).not.toContain("ÁREA DE COMPOSIÇÃO");
    expect(composition.text).not.toContain("canto inferior direito reservado");
    expect(composition.text).not.toContain("Saída: arte estática");
    expect(composition.text).not.toMatch(/homologa/i);
  });

  it("mantém os demais blocos byte-idênticos para a mesma entrada", () => {
    const briefing = {
      backgroundDirection: "studio",
      product: { name: "Bolo Naked Fruit", description: "Massa de pão de ló" },
      commercial: {
        intent: "offer",
        originalPriceText: null,
        discountedPriceText: "R$ 69,90",
        badge: "Imperdível",
        validity: "enquanto durarem os estoques",
      },
      constraints: {
        mandatoryArtworkText:
          "Imagem meramente ilustrativa\nRecheio e cobertura de frutas",
      },
      identity: {
        storeName: "Padaria da Esquina",
        palettePrimary: "#3B2418",
        paletteAccent: "#D59D5E",
      },
    } as const;
    const composition = composeVerticalProductPrompt({
      briefing: briefing as never,
      promptBase: baseline.promptBase,
      references: [
        "9110f31a5528ead0201e1ef35e6f1431e6a4a7437f5067ff2253df62eec7a304",
      ],
      contributions: [
        {
          block: PROMPT_BLOCK_LABELS.identity,
          lines: [
            'Assinar a campanha com a assinatura visual da loja fornecida como imagem de referência. Manter fidelidade ao arquivo fornecido. Não adicionar logotipo.\nPaleta da loja "Padaria da Esquina": cor principal #3B2418; cor de apoio #D59D5E.',
          ],
        },
      ],
      attachments: [{ kind: "product" }, { kind: "identity" }],
    });

    expect(composition.blocks["OBJETIVO"]).toBe(
      "Crie uma campanha de oferta, em peça única.",
    );
    expect(composition.blocks["REFERÊNCIAS"]).toBe(
      [
        "Imagem 1: produto anunciado. Preserve sua aparência e use-o como protagonista.",
        "Imagem 2: ativo da loja. Preserve sua identidade, adaptando sua aplicação à composição e ao contraste, sem descaracterizá-lo.",
      ].join("\n"),
    );
    expect(composition.blocks["DADOS DA CAMPANHA"]).toBe(
      [
        'Loja: "Padaria da Esquina"',
        'Produto: "Bolo Naked Fruit"',
        'Descrição: "Massa de pão de ló"',
        'Preço: "R$ 69,90"',
        'Selo: "Imperdível"',
        'Validade: "enquanto durarem os estoques"',
        'Aviso obrigatório: "Imagem meramente ilustrativa\\nRecheio e cobertura de frutas"',
        "Paleta: principal #3B2418; apoio #D59D5E.",
      ].join("\n"),
    );
    expect(composition.blocks["COMPOSIÇÃO PARA INSTAGRAM"]).toBe(
      [
        "Os 5% superiores e os 20% inferiores são exclusivos para fundo. É PROIBIDO colocar qualquer texto nessa faixa, inclusive textos obrigatórios, avisos legais e validade da oferta. Preço, selo, CTA e ativo da loja também devem permanecer fora dessas áreas. Textos obrigatórios não devem funcionar como rodapé da imagem.",
        "",
        "Posicione o produto preferencialmente na parte inferior da composição. Produto, embalagem e complementos podem avançar nessas faixas, desde que permaneçam reconhecíveis e que nenhuma informação necessária para identificá-los fique comprometida.",
        "",
        "Evite concentrar informações importantes junto à borda inferior direita, onde podem aparecer controles da plataforma, sem reservar um espaço vazio específico para eles.",
        "",
        "Utilize todo o quadro para construir uma composição contínua e equilibrada. As margens protegem informações; não são faixas que devem ficar vazias.",
      ].join("\n"),
    );
  });

  it("emite a liberdade criativa uma única vez no bloco de composição", () => {
    const composition = composeVerticalProductPrompt(defaultInput());
    const line =
      "Exerça liberdade criativa na composição: explore enquadramento, iluminação, profundidade e hierarquia visual para criar uma campanha expressiva e comercialmente atraente, respeitando as informações fornecidas, o ativo da loja e as áreas protegidas.";

    expect(composition.blocks["COMPOSIÇÃO"]).toContain(line);
    expect(composition.text.split(line)).toHaveLength(2);
    expect(composition.blocks["COMPOSIÇÃO PARA INSTAGRAM"]).not.toContain(line);
  });

  it("emite a orientação do aviso somente quando a frase está presente", () => {
    const base = defaultInput();
    const noticeRule =
      "O aviso ‘Imagem meramente ilustrativa’ pode ser aplicado horizontalmente ou rotacionado em 90°, conforme favorecer a composição. Preserve a frase integral, legível, com contraste adequado e dentro da área protegida. Não empilhe as letras.";

    const withNotice = composeVerticalProductPrompt({
      ...base,
      briefing: {
        ...base.briefing,
        constraints: { mandatoryArtworkText: "Imagem meramente ilustrativa" },
      },
    });
    expect(withNotice.blocks["COMPOSIÇÃO"]).toContain(noticeRule);
    expect(withNotice.text.split(noticeRule)).toHaveLength(2);
    expect(withNotice.blocks["DADOS DA CAMPANHA"]).toContain(
      'Aviso obrigatório: "Imagem meramente ilustrativa"',
    );

    const withOtherOnly = composeVerticalProductPrompt({
      ...base,
      briefing: {
        ...base.briefing,
        constraints: { mandatoryArtworkText: "Válido para retirada na loja" },
      },
    });
    expect(withOtherOnly.text).not.toContain(noticeRule);
    expect(withOtherOnly.blocks["DADOS DA CAMPANHA"]).toContain(
      'Aviso obrigatório: "Válido para retirada na loja"',
    );

    const withNoticeAndOther = composeVerticalProductPrompt({
      ...base,
      briefing: {
        ...base.briefing,
        constraints: {
          mandatoryArtworkText:
            "Imagem meramente ilustrativa\nRecheio e cobertura de frutas",
        },
      },
    });
    expect(withNoticeAndOther.text.split(noticeRule)).toHaveLength(2);
    expect(withNoticeAndOther.blocks["DADOS DA CAMPANHA"]).toContain(
      'Aviso obrigatório: "Imagem meramente ilustrativa\\nRecheio e cobertura de frutas"',
    );
    expect(withNoticeAndOther.blocks["COMPOSIÇÃO"]).not.toContain(
      "Recheio e cobertura de frutas",
    );

    const withoutMandatory = composeVerticalProductPrompt({
      ...base,
      briefing: {
        ...base.briefing,
        constraints: { mandatoryArtworkText: null },
      },
    });
    expect(withoutMandatory.text).not.toContain(noticeRule);
    expect(withoutMandatory.blocks["DADOS DA CAMPANHA"]).not.toContain(
      "Aviso obrigatório:",
    );
  });

  it("emite a regra monetária uma vez e não reformata os preços", () => {
    const base = defaultInput();
    const rule =
      "Trate cada preço como uma única expressão monetária. Use exatamente uma vírgula entre a parte inteira e os centavos, quando houver centavos, mesmo quando tiverem tamanhos ou alinhamentos diferentes. Não repita a vírgula ao separar visualmente os centavos.";

    const cases: ReadonlyArray<{
      readonly original: string | null;
      readonly discounted: string | null;
      readonly expected: readonly string[];
    }> = [
      {
        original: null,
        discounted: "R$ 49,90",
        expected: ['Preço: "R$ 49,90"'],
      },
      {
        original: "R$ 99,90",
        discounted: "R$ 49,90",
        expected: ['Preço original: "R$ 99,90"', 'Preço: "R$ 49,90"'],
      },
      {
        original: null,
        discounted: "R$ 70",
        expected: ['Preço: "R$ 70"'],
      },
      {
        original: null,
        discounted: "R$ 1.299,90",
        expected: ['Preço: "R$ 1.299,90"'],
      },
    ];

    for (const testCase of cases) {
      const composition = composeVerticalProductPrompt({
        ...base,
        briefing: {
          ...base.briefing,
          commercial: {
            ...base.briefing.commercial,
            originalPriceText: testCase.original,
            discountedPriceText: testCase.discounted,
          },
        },
      });
      expect(composition.text.split(rule)).toHaveLength(2);
      const data = composition.blocks["DADOS DA CAMPANHA"];
      for (const line of testCase.expected) {
        expect(data).toContain(line);
      }
      expect(data).not.toContain("R$ 4990");
      expect(data).not.toContain("R$ 1299,90");
    }
  });

  it("mantém as faixas experimentais 5%/20% para geração e entrega, fora do prompt", () => {
    const generation = instagramTopBottomBandsForCanvas(1152, 2048);
    expect(generation).toEqual({
      width: 1152,
      height: 2048,
      topPx: 102,
      bottomPx: 410,
      protectedYMin: 102,
      protectedYMax: 1638,
      isGenerationCanvas: true,
    });
    expect(Object.keys(generation!)).toEqual([
      "width",
      "height",
      "topPx",
      "bottomPx",
      "protectedYMin",
      "protectedYMax",
      "isGenerationCanvas",
    ]);

    const delivery = instagramTopBottomBandsForCanvas(1080, 1920);
    expect(delivery).toEqual({
      width: 1080,
      height: 1920,
      topPx: 96,
      bottomPx: 384,
      protectedYMin: 96,
      protectedYMax: 1536,
      isGenerationCanvas: false,
    });

    const composition = composeVerticalProductPrompt(defaultInput());
    expect(composition.text).not.toMatch(/1152|2048|1080|1920|px|x=|y=/);
  });

  it("identifica anexos na ordem real e orienta o ativo uma única vez", () => {
    const composition = composeVerticalProductPrompt({
      ...defaultInput(),
      attachments: [{ kind: "product" }, { kind: "identity" }],
      contributions: [PALETTE_CONTRIBUTION],
    });

    expect(composition.text).toContain(
      "Imagem 1: produto anunciado. Preserve sua aparência e use-o como protagonista.",
    );
    expect(composition.text).toContain(
      "Imagem 2: ativo da loja. Preserve sua identidade, adaptando sua aplicação à composição e ao contraste, sem descaracterizá-lo.",
    );
    expect(
      composition.text.match(/Preserve sua identidade, adaptando sua aplicação/g),
    ).toHaveLength(1);
    expect(composition.text).not.toContain("Imagens de referência:");
    expect(composition.text).not.toContain("logo ou a assinatura");
    expect(composition.text).not.toContain("Não adicionar logotipo");
  });

  it("calcula a posição do ativo com múltiplas referências", () => {
    const composition = composeVerticalProductPrompt({
      ...defaultInput(),
      attachments: [
        { kind: "product" },
        { kind: "reference" },
        { kind: "identity" },
      ],
      contributions: [PALETTE_CONTRIBUTION],
    });

    expect(composition.text).toContain(
      "Imagem 2: referência adicional do produto. Use como apoio visual.",
    );
    expect(composition.text).toContain(
      "Imagem 3: ativo da loja. Preserve sua identidade",
    );
    expect(composition.text).not.toContain("Imagem 3: produto anunciado");
  });

  it("sem ativo não anuncia anexo nem inventa identidade", () => {
    const composition = composeVerticalProductPrompt({
      ...defaultInput(),
      attachments: [{ kind: "product" }, { kind: "reference" }],
      contributions: [PALETTE_CONTRIBUTION],
    });

    expect(composition.text).not.toContain("Imagem 2: ativo da loja");
    expect(composition.text).toContain("Não invente identidade visual.");
    expect(composition.text).toContain(
      "Preço, selo, CTA e ativo da loja também devem permanecer fora dessas áreas.",
    );
  });

  it("com paleta informa loja e paleta, sem inventar quando ausente", () => {
    const withPalette = composeVerticalProductPrompt({
      ...defaultInput(),
      attachments: [{ kind: "product" }, { kind: "identity" }],
      contributions: [PALETTE_CONTRIBUTION],
    });
    expect(withPalette.text).toContain('Loja: "Loja"');
    expect(withPalette.text).toContain(
      "Paleta: principal #000000; apoio #FFFFFF.",
    );
    expect(withPalette.text).toContain("na paleta da loja");

    const withoutPalette = composeVerticalProductPrompt({
      ...defaultInput(),
      attachments: [{ kind: "product" }, { kind: "identity" }],
      contributions: [NO_PALETTE_CONTRIBUTION],
    });
    expect(withoutPalette.text).not.toContain("Paleta:");
    expect(withoutPalette.text).not.toContain("paleta da loja");
    expect(withoutPalette.text).not.toContain("Loja:");
  });

  it("prefere a identidade estruturada quando o nome da loja tem aspas", () => {
    const base = defaultInput();
    const composition = composeVerticalProductPrompt({
      ...base,
      briefing: {
        ...base.briefing,
        identity: {
          storeName: 'Padaria "da" Esquina',
          palettePrimary: "#3B2418",
          paletteAccent: "#D59D5E",
        },
      },
      attachments: [{ kind: "product" }, { kind: "identity" }],
      // Diretiva textual deliberadamente ambígua: os dados estruturados vencem.
      contributions: [
        {
          block: PROMPT_BLOCK_LABELS.identity,
          lines: ['Paleta da loja "Padaria "da" Esquina": cor principal #000000.'],
        },
      ],
    });
    expect(composition.text).toContain('Loja: "Padaria \\"da\\" Esquina"');
    expect(composition.text).toContain(
      "Paleta: principal #3B2418; apoio #D59D5E.",
    );
    expect(composition.text).toContain("na paleta da loja");
  });

  it("fallback textual lê a paleta mesmo com aspas no nome da loja", () => {
    const base = defaultInput();
    const composition = composeVerticalProductPrompt({
      ...base,
      attachments: [{ kind: "product" }, { kind: "identity" }],
      contributions: [
        {
          block: PROMPT_BLOCK_LABELS.identity,
          lines: [
            'Paleta da loja "Padaria "da" Esquina": cor principal #3B2418; cor de apoio #D59D5E.',
          ],
        },
      ],
    });
    expect(composition.text).toContain('Loja: "Padaria \\"da\\" Esquina"');
    expect(composition.text).toContain(
      "Paleta: principal #3B2418; apoio #D59D5E.",
    );
    expect(composition.text).toContain("na paleta da loja");
  });

  it.each([
    ["offer", "Crie uma campanha de oferta", "Destaque o preço de venda; apresente o preço original como secundário."],
    ["spotlight", "Crie uma campanha de destaque", "Priorize a apresentação do produto"],
    ["exclusive", "Crie uma campanha exclusiva", "Apresente o produto sem preço"],
  ] as const)("cobre a intenção %s", (intent, objective, rule) => {
    const base = defaultInput();
    const composition = composeVerticalProductPrompt({
      ...base,
      briefing: {
        ...base.briefing,
        commercial: { ...base.briefing.commercial, intent },
      },
    });
    expect(composition.text.startsWith(objective)).toBe(true);
    expect(composition.text).toContain(rule);
  });

  it.each([
    ["studio", "Use fundo de estúdio liso ou gradiente suave"],
    ["ambient", "Crie um cenário coerente com o produto"],
    ["original", "Mantenha o cenário da imagem enviada como base"],
  ] as const)("cobre a direção de fundo %s", (direction, rule) => {
    const base = defaultInput();
    const composition = composeVerticalProductPrompt({
      ...base,
      briefing: { ...base.briefing, backgroundDirection: direction },
      attachments: [{ kind: "product" }, { kind: "identity" }],
      contributions: [PALETTE_CONTRIBUTION],
    });
    expect(composition.text).toContain(rule);
  });

  it("não menciona preço original quando ausente e omite preço em exclusivo", () => {
    const base = defaultInput();
    const withoutOriginal = composeVerticalProductPrompt({
      ...base,
      briefing: {
        ...base.briefing,
        commercial: {
          ...base.briefing.commercial,
          originalPriceText: null,
        },
      },
    });
    expect(withoutOriginal.text).not.toContain("Preço original:");

    const exclusive = composeVerticalProductPrompt({
      ...base,
      briefing: {
        ...base.briefing,
        commercial: {
          ...base.briefing.commercial,
          intent: "exclusive",
        },
      },
    });
    expect(exclusive.text).not.toContain("Preço:");
    expect(exclusive.text).not.toContain("Preço original:");
  });

  it("preserva a hierarquia do preço original quando os dois existem", () => {
    const base = defaultInput();
    const both = composeVerticalProductPrompt({
      ...base,
      briefing: {
        ...base.briefing,
        commercial: {
          ...base.briefing.commercial,
          intent: "offer",
          originalPriceText: "R$ 99,90",
          discountedPriceText: "R$ 69,90",
        },
      },
    });
    expect(both.text).toContain(
      "Destaque o preço de venda; apresente o preço original como secundário.",
    );

    const onlyDiscounted = composeVerticalProductPrompt({
      ...base,
      briefing: {
        ...base.briefing,
        commercial: {
          ...base.briefing.commercial,
          intent: "offer",
          originalPriceText: null,
          discountedPriceText: "R$ 69,90",
        },
      },
    });
    expect(onlyDiscounted.text).toContain("Destaque o preço de venda.");
    expect(onlyDiscounted.text).not.toContain("preço original");
  });

  it("a regra de textos não torna a descrição obrigatória", () => {
    const composition = composeVerticalProductPrompt(defaultInput());
    expect(composition.text).toContain(
      "Preserve o nome do produto, os textos comerciais e os textos obrigatórios, exibindo cada um uma única vez.",
    );
    expect(composition.text).toContain(
      "A descrição é opcional e pode ser adaptada ou omitida",
    );
    expect(composition.text).not.toContain(
      "Preserve o conteúdo dos textos e apresente cada um",
    );
  });

  it("omite campos vazios e regras sobre descrição ausente", () => {
    const base = defaultInput();
    const composition = composeVerticalProductPrompt({
      ...base,
      briefing: {
        ...base.briefing,
        product: { ...base.briefing.product, description: null },
        commercial: {
          ...base.briefing.commercial,
          badge: null,
          validity: null,
        },
        constraints: { mandatoryArtworkText: null },
      },
    });
    expect(composition.text).not.toContain("Descrição:");
    expect(composition.text).not.toContain("A descrição é opcional");
    expect(composition.text).not.toContain("Selo:");
    expect(composition.text).not.toContain("Validade:");
    expect(composition.text).not.toContain("Aviso obrigatório:");
  });

  it("delimita descrição multilinha e aspas de forma inequívoca", () => {
    const base = defaultInput();
    const composition = composeVerticalProductPrompt({
      ...base,
      briefing: {
        ...base.briefing,
        product: {
          name: 'Bolo "Naked" Fruit',
          description: 'Massa de pão de ló\nRecheio "especial"\nCobertura',
        },
      },
    });
    expect(composition.text).toContain(
      'Produto: "Bolo \\"Naked\\" Fruit"',
    );
    expect(composition.text).toContain(
      'Descrição: "Massa de pão de ló\\nRecheio \\"especial\\"\\nCobertura"',
    );
    expect(composition.text.split("\n")).not.toContain("Cobertura");
  });

  it("não repete orientações essenciais", () => {
    const composition = composeVerticalProductPrompt({
      ...defaultInput(),
      attachments: [{ kind: "product" }, { kind: "identity" }],
      contributions: [PALETTE_CONTRIBUTION],
    });
    for (const rule of [
      "Exerça liberdade criativa na composição: explore enquadramento, iluminação, profundidade e hierarquia visual para criar uma campanha expressiva e comercialmente atraente, respeitando as informações fornecidas, o ativo da loja e as áreas protegidas.",
      "Trate cada preço como uma única expressão monetária. Use exatamente uma vírgula entre a parte inteira e os centavos, quando houver centavos, mesmo quando tiverem tamanhos ou alinhamentos diferentes. Não repita a vírgula ao separar visualmente os centavos.",
      "Não invente informações comerciais.",
      "Preserve o nome do produto, os textos comerciais e os textos obrigatórios, exibindo cada um uma única vez.",
      "Antes de alterar as cores do ativo",
      "Os 5% superiores e os 20% inferiores são exclusivos para fundo. É PROIBIDO colocar qualquer texto nessa faixa, inclusive textos obrigatórios, avisos legais e validade da oferta. Preço, selo, CTA e ativo da loja também devem permanecer fora dessas áreas. Textos obrigatórios não devem funcionar como rodapé da imagem.",
      "Posicione o produto preferencialmente na parte inferior da composição.",
      "Utilize todo o quadro para construir uma composição contínua e equilibrada.",
    ]) {
      expect(composition.text.split(rule)).toHaveLength(2);
    }
  });

  it("a versão 1:1 permanece byte-idêntica ao baseline", () => {
    const standard = composeProductPrompt(defaultInput());
    expect(standard.text).toBe(fixture.expected.text);
    expect(standard.blocks).toEqual(fixture.expected.blocks);
    expect(standard.composerVersion).toBe(COMPOSER_VERSION);
  });
});
