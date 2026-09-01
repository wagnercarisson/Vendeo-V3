import { describe, it, expect } from "vitest";
import {
  CampaignBriefSchemaVersion,
  buildCampaignBriefFromFlat,
  buildCampaignBriefSnapshot,
} from "../brief";
import { campaignBriefSchema } from "../brief-schema";
import { GenerateImageRequestSchema } from "@/lib/image-generation/schema";
import type { GenerateImageRequest } from "@/lib/image-generation/schema";

const storeId = "22222222-2222-4222-8222-222222222222";

function flatInput(
  overrides: Partial<GenerateImageRequest> = {}
): GenerateImageRequest {
  return {
    storeId,
    productName: "Produto Teste",
    discountedPriceCents: 1990,
    campaignIntent: "offer",
    preserveImageContext: true,
    productImageDataUrl: "data:image/jpeg;base64,abc123",
    ...overrides,
  };
}

describe("buildCampaignBriefFromFlat (8.7 round-trip)", () => {
  it("mapeia campos equivalentes: product.name, commercial.intent, preços, badge", () => {
    const brief = buildCampaignBriefFromFlat(
      flatInput({
        productName: "Tênis Runner",
        originalPriceCents: 29900,
        discountedPriceCents: 19900,
        badgeText: "Oferta",
        campaignIntent: "spotlight",
      }),
      storeId
    );
    expect(brief.product.name).toBe("Tênis Runner");
    expect(brief.commercial.intent).toBe("spotlight");
    expect(brief.commercial.originalPriceCents).toBe(29900);
    expect(brief.commercial.discountedPriceCents).toBe(19900);
    expect(brief.commercial.badgeText).toBe("Oferta");
    expect(brief.metadata.source).toBe("web_form");
    expect(brief.metadata.schemaVersion).toBe(CampaignBriefSchemaVersion);
  });

  it("validity string → { enabled: true, displayText }; ausente → ausente (nunca enabled:false)", () => {
    const brief = buildCampaignBriefFromFlat(
      flatInput({ validity: "válida até 30/09" }),
      storeId
    );
    expect(brief.commercial.validity).toEqual({ enabled: true, displayText: "válida até 30/09" });

    const semValidity = buildCampaignBriefFromFlat(flatInput(), storeId);
    expect(semValidity.commercial.validity).toBeUndefined();
  });

  it("mandatoryArtworkText → { enabled: true, text }; ausente → ausente", () => {
    const brief = buildCampaignBriefFromFlat(
      flatInput({ mandatoryArtworkText: "Imagem ilustrativa" }),
      storeId
    );
    expect(brief.commercial.legalNotice).toEqual({ enabled: true, text: "Imagem ilustrativa" });

    const semAviso = buildCampaignBriefFromFlat(flatInput(), storeId);
    expect(semAviso.commercial.legalNotice).toBeUndefined();
  });

  it("offer + preserveImageContext true → creativeContext.preserveImageContext false (regra canônica)", () => {
    const brief = buildCampaignBriefFromFlat(
      flatInput({ campaignIntent: "offer", preserveImageContext: true }),
      storeId
    );
    expect(brief.creativeContext.preserveImageContext).toBe(false);
    expect(brief.creativeContext.themeId).toBeNull();
  });

  it("spotlight sem preserve → preserveImageContext false; themeId null", () => {
    const brief = buildCampaignBriefFromFlat(
      flatInput({ campaignIntent: "spotlight", preserveImageContext: undefined }),
      storeId
    );
    expect(brief.creativeContext.preserveImageContext).toBe(false);
    expect(brief.creativeContext.themeId).toBeNull();
  });

  it("productImageDataUrl → media.images[0] primary/upload/mimeType image/jpeg com dataUrl no runtime", () => {
    const brief = buildCampaignBriefFromFlat(flatInput(), storeId);
    expect(brief.media.images).toHaveLength(1);
    expect(brief.media.images[0].role).toBe("primary");
    expect(brief.media.images[0].source).toBe("upload");
    expect(brief.media.images[0].mimeType).toBe("image/jpeg");
    expect(brief.media.images[0].dataUrl).toBe("data:image/jpeg;base64,abc123");
    expect(brief.media.images[0].id).toBeTruthy();
  });

  it("1 (F41): productImages[] com primary + 2 reference → media.images com roles/source/mimeType corretos", () => {
    const brief = buildCampaignBriefFromFlat(
      flatInput({
        productImageDataUrl: undefined,
        productImages: [
          { role: "primary", source: "camera", mimeType: "image/png", dataUrl: "data:image/png;base64,abc" },
          { role: "reference", source: "upload", mimeType: "image/jpeg", dataUrl: "data:image/jpeg;base64,def" },
          { role: "reference", source: "upload", mimeType: "image/webp", dataUrl: "data:image/webp;base64,ghi" },
        ],
      }),
      storeId
    );

    expect(brief.media.images).toHaveLength(3);
    expect(brief.media.images[0].role).toBe("primary");
    expect(brief.media.images[0].source).toBe("camera");
    expect(brief.media.images[0].mimeType).toBe("image/png");
    expect(brief.media.images[1].role).toBe("reference");
    expect(brief.media.images[1].source).toBe("upload");
    expect(brief.media.images[1].mimeType).toBe("image/jpeg");
    expect(brief.media.images[2].role).toBe("reference");
    expect(brief.media.images[2].source).toBe("upload");
    expect(brief.media.images[2].mimeType).toBe("image/webp");
    for (const img of brief.media.images) {
      expect(img.id).toBeTruthy();
      expect(img.storagePath).toBeUndefined();
    }
  });

  it("2 (F41): legado productImageDataUrl → productImages de 1 elemento (zero bifurcação)", () => {
    const legacy = buildCampaignBriefFromFlat(
      flatInput({ productImageDataUrl: "data:image/jpeg;base64,abc123" }),
      storeId
    );
    const multi = buildCampaignBriefFromFlat(
      flatInput({
        productImageDataUrl: undefined,
        productImages: [
          { role: "primary", source: "upload", mimeType: "image/jpeg", dataUrl: "data:image/jpeg;base64,abc123" },
        ],
      }),
      storeId
    );

    expect(legacy.media.images).toHaveLength(1);
    expect(multi.media.images).toHaveLength(1);
    expect(legacy.media.images[0].role).toBe("primary");
    expect(legacy.media.images[0].source).toBe("upload");
    expect(legacy.media.images[0].mimeType).toBe("image/jpeg");
    expect(legacy.media.images[0].dataUrl).toBe(multi.media.images[0].dataUrl);
    expect(legacy.media.images[0].source).toBe(multi.media.images[0].source);
    expect(legacy.media.images[0].role).toBe(multi.media.images[0].role);
  });

  it("3 (F41): invariante exactly-1-primary rejeitado no TRANSPORTE (safeParse)", () => {
    // sem primary (2 reference)
    const semPrimary = GenerateImageRequestSchema.safeParse(
      flatInput({
        productImageDataUrl: undefined,
        productImages: [
          { role: "reference", source: "upload", mimeType: "image/jpeg", dataUrl: "data:image/jpeg;base64,a" },
          { role: "reference", source: "upload", mimeType: "image/jpeg", dataUrl: "data:image/jpeg;base64,b" },
        ],
      })
    );
    expect(semPrimary.success).toBe(false);
    if (!semPrimary.success) {
      expect(JSON.stringify(semPrimary.error.issues)).toContain("Deve existir exatamente 1 imagem com role");
    }

    // 2 primaries
    const duasPrimaries = GenerateImageRequestSchema.safeParse(
      flatInput({
        productImageDataUrl: undefined,
        productImages: [
          { role: "primary", source: "upload", mimeType: "image/jpeg", dataUrl: "data:image/jpeg;base64,a" },
          { role: "primary", source: "upload", mimeType: "image/jpeg", dataUrl: "data:image/jpeg;base64,b" },
        ],
      })
    );
    expect(duasPrimaries.success).toBe(false);
    if (!duasPrimaries.success) {
      expect(JSON.stringify(duasPrimaries.error.issues)).toContain("Deve existir exatamente 1 imagem com role");
    }
  });

  it("5 (F41): mimeType real derivado do dataUrl (png/jpeg/webp) — corrige quirk da F39", () => {
    for (const [mime, prefix] of [
      ["image/png", "data:image/png;base64"],
      ["image/jpeg", "data:image/jpeg;base64"],
      ["image/webp", "data:image/webp;base64"],
    ] as const) {
      const brief = buildCampaignBriefFromFlat(
        flatInput({
          productImageDataUrl: undefined,
          productImages: [
            { role: "primary", source: "upload", mimeType: "image/jpeg", dataUrl: `${prefix},abc` },
          ],
        }),
        storeId
      );
      expect(brief.media.images[0].mimeType).toBe(mime);
    }
  });

  it("campos adormecidos mapeados 1:1 no lar canônico; ausentes quando não informados", () => {
    const brief = buildCampaignBriefFromFlat(
      flatInput({
        hook: "Rocket",
        cta: "Compre agora",
        objective: "Vender mais",
        targetChannel: "Instagram",
        format: "quadrado 1:1",
        sensitiveConstraints: "sem animais",
      }),
      storeId
    );
    expect(brief.commercial.hook).toBe("Rocket");
    expect(brief.commercial.cta).toBe("Compre agora");
    expect(brief.commercial.objective).toBe("Vender mais");
    expect(brief.commercial.targetChannel).toBe("Instagram");
    expect(brief.commercial.format).toBe("quadrado 1:1");
    expect(brief.creativeContext.sensitiveConstraints).toBe("sem animais");

    const semCampos = buildCampaignBriefFromFlat(flatInput(), storeId);
    expect(semCampos.commercial.hook).toBeUndefined();
    expect(semCampos.commercial.cta).toBeUndefined();
    expect(semCampos.commercial.objective).toBeUndefined();
    expect(semCampos.commercial.targetChannel).toBeUndefined();
    expect(semCampos.commercial.format).toBeUndefined();
    expect(semCampos.creativeContext.sensitiveConstraints).toBeUndefined();
  });

  it("description vai para product.description", () => {
    const brief = buildCampaignBriefFromFlat(
      flatInput({ description: "Tênis confortável" }),
      storeId
    );
    expect(brief.product.description).toBe("Tênis confortável");
  });

  it("PÓS-CONDIÇÃO 8.7: com imagem, safeParse do resultado == true (mapper nunca produz brief inválido)", () => {
    const brief = buildCampaignBriefFromFlat(flatInput(), storeId);
    expect(campaignBriefSchema.safeParse(brief).success).toBe(true);
  });
});

