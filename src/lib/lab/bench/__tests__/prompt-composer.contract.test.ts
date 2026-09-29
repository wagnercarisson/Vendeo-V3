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
    text: "Oferta especial da semana",
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
    const { briefing, snapshot } = makeBriefing();
    const { text, blocks } = composePromptBlocks({ briefing, snapshot, promptBase: PROMPT_BASE });

    expect(Object.keys(blocks)).toEqual([...PROMPT_BLOCK_ORDER]);

    let cursor = -1;
    for (const label of PROMPT_BLOCK_ORDER) {
      const index = text.indexOf(`[${label}]`);
      expect(index).toBeGreaterThan(cursor);
      cursor = index;
    }
  });

  it("omite blocos vazios (tipografia/condições/prompt-base/restrições)", () => {
    const { briefing, snapshot } = makeBriefing({
      branding: { typographyDirection: null },
      product: { mandatoryArtworkText: undefined, priceCents: undefined, originalPriceCents: undefined },
      offer: { badge: "", validity: "" },
    });

    const { text, blocks } = composePromptBlocks({ briefing, snapshot, promptBase: "" });

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
    const { briefing, snapshot } = makeBriefing();
    const typography = briefing.typographyDirection!;

    const { blocks } = composePromptBlocks({ briefing, snapshot, promptBase: PROMPT_BASE });

    expect(blocks[PROMPT_BLOCK_LABELS.typography]).toContain(typography);
    const occurrences = Object.values(blocks).filter((content) => content.includes(typography));
    expect(occurrences).toHaveLength(1);
  });

  it("reflete preserveImageContext em [PRODUTO E IMAGENS DE REFERÊNCIA] sem duplicar", () => {
    const { briefing, snapshot } = spotlightBriefing();
    expect(briefing.commercial.preserveImageContext).toBe(true);

    const { blocks } = composePromptBlocks({ briefing, snapshot, promptBase: PROMPT_BASE });

    expect(blocks[PROMPT_BLOCK_LABELS.product]).toContain("Preservar imagem original: sim");
    const occurrences = Object.values(blocks).filter((content) =>
      content.includes("Preservar imagem original"),
    );
    expect(occurrences).toHaveLength(1);
  });

  it("não repete deliberadamente o mesmo dado em vários blocos (cor da marca)", () => {
    const { briefing, snapshot } = makeBriefing();
    const { blocks } = composePromptBlocks({ briefing, snapshot, promptBase: PROMPT_BASE });

    const occurrences = Object.values(blocks).filter((content) => content.includes("#22C55E"));
    expect(occurrences).toHaveLength(1);
    expect(blocks[PROMPT_BLOCK_LABELS.identity]).toContain("#22C55E");
  });
});

// ─── Preservação do prompt-base ──────────────────────────────────────────────

describe("compositor — preservação integral do prompt-base", () => {
  it("inclui o prompt-base verbatim, sem filtrar palavras legítimas", () => {
    const { briefing, snapshot } = makeBriefing();
    const promptBase = "Faça um teste desta comparação para avaliação interna da equipe.";

    const { text, blocks } = composePromptBlocks({ briefing, snapshot, promptBase });

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
    const { briefing, snapshot } = makeBriefing();
    // Prompt-base vazio ⇒ o texto é composto apenas pelos blocos GERADOS.
    const { text } = composePromptBlocks({ briefing, snapshot, promptBase: "" });

    const lowered = text.toLowerCase();
    for (const term of FORBIDDEN_TERMS) {
      expect(lowered, `termo proibido no conteúdo gerado: ${term}`).not.toContain(term);
    }
    expect(lowered).not.toContain("objetivo experimental");
  });

  it("a verificação é por origem: o mesmo termo no prompt-base é preservado", () => {
    const { briefing, snapshot } = makeBriefing();
    const promptBase = "Considere o baseline e faça uma comparação e avaliação.";

    const { text } = composePromptBlocks({ briefing, snapshot, promptBase });

    // O termo aparece no prompt-base (preservado), mas não nos blocos gerados.
    expect(text).toContain("baseline");
    expect(text).toContain("comparação");
    expect(text).toContain("avaliação");
  });
});

// ─── Determinismo e pureza ───────────────────────────────────────────────────

describe("compositor — determinismo e pureza", () => {
  it("mesma entrada → mesma saída (texto único estável)", () => {
    const { briefing, snapshot } = makeBriefing();
    const input = { briefing, snapshot, promptBase: PROMPT_BASE, references: ["bench/run/inputs/0.png"] };

    const first = composePrompt(input);
    const second = composePrompt(input);

    expect(typeof first).toBe("string");
    expect(first.length).toBeGreaterThan(0);
    expect(first).toBe(second);
  });

  it("inclui as referências de imagem quando fornecidas", () => {
    const { briefing, snapshot } = makeBriefing();
    const { blocks } = composePromptBlocks({
      briefing,
      snapshot,
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
