// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import { DEFAULT_BENCH_CONFIG, type BenchRecorteConfig } from "../domain/config-registry";
import { buildBenchCampaignSnapshot } from "../domain/campaign-snapshot";
import { buildBenchExperimentalBriefing } from "../domain/experimental-briefing";
import { PROMPT_BLOCK_LABELS, composePromptBlocks } from "../domain/prompt-composer";
import {
  BENCH_DEFAULT_PROMPT_BASE,
  BENCH_DEFAULT_PROMPT_BASE_VERSION,
  BenchPromptBaseError,
  resolveBenchDefaultPromptBase,
} from "../domain/prompt-base";
import type { BenchBrandingContract } from "../domain/branding-service";
import type { BenchConfig, BenchOffer, BenchProduct } from "../domain/schemas";

/**
 * Contrato do **prompt-base padrão versionado e resolvido por configuração** da
 * bancada (F48.2.4, D6/D7; spec `lab-bench-prompt-base`).
 *
 * Prova, sem nenhuma chamada de rede/IA:
 *  - carregamento do padrão do recorte e resolução **por configuração** (chaveada
 *    pelo recorte multidimensional);
 *  - conteúdo **apenas complementar** (não repete a hierarquia de oferta nem o
 *    formato 1:1 das políticas);
 *  - **preservação integral** do prompt-base (padrão e editado) pelo compositor —
 *    verbatim, sem filtragem lexical;
 *  - **determinismo** com a entrada editada (mesma entrada ⇒ mesma saída);
 *  - **ausência de geração/revisão por IA** e de qualquer chamada de rede (módulo
 *    puro, estático e auto-contido).
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

const PROMPT_BASE_SOURCE = "src/lib/lab/bench/domain/prompt-base.ts";

// ─── Fixtures (puras, sem I/O) ───────────────────────────────────────────────

function makeBranding(): BenchBrandingContract {
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
  };
}

function makeProduct(): BenchProduct {
  return {
    name: "Camiseta básica",
    description: "100% algodão",
    priceCents: 4990,
    originalPriceCents: 9990,
    mandatoryArtworkText: "Válido para retirada na loja",
    preserveImageContext: false,
  };
}

function makeOffer(): BenchOffer {
  return {
    badge: "50% OFF",
    validity: "até 31/12/2026",
    showIllustrativeNotice: true,
  };
}

function makeBriefing(config: BenchConfig = CONFIG) {
  const snapshot = buildBenchCampaignSnapshot({
    product: makeProduct(),
    offer: makeOffer(),
    config,
  });
  return buildBenchExperimentalBriefing({ branding: makeBranding(), snapshot, config });
}

/** Compõe o núcleo com o prompt-base informado (preservação verbatim). */
function compose(promptBase: string, config: BenchConfig = CONFIG) {
  return composePromptBlocks({ briefing: makeBriefing(config), promptBase });
}

// ─── Carregamento e resolução por configuração ───────────────────────────────

