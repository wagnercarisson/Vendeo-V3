// Testes de fence da F49 (D8/D12/D15) — ambiente node (puro, sem jsdom).
//
// Provam em runtime que:
//  - `product.description` CHEGA ao `CopyDirectorInput` e NÃO aparece no briefing
//    do Diretor de Arte (item OpenSpec 7.10 / D8);
//  - body/snapshot/transporte permanecem comportamentalmente idênticos (7.11):
//    `buildMandatoryArtworkText` nas 4 combinações exatas, snapshot
//    `campaign_brief_v1` preservando a descrição e `inferIntent` inalterado.
//
// As funções importadas são as REAIS do pipeline — a fence não pode divergir do
// runtime (T-49-02, Tampering).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  buildCampaignBriefFromFlat,
  buildCampaignBriefSnapshot,
  type CampaignBrief,
} from "@/lib/campaign/brief";
import { mapBriefToCopyDirectorInput } from "@/lib/copy/mapper";
import {
  buildCommercialRepertoire,
  campaignFactsSection,
  commercialDetailsSection,
  constraintsSection,
  creativeDirectionSection,
  identityReferenceSection,
  productReferenceSection,
} from "@/lib/image-generation/services/art-director-briefing";
import { buildMandatoryArtworkText, inferIntent } from "../use-campaign-form";
import { ILLUSTRATIVE_NOTICE_TEXT } from "@/lib/campaign/constants";
import type { GenerateImageRequest } from "@/lib/image-generation/schema";
import type { ResolvedCampaignContext } from "@/components/campaign/types";

/** Sentinela fictícia (sem PII/segredo — T-49-04) que não pode vazar para a arte. */
const SENTINELA = "SENTINELA_DESCRICAO_F49_NAO_DEVE_APARECER";

const context: ResolvedCampaignContext = {
  campaignInput: {
    productName: "Produto F49",
    discountedPriceCents: 8000,
    productImageDataUrl: "data:image/jpeg;base64,dGVzdA==",
    badgeText: "Oferta",
    campaignIntent: "offer",
  },
  store: {
    name: "Loja F49",
    segment: "outros",
    subsegment: null,
    toneOfVoice: null,
    positioning: null,
    shortDescription: null,
    slogan: null,
    brandColor: "#22C55E",
  },
  brandProfile: null,
  identity: { state: "text_only", imageUrl: null, directive: "" },
};

function buildBrief(): CampaignBrief {
  return buildCampaignBriefFromFlat(
    {
      productName: "Produto F49",
      description: SENTINELA,
      originalPriceCents: 10000,
      discountedPriceCents: 8000,
      badgeText: "Oferta",
      campaignIntent: "offer",
      productImageDataUrl: "data:image/jpeg;base64,dGVzdA==",
    } as GenerateImageRequest,
    "store-1",
  );
}

describe("Fence do Diretor de Arte (7.10 / D8)", () => {
  it("a descrição do produto CHEGA ao CopyDirectorInput", () => {
    const brief = buildBrief();

    expect(mapBriefToCopyDirectorInput(brief, context, {}).description).toBe(SENTINELA);
  });

  it("a descrição NÃO aparece em nenhuma das 7 seções do Diretor de Arte", () => {
    const brief = buildBrief();

    const sections: Record<string, string> = {
      campaignFactsSection: campaignFactsSection(brief, context, "Produto F49"),
      commercialDetailsSection: commercialDetailsSection(brief),
      buildCommercialRepertoire: buildCommercialRepertoire(brief),
      productReferenceSection: productReferenceSection(brief, context, 1),
      constraintsSection: constraintsSection(brief),
      creativeDirectionSection: creativeDirectionSection(brief, context),
      identityReferenceSection: identityReferenceSection(brief, context),
    };

    for (const [name, section] of Object.entries(sections)) {
      expect(section, `${name} não deve conter a descrição do produto`).not.toContain(SENTINELA);
    }
  });
});

