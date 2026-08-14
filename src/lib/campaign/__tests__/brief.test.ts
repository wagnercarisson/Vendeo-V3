import { describe, it, expect } from "vitest";
import {
  CampaignBriefSchemaVersion,
  buildCampaignBriefFromFlat,
  getCampaignLegalNotice,
  type CampaignBrief,
  type CampaignBriefSnapshot,
} from "../brief";
import { campaignBriefSchema, productSchema } from "../brief-schema";
import { ILLUSTRATIVE_NOTICE_TEXT } from "../constants";

// Fixture base com overrides spread-last (padrão store.test.ts:180-195).
function baseBrief(overrides: Partial<CampaignBrief> = {}): CampaignBrief {
  return {
    product: {
      source: "manual",
      name: "Produto Teste",
    },
    commercial: {
      intent: "offer",
      discountedPriceCents: 1990,
    },
    media: {
      images: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          role: "primary",
          source: "upload",
          mimeType: "image/jpeg",
          dataUrl: "data:image/jpeg;base64,abc123",
        },
      ],
    },
    creativeContext: {
      preserveImageContext: false,
      themeId: null,
    },
    metadata: {
      schemaVersion: CampaignBriefSchemaVersion,
      source: "web_form",
    },
    ...overrides,
  };
}

function baseSnapshot(overrides: Partial<CampaignBriefSnapshot> = {}): CampaignBriefSnapshot {
  return {
    schemaVersion: CampaignBriefSchemaVersion,
    product: { source: "manual", name: "Produto Teste" },
    commercial: { intent: "offer", discountedPriceCents: 1990 },
    media: {
      images: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          role: "primary",
          source: "upload",
          provided: true,
          mimeType: "image/jpeg",
        },
      ],
    },
    creativeContext: { preserveImageContext: false, themeId: null },
    metadata: { source: "web_form" },
    ...overrides,
  };
}

describe("campaignBriefSchema", () => {
  it("brief válido com 1 imagem primary → safeParse success", () => {
    const result = campaignBriefSchema.safeParse(baseBrief());
    expect(result.success).toBe(true);
  });

  it("brief com 2 imagens primary → safeParse failure apontando media.images", () => {
    const brief = baseBrief({
      media: {
        images: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            role: "primary",
            source: "upload",
            mimeType: "image/jpeg",
          },
          {
            id: "22222222-2222-4222-8222-222222222222",
            role: "primary",
            source: "upload",
            mimeType: "image/jpeg",
          },
        ],
      },
    });
    const result = campaignBriefSchema.safeParse(brief);
    expect(result.success).toBe(false);
    if (!result.success) {
      const issues = result.error.issues;
      expect(issues.some((i) => i.path.includes("media") && i.path.includes("images"))).toBe(true);
    }
  });

  it("brief com 0 imagens primary → safeParse failure (invariante 1 primary)", () => {
    const brief = baseBrief({
      media: {
        images: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            role: "reference",
            source: "upload",
            mimeType: "image/jpeg",
          },
        ],
      },
    });
    expect(campaignBriefSchema.safeParse(brief).success).toBe(false);
  });

  it("imagem com role inválido → safeParse failure (.strict + enum typoguard)", () => {
    const brief = baseBrief();
    (brief.media.images[0] as unknown as { role: string }).role = "made_up";
    expect(campaignBriefSchema.safeParse(brief).success).toBe(false);
  });

  it("chave extra no product → safeParse failure (.strict typoguard)", () => {
    const brief = baseBrief({
      product: { source: "manual", name: "Produto", extraKey: "x" } as unknown as CampaignBrief["product"],
    });
    expect(campaignBriefSchema.safeParse(brief).success).toBe(false);
  });

  it("schemaVersion inválido no metadata runtime → safeParse failure", () => {
    const brief = baseBrief();
    (brief.metadata as unknown as { schemaVersion: string }).schemaVersion = "campaign_brief_v2";
    expect(campaignBriefSchema.safeParse(brief).success).toBe(false);
  });
});

describe("8.1 brief mínimo válido (F39-01/08)", () => {
  it("product.source manual, nomeado, 1 primary → safeParse success", () => {
    const brief = baseBrief();
    expect(brief.product.source).toBe("manual");
    expect(brief.media.images[0].role).toBe("primary");
    expect(campaignBriefSchema.safeParse(brief).success).toBe(true);
  });
});

describe("8.2 oferta com preço + validade (F39-05/D8)", () => {
  it("validity aninhada em commercial com enabled+displayText", () => {
    const brief = baseBrief({
      commercial: {
        intent: "offer",
        discountedPriceCents: 1990,
        validity: { enabled: true, displayText: "Somente hoje" },
      },
    });
    expect(brief.commercial.validity?.enabled).toBe(true);
    expect(brief.commercial.validity?.displayText).toBe("Somente hoje");
    expect(campaignBriefSchema.safeParse(brief).success).toBe(true);
  });

  it("validity é aninhada em commercial — nunca top-level", () => {
    const brief = baseBrief();
    expect("validity" in brief).toBe(false);
  });
});

