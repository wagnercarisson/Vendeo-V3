import type { ResolvedCampaignContext } from "@/components/campaign/types";
import type { CampaignIntent } from "@/lib/campaign/types";
import type { CopyDirectorInput } from "@/lib/copy/schema";

export function buildCommercialFrame(
  campaignIntent: CampaignIntent,
  input: {
    badgeText?: string;
    originalPriceCents?: number;
    discountedPriceCents?: number;
  }
): string {
  switch (campaignIntent) {
    case "offer": {
      if (!input.discountedPriceCents) return "Oferta";
      const formattedDiscounted = formatBRL(input.discountedPriceCents);
      if (input.badgeText) {
        const formattedOriginal = input.originalPriceCents
          ? `de R$ ${(input.originalPriceCents / 100).toFixed(2).replace(".", ",")} por `
          : "";
        return `${input.badgeText}: ${formattedOriginal}R$ ${formattedDiscounted}`;
      }
      return `Apenas R$ ${formattedDiscounted}`;
    }
    case "spotlight": {
      if (!input.discountedPriceCents) return "Destaque do produto";
      const formattedDiscounted = formatBRL(input.discountedPriceCents);
      return `Destaque — R$ ${formattedDiscounted}`;
    }
    case "exclusive": {
      return "Produto exclusivo — sem divulgação de preço";
    }
    default:
      return "Oferta";
  }
}

export function buildOfferText(input: {
  badgeText?: string;
  originalPriceCents?: number;
  discountedPriceCents?: number;
}): string {
  return buildCommercialFrame("offer", input);
}

export function buildDeterministicCopy(
  campaignIntent: CampaignIntent,
  params: {
    productName: string;
    storeName: string;
    commercialFrame?: string;
    discountedPriceCents?: number;
    badgeText?: string;
  }
): { title: string; caption: string; cta_post: string; hashtags: string[] } {
  switch (campaignIntent) {
    case "offer": {
      const commercialFrame = params.commercialFrame ?? buildCommercialFrame("offer", params);
      return {
        title: params.productName,
        caption: `${params.productName} — ${commercialFrame}`,
        cta_post: "Aproveite!",
        hashtags: [],
      };
    }
    case "spotlight": {
      return {
        title: `Novidade na ${params.storeName}!`,
        caption: `${params.productName} — Novo na ${params.storeName}!${params.discountedPriceCents ? ` Preço: R$ ${(params.discountedPriceCents / 100).toFixed(2).replace(".", ",")}` : ""}`,
        cta_post: "Confira!",
        hashtags: [],
      };
    }
    case "exclusive": {
      return {
        title: `Exclusivo na ${params.storeName}!`,
        caption: `${params.productName} — Exclusivo na ${params.storeName}! Produto premium com disponibilidade limitada.`,
        cta_post: "Saiba mais!",
        hashtags: [],
      };
    }
    default:
      return { title: params.productName, caption: params.productName, cta_post: "Aproveite!", hashtags: [] };
  }
}

function formatBRL(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function mapBriefToCopyDirectorInput(
  brief: ResolvedCampaignContext,
  input: { badgeText?: string; originalPriceCents?: number; discountedPriceCents?: number }
): CopyDirectorInput {
  const campaignIntent = (brief.campaignInput.campaignIntent ?? "offer") as CampaignIntent;
  const discountedPriceCents = input.discountedPriceCents ?? brief.campaignInput.discountedPriceCents;
  const commercialFrame = buildCommercialFrame(campaignIntent, {
    badgeText: input.badgeText ?? brief.campaignInput.badgeText,
    originalPriceCents: input.originalPriceCents ?? brief.campaignInput.originalPriceCents,
    discountedPriceCents,
  });
  return {
    productName: brief.campaignInput.productName,
    description: brief.campaignInput.description,
    commercialFrame,
    campaignIntent,
    storeName: brief.store.name,
    segment: brief.store.segment,
    toneOfVoice: brief.store.toneOfVoice ?? undefined,
    positioning: brief.store.positioning ?? undefined,
    shortDescription: brief.store.shortDescription ?? undefined,
    slogan: brief.store.slogan ?? undefined,
    brandPersonality: brief.brandProfile?.brand_personality ?? undefined,
    campaignGuidelines: brief.brandProfile?.campaign_guidelines ?? undefined,
  };
}
