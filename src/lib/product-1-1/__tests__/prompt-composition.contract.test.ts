import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  PRODUCT_1_1_BACKGROUND_COMMON_ORIENTATION,
  PRODUCT_1_1_BACKGROUND_LABELS,
  PRODUCT_1_1_BACKGROUND_PROMPT_INSTRUCTIONS,
} from "../background-direction";
import { PRODUCT_1_1_INTENT_LABELS } from "../intent-selection";
import { PROMPT_BASE_CONTENT, PROMPT_BASE_VERSION } from "../prompt-base";
import {
  COMPOSER_VERSION,
  composeProductPrompt,
  PROMPT_BLOCK_LABELS,
  PROMPT_BLOCK_ORDER,
} from "../prompt-composition";
import {
  GENERAL_INTEGRITY_POLICY_VERSION,
  PRODUCT_1_1_GENERAL_INTEGRITY_LINES,
} from "../policies/general-integrity";
import {
  PRODUCT_1_1_PROMPT_POLICY_REGISTRY,
  resolveProductOneToOnePromptPolicies,
  validateProductOneToOnePromptPolicyRegistry,
} from "../policies/registry";
import type { ProductPromptCompositionBriefing } from "../policies/types";

const BRIEFING: ProductPromptCompositionBriefing = {
  backgroundDirection: "studio",
  product: {
    name: "Johnnie Walker Black Label 750 ml",
    description: "Whisky escocês",
  },
  commercial: {
    intent: "offer",
    originalPriceText: "R$ 99,90",
    discountedPriceText: "R$ 49,90",
    badge: "50% OFF",
    validity: "até 31/12/2026",
  },
  constraints: {
    mandatoryArtworkText: "Válido para retirada na loja",
  },
};

