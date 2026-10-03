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
 * Contrato do **núcleo do compositor determinístico** da bancada (F48.2.4,
 * D1/D7/D19; specs `lab-bench-prompt-policy` + `lab-bench-prompt-preflight`).
 *
 * A partir da F48.2.4 o compositor é um **núcleo neutro contribution-based**: ele
 * não contém regra de dimensão e não emite valores crus de configuração. Este
 * teste usa **contribuições sintéticas** (`{ block, lines }` literais) para provar
 * o comportamento do núcleo **sem** importar `branding-prompt-mapping.ts` /
 * `identity-direction.ts` / `policies/**` (mantém o plano independente).
 *
 * Prova, sem nenhuma chamada de rede/IA:
 *  - os 7 blocos canônicos na ordem travada;
 *  - contribuições mescladas por bloco declarado; blocos vazios omitidos;
 *  - o prompt-base é preservado **verbatim** (inclusive palavras legítimas como
 *    "teste"/"comparação"/"avaliação") — sem filtragem lexical;
 *  - **ausência de contexto experimental por origem**: a verificação incide sobre
 *    os blocos **gerados** pelo compositor (prompt-base vazio), não como blacklist
 *    sobre o prompt completo;
 *  - **neutralidade do núcleo**: sem regra de dimensão e sem emissão de valores
 *    crus de configuração;
 *  - determinismo: mesma entrada → mesma saída (texto único estável + versões).
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

// ─── Contribuições sintéticas (sem importar policies/**) ─────────────────────

const IDENTITY_CONTRIBUTION = {
  block: PROMPT_BLOCK_LABELS.identity,
  lines: ["Loja: Loja Exemplo", "Cor da marca: #22C55E"],
} as const;

const TYPOGRAPHY_CONTRIBUTION = {
  block: PROMPT_BLOCK_LABELS.typography,
  lines: ["Direção tipográfica: Poppins para títulos; Open Sans para textos"],
} as const;

const INTENT_CONTRIBUTION = {
  block: PROMPT_BLOCK_LABELS.intent,
  lines: ["Oferta", "Formato: quadrado 1:1", "Estrutura: peça única"],
} as const;

const ALL_CONTRIBUTIONS = [IDENTITY_CONTRIBUTION, TYPOGRAPHY_CONTRIBUTION, INTENT_CONTRIBUTION];

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
    identityState: "text_only",
    identityReference: null,
    identityReason: "text_only:no_identity_image",
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
    mandatoryArtworkText: "Válido para retirada na loja",
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

function makeBriefing(overrides: {
  branding?: Partial<BenchBrandingContract>;
  product?: Partial<BenchProduct>;
  offer?: Partial<BenchOffer>;
  intent?: BenchConfig["intencao"];
} = {}) {
  const config = { ...CONFIG, intencao: overrides.intent ?? CONFIG.intencao };
  const snapshot = buildBenchCampaignSnapshot({
    product: makeProduct(overrides.product),
    offer: makeOffer(overrides.offer),
    config,
  });
  const briefing = buildBenchExperimentalBriefing({
    branding: makeBranding(overrides.branding),
    snapshot,
    config,
  });
  return { briefing, snapshot };
}

/** Destaque (não-oferta) com `preserveImageContext` ligado. */
function spotlightBriefing() {
  return makeBriefing({
    offer: { campaignIntent: "spotlight", badge: "", validity: undefined },
    intent: "destaque",
    product: {
      priceCents: 4990,
      originalPriceCents: undefined,
      preserveImageContext: true,
    },
  });
}

const PROMPT_BASE = "Crie uma arte comercial clara e legível.";

// ─── Blocos canônicos ────────────────────────────────────────────────────────

