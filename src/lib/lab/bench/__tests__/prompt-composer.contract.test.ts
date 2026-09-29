// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  COMPOSER_VERSION,
  PROMPT_BLOCK_LABELS,
  PROMPT_BLOCK_ORDER,
  composePrompt,
  composePromptBlocks,
} from "../domain/prompt-composer";
import { buildBenchExperimentalBriefing } from "../domain/experimental-briefing";
import { buildBenchCampaignSnapshot } from "../domain/campaign-snapshot";
import type { BenchBrandingContract } from "../domain/branding-service";
import type { BenchConfig, BenchOffer, BenchProduct } from "../domain/schemas";

/**
 * Contrato do **compositor determinístico** da bancada (F48.2.3, D19/D20/D21;
 * spec `lab-bench-prompt-preflight`).
 *
 * Prova, sem nenhuma chamada de rede/IA:
 *  - os 7 blocos canônicos na ordem travada;
 *  - um dado → um bloco (tipografia e `preserveImageContext` sem duplicação);
 *  - blocos vazios omitidos;
 *  - o prompt-base é preservado **verbatim** (inclusive palavras legítimas como
 *    "teste"/"comparação"/"avaliação") — sem filtragem lexical;
 *  - **ausência de contexto experimental por origem**: a verificação incide
 *    sobre os blocos **gerados** pelo compositor (prompt-base vazio), não como
 *    blacklist sobre o prompt completo;
 *  - determinismo: mesma entrada → mesma saída (texto único estável).
 *
 * O `prompt_sent` idêntico ao aprovado via adapter gravador é comprovado no
 * Plano 07; aqui garantimos que a saída do compositor é um texto único estável.
 */

const STORE_ID = "11111111-1111-4111-8111-111111111111";

const CONFIG: BenchConfig = {
  pipeline: "manual-direto",
  formato: "1:1",
  modelo: "gpt-image-2",
  qualidade: "low",
  intencao: "oferta",
  tipoConteudo: "produto",
  estrutura: "peca-unica",
  tema: "nenhum",
};

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeBranding(overrides: Partial<BenchBrandingContract> = {}): BenchBrandingContract {
  return {
    storeId: STORE_ID,
    storeName: "Loja Exemplo",
    segment: "moda-calcados-acessorios",
    subsegment: null,
    toneOfVoice: null,
    positioning: null,
    shortDescription: null,
    slogan: null,
    typographyDirection: "Poppins para títulos; Open Sans para textos",
    safeColorTokens: {},
    brandColorsChosen: ["#22C55E"],
    inferredPrimaryColor: null,
    storeBrandColor: null,
    brandColor: "#22C55E",
    logoColorsDetected: [],
    visualStyle: "Minimalista",
    visualTone: "Comercial",
    brandPersonality: "Próxima e confiável",
    campaignGuidelines: "Sempre destacar o preço",
    campaignBrief: "Campanha focada em oferta de moda",
    profileSource: "full",
    profileStatus: "synced",
    logoUrl: null,
    signatureUrl: null,
    assets: [],
    ...overrides,
  };
}

function makeProduct(overrides: Partial<BenchProduct> = {}): BenchProduct {
  return {
    name: "Camiseta básica",
    description: "100% algodão",
    priceCents: 4990,
    originalPriceCents: 9990,
    mandatoryArtworkText: "Imagem meramente ilustrativa",
    preserveImageContext: false,
    ...overrides,
  };
}

function makeOffer(overrides: Partial<BenchOffer> = {}): BenchOffer {
  return {
    badge: "50% OFF",
    validity: "até 31/12/2026",
    showIllustrativeNotice: true,
    ...overrides,
  };
}

interface BriefingFixture {
  briefing: ReturnType<typeof buildBenchExperimentalBriefing>;
  snapshot: ReturnType<typeof buildBenchCampaignSnapshot>;
}

function makeBriefing(overrides: {
  branding?: Partial<BenchBrandingContract>;
  product?: Partial<BenchProduct>;
  offer?: Partial<BenchOffer>;
} = {}): BriefingFixture {
  const snapshot = buildBenchCampaignSnapshot({
    product: makeProduct(overrides.product),
    offer: makeOffer(overrides.offer),
    config: CONFIG,
  });
  const briefing = buildBenchExperimentalBriefing({
    branding: makeBranding(overrides.branding),
    snapshot,
    config: CONFIG,
  });
  return { briefing, snapshot };
}

/** Destaque (não-oferta) com `preserveImageContext` ligado. */
function spotlightBriefing(): BriefingFixture {
  return makeBriefing({
    offer: { campaignIntent: "spotlight", badge: "", validity: "" },
    product: {
      priceCents: 4990,
      originalPriceCents: undefined,
      preserveImageContext: true,
    },
  });
}

const PROMPT_BASE = "Crie uma arte comercial clara e legível.";

// ─── Blocos canônicos ────────────────────────────────────────────────────────