describe("8.14 compat payload benchmark → brief equivalente", () => {
  it("payload detalhes-variados → validity estruturada + adormecidos + ausência", () => {
    const payload = flatInput({
      productName: "Bolsa Personalizada",
      validity: "Oferta válida até 31/12",
      availabilityNotes: "Últimas unidades",
      campaignDetails: "Coleção inverno",
      additionalDetails: "Frete grátis",
      hook: "Lançamento",
      cta: "Garanta já",
      objective: "Promover a coleção",
      targetChannel: "Instagram",
      format: "quadrado 1:1",
      sensitiveConstraints: "sem promoção agressiva",
    });
    const brief = buildCampaignBriefFromFlat(payload, "benchmark");

    expect(brief.commercial.validity).toEqual({ enabled: true, displayText: "Oferta válida até 31/12" });
    expect(brief.commercial.availabilityNotes).toBe("Últimas unidades");
    expect(brief.commercial.campaignDetails).toBe("Coleção inverno");
    expect(brief.commercial.additionalDetails).toBe("Frete grátis");
    expect(brief.commercial.hook).toBe("Lançamento");
    expect(brief.commercial.cta).toBe("Garanta já");
    expect(brief.commercial.objective).toBe("Promover a coleção");
    expect(brief.commercial.targetChannel).toBe("Instagram");
    expect(brief.commercial.format).toBe("quadrado 1:1");
    expect(brief.creativeContext.sensitiveConstraints).toBe("sem promoção agressiva");
    expect(brief.media.images[0].source).toBe("upload");
    expect(brief.media.images[0].mimeType).toBe("image/jpeg");
    expect(brief.media.images[0].role).toBe("primary");
    expect(brief.media.images[0].dataUrl).toBe("data:image/jpeg;base64,abc123");
    expect(brief.metadata.schemaVersion).toBe(CampaignBriefSchemaVersion);
    expect(brief.metadata.source).toBe("web_form");
  });

  it("regra de ausência: payload sem validity/mandatoryArtworkText → campos ausentes (8.7b/8.8)", () => {
    const brief = buildCampaignBriefFromFlat(flatInput(), storeId);
    expect(brief.commercial.validity).toBeUndefined();
    expect(brief.commercial.legalNotice).toBeUndefined();
  });
});

