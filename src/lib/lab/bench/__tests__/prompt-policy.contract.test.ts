// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import { BenchConfigRegistryError } from "../domain/config-registry";
import { buildBenchCampaignSnapshot } from "../domain/campaign-snapshot";
import { buildBenchExperimentalBriefing } from "../domain/experimental-briefing";
import { COMPOSER_VERSION, PROMPT_BLOCK_LABELS, composePromptBlocks } from "../domain/prompt-composer";
import type { BenchBrandingContract } from "../domain/branding-service";
import type { BenchConfig, BenchOffer, BenchProduct } from "../domain/schemas";
import { ofertaPolicy } from "../domain/policies/oferta";
import { destaquePolicy } from "../domain/policies/destaque";
import { exclusivoPolicy } from "../domain/policies/exclusivo";
import { EXCLUSIVO_POLICY_VERSION } from "../domain/policies/exclusivo";
import { produtoPolicy } from "../domain/policies/produto";
import { generalIntegrityPolicy } from "../domain/policies/general-integrity";
import { temaNenhumPolicy } from "../domain/policies/tema-nenhum";
import { BADGE_OPTIONS_BY_INTENT } from "@/lib/constants";
import { BENCH_PROMPT_POLICY_REGISTRY } from "../domain/policies/registry";
import {
  BenchPromptPolicyError,
  resolveBenchPromptPolicies,
} from "../domain/policies/resolve-bench-prompt-policies";

/**
 * Contrato das **políticas de prompt** da bancada (F48.2.4, D1/D2/D3/D4/D5/D7;
 * specs `lab-bench-prompt-policy` + `lab-bench-prompt-preflight`).
 *
 * Prova, sem nenhuma chamada de rede/IA:
 *  - resolução explícita das 5 dimensões habilitadas (contribuições + versões);
 *  - determinismo (mesma entrada ⇒ mesma saída);
 *  - linguagem natural ("Oferta", "quadrado 1:1", "peça única");
 *  - omissão do tema neutro `nenhum`;
 *  - ausência de redundância no conteúdo gerado;
 *  - **atribuição exclusiva por política** (`oferta`×`produto` disjuntos);
 *  - **golden do prompt completo** do recorte Oferta 1:1 (complementar);
 *  - negativos para cada combinação não habilitada (falha antes da chamada paga);
 *  - `bench_policy_not_implemented` para dimensão habilitada sem política;
 *  - neutralidade do núcleo (sem regra de dimensão).
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

const PROMPT_BASE = "Crie uma arte comercial clara e legível.";
const NBSP = "\u00A0";

// ─── Fixtures ────────────────────────────────────────────────────────────────

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
  };
}

function makeOffer(): BenchOffer {
  return {
    backgroundDirection: "studio",
    badge: "50% OFF",
    validity: "até 31/12/2026",
    showIllustrativeNotice: true,
  };
}

function makeBriefing(config: BenchConfig = CONFIG, product = makeProduct(), offer = makeOffer()) {
  const snapshot = buildBenchCampaignSnapshot({
    product,
    offer,
    config,
  });
  return buildBenchExperimentalBriefing({ branding: makeBranding(), snapshot, config });
}

/** Compõe o recorte com as contribuições resolvidas das políticas. */
function composeResolved(
  config: BenchConfig = CONFIG,
  promptBase = PROMPT_BASE,
  references?: readonly string[],
  product = makeProduct(),
): string {
  const { contributions } = resolveBenchPromptPolicies(config, undefined, { references });
  return composePromptBlocks({ briefing: makeBriefing(config, product), promptBase, contributions, references }).text;
}

// ─── Resolução explícita e versionada ────────────────────────────────────────

