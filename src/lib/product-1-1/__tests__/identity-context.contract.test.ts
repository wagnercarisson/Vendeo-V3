import { describe, expect, it } from "vitest";

import {
  PRODUCT_1_1_BACKGROUND_COMMON_ORIENTATION,
  PRODUCT_1_1_BACKGROUND_PROMPT_INSTRUCTIONS,
} from "../background-direction";
import {
  PRODUCT_1_1_IDENTITY_CONTEXT_VERSION,
  buildNewFlowIdentityBlock,
  buildTextOnlyInstruction,
  buildVisualSignatureInstruction,
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
      "48.2.6-identity-context-v3",
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
    policyVersions: { identidade: "48.2.6-identity-context-v3" },
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

// ── Quick 261125-i05 — instrução explícita de assinatura visual ─────────────
describe("Quick 261125-i05 — assinatura visual com arquivo disponível", () => {
  const PALETTE_PROFILE = {
    brand_colors_chosen: ["#242422", "#AABBCC"],
    safe_color_tokens: { primary: "#242422", accent: "#445566" },
  };
  const LEGACY_SIGNATURE_NO_ASSET =
    "Não inventar assinatura visual nem logotipo. Considerar a direção visual do perfil de marca como contexto direcional, não obrigatório.";
  // Montado por partes para que o placeholder não apareça literalmente no
  // código-fonte (gate: `rg "\[nome da loja\]" src` sem ocorrências).
  const PLACEHOLDER_TOKEN = `[${"nome da loja"}]`;

  function expectedInstruction(name: string): string {
    return [
      `Use obrigatoriamente a assinatura visual oficial da loja "${name}", fornecida como imagem de referência de identidade.`,
      "Inclua a assinatura de forma legível, preservando seus elementos gráficos, cores, proporções e textos. Ajuste sua posição e escala para integrá-la à composição, sem redesenhá-la ou substituir seus elementos.",
      "Títulos promocionais, mesmo contendo o nome da loja, não substituem essa assinatura.",
      "Não invente nem acrescente outro logotipo ou assinatura.",
    ].join("\n");
  }

  it("redação exata: quatro linhas com o nome interpolado, sem placeholder; nome vazio ⇒ vazio", () => {
    const instruction = buildVisualSignatureInstruction("Mega Vale");

    expect(instruction).toBe(expectedInstruction("Mega Vale"));
    expect(instruction).toContain('loja "Mega Vale",');
    expect(instruction.split("\n")).toHaveLength(4);
    expect(instruction).not.toContain(PLACEHOLDER_TOKEN);
    expect(buildVisualSignatureInstruction("   ")).toBe("");
  });

  it("visual_signature + arquivo + paleta: instrução uma única vez, paleta preservada, instrução antiga ausente", () => {
    const instruction = expectedInstruction("Adega Mestre das Geladas");
    const block = buildNewFlowIdentityBlock({
      legacyDirective: LEGACY_SIGNATURE_ASSET,
      backgroundDirection: "studio",
      storeName: "Adega Mestre das Geladas",
      storeBrandColor: "#242422",
      brandProfile: PALETTE_PROFILE,
      identityState: "visual_signature",
      hasIdentityAsset: true,
    });

    expect(block.directive.split(instruction)).toHaveLength(2);
    expect(block.directive).toContain(
      'Paleta da loja "Adega Mestre das Geladas": cor principal #242422; cor de apoio #AABBCC.',
    );
    expect(block.directive).not.toContain(
      "Assinar a campanha com a assinatura visual da loja fornecida como imagem de referência",
    );
    expect(block.directive).not.toContain("Não adicionar logotipo.");
  });

  it("instrução independe da paleta (original sem paleta ⇒ exatamente as 4 linhas; estúdio ⇒ + neutra)", () => {
    const instruction = expectedInstruction("Adega Mestre das Geladas");
    const base = {
      legacyDirective: LEGACY_SIGNATURE_ASSET,
      storeName: "Adega Mestre das Geladas",
      storeBrandColor: null,
      brandProfile: null,
      identityState: "visual_signature" as const,
      hasIdentityAsset: true,
    };

    const original = buildNewFlowIdentityBlock({
      ...base,
      backgroundDirection: "original",
    });
    expect(original.directive).toBe(instruction);

    const studio = buildNewFlowIdentityBlock({
      ...base,
      backgroundDirection: "studio",
    });
    expect(studio.directive).toBe(
      `${instruction}\nSem paleta da loja definida, use cores neutras e discretas.`,
    );
    expect(studio.directive).not.toContain("Paleta da loja");
  });

  it("preserva exatamente o texto anterior em text_only, logo e assinatura sem arquivo", () => {
    const base = {
      backgroundDirection: "original" as const,
      storeName: "Adega Mestre das Geladas",
      storeBrandColor: null,
      brandProfile: null,
    };

    expect(
      buildNewFlowIdentityBlock({
        ...base,
        legacyDirective: LEGACY_TEXT_ONLY,
        identityState: "text_only",
        hasIdentityAsset: false,
      }).directive,
    ).toBe("Não colocar logotipo. Não gerar assinatura visual.");

    expect(
      buildNewFlowIdentityBlock({
        ...base,
        legacyDirective: LEGACY_LOGO_ASSET,
        identityState: "logo",
        hasIdentityAsset: true,
      }).directive,
    ).toBe(
      "Assinar a campanha com o logotipo da loja fornecido como imagem de referência. Manter fidelidade ao arquivo fornecido.",
    );

    expect(
      buildNewFlowIdentityBlock({
        ...base,
        legacyDirective: LEGACY_SIGNATURE_NO_ASSET,
        identityState: "visual_signature",
        hasIdentityAsset: false,
      }).directive,
    ).toBe("Não inventar assinatura visual nem logotipo.");
  });

  it("prompt final composto: redação presente uma única vez, nome interpolado, sem instrução antiga", () => {
    const instruction = expectedInstruction("Adega Mestre das Geladas");
    const block = buildNewFlowIdentityBlock({
      legacyDirective: LEGACY_SIGNATURE_ASSET,
      backgroundDirection: "studio",
      storeName: "Adega Mestre das Geladas",
      storeBrandColor: "#242422",
      brandProfile: PALETTE_PROFILE,
      identityState: "visual_signature",
      hasIdentityAsset: true,
    });
    const composed = composeProductPrompt({
      briefing: {
        backgroundDirection: "studio",
        product: { name: "Produto X 250ml", description: null },
        commercial: {
          intent: "offer",
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

    expect(
      composed.text.split(
        "Use obrigatoriamente a assinatura visual oficial da loja",
      ),
    ).toHaveLength(2);
    expect(composed.text).toContain(instruction);
    expect(composed.text).toContain('loja "Adega Mestre das Geladas"');
    expect(composed.text).not.toContain("Assinar a campanha com a assinatura visual");
    expect(composed.text).not.toContain("Não adicionar logotipo.");
    expect(composed.text).not.toContain(PLACEHOLDER_TOKEN);
  });
});

// ── Quick 261125-i06 — identificação institucional em texto (1:1 text_only) ──
describe("Quick 261125-i06 — identificação institucional em texto no 1:1", () => {
  const DIRECTIONS = ["studio", "ambient", "original"] as const;
  const STORE_NAME = "Adega Mestre das Geladas";
  const TYPOGRAPHY = "Serifada editorial elegante";
  // Montado por partes para que o placeholder não apareça literalmente no
  // código-fonte (gate: `rg "\[nome da loja\]" src` sem ocorrências).
  const PLACEHOLDER_TOKEN = `[${"nome da loja"}]`;
  const OLD_TEXT_ONLY =
    "Não colocar logotipo. Não gerar assinatura visual.";

  function expectedInstruction(typography?: string): string {
    const lines = [
      `Inclua obrigatoriamente o nome da loja "${STORE_NAME}" como identificação institucional, em texto legível.`,
      "Títulos promocionais, mesmo contendo o nome da loja, não substituem essa identificação.",
      "Não invente nem acrescente logotipo, símbolo de marca ou assinatura gráfica para identificar a loja.",
    ];
    if (typography) lines.push(`Direção tipográfica da loja: ${typography}`);
    return lines.join("\n");
  }

  function composeTextOnly(options: {
    direction: (typeof DIRECTIONS)[number];
    palette: boolean;
    typography: string | null;
  }) {
    const block = buildNewFlowIdentityBlock({
      legacyDirective: LEGACY_TEXT_ONLY,
      backgroundDirection: options.direction,
      storeName: STORE_NAME,
      storeBrandColor: options.palette ? "#242422" : null,
      brandProfile: options.palette
        ? {
            brand_colors_chosen: ["#242422", "#AABBCC"],
            safe_color_tokens: { primary: "#242422", accent: "#445566" },
            typography_direction: options.typography,
          }
        : null,
      typographyDirection: options.typography,
      identityState: "text_only",
      textOnlyInstitutionalIdentity: true,
    });
    return {
      block,
      composed: composeProductPrompt(
        {
          briefing: {
            backgroundDirection: options.direction,
            product: { name: "Produto X 250ml", description: null },
            commercial: {
              intent: "offer",
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
        },
        // Mesma opção que o orquestrador passa no 1:1 `text_only`.
        { commercialIdentityLine: null },
      ),
    };
  }

  it("redação exata: sem tipografia são 3 linhas; com tipografia são 4; nome vazio ⇒ vazio", () => {
    expect(buildTextOnlyInstruction(STORE_NAME)).toBe(expectedInstruction());
    expect(buildTextOnlyInstruction(STORE_NAME).split("\n")).toHaveLength(3);

    const withTypography = buildTextOnlyInstruction(STORE_NAME, TYPOGRAPHY);
    expect(withTypography).toBe(expectedInstruction(`${TYPOGRAPHY}.`));
    expect(withTypography.split("\n")).toHaveLength(4);
    expect(withTypography).not.toContain(PLACEHOLDER_TOKEN);

    // Pontuação final idempotente (não duplica).
    expect(buildTextOnlyInstruction(STORE_NAME, "Manuscrita!")).toContain(
      "Direção tipográfica da loja: Manuscrita!",
    );
    expect(
      buildTextOnlyInstruction(STORE_NAME, "Manuscrita!").endsWith(
        "Manuscrita!",
      ),
    ).toBe(true);
    expect(buildTextOnlyInstruction("   ", TYPOGRAPHY)).toBe("");
  });

  it("text_only + opt-in + nome + tipografia (original, sem paleta): exatamente 4 linhas, nome e orientação uma única vez", () => {
    const block = buildNewFlowIdentityBlock({
      legacyDirective: LEGACY_TEXT_ONLY,
      backgroundDirection: "original",
      storeName: STORE_NAME,
      storeBrandColor: null,
      brandProfile: null,
      typographyDirection: TYPOGRAPHY,
      identityState: "text_only",
      textOnlyInstitutionalIdentity: true,
    });

    expect(block.directive).toBe(expectedInstruction(`${TYPOGRAPHY}.`));
    expect(block.directive.split("\n")).toHaveLength(4);
    expect(block.directive.split(`"${STORE_NAME}"`)).toHaveLength(2);
    expect(
      block.directive.split(`Direção tipográfica da loja: ${TYPOGRAPHY}.`),
    ).toHaveLength(2);
    expect(block.directive).not.toContain(OLD_TEXT_ONLY);
  });

  it("orientação vazia/só espaços ⇒ 3 linhas, sem 'Direção tipográfica'; nome permanece mesmo sem perfil/paleta", () => {
    for (const typography of [null, "", "   "] as const) {
      const block = buildNewFlowIdentityBlock({
        legacyDirective: LEGACY_TEXT_ONLY,
        backgroundDirection: "original",
        storeName: STORE_NAME,
        storeBrandColor: null,
        brandProfile: null,
        typographyDirection: typography,
        identityState: "text_only",
        textOnlyInstitutionalIdentity: true,
      });
      expect(block.directive).toBe(expectedInstruction());
      expect(block.directive.split("\n")).toHaveLength(3);
      expect(block.directive).not.toContain("Direção tipográfica");
      expect(block.directive).toContain(`"${STORE_NAME}"`);
    }
  });

  it("text_only SEM opt-in preserva o texto reconciliado anterior (fronteira joint/9:16)", () => {
    const block = buildNewFlowIdentityBlock({
      legacyDirective: LEGACY_TEXT_ONLY,
      backgroundDirection: "original",
      storeName: STORE_NAME,
      storeBrandColor: null,
      brandProfile: null,
      typographyDirection: TYPOGRAPHY,
      identityState: "text_only",
    });

    expect(block.directive).toBe(OLD_TEXT_ONLY);
    expect(block.directive).not.toContain("Inclua obrigatoriamente");
    expect(block.directive).not.toContain("Direção tipográfica");
  });

  it("logo e visual_signature (com e sem arquivo) mantêm o conteúdo anterior exato", () => {
    const base = {
      backgroundDirection: "original" as const,
      storeName: STORE_NAME,
      storeBrandColor: null,
      brandProfile: null,
      typographyDirection: TYPOGRAPHY,
      textOnlyInstitutionalIdentity: true,
    };

    expect(
      buildNewFlowIdentityBlock({
        ...base,
        legacyDirective: LEGACY_LOGO_ASSET,
        identityState: "logo",
        hasIdentityAsset: true,
      }).directive,
    ).toBe(
      "Assinar a campanha com o logotipo da loja fornecido como imagem de referência. Manter fidelidade ao arquivo fornecido.",
    );

    expect(
      buildNewFlowIdentityBlock({
        ...base,
        legacyDirective: LEGACY_LOGO_NO_ASSET,
        identityState: "logo",
        hasIdentityAsset: false,
      }).directive,
    ).toBe("Não inventar logotipo.");

    expect(
      buildNewFlowIdentityBlock({
        ...base,
        legacyDirective: LEGACY_SIGNATURE_ASSET,
        identityState: "visual_signature",
        hasIdentityAsset: true,
      }).directive,
    ).toBe(expectedVisualSignature());
  });

  function expectedVisualSignature(): string {
    return [
      `Use obrigatoriamente a assinatura visual oficial da loja "${STORE_NAME}", fornecida como imagem de referência de identidade.`,
      "Inclua a assinatura de forma legível, preservando seus elementos gráficos, cores, proporções e textos. Ajuste sua posição e escala para integrá-la à composição, sem redesenhá-la ou substituir seus elementos.",
      "Títulos promocionais, mesmo contendo o nome da loja, não substituem essa assinatura.",
      "Não invente nem acrescente outro logotipo ou assinatura.",
    ].join("\n");
  }

  it("estado logo com arquivo indisponível NÃO recebe a redação text_only mesmo com opt-in", () => {
    const block = buildNewFlowIdentityBlock({
      legacyDirective: LEGACY_LOGO_NO_ASSET,
      backgroundDirection: "original",
      storeName: STORE_NAME,
      storeBrandColor: null,
      brandProfile: null,
      typographyDirection: TYPOGRAPHY,
      identityState: "logo",
      hasIdentityAsset: false,
      textOnlyInstitutionalIdentity: true,
    });

    expect(block.directive).toBe("Não inventar logotipo.");
    expect(block.directive).not.toContain("Inclua obrigatoriamente o nome da loja");
    expect(block.directive).not.toContain("Direção tipográfica");
  });

  it.each(DIRECTIONS)(
    "prompt final real (%s): nome/tipografia uma única vez, sem a linha comum de logo/assinatura",
    (direction) => {
      for (const palette of [true, false]) {
        const { composed } = composeTextOnly({
          direction,
          palette,
          typography: TYPOGRAPHY,
        });
        const typographyLine = `Direção tipográfica da loja: ${TYPOGRAPHY}.`;

        expect(composed.text.split(
          `Inclua obrigatoriamente o nome da loja "${STORE_NAME}"`,
        )).toHaveLength(2);
        expect(composed.text.split(typographyLine)).toHaveLength(2);
        expect(composed.text).not.toContain(OLD_TEXT_ONLY);
        expect(composed.text).not.toContain(PLACEHOLDER_TOKEN);
        expect(composed.text).not.toContain("sans-serif");
        expect(composed.text).not.toContain(
          PRODUCT_1_1_BACKGROUND_COMMON_ORIENTATION,
        );

        if (direction === "original") {
          expect(composed.text).not.toContain(
            "Garanta contraste para destacar o produto.",
          );
        } else {
          expect(
            composed.text.split("Garanta contraste para destacar o produto."),
          ).toHaveLength(2);
        }
      }
    },
  );
});