describe("8.3 legalNotice on/off (F39-06/D9)", () => {
  it("enabled=false → estrutura preservada e helper retorna a estrutura", () => {
    const brief = baseBrief({
      commercial: {
        intent: "offer",
        discountedPriceCents: 1990,
        legalNotice: { enabled: false },
      },
    });
    expect(brief.commercial.legalNotice?.enabled).toBe(false);
    expect(getCampaignLegalNotice(brief)?.enabled).toBe(false);
  });

  it("enabled=true + text → getCampaignLegalNotice retorna o texto (compat mandatoryArtworkText)", () => {
    const brief = baseBrief({
      commercial: {
        intent: "offer",
        discountedPriceCents: 1990,
        legalNotice: { enabled: true, text: "Imagem meramente ilustrativa" },
      },
    });
    expect(getCampaignLegalNotice(brief)?.text).toBe("Imagem meramente ilustrativa");
  });

  it("helper retorna undefined quando legalNotice ausente (sem espelho)", () => {
    const brief = baseBrief();
    expect(getCampaignLegalNotice(brief)).toBeUndefined();
  });
});

describe("8.4 exatamente 1 primary (F39-08)", () => {
  it("0 primary → safeParse falha", () => {
    const brief = baseBrief({
      media: { images: [] },
    });
    expect(campaignBriefSchema.safeParse(brief).success).toBe(false);
  });

  it("2 primary → safeParse falha", () => {
    const brief = baseBrief({
      media: {
        images: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            role: "primary",
            source: "upload",
            mimeType: "image/jpeg",
          },
          {
            id: "22222222-2222-4222-8222-222222222222",
            role: "primary",
            source: "upload",
            mimeType: "image/jpeg",
          },
        ],
      },
    });
    expect(campaignBriefSchema.safeParse(brief).success).toBe(false);
  });

  it("exatamente 1 primary → safeParse success", () => {
    expect(campaignBriefSchema.safeParse(baseBrief()).success).toBe(true);
  });
});

describe("8.5 product.source default manual (F39-02/D3)", () => {
  it("source ausente → default manual via schema; catalogProductId opcional uuid", () => {
    const parsed = productSchema.parse({ name: "Produto Teste" });
    expect(parsed.source).toBe("manual");
    expect(parsed.catalogProductId).toBeUndefined();
  });

  it("catalogProductId aceita uuid válido (não aponta tabela — só string)", () => {
    const result = campaignBriefSchema.safeParse(
      baseBrief({
        product: {
          source: "manual",
          catalogProductId: "33333333-3333-4333-8333-333333333333",
          name: "Produto Teste",
        },
      })
    );
    expect(result.success).toBe(true);
  });
});

describe("8.6 themeId null no contrato (F39-07/D10)", () => {
  it("creativeContext.themeId aceita null", () => {
    const brief = baseBrief({ creativeContext: { preserveImageContext: false, themeId: null } });
    expect(brief.creativeContext.themeId).toBeNull();
    expect(campaignBriefSchema.safeParse(brief).success).toBe(true);
  });
});

describe("8.15 clareza metadata.schemaVersion (F39-11/D6)", () => {
  it("runtime: metadata.schemaVersion === campaign_brief_v1", () => {
    const brief = baseBrief();
    expect(brief.metadata.schemaVersion).toBe(CampaignBriefSchemaVersion);
  });

  it("snapshot: schemaVersion no ROOT e metadata SEM schemaVersion (assert de runtime)", () => {
    const snapshot = baseSnapshot();
    expect(snapshot.schemaVersion).toBe(CampaignBriefSchemaVersion);
    expect("schemaVersion" in snapshot.metadata).toBe(false);
  });

  it("snapshot: imagens SEM dataUrl (assert de runtime)", () => {
    const snapshot = baseSnapshot();
    expect("dataUrl" in snapshot.media.images[0]).toBe(false);
  });
});

describe("8.8 validity/legalNotice via buildCampaignBriefFromFlat (F40)", () => {
  const FLAT_BASE = {
    storeId: "44444444-4444-4444-8444-444444444444",
    productName: "Produto Teste",
    discountedPriceCents: 1990,
    badgeText: "Oferta",
    campaignIntent: "offer" as const,
    productImageDataUrl: "data:image/jpeg;base64,test",
  };

  it("validity do form (string) → commercial.validity = { enabled: true, displayText }", () => {
    const brief = buildCampaignBriefFromFlat(
      { ...FLAT_BASE, validity: "até 30/09" },
      FLAT_BASE.storeId
    );
    expect(brief.commercial.validity).toEqual({
      enabled: true,
      displayText: "até 30/09",
    });
  });

  it("mandatoryArtworkText concatenado → commercial.legalNotice.text integral (nova linha preservada)", () => {
    const text = `${ILLUSTRATIVE_NOTICE_TEXT}\nTexto`;
    const brief = buildCampaignBriefFromFlat(
      { ...FLAT_BASE, mandatoryArtworkText: text },
      FLAT_BASE.storeId
    );
    expect(brief.commercial.legalNotice).toEqual({
      enabled: true,
      text,
    });
    expect(getCampaignLegalNotice(brief)?.text).toBe(text);
  });

  it("ausência canônica: sem validity/mandatoryArtworkText → campos ausentes (nunca fabricados)", () => {
    const brief = buildCampaignBriefFromFlat(FLAT_BASE, FLAT_BASE.storeId);
    expect(brief.commercial.validity).toBeUndefined();
    expect(brief.commercial.legalNotice).toBeUndefined();
    expect(getCampaignLegalNotice(brief)).toBeUndefined();
  });
});


// Helper local para testar default do productSchema isolado.