describe("políticas — resolução explícita e versionada", () => {
  it.each(["oferta", "destaque", "exclusivo"] as const)("propaga todas as três direções de fundo para %s", (intent) => {
    const campaignIntent = intent === "oferta" ? "offer" : intent === "destaque" ? "spotlight" : "exclusive";
    const product = intent === "oferta"
      ? { name: "Produto", priceCents: 500, originalPriceCents: 1000 }
      : intent === "destaque" ? { name: "Produto", priceCents: 500 } : { name: "Produto" };
    const directions = ["studio", "ambient", "original"] as const;
    for (const direction of directions) {
      const config = { ...CONFIG, intencao: intent } as BenchConfig;
      const snapshot = buildBenchCampaignSnapshot({ product, offer: { campaignIntent, backgroundDirection: direction }, config });
      const briefing = buildBenchExperimentalBriefing({ branding: makeBranding(), snapshot, config });
      const resolved = resolveBenchPromptPolicies(config);
      const text = composePromptBlocks({ briefing, promptBase: "", contributions: resolved.contributions }).text;
      expect(snapshot.backgroundDirection).toBe(direction);
      expect(text).toContain(`Direção de fundo: ${{
        studio: "Use um fundo de estúdio discreto, em cor sólida ou gradiente suave, sem cenário ou objetos de apoio.",
        ambient: "Crie um cenário ambientado coerente com o produto e a marca, sem prejudicar a leitura.",
        original: "Mantenha o cenário da imagem enviada como base; não o substitua por outro.",
      }[direction]}`);
    }
  });

  it("resolve as 5 dimensões habilitadas com contribuições e versões", () => {
    const resolved = resolveBenchPromptPolicies(CONFIG);

    expect(Object.keys(resolved.versions)).toEqual([
      "intencao",
      "formato",
      "tipoConteudo",
      "estrutura",
      "tema",
      "geral",
    ]);
    for (const version of Object.values(resolved.versions)) {
      expect(version.length).toBeGreaterThan(0);
    }
    expect(resolved.contributions.length).toBeGreaterThan(0);
  });

  it.each([
    { intent: "oferta", policy: ofertaPolicy, line: "Oferta: destaque o preço por e mantenha o preço de como secundário, quando informado. Não invente informações comerciais." },
    { intent: "destaque", policy: destaquePolicy, line: "Destaque: priorize a apresentação do produto; preço informado é secundário." },
    { intent: "exclusivo", policy: exclusivoPolicy, line: "Exclusivo: apresente o produto sem preço em uma composição editorial, sóbria e arejada, com hierarquia discreta e sem chamadas promocionais. Respeite os selos informados sem inventar informações." },
  ])("resolve $intent por valor habilitado", ({ intent, policy, line }) => {
    const config = { ...CONFIG, intencao: intent } as BenchConfig;
    const resolved = resolveBenchPromptPolicies(config);
    expect(BENCH_PROMPT_POLICY_REGISTRY.intencao?.[intent]).toBe(policy);
    expect(resolved.contributions.flatMap((entry) => entry.lines)).toContain(line);
    expect(resolved.versions.intencao).toBe(policy.version);
  });

  it("mesma entrada ⇒ mesma saída (determinismo)", () => {
    const first = resolveBenchPromptPolicies(CONFIG);
    const second = resolveBenchPromptPolicies(CONFIG);

    expect(first).toEqual(second);
    expect(composeResolved()).toBe(composeResolved());
  });

  it("versiona a serialização neutra do preço de venda sem alterar a política Oferta", () => {
    expect(COMPOSER_VERSION).toBe("48.2.4-prompt-composer-v5");
    expect(ofertaPolicy.version).toBe("48.2.6-oferta-v1");
    expect(ofertaPolicy.contributions({ config: CONFIG }).flatMap((entry) => entry.lines)).toContain(
      "Oferta: destaque o preço por e mantenha o preço de como secundário, quando informado. Não invente informações comerciais.",
    );
    expect(composeResolved()).toContain(`Preço de venda: R$${NBSP}49,90`);
  });

  it("não duplica o ponto final de um nome e mantém a redação normal inalterada", () => {
    const prompt = composeResolved(CONFIG, "", ["bench/product.png"], {
      ...makeProduct(),
      name: "Johnnie Walker.",
    });

    expect(prompt).toContain("Nome obrigatório na arte: Johnnie Walker. Inclua todas as palavras, números e unidades; capitalização, quebras de linha e arranjo livres.");
    expect(prompt).not.toContain("Johnnie Walker.. Inclua");
    expect(composeResolved(CONFIG, "", ["bench/product.png"])).toContain(
      "Nome obrigatório na arte: Camiseta básica. Inclua todas as palavras, números e unidades; capitalização, quebras de linha e arranjo livres.",
    );
  });

  it("versiona as instruções do produto conforme a contagem de imagens", () => {
    const singleImageLines = produtoPolicy.contributions({ config: CONFIG, references: ["product-1.png"] }).flatMap((entry) => entry.lines);
    const multiImageLines = produtoPolicy.contributions({ config: CONFIG, references: ["product-1.png", "product-2.png"] }).flatMap((entry) => entry.lines);
    expect(produtoPolicy.version).toBe("48.2.6-produto-v4");
    expect(singleImageLines).toContain("Produto como elemento principal da peça. Reproduza com fidelidade o produto da imagem enviada, incluindo aparência e embalagem.");
    expect(singleImageLines.join(" ")).not.toContain("primeira imagem");
    expect(singleImageLines.join(" ")).not.toContain("variante protagonista");
    expect(singleImageLines.join(" ")).not.toContain("imagens auxiliares");
    expect(multiImageLines).toContain("A primeira imagem enviada define a variante protagonista: apresente-a maior e em primeiro plano; use as imagens auxiliares como apoio visual secundário.");
    expect(multiImageLines.filter((line) => line === "Reproduza com fidelidade o produto da imagem enviada, incluindo aparência e embalagem.")).toHaveLength(1);
    expect(singleImageLines.join(" ").toLowerCase()).not.toContain("garantia de aparição");
    expect(multiImageLines.join(" ").toLowerCase()).not.toContain("layout programático");
  });

  it.each([
    { intent: "oferta" as const, campaignIntent: "offer" as const },
    { intent: "destaque" as const, campaignIntent: "spotlight" as const },
    { intent: "exclusivo" as const, campaignIntent: "exclusive" as const },
  ])("compila uma e várias imagens sem duplicar instruções para $intent", ({ intent, campaignIntent }) => {
    const config = { ...CONFIG, intencao: intent } as BenchConfig;
    const product = {
      ...makeProduct(),
      name: "Johnnie Walker Black Label 750ml",
      priceCents: intent === "exclusivo" ? undefined : 4990,
      originalPriceCents: intent === "oferta" ? 9990 : undefined,
    };
    const offer = {
      ...makeOffer(),
      campaignIntent,
      badge: intent === "oferta" ? "50% OFF" : "",
      validity: intent === "oferta" ? "até 31/12/2026" : undefined,
    };
    const briefing = makeBriefing(config, product, offer);
    const singleReferences = ["bench/product-1.png"];
    const multipleReferences = [...singleReferences, "bench/product-2.png"];
    const expectedName = "Nome obrigatório na arte: Johnnie Walker Black Label 750ml. Inclua todas as palavras, números e unidades; capitalização, quebras de linha e arranjo livres.";
    const expectedOneImage = "Produto como elemento principal da peça. Reproduza com fidelidade o produto da imagem enviada, incluindo aparência e embalagem.";
    const expectedMultipleImageFidelity = "Reproduza com fidelidade o produto da imagem enviada, incluindo aparência e embalagem.";
    const expectedMultipleImageHierarchy = "A primeira imagem enviada define a variante protagonista: apresente-a maior e em primeiro plano; use as imagens auxiliares como apoio visual secundário.";

    for (const references of [singleReferences, multipleReferences]) {
      const policies = resolveBenchPromptPolicies(config, undefined, { briefing, references });
      const composition = composePromptBlocks({ briefing, promptBase: "", references, contributions: policies.contributions, policyVersions: policies.versions });
      expect(policies.versions.tipoConteudo).toBe("48.2.6-produto-v4");
      expect(composition.text.split(expectedName)).toHaveLength(2);
      expect(composition.text).not.toContain("Nome: completo");
      expect(composition.text).not.toContain("Nome do produto obrigatório:");
      if (references.length === 1) {
        expect(composition.text.split(expectedOneImage)).toHaveLength(2);
        expect(composition.text).not.toContain("primeira imagem");
        expect(composition.text).not.toContain("variante protagonista");
        expect(composition.text).not.toContain("imagens auxiliares");
      } else {
        expect(composition.text).toContain(expectedMultipleImageHierarchy);
        expect(composition.text.split(expectedMultipleImageFidelity)).toHaveLength(2);
      }
    }
  });

  it("versiona a política geral uma vez sem adicioná-la às dimensões configuráveis", () => {
    const resolved = resolveBenchPromptPolicies(CONFIG);
    const generalLines = generalIntegrityPolicy.contributions().flatMap((entry) => entry.lines);
    const resolvedGeneralLines = resolved.contributions
      .flatMap((entry) => entry.lines)
      .filter((line) => generalLines.includes(line));

    expect(generalIntegrityPolicy.version).toBe("48.2.5-general-integrity-v1");
    expect(resolved.versions.geral).toBe(generalIntegrityPolicy.version);
    expect(BENCH_PROMPT_POLICY_REGISTRY).not.toHaveProperty("geral");
    expect(resolvedGeneralLines).toEqual(generalLines);
  });

  it("cada política declara apenas blocos canônicos", () => {
    const { contributions } = resolveBenchPromptPolicies(CONFIG);
    const canonical = new Set(Object.values(PROMPT_BLOCK_LABELS));
    for (const contribution of contributions) {
      expect(canonical.has(contribution.block)).toBe(true);
    }
  });
});