describe("núcleo do compositor — estrutura de blocos canônicos", () => {
  it("usa os 7 blocos canônicos na ordem travada (dados + contribuições)", () => {
    const { briefing } = makeBriefing();
    const { text, blocks } = composePromptBlocks({
      briefing,
      promptBase: PROMPT_BASE,
      contributions: ALL_CONTRIBUTIONS,
    });

    expect(Object.keys(blocks)).toEqual([...PROMPT_BLOCK_ORDER]);

    let cursor = -1;
    for (const label of PROMPT_BLOCK_ORDER) {
      const index = text.indexOf(`[${label}]`);
      expect(index).toBeGreaterThan(cursor);
      cursor = index;
    }
  });

  it("omite blocos vazios (identidade/tipografia/comercial/intenção/prompt-base/restrições)", () => {
    const { briefing } = makeBriefing({
      product: {
        mandatoryArtworkText: undefined,
        priceCents: undefined,
        originalPriceCents: undefined,
      },
      offer: { campaignIntent: "exclusive", badge: "", validity: undefined, showIllustrativeNotice: false },
      intent: "exclusivo",
    });

    const { text, blocks } = composePromptBlocks({ briefing, promptBase: "" });

    expect(Object.keys(blocks)).toEqual([PROMPT_BLOCK_LABELS.product]);
    for (const omitted of [
      PROMPT_BLOCK_LABELS.identity,
      PROMPT_BLOCK_LABELS.typography,
      PROMPT_BLOCK_LABELS.commercial,
      PROMPT_BLOCK_LABELS.intent,
      PROMPT_BLOCK_LABELS.promptBase,
      PROMPT_BLOCK_LABELS.constraints,
    ]) {
      expect(text).not.toContain(`[${omitted}]`);
    }
  });

  it("mescla as contribuições no bloco declarado (intenção)", () => {
    const { briefing } = makeBriefing();
    const { blocks } = composePromptBlocks({
      briefing,
      promptBase: PROMPT_BASE,
      contributions: [INTENT_CONTRIBUTION],
    });

    expect(blocks[PROMPT_BLOCK_LABELS.intent]).toBe(INTENT_CONTRIBUTION.lines.join("\n"));
  });

  it("coloca a direção tipográfica sintética apenas em [DIREÇÃO TIPOGRÁFICA]", () => {
    const { briefing } = makeBriefing();
    const { blocks } = composePromptBlocks({
      briefing,
      promptBase: PROMPT_BASE,
      contributions: [TYPOGRAPHY_CONTRIBUTION],
    });

    const line = TYPOGRAPHY_CONTRIBUTION.lines[0];
    expect(blocks[PROMPT_BLOCK_LABELS.typography]).toContain(line);
    const occurrences = Object.values(blocks).filter((content) => content.includes(line));
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
});

// ─── Neutralidade do núcleo (sem regra de dimensão) ──────────────────────────

describe("núcleo do compositor — neutralidade", () => {
  it("não emite valores crus de configuração (sem contribuições de intenção)", () => {
    const { briefing } = makeBriefing();
    const { text, blocks } = composePromptBlocks({ briefing, promptBase: PROMPT_BASE });

    expect(blocks[PROMPT_BLOCK_LABELS.intent]).toBeUndefined();
    for (const raw of ["Intenção:", "Formato:", "Tipo de conteúdo:", "Estrutura:", "Tema:"]) {
      expect(text).not.toContain(raw);
    }
  });

  it("a fonte do núcleo não contém regra de dimensão nem emite config cru", () => {
    const source = readFileSync(
      path.resolve(process.cwd(), "src/lib/lab/bench/domain/prompt-composer.ts"),
      "utf8",
    );

    // Removidos do núcleo (movidos para as políticas/Planos 03-04):
    for (const removed of ["briefing.config", "briefing.commercial.intent", "intentLines", "identityLines", "typographyLines"]) {
      expect(source, `núcleo não deve conter ${removed}`).not.toContain(removed);
    }
    // Sem literais de valor de dimensão (as regras vivem nas políticas):
    for (const literal of ['"oferta"', '"destaque"', '"exclusivo"', '"peca-unica"', '"carrossel"', '"nenhum"', '"1:1"', '"9:16"', '"produto"']) {
      expect(source, `núcleo não deve conter literal ${literal}`).not.toContain(literal);
    }
    // Sem rótulos crus de configuração:
    for (const rawLabel of ["Intenção", "Tipo de conteúdo", "Estrutura:", "Tema:"]) {
      expect(source, `núcleo não deve conter rótulo ${rawLabel}`).not.toContain(rawLabel);
    }
  });
});

// ─── Preservação do prompt-base ──────────────────────────────────────────────

describe("núcleo do compositor — preservação integral do prompt-base", () => {
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

describe("núcleo do compositor — ausência de contexto experimental por origem", () => {
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
    const { text } = composePromptBlocks({
      briefing,
      promptBase: "",
      contributions: ALL_CONTRIBUTIONS,
    });

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

    expect(text).toContain("baseline");
    expect(text).toContain("comparação");
    expect(text).toContain("avaliação");
  });
});

// ─── Determinismo e pureza ───────────────────────────────────────────────────

describe("núcleo do compositor — determinismo e pureza", () => {
  it("mesma entrada → mesma saída (texto único estável + versões)", () => {
    const { briefing } = makeBriefing();
    const input = {
      briefing,
      promptBase: PROMPT_BASE,
      references: ["bench/run/inputs/0.png"],
      contributions: ALL_CONTRIBUTIONS,
      policyVersions: { intencao: "v1" },
    };

    const first = composePromptBlocks(input);
    const second = composePromptBlocks(input);

    expect(typeof first.text).toBe("string");
    expect(first.text.length).toBeGreaterThan(0);
    expect(first.text).toBe(second.text);
    expect(first.composerVersion).toBe(COMPOSER_VERSION);
    expect(first.policyVersions).toEqual({ intencao: "v1" });
  });

  it("composePrompt devolve o texto do núcleo", () => {
    const { briefing } = makeBriefing();
    const input = { briefing, promptBase: PROMPT_BASE, contributions: ALL_CONTRIBUTIONS };
    expect(composePrompt(input)).toBe(composePromptBlocks(input).text);
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

  it("exporta COMPOSER_VERSION como string estática da fase", () => {
    expect(typeof COMPOSER_VERSION).toBe("string");
    expect(COMPOSER_VERSION).toBe("48.2.4-prompt-composer-v2");
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

// ─── Restrições combinam aviso + texto livre (buildMandatoryArtworkText) ─────

describe("núcleo do compositor — restrições combinam aviso + texto livre", () => {
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
