import { describe, it, expect } from 'vitest';
import { GenerateImageRequestSchema } from '@/lib/image-generation/schema';
import { CampaignGenerationInputSchema, CampaignSpecSchema } from '@/lib/campaign-intelligence/schema';
import { CopyDirectorInputSchema } from '@/lib/copy/schema';
import { buildCommercialFrame, buildDeterministicCopy } from '@/lib/copy/mapper';

const MINIMAL_IMAGE_REQUEST = {
  storeId: "00000000-0000-0000-0000-000000000001",
  productName: "Produto X",
  productImageDataUrl: "data:image/jpeg;base64,/9j/4AAQSkZJRg",
};

const MINIMAL_CAMPAIGN_INPUT = {
  productName: "Produto X",
  storeName: "Loja Teste",
  storeSegment: "outros",
  brandColor: "#22C55E",
};

describe("F31.2: Schema Intent Contracts", () => {
  it("GenerateImageRequestSchema aceita spotlight sem discountedPriceCents", () => {
    const result = GenerateImageRequestSchema.safeParse({
      ...MINIMAL_IMAGE_REQUEST,
      campaignIntent: "spotlight",
    });
    expect(result.success).toBe(true);
  });

  it("GenerateImageRequestSchema aceita exclusive sem discountedPriceCents", () => {
    const result = GenerateImageRequestSchema.safeParse({
      ...MINIMAL_IMAGE_REQUEST,
      campaignIntent: "exclusive",
    });
    expect(result.success).toBe(true);
  });

  it("GenerateImageRequestSchema aceita offer com discountedPriceCents (regressão)", () => {
    const result = GenerateImageRequestSchema.safeParse({
      ...MINIMAL_IMAGE_REQUEST,
      campaignIntent: "offer",
      discountedPriceCents: 4990,
    });
    expect(result.success).toBe(true);
  });

  it("CampaignSpecSchema aceita discounted_price_display null", () => {
    const result = CampaignSpecSchema.safeParse({
      commercial_copy: { title: "T", subtitle: "S", hook: "H", cta: "C" },
      offer: {
        product_name: "P",
        original_price_display: null,
        discounted_price_display: null,
        badge_text: null,
      },
      visual_parameters: {
        layout_preset: "produto-oferta-comercial",
        composition_type: "standard",
        hierarchy_focus: "product-image",
        palette_accent: "#22C55E",
        badge_style: "pill",
        background_style: "solid-light",
      },
      generation_metadata: {
        provider: "mock",
        model: "v1",
        generated_at: "2026-07-25T12:00:00.000Z",
      },
    });
    expect(result.success).toBe(true);
  });

  it("CampaignSpecSchema rejeita product_name vazio (obrigatório mantido)", () => {
    const result = CampaignSpecSchema.safeParse({
      commercial_copy: { title: "T", subtitle: "S", hook: "H", cta: "C" },
      offer: {
        product_name: "",
        original_price_display: null,
        discounted_price_display: null,
        badge_text: null,
      },
      visual_parameters: {
        layout_preset: "produto-oferta-comercial",
        composition_type: "standard",
        hierarchy_focus: "product-image",
        palette_accent: "#22C55E",
        badge_style: "pill",
        background_style: "solid-light",
      },
      generation_metadata: {
        provider: "mock",
        model: "v1",
        generated_at: "2026-07-25T12:00:00.000Z",
      },
    });
    expect(result.success).toBe(false);
  });

  it("CampaignGenerationInputSchema aceita exclusive sem discountedPriceCents", () => {
    const result = CampaignGenerationInputSchema.safeParse({
      ...MINIMAL_CAMPAIGN_INPUT,
      campaignIntent: "exclusive",
    });
    expect(result.success).toBe(true);
  });

  it("CampaignGenerationInputSchema aceita offer com discountedPriceCents (regressão)", () => {
    const result = CampaignGenerationInputSchema.safeParse({
      ...MINIMAL_CAMPAIGN_INPUT,
      discountedPriceCents: 4990,
    });
    expect(result.success).toBe(true);
  });
});

describe("F31.2: Copy Director", () => {
  it("CopyDirectorInputSchema rejeita commercialFrame vazio", () => {
    const result = CopyDirectorInputSchema.safeParse({
      productName: "X",
      commercialFrame: "",
      storeName: "L",
      segment: "outros",
    });
    expect(result.success).toBe(false);
  });

  it("CopyDirectorInputSchema aceita input mínimo com commercialFrame", () => {
    const result = CopyDirectorInputSchema.safeParse({
      productName: "X",
      commercialFrame: "Promoção: R$ 49,90",
      storeName: "L",
      segment: "outros",
    });
    expect(result.success).toBe(true);
    expect(result.data?.commercialFrame).toBe("Promoção: R$ 49,90");
    expect(result.data?.campaignIntent).toBe("offer");
  });

  it("CopyDirectorInputSchema não contém campo offer", () => {
    const shape = CopyDirectorInputSchema.shape as Record<string, unknown>;
    expect(shape).not.toHaveProperty("offer");
    expect(shape).toHaveProperty("commercialFrame");
  });

  it("buildCommercialFrame retorna texto correto por intent", () => {
    const offer = buildCommercialFrame("offer", { discountedPriceCents: 4990, badgeText: "Promoção" });
    expect(offer).toContain("R$ 49,90");

    const spotlight = buildCommercialFrame("spotlight", { discountedPriceCents: 12990 });
    expect(spotlight).toContain("R$ 129,90");

    const exclusive = buildCommercialFrame("exclusive", {});
    expect(exclusive).toContain("exclusivo");

    const offerSemPreco = buildCommercialFrame("offer", {});
    expect(offerSemPreco).toBe("Oferta");

    const spotlightSemPreco = buildCommercialFrame("spotlight", {});
    expect(spotlightSemPreco).toBe("Destaque do produto");
  });

  it("buildDeterministicCopy gera texto diferente por intent", () => {
    const offer = buildDeterministicCopy("offer", {
      productName: "Tênis",
      storeName: "Loja X",
      commercialFrame: "Promoção: R$ 49,90",
    });
    const exclusive = buildDeterministicCopy("exclusive", {
      productName: "Tênis",
      storeName: "Loja X",
    });
    expect(offer.caption).not.toBe(exclusive.caption);
    expect(exclusive.caption).not.toContain("R$");
    expect(exclusive.caption).toContain("Exclusivo");
    expect(offer.caption).toContain("Promoção");
  });

  it("buildDeterministicCopy spotlight inclui preço quando disponível", () => {
    const result = buildDeterministicCopy("spotlight", {
      productName: "Tênis",
      storeName: "Loja X",
      discountedPriceCents: 12990,
    });
    expect(result.caption).toContain("Novo");
    expect(result.caption).toContain("R$ 129,90");
    expect(result.cta_post).toBe("Confira!");
  });

  it("buildDeterministicCopy spotlight sem preço não exibe valor", () => {
    const result = buildDeterministicCopy("spotlight", {
      productName: "Tênis",
      storeName: "Loja X",
    });
    expect(result.caption).toContain("Novo");
    expect(result.caption).not.toContain("R$");
  });

  it("buildDeterministicCopy exclusive sem preço", () => {
    const result = buildDeterministicCopy("exclusive", {
      productName: "Tênis",
      storeName: "Loja X",
    });
    expect(result.caption).toContain("Exclusivo");
    expect(result.caption).not.toContain("R$");
  });
});