describe("política Exclusivo v2 — composição e selos fornecidos", () => {
  const instruction = "Exclusivo: apresente o produto sem preço em uma composição editorial, sóbria e arejada, com hierarquia discreta e sem chamadas promocionais. Respeite os selos informados sem inventar informações.";
  const exclusiveConfig = { ...CONFIG, intencao: "exclusivo" } as BenchConfig;

  it.each([
    { label: "sem selo", badge: undefined, serialized: undefined },
    { label: "selo Exclusivo", badge: "Exclusivo", serialized: "Selo: Exclusivo" },
    { label: "selo Edição Limitada", badge: "Edição Limitada", serialized: "Selo: Edição Limitada" },
  ])("compõe v2 $label sem preço nem selo não fornecido", ({ badge, serialized }) => {
    const snapshot = buildBenchCampaignSnapshot({
      product: { name: "Produto de teste", priceCents: undefined, originalPriceCents: undefined },
      offer: { campaignIntent: "exclusive", backgroundDirection: "studio", ...(badge ? { badge } : {}), showIllustrativeNotice: false },
      config: exclusiveConfig,
    });
    const briefing = buildBenchExperimentalBriefing({ branding: makeBranding(), snapshot, config: exclusiveConfig });
    const policies = resolveBenchPromptPolicies(exclusiveConfig);
    const text = composePromptBlocks({ briefing, promptBase: "", contributions: policies.contributions }).text;

    expect(EXCLUSIVO_POLICY_VERSION).toBe("48.2.6-exclusivo-v3");
    expect(policies.versions.intencao).toBe("48.2.6-exclusivo-v3");
    expect(text).toContain(instruction);
    expect(text.split(instruction)).toHaveLength(2);
    expect(text).not.toContain("Preço original:");
    expect(text).not.toContain("Preço de venda:");
    expect(text).not.toContain("Oferta:");
    expect(text).not.toContain("Destaque:");
    if (serialized) expect(text).toContain(serialized);
    else expect(text).not.toContain("Selo:");
    for (const unprovided of ["Premium", "Sob Encomenda", "Edição Limitada", "Exclusivo"]) {
      if (badge !== unprovided) expect(text).not.toContain(`Selo: ${unprovided}`);
    }
  });

  it("preserva as opções e permissões de selos existentes", () => {
    expect(BADGE_OPTIONS_BY_INTENT.exclusive).toEqual([
      "Exclusivo", "Premium", "Sob Encomenda", "Edição Limitada",
    ]);
    expect(exclusivoPolicy.version).toBe(EXCLUSIVO_POLICY_VERSION);
  });
});

