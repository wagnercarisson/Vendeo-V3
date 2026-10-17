import { describe, expect, it } from "vitest";

import { PRODUCT_1_1_BACKGROUND_PROMPT_INSTRUCTIONS } from "../background-direction";
import {
  PRODUCT_1_1_IDENTITY_CONTEXT_VERSION,
  buildNewFlowIdentityBlock,
  reconcileLegacyIdentityDirective,
  resolveProductOneToOneIdentityContext,
} from "../identity-context";
import { PROMPT_BASE_CONTENT } from "../prompt-base";
import { PROMPT_BLOCK_LABELS, composeProductPrompt } from "../prompt-composition";
import { computeContentFingerprint } from "../snapshot/persist-snapshot";
import type { ProductOneToOneIntent } from "../intent-selection";

const LEGACY_LOGO_ASSET =
  "Assinar a campanha com o logotipo da loja fornecido como imagem de referência. Manter fidelidade ao arquivo fornecido. Considerar a direção visual do perfil de marca como contexto direcional, não obrigatório.";
const LEGACY_LOGO_NO_ASSET =
  "Não inventar logotipo. Usar apenas a direção visual do perfil de marca como contexto direcional, não obrigatório.";
const LEGACY_SIGNATURE_ASSET =
  "Assinar a campanha com a assinatura visual da loja fornecida como imagem de referência. Manter fidelidade ao arquivo fornecido. Não adicionar logotipo. Considerar a direção visual do perfil de marca como contexto direcional, não obrigatório.";
const LEGACY_TEXT_ONLY =
  "Não colocar logotipo. Não gerar assinatura visual. Considerar a direção visual do perfil de marca como contexto direcional, não obrigatório.";

describe("Product 1:1 identity context (quick 261017-cdi)", () => {
  it("expõe a versão fixada do contexto de identidade", () => {
    expect(PRODUCT_1_1_IDENTITY_CONTEXT_VERSION).toBe(
      "48.2.6-identity-context-v1",
    );
  });

  it("precedência da paleta PRINCIPAL: brand_colors_chosen[0] > safe_color_tokens.primary > brand_color", () => {
    expect(
      resolveProductOneToOneIdentityContext({
        storeName: "Loja",
        storeBrandColor: "#111111",
        brandProfile: {
          brand_colors_chosen: ["#AA0000"],
          safe_color_tokens: { primary: "#BBBBBB", accent: "#CCCCCC" },
        },
      }).palettePrimary,
    ).toBe("#AA0000");

    expect(
      resolveProductOneToOneIdentityContext({
        storeName: "Loja",
        storeBrandColor: "#111111",
        brandProfile: {
          brand_colors_chosen: [],
          safe_color_tokens: { primary: "#BBBBBB" },
        },
      }).palettePrimary,
    ).toBe("#BBBBBB");

    expect(
      resolveProductOneToOneIdentityContext({
        storeName: "Loja",
        storeBrandColor: "#111111",
        brandProfile: null,
      }).palettePrimary,
    ).toBe("#111111");
  });

  it("precedência do ACENTO alinhada à tela: brand_colors_chosen[1] > safe_color_tokens.accent", () => {
    // Reprodução do relato: escolhida #AABBCC (tela) vs enviada #445566.
    expect(
      resolveProductOneToOneIdentityContext({
        storeName: "Loja",
        storeBrandColor: "#111111",
        brandProfile: {
          brand_colors_chosen: ["#111111", "#AABBCC"],
          safe_color_tokens: { primary: "#111111", accent: "#445566" },
        },
      }).paletteAccent,
    ).toBe("#AABBCC");

    // Sem escolha do lojista ⇒ cai no acento do perfil.
    expect(
      resolveProductOneToOneIdentityContext({
        storeName: "Loja",
        storeBrandColor: "#111111",
        brandProfile: {
          brand_colors_chosen: ["#111111"],
          safe_color_tokens: { primary: "#111111", accent: "#445566" },
        },
      }).paletteAccent,
    ).toBe("#445566");

    // Acento igual à principal é descartado.
    expect(
      resolveProductOneToOneIdentityContext({
        storeName: "Loja",
        storeBrandColor: "#242422",
        brandProfile: { safe_color_tokens: { primary: "#242422", accent: "#242422" } },
      }).paletteAccent,
    ).toBeNull();
  });

  it("ignora valores inválidos e nunca inventa cor quando não há fonte válida", () => {
    const context = resolveProductOneToOneIdentityContext({
      storeName: "  Loja Sem Paleta  ",
      storeBrandColor: "vermelho",
      brandProfile: {
        brand_colors_chosen: [null, "#12345"],
        safe_color_tokens: { primary: "rgb(0,0,0)", accent: null },
      },
    });

    expect(context.palettePrimary).toBeNull();
    expect(context.paletteAccent).toBeNull();
    expect(context.storeName).toBe("Loja Sem Paleta");
  });

  it("reconcilia a diretiva legada removendo a cláusula ambígua e preservando presença/ausência", () => {
    expect(reconcileLegacyIdentityDirective(LEGACY_LOGO_ASSET)).toBe(
      "Assinar a campanha com o logotipo da loja fornecido como imagem de referência. Manter fidelidade ao arquivo fornecido.",
    );
    expect(reconcileLegacyIdentityDirective(LEGACY_LOGO_NO_ASSET)).toBe(
      "Não inventar logotipo.",
    );
    expect(reconcileLegacyIdentityDirective(LEGACY_SIGNATURE_ASSET)).toBe(
      "Assinar a campanha com a assinatura visual da loja fornecida como imagem de referência. Manter fidelidade ao arquivo fornecido. Não adicionar logotipo.",
    );
    expect(reconcileLegacyIdentityDirective(LEGACY_TEXT_ONLY)).toBe(
      "Não colocar logotipo. Não gerar assinatura visual.",
    );
    for (const legacy of [
      LEGACY_LOGO_ASSET,
      LEGACY_LOGO_NO_ASSET,
      LEGACY_SIGNATURE_ASSET,
      LEGACY_TEXT_ONLY,
    ]) {
      const reconciled = reconcileLegacyIdentityDirective(legacy);
      expect(reconciled.toLowerCase()).not.toContain("não obrigatório");
      expect(reconciled.toLowerCase()).not.toContain("perfil de marca");
    }
  });
});

