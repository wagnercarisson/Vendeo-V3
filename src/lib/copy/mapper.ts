import type { CampaignBrief } from "@/components/campaign/types";
import type { CopyDirectorInput } from "@/lib/copy/schema";

export function buildOfferText(input: {
  badgeText?: string;
  originalPriceCents?: number;
  discountedPriceCents?: number;
}): string {
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

function formatBRL(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function mapBriefToCopyDirectorInput(
  brief: CampaignBrief,
  input: { badgeText?: string; originalPriceCents?: number; discountedPriceCents?: number }
): CopyDirectorInput {
  const discountedPriceCents = input.discountedPriceCents ?? brief.campaignInput.discountedPriceCents;
  return {
    productName: brief.campaignInput.productName,
    description: brief.campaignInput.description,
    offer: buildOfferText({
      badgeText: input.badgeText ?? brief.campaignInput.badgeText,
      originalPriceCents: input.originalPriceCents ?? brief.campaignInput.originalPriceCents,
      discountedPriceCents,
    }),
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