describe("compositor — estrutura de blocos canônicos", () => {
  it("usa os 7 blocos canônicos na ordem travada", () => {
    const { briefing } = makeBriefing();
    const { text, blocks } = composePromptBlocks({ briefing, promptBase: PROMPT_BASE });

    expect(Object.keys(blocks)).toEqual([...PROMPT_BLOCK_ORDER]);

    let cursor = -1;
    for (const label of PROMPT_BLOCK_ORDER) {
      const index = text.indexOf(`[${label}]`);
      expect(index).toBeGreaterThan(cursor);
      cursor = index;
    }
  });

  it("omite blocos vazios (tipografia/condições/prompt-base/restrições)", () => {
    const { briefing } = makeBriefing({
      branding: { typographyDirection: null },
      product: { mandatoryArtworkText: undefined, priceCents: undefined, originalPriceCents: undefined },
      offer: { badge: "", validity: "", showIllustrativeNotice: false },
    });

    const { text, blocks } = composePromptBlocks({ briefing, promptBase: "" });

    expect(Object.keys(blocks)).toEqual([
      PROMPT_BLOCK_LABELS.identity,
      PROMPT_BLOCK_LABELS.product,
      PROMPT_BLOCK_LABELS.intent,
    ]);
    for (const omitted of [
      PROMPT_BLOCK_LABELS.typography,
      PROMPT_BLOCK_LABELS.commercial,
      PROMPT_BLOCK_LABELS.promptBase,
      PROMPT_BLOCK_LABELS.constraints,
    ]) {
      expect(text).not.toContain(`[${omitted}]`);
    }
  });

  it("coloca a direção tipográfica apenas em [DIREÇÃO TIPOGRÁFICA]", () => {
    const { briefing } = makeBriefing();
    const typography = briefing.typographyDirection!;

    const { blocks } = composePromptBlocks({ briefing, promptBase: PROMPT_BASE });

    expect(blocks[PROMPT_BLOCK_LABELS.typography]).toContain(typography);
    const occurrences = Object.values(blocks).filter((content) => content.includes(typography));
    expect(occurrences).toHaveLength(1);
  });

  it("reflete preserveImageContext em [PRODUTO E IMAGENS DE REFERÊNCIA] sem duplicar", () => {
    const { briefing } = spotlightBriefing();
    expect(briefing.commercial.preserveImageContext).toBe(true);

    const { blocks } = composePromptBlocks({ briefing, promptBase: PROMPT_BASE });

    expect(blocks[PROMPT_BLOCK_LABELS.product]).toContain("Preservar imagem original: sim");
    const occurrences = Object.values(blocks).filter((content) =>
      content.includes("Preservar imagem original"),
    );
    expect(occurrences).toHaveLength(1);
  });

  it("não repete deliberadamente o mesmo dado em vários blocos (cor da marca)", () => {
    const { briefing } = makeBriefing();
    const { blocks } = composePromptBlocks({ briefing, promptBase: PROMPT_BASE });

    const occurrences = Object.values(blocks).filter((content) => content.includes("#22C55E"));
    expect(occurrences).toHaveLength(1);
    expect(blocks[PROMPT_BLOCK_LABELS.identity]).toContain("#22C55E");
  });
});

// ─── Preservação do prompt-base ──────────────────────────────────────────────

describe("compositor — preservação integral do prompt-base", () => {
  it("inclui o prompt-base verbatim, sem filtrar palavras legítimas", () => {
    const { briefing } = makeBriefing();
    const promptBase = "Faça um teste desta comparação para avaliação interna da equipe.";

    const { text, blocks } = composePromptBlocks({ briefing, promptBase });

    expect(blocks[PROMPT_BLOCK_LABELS.promptBase]).toBe(promptBase);
    expect(text).toContain(promptBase);
    expect(text).toContain("teste");
    expect(text).toContain("comparação");
    expect(text).toContain("avaliação");
  });
});

// ─── Ausência de contexto experimental (por origem) ──────────────────────────

describe("compositor — ausência de contexto experimental por origem", () => {
  const FORBIDDEN_TERMS = [
    "laboratório",
    "laboratorio",
    "experimento",
    "baseline",
    "comparação",
    "comparacao",
    "avaliação",
    "avaliacao",
  ];

  it("os blocos gerados não introduzem contexto experimental (prompt-base vazio)", () => {
    const { briefing } = makeBriefing();
    // Prompt-base vazio ⇒ o texto é composto apenas pelos blocos GERADOS.
    const { text } = composePromptBlocks({ briefing, promptBase: "" });

    const lowered = text.toLowerCase();
    for (const term of FORBIDDEN_TERMS) {
      expect(lowered, `termo proibido no conteúdo gerado: ${term}`).not.toContain(term);
    }
    expect(lowered).not.toContain("objetivo experimental");
  });

  it("a verificação é por origem: o mesmo termo no prompt-base é preservado", () => {
    const { briefing } = makeBriefing();
    const promptBase = "Considere o baseline e faça uma comparação e avaliação.";

    const { text } = composePromptBlocks({ briefing, promptBase });

    // O termo aparece no prompt-base (preservado), mas não nos blocos gerados.
    expect(text).toContain("baseline");
    expect(text).toContain("comparação");
    expect(text).toContain("avaliação");
  });
});

// ─── Determinismo e pureza ───────────────────────────────────────────────────

