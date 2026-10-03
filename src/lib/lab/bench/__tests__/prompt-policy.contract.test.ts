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
import { produtoPolicy } from "../domain/policies/produto";
import { generalIntegrityPolicy } from "../domain/policies/general-integrity";
import { temaNenhumPolicy } from "../domain/policies/tema-nenhum";
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

/** Compõe o recorte com as contribuições resolvidas das políticas. */
function composeResolved(config: BenchConfig = CONFIG, promptBase = PROMPT_BASE): string {
  const { contributions } = resolveBenchPromptPolicies(config);
  return composePromptBlocks({ briefing: makeBriefing(config), promptBase, contributions }).text;
}

// ─── Resolução explícita e versionada ────────────────────────────────────────

describe("políticas — resolução explícita e versionada", () => {
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
    { intent: "exclusivo", policy: exclusivoPolicy, line: "Exclusivo: valorize a apresentação sem preço. Preserve os selos informados; não invente atributos nem alegações de exclusividade, escassez ou edição limitada." },
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
    expect(COMPOSER_VERSION).toBe("48.2.4-prompt-composer-v2");
    expect(ofertaPolicy.version).toBe("48.2.6-oferta-v1");
    expect(ofertaPolicy.contributions({ config: CONFIG }).flatMap((entry) => entry.lines)).toContain(
      "Oferta: destaque o preço por e mantenha o preço de como secundário, quando informado. Não invente informações comerciais.",
    );
    expect(composeResolved()).toContain(`Preço de venda: R$${NBSP}49,90`);
  });

  it("versiona a orientação da imagem principal e das adicionais em produto", () => {
    const lines = produtoPolicy.contributions({ config: CONFIG }).flatMap((entry) => entry.lines);
    expect(produtoPolicy.version).toBe("48.2.6-produto-v2");
    expect(lines).toContain(
      "Use a imagem principal como protagonista. As imagens auxiliares enriquecem a campanha; use-as sempre que possível, sem competir com a principal.",
    );
    expect(lines.join(" ").toLowerCase()).not.toContain("garantia de aparição");
    expect(lines.join(" ").toLowerCase()).not.toContain("layout programático");
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
    expect(productLines.join(" ")).toContain("Nome: completo, sem alterar palavras; capitalização, quebras de linha e arranjo livres.");
    expect(productLines.join(" ")).toContain("preservando o significado");
    expect(productLines.join(" ")).toContain("Textos obrigatórios: reprodução integral.");
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
      "Nome do produto obrigatório: Camiseta básica",
      "Descrição: 100% algodão",
      "Produto como elemento principal da peça.",
      "Reproduzir com fidelidade a aparência, a embalagem e as características do produto.",
      "Use a imagem principal como protagonista. As imagens auxiliares enriquecem a campanha; use-as sempre que possível, sem competir com a principal.",
      "Nome: completo, sem alterar palavras; capitalização, quebras de linha e arranjo livres.",
      "Descrição: opcional; pode ser adaptada, melhorada ou omitida, preservando o significado.",
      "Textos obrigatórios: reprodução integral.",
      "",
      "[CONDIÇÕES COMERCIAIS]",
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
    expect(source).toContain("Use a imagem principal como protagonista. As imagens auxiliares enriquecem a campanha; use-as sempre que possível, sem competir com a principal.");
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