// ─── Linguagem natural e omissão do tema neutro ──────────────────────────────

describe("políticas — linguagem natural e omissão do tema neutro", () => {
  it("traduz valores técnicos em linguagem natural", () => {
    const { contributions } = resolveBenchPromptPolicies(CONFIG);
    const intent = contributions
      .filter((contribution) => contribution.block === PROMPT_BLOCK_LABELS.intent)
      .flatMap((contribution) => contribution.lines)
      .join("\n");

    expect(intent).not.toContain("oferta");
    expect(intent).toContain("quadrado 1:1");
    expect(intent).toContain("peça única");
    expect(intent).not.toContain("offer");
    expect(intent).not.toContain("spotlight");
  });

  it("omite o tema neutro `nenhum` do prompt compilado", () => {
    expect(temaNenhumPolicy.contributions({ config: CONFIG })).toEqual([]);

    const text = composeResolved();
    expect(text).not.toContain("Tema:");
    expect(text).not.toContain("Nenhum");
  });
});

// ─── Atribuição exclusiva (oferta × produto) ─────────────────────────────────

describe("políticas — atribuição exclusiva e disjunta (oferta × produto)", () => {
  it("nenhuma linha de orientação é emitida por ambas", () => {
    const ofertaLines = ofertaPolicy
      .contributions({ config: CONFIG })
      .flatMap((contribution) => contribution.lines);
    const produtoLines = produtoPolicy
      .contributions({ config: CONFIG })
      .flatMap((contribution) => contribution.lines);

    for (const line of ofertaLines) {
      expect(produtoLines).not.toContain(line);
    }

    const commercialKeywords = ["preço", "desconto", "selo", "validade", "comercial", "legibilidade"];
    for (const line of produtoLines) {
      for (const keyword of commercialKeywords) {
        expect(line.toLowerCase(), `produto não deve conter "${keyword}"`).not.toContain(keyword);
      }
    }

    const productKeywords = ["produto", "embalagem", "referência", "benefício"];
    for (const line of ofertaLines) {
      for (const keyword of productKeywords) {
        expect(line.toLowerCase(), `oferta não deve conter "${keyword}"`).not.toContain(keyword);
      }
    }
  });

  it("separa a política geral da propriedade de produto e de Oferta", () => {
    const generalLines = generalIntegrityPolicy.contributions().flatMap((entry) => entry.lines);
    const productLines = produtoPolicy
      .contributions({ config: CONFIG })
      .flatMap((entry) => entry.lines);
    const offerLines = ofertaPolicy
      .contributions({ config: CONFIG })
      .flatMap((entry) => entry.lines);

    expect(generalLines).toEqual([
      "Use português correto e natural.",
      "Evite caracteres, símbolos ou pontuação duplicados ou anômalos.",
      "Não corrija silenciosamente os textos de entrada.",
    ]);
    for (const line of generalLines) {
      expect(productLines).not.toContain(line);
      expect(offerLines).not.toContain(line);
    }
    for (const forbiddenOwnerTerm of [
      "produto",
      "nome",
      "descrição",
      "obrigatório",
      "preço",
      "data",
      "selo",
      "condição",
      "oferta",
    ]) {
      expect(generalLines.join(" ").toLowerCase()).not.toContain(forbiddenOwnerTerm);
    }
    expect(productLines.join(" ")).not.toContain("Nome: completo, sem alterar palavras; capitalização, quebras de linha e arranjo livres.");
    expect(productLines.join(" ")).toContain("preservando o significado");
    expect(productLines.join(" ")).toContain("Textos obrigatórios: exiba cada texto integralmente uma única vez.");
    expect(offerLines.join(" ")).toContain("Oferta: destaque o preço por");
    expect(offerLines.join(" ").toLowerCase()).not.toContain("português correto");
  });
});

