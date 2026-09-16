// @vitest-environment node
import { describe, it, expect } from "vitest";

import { ILLUSTRATIVE_NOTICE_TEXT } from "@/lib/campaign/constants";
import type { LabScenarioContent } from "../schema";
import { parseLabScenarioContent } from "../schema";
import { mapScenarioToCampaignBrief, mapScenarioToResolvedContext } from "../mapper";

/**
 * Mapper dos cenários controlados (F48.1, D4/D7).
 *
 * Testes puros: os data URLs são sintéticos (nenhuma leitura de disco, nenhuma
 * rede, nenhuma chamada paga). O que importa aqui é o contrato do brief/contexto:
 * exatamente 1 imagem `primary`, mimeType derivado do data URL, validade/aviso
 * estruturados, identidade fictícia e o override de revisão do brief fixo.
 */

const JPEG_DATA_URL = `data:image/jpeg;base64,${Buffer.from("fixture-jpeg-bytes").toString("base64")}`;
const PNG_DATA_URL = `data:image/png;base64,${Buffer.from("fixture-png-bytes").toString("base64")}`;

function baseScenario(): Record<string, unknown> {
  return {
    slug: "produto-oferta-preco",
    name: "Oferta com preço",
    description: "Cenário fictício.",
    intent: "offer",
    format: "1:1",
    locale: "pt-BR",
    mediaKinds: ["image"],
    brief: {
      product: {
        name: "Cesta de Café da Manhã Aurora",
        brand: "Empório Aurora",
        sizeOrVariant: "Cesta média",
        description: "Cesta fictícia.",
      },
      offer: {
        originalPriceCents: 12990,
        discountedPriceCents: 9990,
        badgeText: "OFERTA",
        availabilityNotes: "Enquanto durarem os estoques.",
        campaignDetails: "Semana do café da manhã",
      },
    },
    store: { name: "Empório Aurora", segment: "mercados-mercearias", brandColor: "#16A34A" },
    identity: { state: "text_only" },
    images: [
      { id: "produto", role: "primary", path: "images/produto.jpg" },
      { id: "produto-auxiliar", role: "reference", path: "images/produto-auxiliar.jpg" },
    ],
    fictitious: true,
  };
}

function content(overrides: Record<string, unknown> = {}): LabScenarioContent {
  return parseLabScenarioContent({ ...baseScenario(), ...overrides });
}

const PRECO_IMAGES: Record<string, string> = {
  "images/produto.jpg": JPEG_DATA_URL,
  "images/produto-auxiliar.jpg": JPEG_DATA_URL,
};

describe("mapScenarioToCampaignBrief — domínio de produção", () => {
  it("produz brief com metadata campaign_brief_v1 e product manual", () => {
    const brief = mapScenarioToCampaignBrief(content(), PRECO_IMAGES);

    expect(brief.metadata).toEqual({ schemaVersion: "campaign_brief_v1", source: "web_form" });
    expect(brief.product).toEqual({
      source: "manual",
      name: "Cesta de Café da Manhã Aurora",
      brand: "Empório Aurora",
      sizeOrVariant: "Cesta média",
      description: "Cesta fictícia.",
    });
  });

  it("mapeia imagens preservando id/role e derivando mimeType do data URL", () => {
    const brief = mapScenarioToCampaignBrief(content(), PRECO_IMAGES);

    expect(brief.media.images).toHaveLength(2);
    expect(brief.media.images.filter((image) => image.role === "primary")).toHaveLength(1);
    expect(brief.media.images[0]).toEqual({
      id: "produto",
      role: "primary",
      source: "upload",
      mimeType: "image/jpeg",
      dataUrl: JPEG_DATA_URL,
    });
    expect(brief.media.images[1].role).toBe("reference");
  });

  it("deriva image/png quando o data URL da imagem é PNG", () => {
    const brief = mapScenarioToCampaignBrief(
      content({
        images: [{ id: "produto", role: "primary", path: "images/produto.png" }],
      }),
      { "images/produto.png": PNG_DATA_URL },
    );

    expect(brief.media.images[0].mimeType).toBe("image/png");
  });

  it("mapeia preços, badge, detalhes e formato para commercial", () => {
    const brief = mapScenarioToCampaignBrief(content(), PRECO_IMAGES);

    expect(brief.commercial.intent).toBe("offer");
    expect(brief.commercial.originalPriceCents).toBe(12990);
    expect(brief.commercial.discountedPriceCents).toBe(9990);
    expect(brief.commercial.badgeText).toBe("OFERTA");
    expect(brief.commercial.availabilityNotes).toBe("Enquanto durarem os estoques.");
    expect(brief.commercial.campaignDetails).toBe("Semana do café da manhã");
    expect(brief.commercial.format).toBe("1:1");
    expect(brief.commercial.validity).toBeUndefined();
    expect(brief.commercial.legalNotice).toBeUndefined();
  });

  it("estrutura validity e legalNotice quando o cenário os declara", () => {
    const brief = mapScenarioToCampaignBrief(
      content({
        brief: {
          product: { name: "Kit Degustação Vale Verde" },
          offer: {
            originalPriceCents: 8990,
            discountedPriceCents: 6990,
            validityText: "Oferta válida até 30/09/2026.",
          },
          legalNotice: {
            mandatoryText: "Preços válidos somente para retirada na loja física.",
            illustrativeNoticeEnabled: true,
          },
        },
      }),
      PRECO_IMAGES,
    );

    expect(brief.commercial.validity).toEqual({
      enabled: true,
      displayText: "Oferta válida até 30/09/2026.",
    });
    expect(brief.commercial.legalNotice).toEqual({
      enabled: true,
      text: `${ILLUSTRATIVE_NOTICE_TEXT}\nPreços válidos somente para retirada na loja física.`,
    });
  });

  it("mapeia creativeContext com preserveImageContext false e themeId null", () => {
    const brief = mapScenarioToCampaignBrief(content(), PRECO_IMAGES);

    expect(brief.creativeContext.preserveImageContext).toBe(false);
    expect(brief.creativeContext.themeId).toBeNull();
    expect(brief.creativeContext.sensitiveConstraints).toBeUndefined();
  });

  it("lança missing_scenario_image:<path> quando o data URL não foi resolvido", () => {
    expect(() =>
      mapScenarioToCampaignBrief(content(), { "images/produto.jpg": JPEG_DATA_URL }),
    ).toThrowError("missing_scenario_image:images/produto-auxiliar.jpg");
  });

  it("não vaza base64 fora de media.images[].dataUrl", () => {
    const brief = mapScenarioToCampaignBrief(content(), PRECO_IMAGES);
    const { media, ...rest } = brief;

    expect(media.images.every((image) => image.dataUrl === JPEG_DATA_URL)).toBe(true);
    expect(JSON.stringify(rest)).not.toContain("base64");
    expect(JSON.stringify(rest)).not.toContain("data:image");
  });
});

