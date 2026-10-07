import { describe, expect, it } from "vitest";
import { composePromptBlocks } from "@/lib/lab/bench/domain/prompt-composer";
import {
  buildBenchExperimentalBriefing,
  type BenchExperimentalBriefing,
} from "@/lib/lab/bench/domain/experimental-briefing";
import { buildBenchCampaignSnapshot } from "@/lib/lab/bench/domain/campaign-snapshot";
import { resolveBenchPromptPolicies } from "@/lib/lab/bench/domain/policies/resolve-bench-prompt-policies";
import { BENCH_DEFAULT_PROMPT_BASE } from "@/lib/lab/bench/domain/prompt-base";
import type { BenchBrandingContract } from "@/lib/lab/bench/domain/branding-service";
import type { BenchConfig, BenchOffer, BenchProduct } from "@/lib/lab/bench/domain/schemas";
import type { ProductOneToOneIntent } from "../intent-selection";
import {
  COMPOSER_VERSION,
  composeProductPrompt,
} from "../prompt-composition";
import { PROMPT_BASE_CONTENT, PROMPT_BASE_VERSION } from "../prompt-base";
import type { ProductPromptCompositionBriefing } from "../policies/types";

const BASE_CONFIG: BenchConfig = {
  pipeline: "manual-direto",
  formato: "1:1",
  modelo: "gpt-image-2",
  qualidade: "low",
  intencao: "oferta",
  tipoConteudo: "produto",
  estrutura: "peca-unica",
  tema: "nenhum",
};

const BRANDING: BenchBrandingContract = {
  storeId: "11111111-1111-4111-8111-111111111111",
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
  campaignBrief: "Campanha focada no produto",
  profileSource: "full",
  profileStatus: "synced",
  logoUrl: null,
  signatureUrl: null,
  identityState: "text_only",
  identityReference: null,
  identityReason: "text_only:no_identity_image",
  assets: [],
};

const INTENTS: ReadonlyArray<{
  productIntent: ProductOneToOneIntent;
  benchIntent: BenchConfig["intencao"];
}> = [
  { productIntent: "offer", benchIntent: "oferta" },
  { productIntent: "spotlight", benchIntent: "destaque" },
  { productIntent: "exclusive", benchIntent: "exclusivo" },
];

const DIRECTIONS = ["studio", "ambient", "original"] as const;
const REFERENCES = ["approved/product-main.png", "approved/product-alt.png"];

function makeBenchCase(
  productIntent: ProductOneToOneIntent,
  benchIntent: BenchConfig["intencao"],
  direction: (typeof DIRECTIONS)[number],
): {
  config: BenchConfig;
  briefing: BenchExperimentalBriefing;
  productBriefing: ProductPromptCompositionBriefing;
} {
  const config: BenchConfig = { ...BASE_CONFIG, intencao: benchIntent };
  const product: BenchProduct = {
    name: "Johnnie Walker Black Label 750 ml",
    description: "Whisky escocês",
    priceCents: productIntent === "exclusive" ? undefined : 4990,
    originalPriceCents: productIntent === "offer" ? 9990 : undefined,
    mandatoryArtworkText: "Válido para retirada na loja",
  };
  const offer: BenchOffer = {
    backgroundDirection: direction,
    campaignIntent: productIntent,
    badge: productIntent === "offer" ? "50% OFF" : "",
    validity: productIntent === "offer" ? "até 31/12/2026" : undefined,
    showIllustrativeNotice: false,
  };

  const snapshot = buildBenchCampaignSnapshot({ product, offer, config });
  const briefing = buildBenchExperimentalBriefing({
    branding: BRANDING,
    snapshot,
    config,
  });
  const productBriefing: ProductPromptCompositionBriefing = {
    backgroundDirection: direction,
    product: {
      name: briefing.product.name,
      description: briefing.product.description ?? null,
    },
    commercial: {
      intent: briefing.commercial.intent,
      originalPriceText: briefing.commercial.originalPriceText ?? null,
      discountedPriceText: briefing.commercial.discountedPriceText ?? null,
      badge: briefing.commercial.badge ?? null,
      validity: briefing.commercial.validity ?? null,
    },
    constraints: {
      mandatoryArtworkText: briefing.constraints.mandatoryArtworkText ?? null,
    },
  };

  return { config, briefing, productBriefing };
}

describe("F48.2.6 → Product 1:1 frozen prompt equivalence", () => {
  it("uses the Product-owned prompt base with the exact frozen bench content", () => {
    expect(PROMPT_BASE_CONTENT).toBe(BENCH_DEFAULT_PROMPT_BASE.content);
    expect(PROMPT_BASE_VERSION).toBe(BENCH_DEFAULT_PROMPT_BASE.version);
  });

  it.each(
    INTENTS.flatMap((intent) =>
      DIRECTIONS.map((direction) => [intent, direction] as const),
    ),
  )(
    "matches approved bench text, blocks and versions for %s / %s",
    (intent, direction) => {
      const { config, briefing, productBriefing } = makeBenchCase(
        intent.productIntent,
        intent.benchIntent,
        direction,
      );
      const benchPolicies = resolveBenchPromptPolicies(config, undefined, {
        briefing,
        references: REFERENCES,
      });
      const approvedBench = composePromptBlocks({
        briefing,
        promptBase: BENCH_DEFAULT_PROMPT_BASE.content,
        references: REFERENCES,
        contributions: benchPolicies.contributions,
        policyVersions: benchPolicies.versions,
      });
      const product = composeProductPrompt({
        briefing: productBriefing,
        promptBase: BENCH_DEFAULT_PROMPT_BASE.content,
        references: REFERENCES,
      });

      expect(product.text).toBe(approvedBench.text);
      expect(product.blocks).toEqual(approvedBench.blocks);
      expect(product.policyVersions).toEqual(approvedBench.policyVersions);
      expect(product.composerVersion).toBe(COMPOSER_VERSION);
      expect(product.promptBaseVersion).toBe(PROMPT_BASE_VERSION);
    },
  );
});