// ─── Ausência de redundância no conteúdo gerado ──────────────────────────────

describe("políticas — ausência de redundância no conteúdo gerado", () => {
  it("cada condição comercial e cada texto obrigatório aparece uma única vez", () => {
    // Sem prompt-base: o texto é composto apenas pelo conteúdo gerado.
    const text = composeResolved(CONFIG, "");

    for (const value of [
      `R$${NBSP}99,90`,
      `R$${NBSP}49,90`,
      "50% OFF",
      "até 31/12/2026",
      "Imagem meramente ilustrativa",
      "Válido para retirada na loja",
    ]) {
      expect(text.split(value).length - 1, `duplicidade de "${value}"`).toBe(1);
    }
  });

  it("o prompt-base do operador fica fora da deduplicação (preservado)", () => {
    const promptBase = "Reforço: 50% OFF e 50% OFF novamente.";
    const text = composeResolved(CONFIG, promptBase);

    // Uma ocorrência no dado comercial + duas no prompt-base preservado = 3.
    expect(text.split("50% OFF").length - 1).toBe(3);
  });
});

// ─── Golden do prompt completo (complementar à atribuição exclusiva) ─────────

describe("políticas — golden do prompt completo (Oferta 1:1)", () => {
  it("compõe o prompt completo de forma determinística", () => {
    const golden = [
      "[PRODUTO E IMAGENS DE REFERÊNCIA]",
      "Nome obrigatório na arte: Camiseta básica. Inclua todas as palavras, números e unidades; capitalização, quebras de linha e arranjo livres.",
      "Descrição: 100% algodão",
      "Produto como elemento principal da peça.",
      "Descrição: opcional; pode ser adaptada, melhorada ou omitida, preservando o significado.",
      "Textos obrigatórios: exiba cada texto integralmente uma única vez.",
      "",
      "[CONDIÇÕES COMERCIAIS]",
      "Direção de fundo: Use um fundo de estúdio discreto, em cor sólida ou gradiente suave, sem cenário ou objetos de apoio.",
      `Preço original: R$${NBSP}99,90`,
      `Preço de venda: R$${NBSP}49,90`,
      "Selo: 50% OFF",
      "Validade: até 31/12/2026",
      "Oferta: destaque o preço por e mantenha o preço de como secundário, quando informado. Não invente informações comerciais.",
      "",
      "[INTENÇÃO E FORMATO]",
      "Formato: quadrado 1:1, com composição quadrada e equilibrada (sem congelar o layout).",
      "Estrutura: peça única.",
      "",
      "[INSTRUÇÕES DO PROMPT-BASE]",
      PROMPT_BASE,
      "",
      "[RESTRIÇÕES E TEXTOS OBRIGATÓRIOS]",
      "Informações obrigatórias na arte: Imagem meramente ilustrativa",
      "Válido para retirada na loja",
      "Use português correto e natural.",
      "Evite caracteres, símbolos ou pontuação duplicados ou anômalos.",
      "Não corrija silenciosamente os textos de entrada.",
    ].join("\n");

    expect(composeResolved()).toBe(golden);
  });

  it("exibe a mensagem normativa exata para imagens adicionais opcionais", () => {
    const source = readFileSync(
      path.resolve(
        process.cwd(),
        "src/app/(app)/admin/laboratorio/bancada/_components/bench-image-upload.tsx",
      ),
      "utf8",
    );
    expect(source).toContain("A primeira imagem enviada define a variante protagonista: apresente-a maior e em primeiro plano; use as imagens auxiliares como apoio visual secundário.");
  });
});