describe("Product 1:1 prompt composition contract", () => {
  it("exposes the fixed versions and canonical block order", () => {
    expect(COMPOSER_VERSION).toBe("48.2.4-prompt-composer-v7");
    expect(PROMPT_BASE_VERSION).toBe("48.2.6-produto-1-1-v1");
    expect(Object.values(PROMPT_BLOCK_LABELS)).toHaveLength(7);
    expect(PROMPT_BLOCK_ORDER).toEqual(Object.values(PROMPT_BLOCK_LABELS));
    expect(PRODUCT_1_1_INTENT_LABELS).toEqual({
      offer: "Oferta",
      spotlight: "Destaque",
      exclusive: "Exclusivo",
    });
    expect(PRODUCT_1_1_BACKGROUND_LABELS).toEqual({
      studio: "Fundo de estúdio",
      ambient: "Cenário ambientado",
      original: "Manter cenário original",
    });
  });

  it("fails fast if an enabled product policy is absent", () => {
    expect(() => validateProductOneToOnePromptPolicyRegistry({})).toThrow(
      "product-1-1-prompt-policy-registry",
    );
    expect(() => validateProductOneToOnePromptPolicyRegistry()).not.toThrow();
    expect(PRODUCT_1_1_PROMPT_POLICY_REGISTRY.tema?.nenhum?.version).toBe(
      "48.2.4-tema-nenhum-v1",
    );
  });

  it("includes every policy version and adds general integrity once in constraints", () => {
    const references = ["approved/product-main.png", "approved/product-alt.png"];
    const policyResolution = resolveProductOneToOnePromptPolicies({
      briefing: BRIEFING,
      references,
    });
    const composed = composeProductPrompt({
      briefing: BRIEFING,
      promptBase: PROMPT_BASE_CONTENT,
      references,
    });
    const constraints = composed.blocks[PROMPT_BLOCK_LABELS.constraints] ?? "";
    const intent = composed.blocks[PROMPT_BLOCK_LABELS.intent] ?? "";

    expect(composed.promptBaseVersion).toBe(PROMPT_BASE_VERSION);
    expect(composed.policyVersions).toEqual(policyResolution.versions);
    expect(composed.policyVersions).toEqual({
      intencao: "48.2.6-oferta-v2",
      formato: "48.2.4-formato-1-1-v1",
      tipoConteudo: "48.2.6-produto-v4",
      estrutura: "48.2.4-peca-unica-v1",
      tema: "48.2.4-tema-nenhum-v1",
      geral: GENERAL_INTEGRITY_POLICY_VERSION,
      fundo: "48.2.6-background-direction-v2",
      identidade: "48.2.6-identity-context-v1",
    });

    for (const line of PRODUCT_1_1_GENERAL_INTEGRITY_LINES) {
      expect(constraints.split(line)).toHaveLength(2);
    }
    expect(intent.split("Estrutura: peça única.")).toHaveLength(2);
    expect(constraints).toContain("Informações obrigatórias na arte: Válido para retirada na loja");
    expect(composed.text).toContain(PROMPT_BASE_CONTENT);
  });

  it("is deterministic and omits empty canonical blocks", () => {
    const briefing: ProductPromptCompositionBriefing = {
      backgroundDirection: "original",
      product: { name: "Produto 750 ml", description: null },
      commercial: {
        intent: "exclusive",
        originalPriceText: null,
        discountedPriceText: null,
        badge: null,
        validity: null,
      },
      constraints: { mandatoryArtworkText: null },
    };
    const input = {
      briefing,
      promptBase: "Base congelada",
      references: ["product.png"],
    };

    const first = composeProductPrompt(input);
    const second = composeProductPrompt(input);

    expect(first).toEqual(second);
    expect(first.text).toContain("Direção de fundo: Mantenha o cenário da imagem enviada como base; não substitua o ambiente por outro.");
    expect(first.blocks[PROMPT_BLOCK_LABELS.identity]).toBeUndefined();
    expect(first.blocks[PROMPT_BLOCK_LABELS.typography]).toBeUndefined();
  });

  it("has no runtime dependency on mutable bench modules", () => {
    const runtimePaths = [
      "src/lib/product-1-1/prompt-base.ts",
      "src/lib/product-1-1/prompt-composition.ts",
      "src/lib/product-1-1/background-direction.ts",
      "src/lib/product-1-1/identity-context.ts",
      "src/lib/product-1-1/policies/types.ts",
      "src/lib/product-1-1/policies/produto.ts",
      "src/lib/product-1-1/policies/oferta.ts",
      "src/lib/product-1-1/policies/destaque.ts",
      "src/lib/product-1-1/policies/exclusivo.ts",
      "src/lib/product-1-1/policies/formato-1-1.ts",
      "src/lib/product-1-1/policies/general-integrity.ts",
      "src/lib/product-1-1/policies/registry.ts",
    ];

    for (const file of runtimePaths) {
      const source = readFileSync(path.resolve(process.cwd(), file), "utf8");
      expect(source, `${file} must stay bench-independent`).not.toMatch(
        /(?:from\s*["'][^"']*lab\/bench|import\s*["'][^"']*lab\/bench)/,
      );
    }
  });
});

describe("Product 1:1 background directions (recreated vs original)", () => {
  it.each(["offer", "spotlight", "exclusive"] as const)(
    "emite a orientação comum de contraste UMA única vez em estúdio/ambientado (%s)",
    (intent) => {
      for (const direction of ["studio", "ambient"] as const) {
        const composed = composeProductPrompt({
          briefing: { ...BRIEFING, backgroundDirection: direction, commercial: { ...BRIEFING.commercial, intent } },
          promptBase: PROMPT_BASE_CONTENT,
          references: ["product.png"],
        });
        const occurrences = composed.text.split(
          PRODUCT_1_1_BACKGROUND_COMMON_ORIENTATION,
        );
        expect(occurrences.length, `${direction}/${intent}`).toBe(2);
        expect(composed.text).toContain(PRODUCT_1_1_BACKGROUND_PROMPT_INSTRUCTIONS[direction]);
      }
    },
  );

  it("não acrescenta paleta nem orientação de contraste em original", () => {
    const composed = composeProductPrompt({
      briefing: { ...BRIEFING, backgroundDirection: "original" },
      promptBase: PROMPT_BASE_CONTENT,
      references: ["product.png"],
    });

    expect(composed.text).toContain(PRODUCT_1_1_BACKGROUND_PROMPT_INSTRUCTIONS.original);
    expect(composed.text).not.toContain(PRODUCT_1_1_BACKGROUND_COMMON_ORIENTATION);
    expect(composed.text.toLowerCase()).not.toContain("paleta da loja");
  });

  it("substitui as instruções antigas (sem acúmulo) e mantém a paleta citada só na direção", () => {
    const composed = composeProductPrompt({
      briefing: { ...BRIEFING, backgroundDirection: "studio" },
      promptBase: PROMPT_BASE_CONTENT,
      references: ["product.png"],
    });

    expect(composed.text).not.toContain(
      "Use um fundo de estúdio discreto, em cor sólida ou gradiente suave, sem cenário ou objetos de apoio.",
    );
    expect(composed.text).toContain(
      "Use um fundo de estúdio discreto na paleta da loja, em cor sólida ou gradiente suave, sem cenário ou objetos de apoio.",
    );
  });
});