describe("buildCampaignBriefSnapshot (8.7a round-trip flat→brief→snapshot)", () => {
  it("deriva imagens do próprio brief, remove dataUrl, preserva id/role/source/mimeType/provided", () => {
    const brief = buildCampaignBriefFromFlat(
      flatInput({ validity: "válida até 30/09", mandatoryArtworkText: "Imagem ilustrativa" }),
      storeId
    );
    const snapshot = buildCampaignBriefSnapshot(brief);

    expect(snapshot.media.images).toHaveLength(1);
    expect(snapshot.media.images[0].id).toBe(brief.media.images[0].id);
    expect(snapshot.media.images[0].role).toBe("primary");
    expect(snapshot.media.images[0].source).toBe("upload");
    expect(snapshot.media.images[0].mimeType).toBe("image/jpeg");
    expect(snapshot.media.images[0].provided).toBe(true);
    expect("dataUrl" in snapshot.media.images[0]).toBe(false);
  });

  it("schemaVersion no ROOT; metadata do snapshot SEM schemaVersion (assert de runtime)", () => {
    const brief = buildCampaignBriefFromFlat(flatInput(), storeId);
    const snapshot = buildCampaignBriefSnapshot(brief);

    expect(snapshot.schemaVersion).toBe(CampaignBriefSchemaVersion);
    expect("schemaVersion" in snapshot.metadata).toBe(false);
    expect(snapshot.metadata.source).toBe("web_form");
  });

  it("campos adormecidos preservados no lar canônico do snapshot", () => {
    const brief = buildCampaignBriefFromFlat(
      flatInput({
        hook: "Rocket",
        cta: "Compre agora",
        sensitiveConstraints: "sem animais",
        validity: "válida até 30/09",
        mandatoryArtworkText: "Imagem ilustrativa",
      }),
      storeId
    );
    const snapshot = buildCampaignBriefSnapshot(brief);

    expect(snapshot.commercial.hook).toBe("Rocket");
    expect(snapshot.commercial.cta).toBe("Compre agora");
    expect(snapshot.creativeContext.sensitiveConstraints).toBe("sem animais");
    expect(snapshot.commercial.validity).toEqual({ enabled: true, displayText: "válida até 30/09" });
    expect(snapshot.commercial.legalNotice).toEqual({ enabled: true, text: "Imagem ilustrativa" });
  });
});