describe("Product 1:1 identity block (paleta + direção de fundo)", () => {
  const PALETTE_PROFILE = {
    brand_colors_chosen: ["#242422", "#AABBCC"],
    safe_color_tokens: { primary: "#242422", accent: "#445566" },
  };

  it("com paleta: assinatura + paleta (apresenta o acento escolhido)", () => {
    const block = buildNewFlowIdentityBlock({
      legacyDirective: LEGACY_LOGO_ASSET,
      backgroundDirection: "studio",
      storeName: "Adega Mestre das Geladas",
      storeBrandColor: "#242422",
      brandProfile: PALETTE_PROFILE,
    });

    expect(block.directive).toContain(
      "Assinar a campanha com o logotipo da loja fornecido como imagem de referência. Manter fidelidade ao arquivo fornecido.",
    );
    expect(block.directive).toContain(
      'Paleta da loja "Adega Mestre das Geladas": cor principal #242422; cor de apoio #AABBCC.',
    );
    expect(block.directive).not.toContain("não obrigatório");
    expect(block.context.paletteAccent).toBe("#AABBCC");
  });

  it("sem paleta + estúdio/ambientado: orientação neutra explícita", () => {
    for (const direction of ["studio", "ambient"] as const) {
      const block = buildNewFlowIdentityBlock({
        legacyDirective: LEGACY_TEXT_ONLY,
        backgroundDirection: direction,
        storeName: "Loja Sem Paleta",
        storeBrandColor: null,
        brandProfile: null,
      });
      expect(block.directive).toContain(
        "Sem paleta da loja definida, use cores neutras e discretas.",
      );
    }
  });

  it("sem paleta + original: NENHUMA orientação neutra (não conflita com o cenário)", () => {
    const block = buildNewFlowIdentityBlock({
      legacyDirective: LEGACY_TEXT_ONLY,
      backgroundDirection: "original",
      storeName: "Loja Sem Paleta",
      storeBrandColor: null,
      brandProfile: null,
    });
    expect(block.directive).toBe(
      "Não colocar logotipo. Não gerar assinatura visual.",
    );
    expect(block.directive).not.toContain("cores neutras");
    expect(block.directive).not.toContain("paleta");
    expect(block.context.palettePrimary).toBeNull();
  });
});