describe("Não-mudança comportamental do body/snapshot/transporte (7.11 / D12/D15)", () => {
  it("buildMandatoryArtworkText preserva as 4 combinações exatas", () => {
    expect(buildMandatoryArtworkText(true, "Texto")).toBe(
      `${ILLUSTRATIVE_NOTICE_TEXT}\nTexto`,
    );
    expect(buildMandatoryArtworkText(true, "")).toBe(ILLUSTRATIVE_NOTICE_TEXT);
    expect(buildMandatoryArtworkText(false, "Texto")).toBe("Texto");
    expect(buildMandatoryArtworkText(false, "")).toBeUndefined();
  });

  it("o snapshot mantém schemaVersion campaign_brief_v1 e preserva a descrição", () => {
    const snapshot = buildCampaignBriefSnapshot(buildBrief());

    expect(snapshot.schemaVersion).toBe("campaign_brief_v1");
    expect(snapshot.product.description).toBe(SENTINELA);
  });

  it("inferIntent(10000, 8000) continua classificando como 'offer'", () => {
    expect(inferIntent(10000, 8000)).toBe("offer");
  });
});

// ─── 7.9 (terceira parte): microcopy de identidade × consumidores reais ──────
// A microcopy de Posicionamento/Descrição Curta/Slogan afirma efeito DIRETO na
// copy e INDIRETO no perfil/direção visual. Esta suíte prova a correspondência:
//  (a) os 5 campos de identidade chegam ao copy mapper (direto);
//  (b) o tom de voz chega à direção visual com default "profissional";
//  (c) os 4 módulos reais de perfil/direção visual referenciam os campos de
//      identidade nos seus mapas de variáveis de prompt (indireto).
const IDENTITY_CONTEXT: ResolvedCampaignContext = {
  ...context,
  store: {
    ...context.store,
    name: "SENTINELA_NOME_LOJA_F49",
    toneOfVoice: "SENTINELA_TOM_DE_VOZ_F49",
    positioning: "SENTINELA_POSICIONAMENTO_F49",
    shortDescription: "SENTINELA_DESCRICAO_CURTA_F49",
    slogan: "SENTINELA_SLOGAN_F49",
  },
};

const IDENTITY_CONSUMER_MODULES = [
  "src/lib/brand-assets/brand-director.ts",
  "src/lib/visual-signature/brand-profiler.ts",
  "src/lib/brand-assets/text-only-inference-service.ts",
  "src/lib/visual-signature/identity-art-director.ts",
];

const IDENTITY_PROMPT_KEYS = [
  "tone_of_voice:",
  "positioning:",
  "short_description:",
  "slogan:",
];

describe("Correspondência da microcopy de identidade × consumidores reais (7.9)", () => {
  it("os 5 campos de identidade chegam ao CopyDirectorInput (efeito direto na copy)", () => {
    const input = mapBriefToCopyDirectorInput(buildBrief(), IDENTITY_CONTEXT, {});

    expect(input.storeName).toBe("SENTINELA_NOME_LOJA_F49");
    expect(input.toneOfVoice).toBe("SENTINELA_TOM_DE_VOZ_F49");
    expect(input.positioning).toBe("SENTINELA_POSICIONAMENTO_F49");
    expect(input.shortDescription).toBe("SENTINELA_DESCRICAO_CURTA_F49");
    expect(input.slogan).toBe("SENTINELA_SLOGAN_F49");
  });

  it("o tom de voz chega à direção visual (campaignFactsSection)", () => {
    const section = campaignFactsSection(buildBrief(), IDENTITY_CONTEXT, "Produto F49");

    expect(section).toContain("SENTINELA_TOM_DE_VOZ_F49");
  });

  it("sem tom de voz, a direção visual usa o default 'profissional'", () => {
    const noTone: ResolvedCampaignContext = {
      ...IDENTITY_CONTEXT,
      store: { ...IDENTITY_CONTEXT.store, toneOfVoice: null },
    };

    expect(campaignFactsSection(buildBrief(), noTone, "Produto F49")).toContain(
      "- **Tom de voz:** profissional",
    );
  });

  for (const relativePath of IDENTITY_CONSUMER_MODULES) {
    it(`${relativePath} referencia os campos de identidade no mapa de variáveis do prompt`, () => {
      const content = readFileSync(path.join(process.cwd(), relativePath), "utf-8");

      for (const key of IDENTITY_PROMPT_KEYS) {
        expect(
          content,
          `${relativePath} deve referenciar "${key}" no mapa de variáveis do prompt`,
        ).toContain(key);
      }
    });
  }
});