describe("prompt-base — carregamento e resolução por configuração", () => {
  it("resolve o padrão do recorte Oferta 1:1 com versão e conteúdo", () => {
    const base = resolveBenchDefaultPromptBase(DEFAULT_BENCH_CONFIG);

    expect(base.version).toBe(BENCH_DEFAULT_PROMPT_BASE_VERSION);
    expect(base.content).toBe(BENCH_DEFAULT_PROMPT_BASE.content);
    expect(base.content.trim().length).toBeGreaterThan(0);
    expect(base.content).toBe("Crie uma peça profissional e visualmente coerente. Evite elementos decorativos que distraiam do conteúdo principal.");
  });

  it("exporta uma versão estável da fase (string)", () => {
    expect(typeof BENCH_DEFAULT_PROMPT_BASE_VERSION).toBe("string");
    expect(BENCH_DEFAULT_PROMPT_BASE_VERSION).toBe("48.2.6-produto-1-1-v1");
  });

  it("é chaveado pelo recorte multidimensional (ignora modelo/qualidade)", () => {
    const fromRecorte: BenchRecorteConfig = { ...DEFAULT_BENCH_CONFIG };
    const fromFullConfig = resolveBenchDefaultPromptBase(CONFIG);
    const fromOtherPreset = resolveBenchDefaultPromptBase({
      ...CONFIG,
      modelo: "gpt-image-2.5-flare",
      qualidade: "medium",
    });

    expect(resolveBenchDefaultPromptBase(fromRecorte)).toEqual(fromFullConfig);
    // modelo/qualidade não pertencem ao recorte governado ⇒ mesmo padrão.
    expect(fromOtherPreset).toEqual(fromFullConfig);
  });

  it("mesma entrada ⇒ mesma saída (determinismo da resolução)", () => {
    expect(resolveBenchDefaultPromptBase(CONFIG)).toEqual(resolveBenchDefaultPromptBase(CONFIG));
  });

  it.each(["oferta", "destaque", "exclusivo"] as const)("intenção %s resolve o mesmo objeto neutro", (intencao) => {
    const base = resolveBenchDefaultPromptBase({ ...DEFAULT_BENCH_CONFIG, intencao });
    expect(base).toBe(BENCH_DEFAULT_PROMPT_BASE);
    expect(base.version).toBe(BENCH_DEFAULT_PROMPT_BASE_VERSION);
    expect(base.content).toBe("Crie uma peça profissional e visualmente coerente. Evite elementos decorativos que distraiam do conteúdo principal.");
  });

  it("recorte sem padrão falha de forma determinística", () => {
    const unsupported = { ...DEFAULT_BENCH_CONFIG, tipoConteudo: "servico" };

    let error: unknown;
    try {
      resolveBenchDefaultPromptBase(unsupported);
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(BenchPromptBaseError);
    expect((error as BenchPromptBaseError).code).toBe("bench_prompt_base_not_found");
    expect((error as BenchPromptBaseError).message).toContain("bench_prompt_base_not_found");
  });
});

// ─── Conteúdo apenas complementar ────────────────────────────────────────────

describe("prompt-base — conteúdo apenas complementar", () => {
  it("não repete a hierarquia de oferta nem o formato 1:1 das políticas", () => {
    const content = BENCH_DEFAULT_PROMPT_BASE.content.toLowerCase();

    const ofertaHierarchy = [
      "preço promocional",
      "preco promocional",
      "preço original",
      "preco original",
      "desconto",
      "selo",
      "validade",
      "hierarquia comercial",
      "textos comerciais",
    ];
    const formatoOrientations = ["quadrado", "1:1", "formato"];
    const estruturaOrientation = "peça única";

    for (const term of [...ofertaHierarchy, ...formatoOrientations, estruturaOrientation]) {
      expect(content, `padrão não deve repetir "${term}"`).not.toContain(term);
    }
    for (const term of ["oferta", "destaque", "exclusivo", "preço", "preco"]) {
      expect(content).not.toContain(term);
    }
  });
});

// ─── Preservação integral (padrão e editado) ─────────────────────────────────

describe("prompt-base — preservação integral pelo compositor", () => {
  it("inclui o padrão verbatim em [INSTRUÇÕES DO PROMPT-BASE]", () => {
    const { text, blocks } = compose(BENCH_DEFAULT_PROMPT_BASE.content);

    expect(blocks[PROMPT_BLOCK_LABELS.promptBase]).toBe(BENCH_DEFAULT_PROMPT_BASE.content);
    expect(text).toContain(BENCH_DEFAULT_PROMPT_BASE.content);
  });

  it("preserva o prompt-base editado sem reescrita nem filtragem lexical", () => {
    const edited = [
      "Edição do operador:",
      "Faça um teste desta comparação para avaliação interna.",
      "Repetir: acabamento acabamento acabamento.",
      "   Espaços e linhas\n\npreservados.   ",
    ].join("\n");

    const { text, blocks } = compose(edited);

    expect(blocks[PROMPT_BLOCK_LABELS.promptBase]).toBe(edited);
    expect(text).toContain(edited);
    // Palavras legítimas do operador não são filtradas.
    expect(text).toContain("teste");
    expect(text).toContain("comparação");
    expect(text).toContain("avaliação");
    expect(text).toContain("acabamento acabamento acabamento");
  });
});

// ─── Determinismo com entrada editada ────────────────────────────────────────

describe("prompt-base — determinismo com entrada editada", () => {
  it("mesma entrada editada ⇒ exatamente a mesma saída", () => {
    const edited = "Direção manual: contraste alto e fundo escuro.";

    const first = compose(edited);
    const second = compose(edited);

    expect(first.text).toBe(second.text);
    expect(first.blocks).toEqual(second.blocks);
  });
});

// ─── Sem IA/rede: pureza e auto-contenção ────────────────────────────────────

describe("prompt-base — sem geração/revisão por IA", () => {
  it("o módulo é puro, estático e sem rede/IA (fonte)", () => {
    const source = readFileSync(path.resolve(process.cwd(), PROMPT_BASE_SOURCE), "utf8");

    for (const forbidden of [
      "process.env",
      "createClient",
      "openai",
      "anthropic",
      "@supabase",
      "fetch(",
      "generation_events",
    ]) {
      expect(source, `módulo não deve conter ${forbidden}`).not.toContain(forbidden);
    }
    expect(source).toContain("BENCH_DEFAULT_PROMPT_BASE_VERSION");
    expect(source).toContain("resolveBenchDefaultPromptBase");
  });

  it("é auto-contido (não importa policies/**, branding-prompt-mapping ou identity-direction)", () => {
    const source = readFileSync(path.resolve(process.cwd(), PROMPT_BASE_SOURCE), "utf8");

    for (const forbidden of ["./policies", "branding-prompt-mapping", "identity-direction"]) {
      expect(source, `módulo não deve importar ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("a resolução é síncrona (sem promessa/async) — nenhum provider é consultado", () => {
    const result = resolveBenchDefaultPromptBase(CONFIG);

    expect(result).not.toBeInstanceOf(Promise);
    expect(typeof result.version).toBe("string");
    expect(typeof result.content).toBe("string");
  });
});