describe("Product 1:1 full prompt with identity (9 combos)", () => {
  const INTENTS: readonly ProductOneToOneIntent[] = [
    "offer",
    "spotlight",
    "exclusive",
  ];
  const DIRECTIONS = ["studio", "ambient", "original"] as const;

  const PALETTE_VALUES = {
    brand_colors_chosen: ["#242422", "#AABBCC"],
    safe_color_tokens: { primary: "#242422", accent: "#445566" },
  };

  function composeWith(options: {
    intent: ProductOneToOneIntent;
    direction: (typeof DIRECTIONS)[number];
    palette: boolean;
  }) {
    const legacyDirective = LEGACY_LOGO_ASSET;
    const block = buildNewFlowIdentityBlock({
      legacyDirective,
      backgroundDirection: options.direction,
      storeName: "Adega Mestre das Geladas",
      storeBrandColor: options.palette ? "#242422" : null,
      brandProfile: options.palette ? PALETTE_VALUES : null,
    });
    return composeProductPrompt({
      briefing: {
        backgroundDirection: options.direction,
        product: { name: "Produto X 250ml", description: null },
        commercial: {
          intent: options.intent,
          originalPriceText: "R$ 9,99",
          discountedPriceText: "R$ 7,49",
          badge: "Oferta",
          validity: "somente hoje",
        },
        constraints: { mandatoryArtworkText: null },
      },
      promptBase: PROMPT_BASE_CONTENT,
      references: ["product.png"],
      contributions: [
        { block: PROMPT_BLOCK_LABELS.identity, lines: [block.directive] },
      ],
    });
  }

  for (const intent of INTENTS) {
    for (const direction of DIRECTIONS) {
      it(`${intent}/${direction}: identidade uma única vez, sem conflito com fundo original`, () => {
        const withPalette = composeWith({ intent, direction, palette: true });
        const noPalette = composeWith({ intent, direction, palette: false });

        // Identidade presente exatamente uma vez (paleta OU neutra).
        const identity = withPalette.blocks[PROMPT_BLOCK_LABELS.identity] ?? "";
        expect(identity).toContain("Paleta da loja");
        expect(identity.split("Paleta da loja")).toHaveLength(2);
        expect(identity).not.toContain("não obrigatório");

        // Determinismo (mesma entrada ⇒ mesma saída).
        expect(composeWith({ intent, direction, palette: true }).text).toBe(
          withPalette.text,
        );

        const noPaletteIdentity =
          noPalette.blocks[PROMPT_BLOCK_LABELS.identity] ?? "";
        if (direction === "original") {
          // `original`: nunca a orientação neutra nem imposição de paleta.
          expect(noPaletteIdentity).not.toContain("cores neutras");
          expect(noPaletteIdentity).not.toContain("Paleta da loja");
          expect(noPalette.text).not.toContain(PRODUCT_1_1_BACKGROUND_PROMPT_INSTRUCTIONS.original + "\nGaranta contraste");
        } else {
          expect(noPaletteIdentity).toContain("cores neutras e discretas");
          // Fundos recriados: orientação comum de contraste uma única vez.
          expect(
            withPalette.text.split(
              "Garanta contraste para destacar o produto e manter legível o logo ou a assinatura da loja.",
            ),
          ).toHaveLength(2);
        }
      });
    }
  }
});

describe("Product 1:1 fingerprint determinism (identidade)", () => {
  const base = {
    campaignIntent: "offer" as const,
    backgroundDirection: "studio" as const,
    referenceSelections: [] as const,
    baseVersion: "48.2.6-produto-1-1-v1",
    composerVersion: "48.2.4-prompt-composer-v7",
    policyVersions: { identidade: "48.2.6-identity-context-v1" },
  };

  const briefingWith = (primary: string) =>
    JSON.stringify({ product: "X", identity: { palettePrimary: primary } });

  it("mesma identidade ⇒ mesmo fingerprint", () => {
    const a = computeContentFingerprint({ ...base, briefing: briefingWith("#242422") });
    const b = computeContentFingerprint({ ...base, briefing: briefingWith("#242422") });
    expect(a).toBe(b);
  });

  it("mudança de cor da loja ⇒ fingerprint diferente", () => {
    const a = computeContentFingerprint({ ...base, briefing: briefingWith("#242422") });
    const b = computeContentFingerprint({ ...base, briefing: briefingWith("#AABBCC") });
    expect(a).not.toBe(b);
  });
});
