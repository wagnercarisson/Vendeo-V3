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
import { SAFE_AREA_9_16_VERSION } from "../safe-area";
import { composeVerticalProductPrompt } from "../prompt/composition";
import {
  FORMATO_9_16_POLICY_VERSION,
  VERTICAL_COMPOSER_VERSION,
  resolveVerticalPromptPolicies,
} from "../prompt/registry";
import { formato916Policy } from "../prompt/policy-formato-9-16";

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
      composerVersion: "f59-vertical-9-16-composer-v3",
    });
    expect(custom.composerVersion).toBe("f59-vertical-9-16-composer-v3");
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

describe("F59 — política de formato 9:16, resolvedor e compositor vertical", () => {
  it("define a política vertical versionada com uma única contribuição consolidada", () => {
    expect(FORMATO_9_16_POLICY_VERSION).toBe("f59-9-16-v2");
    expect(formato916Policy.id).toBe("policy.formato.9-16");
    expect(formato916Policy.dimension).toBe("formato");
    expect(formato916Policy.value).toBe("9:16");
    const contributions = formato916Policy.contributions(defaultInput());
    expect(contributions).toHaveLength(1);
    expect(contributions[0].block).toBe(PROMPT_BLOCK_LABELS.intent);
    const joined = contributions[0].lines.join(" ");
    expect(joined).toContain("proporção 9:16");
    expect(joined).toMatch(/14%/);
    expect(joined).toMatch(/35%/);
    expect(joined).toMatch(/6%/);
    expect(joined).toMatch(/30%/);
    expect(joined).not.toMatch(/px|1080 × 1920|1152|2048|homologa/i);
  });

  it("resolve as 9 versões esperadas sem mutar o registry 1:1", () => {
    const registryBefore = PRODUCT_1_1_PROMPT_POLICY_REGISTRY;
    const formatoBefore = PRODUCT_1_1_PROMPT_POLICY_REGISTRY.formato;
    const intencaoBefore = PRODUCT_1_1_PROMPT_POLICY_REGISTRY.intencao;
    const resolved = resolveVerticalPromptPolicies({
      briefing: fixture.briefing,
      references: baseline.references,
    });

    expect(PRODUCT_1_1_PROMPT_POLICY_REGISTRY).toBe(registryBefore);
    expect(PRODUCT_1_1_PROMPT_POLICY_REGISTRY.formato).toBe(formatoBefore);
    expect(PRODUCT_1_1_PROMPT_POLICY_REGISTRY.intencao).toBe(intencaoBefore);
    expect(resolved.versions).toEqual({
      intencao: "48.2.6-oferta-v2",
      formato: "f59-9-16-v2",
      tipoConteudo: "48.2.6-produto-v4",
      estrutura: "48.2.4-peca-unica-v1",
      tema: "48.2.4-tema-nenhum-v1",
      geral: "48.2.5-general-integrity-v1",
      fundo: "48.2.6-background-direction-v2",
      identidade: "48.2.6-identity-context-v1",
      safeArea: SAFE_AREA_9_16_VERSION,
    });
    expect(Object.keys(resolved.versions)).toHaveLength(9);
    expect(resolved.versions.formato).not.toBe("48.2.4-formato-1-1-v1");
    expect(PRODUCT_1_1_PROMPT_POLICY_REGISTRY.formato?.["1:1"]).toBe(
      formato11Policy,
    );
    expect(PRODUCT_1_1_PROMPT_POLICY_REGISTRY.formato?.["9:16"]).toBeUndefined();
  });

  it("compõe o prompt vertical com versão própria e base 1:1 reaproveitada", () => {
    const composition = composeVerticalProductPrompt(defaultInput());
    const standard = composeProductPrompt(defaultInput());

    expect(VERTICAL_COMPOSER_VERSION).toBe("f59-vertical-9-16-composer-v3");
    expect(composition.composerVersion).toBe(VERTICAL_COMPOSER_VERSION);
    expect(composition.promptBaseVersion).toBe(standard.promptBaseVersion);
    expect(composition.text).toContain("9:16");
    expect(composition.text).toMatch(/14%/);
    expect(composition.text).toMatch(/35%/);
    expect(composition.text).toMatch(/6%/);
    expect(composition.text).toMatch(/30%/);
    expect(composition.text).toMatch(/sem bordas ou faixas vazias/);
    expect(composition.text).toMatch(/guias ou marcas de corte/);
    expect(composition.text).not.toMatch(/px|1080 × 1920|1152|2048|homologa/i);
  });

  it("mantém 7 blocos na ordem, sem pixels nem repetição de área reservada", () => {
    const composition = composeVerticalProductPrompt(defaultInput());
    const present = PROMPT_BLOCK_ORDER.filter(
      (label) => composition.blocks[label] !== undefined,
    );
    expect(Object.keys(composition.blocks)).toEqual(present);
    expect(Object.keys(composition.blocks).length).toBeLessThanOrEqual(7);

    expect(composition.text).not.toMatch(/px|1080 × 1920|1152|2048|homologa/i);
    for (const token of ["14%", "35%", "6%", "30%"]) {
      expect(composition.text.match(new RegExp(token, "g"))).toHaveLength(1);
    }
    expect(composition.text).not.toMatch(/Formato: vertical 9:16/);
  });

  it("identifica anexos na ordem real: produto + ativo", () => {
    const composition = composeVerticalProductPrompt({
      ...defaultInput(),
      attachments: [{ kind: "product" }, { kind: "identity" }],
      contributions: [
        {
          block: PROMPT_BLOCK_LABELS.identity,
          lines: ['Regra legada\nPaleta da loja "Loja": cor principal #000000.'],
        },
      ],
    });
    expect(composition.text).toContain("- Imagem 1: produto anunciado.");
    expect(composition.text).toContain("- Imagem 2: ativo da loja.");
    expect(composition.text).toContain(
      "Use o ativo da loja da imagem 2 como referência de identidade.",
    );
    expect(composition.text).toContain(
      "Preserve o nome, o lettering e os elementos gráficos característicos.",
    );
    expect(composition.text).toContain(
      "Quando indispensável para legibilidade e contraste, ajuste as cores e a disposição dos componentes",
    );
    expect(composition.text).toContain("use a paleta fornecida");
    expect(composition.text).toContain(
      "Antes de alterar as cores do ativo, priorize o posicionamento e a adequação do fundo",
    );
    expect(composition.text).not.toContain("Imagens de referência:");
    expect(composition.text).toContain("manter legível o ativo da loja");
    expect(composition.text).not.toContain("logo ou a assinatura");
    expect(composition.text).not.toContain("Não adicionar logotipo");
    expect(composition.text).toContain('Paleta da loja "Loja"');
  });

  it("calcula a posição do ativo com múltiplas referências de produto", () => {
    const composition = composeVerticalProductPrompt({
      ...defaultInput(),
      attachments: [
        { kind: "product" },
        { kind: "reference" },
        { kind: "identity" },
      ],
      contributions: [
        {
          block: PROMPT_BLOCK_LABELS.identity,
          lines: ['Regra legada\nPaleta da loja "Loja": cor principal #000000.'],
        },
      ],
    });
    expect(composition.text).toContain("- Imagem 1: produto anunciado.");
    expect(composition.text).toContain(
      "- Imagem 2: referência adicional do produto.",
    );
    expect(composition.text).toContain("- Imagem 3: ativo da loja.");
    expect(composition.text).toContain(
      "Use o ativo da loja da imagem 3 como referência de identidade.",
    );
  });

  it("sem ativo não anuncia anexo inexistente nem pede para reproduzi-lo", () => {
    const composition = composeVerticalProductPrompt({
      ...defaultInput(),
      attachments: [{ kind: "product" }, { kind: "reference" }],
      contributions: [
        {
          block: PROMPT_BLOCK_LABELS.identity,
          lines: ['Regra legada\nPaleta da loja "Loja": cor principal #000000.'],
        },
      ],
    });
    expect(composition.text).toContain("- Imagem 1: produto anunciado.");
    expect(composition.text).toContain(
      "- Imagem 2: referência adicional do produto.",
    );
    expect(composition.text).not.toContain("ativo da loja da imagem");
    expect(composition.text).not.toContain(
      "Use o ativo da loja da imagem",
    );
    expect(composition.text).toContain(
      "Não há ativo da loja anexado; não invente identidade visual.",
    );
    expect(composition.text).not.toContain("logo ou a assinatura");
  });

  it("sem paleta não afirma que ela existe", () => {
    const composition = composeVerticalProductPrompt({
      ...defaultInput(),
      attachments: [{ kind: "product" }, { kind: "identity" }],
      contributions: [
        {
          block: PROMPT_BLOCK_LABELS.identity,
          lines: ["Regra legada sem paleta."],
        },
      ],
    });
    expect(composition.text).toContain("use uma aplicação monocromática adequada.");
    expect(composition.text).not.toContain("paleta fornecida");
    expect(composition.text).not.toContain("Paleta da loja");
  });

  it("Original prioriza posição/escala e não altera produto ou cenário", () => {
    const input = defaultInput();
    const composition = composeVerticalProductPrompt({
      ...input,
      briefing: { ...input.briefing, backgroundDirection: "original" },
      attachments: [{ kind: "product" }, { kind: "identity" }],
      contributions: [
        {
          block: PROMPT_BLOCK_LABELS.identity,
          lines: ['Regra legada\nPaleta da loja "Loja": cor principal #000000.'],
        },
      ],
    });
    expect(composition.text).toContain(
      "Não altere o produto nem o cenário para resolver o contraste; priorize posição, escala e adaptação cromática do ativo.",
    );
    expect(composition.text).not.toContain(
      "Antes de alterar as cores do ativo",
    );
  });

  it.each(["studio", "ambient"] as const)(
    "%s prioriza posicionamento/fundo antes de alterar cores",
    (backgroundDirection) => {
      const input = defaultInput();
      const composition = composeVerticalProductPrompt({
        ...input,
        briefing: { ...input.briefing, backgroundDirection },
        attachments: [{ kind: "product" }, { kind: "identity" }],
        contributions: [
          {
            block: PROMPT_BLOCK_LABELS.identity,
            lines: ['Regra legada\nPaleta da loja "Loja": cor principal #000000.'],
          },
        ],
      });
      expect(composition.text).toContain(
        "Antes de alterar as cores do ativo, priorize o posicionamento e a adequação do fundo",
      );
      expect(composition.text).not.toContain(
        "Não altere o produto nem o cenário",
      );
    },
  );

  it("orientação do ativo aparece uma vez, sem proibição absoluta nem duplicação", () => {
    const composition = composeVerticalProductPrompt({
      ...defaultInput(),
      attachments: [{ kind: "product" }, { kind: "identity" }],
      contributions: [
        {
          block: PROMPT_BLOCK_LABELS.identity,
          lines: ['Regra legada\nPaleta da loja "Loja": cor principal #000000.'],
        },
      ],
    });
    expect(
      composition.text.match(/Use o ativo da loja da imagem 2/g),
    ).toHaveLength(1);
    expect(composition.text).not.toContain("Não redesenhe");
    expect(composition.text).not.toContain("não reorganize");
    expect(composition.text).not.toContain("logo ou a assinatura");
    expect(composition.text).not.toContain("Não adicionar logotipo");
  });

  it("a versão custom não altera os blocos 1:1 de identidade/produto/comercial", () => {
    const vertical = composeVerticalProductPrompt(defaultInput());
    const standard = composeProductPrompt(defaultInput());
    for (const label of [
      PROMPT_BLOCK_LABELS.identity,
      PROMPT_BLOCK_LABELS.product,
      PROMPT_BLOCK_LABELS.commercial,
    ]) {
      expect(vertical.blocks[label]).toBe(standard.blocks[label]);
    }
  });
});