// ─── Negativos (combinações não habilitadas) ─────────────────────────────────

describe("políticas — negativos: combinações não habilitadas falham antes da chamada paga", () => {
  const disabled = [
    { name: "9:16", config: { ...CONFIG, formato: "9:16" } },
    { name: "serviço", config: { ...CONFIG, tipoConteudo: "servico" } },
    { name: "informativo", config: { ...CONFIG, tipoConteudo: "informativo" } },
    { name: "tema", config: { ...CONFIG, tema: "datas-comemorativas" } },
    { name: "carrossel", config: { ...CONFIG, estrutura: "carrossel" } },
  ];

  it.each(disabled)("$name falha com erro determinístico", ({ config }) => {
    expect(() => resolveBenchPromptPolicies(config)).toThrow(BenchConfigRegistryError);

    try {
      resolveBenchPromptPolicies(config);
      throw new Error("deveria ter falhado");
    } catch (error) {
      expect(error).toBeInstanceOf(BenchConfigRegistryError);
      expect((error as BenchConfigRegistryError).code).toBe("config_registry_value_disabled");
    }
  });

  it("dimensão habilitada sem política ⇒ bench_policy_not_implemented", () => {
    const partialRegistry = { ...BENCH_PROMPT_POLICY_REGISTRY, intencao: undefined };

    let error: unknown;
    try {
      resolveBenchPromptPolicies(CONFIG, partialRegistry);
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(BenchPromptPolicyError);
    expect((error as BenchPromptPolicyError).code).toBe("bench_policy_not_implemented");
    expect((error as BenchPromptPolicyError).message).toContain("bench_policy_not_implemented");
  });
});

// ─── Neutralidade do núcleo ──────────────────────────────────────────────────

describe("políticas — neutralidade do núcleo do compositor", () => {
  it("o núcleo não contém regra de dimensão nem emite valores crus", () => {
    const source = readFileSync(
      path.resolve(process.cwd(), "src/lib/lab/bench/domain/prompt-composer.ts"),
      "utf8",
    );

    for (const removed of [
      "briefing.config",
      "briefing.commercial.intent",
      "intentLines",
      "identityLines",
      "typographyLines",
    ]) {
      expect(source, `núcleo não deve conter ${removed}`).not.toContain(removed);
    }
    for (const literal of [
      '"oferta"',
      '"destaque"',
      '"exclusivo"',
      '"peca-unica"',
      '"carrossel"',
      '"nenhum"',
      '"1:1"',
      '"9:16"',
      '"produto"',
    ]) {
      expect(source, `núcleo não deve conter literal ${literal}`).not.toContain(literal);
    }
  });
});