describe("compositor — determinismo e pureza", () => {
  it("mesma entrada → mesma saída (texto único estável)", () => {
    const { briefing } = makeBriefing();
    const input = { briefing, promptBase: PROMPT_BASE, references: ["bench/run/inputs/0.png"] };

    const first = composePrompt(input);
    const second = composePrompt(input);

    expect(typeof first).toBe("string");
    expect(first.length).toBeGreaterThan(0);
    expect(first).toBe(second);
  });

  it("inclui as referências de imagem quando fornecidas", () => {
    const { briefing } = makeBriefing();
    const { blocks } = composePromptBlocks({
      briefing,
      promptBase: PROMPT_BASE,
      references: ["bench/run/inputs/0.png", "bench/run/inputs/1.png"],
    });

    expect(blocks[PROMPT_BLOCK_LABELS.product]).toContain("Imagens de referência: 2");
  });

  it("exporta COMPOSER_VERSION como string estática", () => {
    expect(typeof COMPOSER_VERSION).toBe("string");
    expect(COMPOSER_VERSION.length).toBeGreaterThan(0);
  });

  it("o módulo é puro e sem IA (fonte): sem env, rede, provider ou supabase", () => {
    const source = readFileSync(
      path.resolve(process.cwd(), "src/lib/lab/bench/domain/prompt-composer.ts"),
      "utf8",
    );
    expect(source).not.toContain("process.env");
    expect(source).not.toContain("@supabase");
    expect(source).not.toContain("fetch(");
    expect(source).not.toContain("generation_events");
    expect(source).not.toContain("resolveAiCost");
    expect(source).toContain("COMPOSER_VERSION");
  });
});

// ─── Caso do UAT (sem duplicidade) ───────────────────────────────────────────

describe("compositor — caso do UAT (sem duplicidade)", () => {
  it("R$ 8,99 → R$ 7,49, selo Promoção, validade até 03/10/2026 — cada dado uma vez", () => {
    const { briefing } = makeBriefing({
      product: { priceCents: 749, originalPriceCents: 899, mandatoryArtworkText: undefined },
      offer: {
        badge: "Promoção",
        validity: "até 03/10/2026",
        campaignIntent: "offer",
        showIllustrativeNotice: true,
      },
    });

    const { text, blocks } = composePromptBlocks({ briefing, promptBase: PROMPT_BASE });

    const commercial = blocks[PROMPT_BLOCK_LABELS.commercial];
    expect(commercial).toBeDefined();
    expect(commercial).toContain("Preço original:");
    expect(commercial).toContain("8,99");
    expect(commercial).toContain("Preço promocional:");
    expect(commercial).toContain("7,49");
    expect(commercial).toContain("Selo: Promoção");
    expect(commercial).toContain("Validade: até 03/10/2026");

    // Cada valor comercial aparece EXATAMENTE uma vez no prompt compilado.
    for (const value of ["8,99", "7,49", "Promoção", "03/10/2026"]) {
      const occurrences = text.split(value).length - 1;
      expect(occurrences, `duplicidade de "${value}"`).toBe(1);
    }

    // A linha manual "Oferta:" não existe mais em [PRODUTO E IMAGENS DE REFERÊNCIA].
    expect(blocks[PROMPT_BLOCK_LABELS.product]).not.toContain("Oferta:");

    // Aviso ilustrativo (checkbox ligado, sem texto livre) uma única vez.
    expect(text.split("Imagem meramente ilustrativa").length - 1).toBe(1);
  });
});

describe("compositor — restrições combinam aviso + texto livre (buildMandatoryArtworkText)", () => {
  const cases = [
    {
      name: "checkbox ligado + texto livre",
      show: true,
      free: "Válido para retirada na loja",
      included: ["Imagem meramente ilustrativa", "Válido para retirada na loja"],
      omitted: false,
    },
    {
      name: "apenas checkbox",
      show: true,
      free: "",
      included: ["Imagem meramente ilustrativa"],
      omitted: false,
    },
    {
      name: "apenas texto",
      show: false,
      free: "Válido para retirada na loja",
      included: ["Válido para retirada na loja"],
      omitted: false,
    },
    {
      name: "ambos vazios/desligados",
      show: false,
      free: "",
      included: [],
      omitted: true,
    },
  ];

  it.each(cases)("$name", ({ show, free, included, omitted }) => {
    const { briefing } = makeBriefing({
      product: { mandatoryArtworkText: free },
      offer: { showIllustrativeNotice: show },
    });

    const { text, blocks } = composePromptBlocks({ briefing, promptBase: PROMPT_BASE });
    const constraints = blocks[PROMPT_BLOCK_LABELS.constraints];

    if (omitted) {
      expect(constraints).toBeUndefined();
      expect(text).not.toContain("[RESTRIÇÕES E TEXTOS OBRIGATÓRIOS]");
      return;
    }

    expect(constraints).toBeDefined();
    for (const value of included) {
      expect(constraints).toContain(value);
      // O resultado combinado aparece exatamente uma vez no prompt inteiro.
      expect(text.split(value).length - 1).toBe(1);
    }
  });
});
