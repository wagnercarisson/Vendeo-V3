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
import { SAFE_AREA_9_16_VERSION, SAFE_AREA_PERCENT } from "../safe-area";
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
      composerVersion: "f59-vertical-9-16-composer-v4",
    });
    expect(custom.composerVersion).toBe("f59-vertical-9-16-composer-v4");
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
      formato: "f59-9-16-v3",
      tipoConteudo: "48.2.6-produto-v4",
      estrutura: "48.2.4-peca-unica-v1",
      tema: "48.2.4-tema-nenhum-v1",
      geral: "48.2.5-general-integrity-v1",
      fundo: "48.2.6-background-direction-v2",
      identidade: "48.2.6-identity-context-v1",
      safeArea: SAFE_AREA_9_16_VERSION,
    });
    expect(Object.keys(versions)).toHaveLength(9);
    expect(versions.formato).toBe(FORMATO_9_16_POLICY_VERSION);
    expect(versions.formato).not.toBe(formato11Policy.version);
    expect(PRODUCT_1_1_PROMPT_POLICY_REGISTRY.formato?.["9:16"]).toBeUndefined();
  });

  it("compõe a estrutura editorial na ordem e com versão própria", () => {
    const composition = composeVerticalProductPrompt(defaultInput());

    expect(VERTICAL_COMPOSER_VERSION).toBe("f59-vertical-9-16-composer-v4");
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
      "reservedAreas",
    ]);
    const order = [
      "[REFERÊNCIAS]",
      "[DADOS DA CAMPANHA]",
      "[COMPOSIÇÃO]",
      "[ÁREAS RESERVADAS]",
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
      "ÁREAS RESERVADAS",
    ]);
    expect(composition.text).not.toContain("[IDENTIDADE E DIREÇÃO VISUAL]");
    expect(composition.text).not.toContain("[PRODUTO E IMAGENS DE REFERÊNCIA]");
    expect(composition.text).not.toContain("[INSTRUÇÕES DO PROMPT-BASE]");
  });

  it("emite as áreas reservadas uma única vez, só em percentuais", () => {
    const composition = composeVerticalProductPrompt(defaultInput());
    expect(composition.text.match(/14%/g)).toHaveLength(1);
    expect(composition.text.match(/35%/g)).toHaveLength(1);
    expect(composition.text.match(/6%/g)).toHaveLength(1);
    expect(composition.text.match(/30%/g)).toHaveLength(1);
    expect(composition.text.match(/40%/g)).toHaveLength(1);
    expect(composition.text).toContain(
      `${SAFE_AREA_PERCENT.top}% do topo, ${SAFE_AREA_PERCENT.bottom}% da base, ${SAFE_AREA_PERCENT.sides}% de cada lateral`,
    );
    expect(composition.text).not.toMatch(
      /px|1080 × 1920|1152|2048|0,9375|homologa/i,
    );
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

    expect(composition.text).not.toContain("ativo da loja. Preserve sua identidade");
    expect(composition.text).toContain("Não invente identidade visual.");
    expect(composition.text).toContain(
      "Deixe sem textos ou partes essenciais do produto:",
    );
    expect(composition.text).not.toContain("textos, ativo da loja");
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

  it.each([
    ["offer", "Crie uma campanha de oferta", "Destaque o produto e o preço de venda."],
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
      "Não invente informações comerciais.",
      "Preserve o conteúdo dos textos e apresente cada um uma única vez",
      "Antes de alterar as cores do ativo",
      "O fundo deve preencher também essas regiões.",
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