describe("mapScenarioToResolvedContext — loja/identidade fictícias", () => {
  it("monta store fictícia com campos de identidade nulos e brandProfile null", () => {
    const resolved = mapScenarioToResolvedContext(content(), PRECO_IMAGES, null);

    expect(resolved.store).toEqual({
      name: "Empório Aurora",
      segment: "mercados-mercearias",
      subsegment: null,
      toneOfVoice: null,
      positioning: null,
      shortDescription: null,
      slogan: null,
      brandColor: "#16A34A",
    });
    expect(resolved.brandProfile).toBeNull();
  });

  it("identity text_only tem imageUrl null e directive vazia", () => {
    const resolved = mapScenarioToResolvedContext(content(), PRECO_IMAGES, null);

    expect(resolved.identity).toEqual({ state: "text_only", imageUrl: null, directive: "" });
  });

  it("identity logo usa o data URL do logo controlado", () => {
    const resolved = mapScenarioToResolvedContext(
      content({ identity: { state: "logo", logoPath: "images/logo.png" } }),
      PRECO_IMAGES,
      PNG_DATA_URL,
    );

    expect(resolved.identity.state).toBe("logo");
    expect(resolved.identity.imageUrl).toBe(PNG_DATA_URL);
  });

  it("campaignInput fixa campaignIntent offer e o override de revisão do brief (D7)", () => {
    const resolved = mapScenarioToResolvedContext(content(), PRECO_IMAGES, null);

    expect(resolved.campaignInput.campaignIntent).toBe("offer");
    expect(resolved.campaignInput.inputValidationOverride).toEqual({
      productImageCheck: "brief_review_confirmed",
    });
  });

  it("campaignInput leva produto, preços, validade e texto obrigatório", () => {
    const resolved = mapScenarioToResolvedContext(
      content({
        brief: {
          product: { name: "Kit Degustação Vale Verde" },
          offer: {
            originalPriceCents: 8990,
            discountedPriceCents: 6990,
            validityText: "Oferta válida até 30/09/2026.",
          },
          legalNotice: {
            mandatoryText: "Preços válidos somente para retirada na loja física.",
            illustrativeNoticeEnabled: true,
          },
        },
      }),
      PRECO_IMAGES,
      null,
    );

    expect(resolved.campaignInput.productName).toBe("Kit Degustação Vale Verde");
    expect(resolved.campaignInput.originalPriceCents).toBe(8990);
    expect(resolved.campaignInput.discountedPriceCents).toBe(6990);
    expect(resolved.campaignInput.validity).toBe("Oferta válida até 30/09/2026.");
    expect(resolved.campaignInput.mandatoryArtworkText).toBe(
      `${ILLUSTRATIVE_NOTICE_TEXT}\nPreços válidos somente para retirada na loja física.`,
    );
  });

  it("campaignInput carrega productImages com exatamente 1 primary e sem id", () => {
    const resolved = mapScenarioToResolvedContext(content(), PRECO_IMAGES, null);
    const images = resolved.campaignInput.productImages ?? [];

    expect(images).toHaveLength(2);
    expect(images.filter((image) => image.role === "primary")).toHaveLength(1);
    expect(images[0]).toEqual({
      role: "primary",
      source: "upload",
      mimeType: "image/jpeg",
      dataUrl: JPEG_DATA_URL,
    });
    expect(Object.keys(images[0]).sort()).toEqual(["dataUrl", "mimeType", "role", "source"]);
  });

  it("propaga o erro de imagem ausente também no contexto resolvido", () => {
    expect(() => mapScenarioToResolvedContext(content(), {}, null)).toThrowError(
      "missing_scenario_image:images/produto.jpg",
    );
  });
});
