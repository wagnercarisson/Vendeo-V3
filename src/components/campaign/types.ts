import type { CampaignSpec } from "@/lib/campaign-intelligence/schema";
import type { VisualSignatureType } from "@/lib/visual-signature/types";

export interface BrandProfileSnapshot {
  brand_colors_chosen: string[];
  safe_color_tokens: Record<string, string>;
  visual_style: string | null;
  visual_tone: string | null;
  brand_personality: string | null;
  campaign_guidelines: string | null;
  campaign_brief: string | null;
  logoVariantUrl: string | null;
}

export interface StoreIdentitySnapshot {
  storeName: string;
  storeSegment: string;
  brandColor: string;
  logoUrl: string | null;
  visualSignatureUrl: string | null;
  visualSignatureType: VisualSignatureType | null;
  storeInitials: string;
  brandProfile: BrandProfileSnapshot | null;
  toneOfVoice: string | null;
  subsegment: string | null;
  positioning: string | null;
  shortDescription: string | null;
  slogan: string | null;
}

export interface PreviewPayload {
  campaignSpec: CampaignSpec;
  storeIdentity: StoreIdentitySnapshot;
  productImageUrl: string | null;
  generatedImageDataUrl?: string;
  generatedAt: string;
}

export interface CampaignAdjustments {
  title?: string;
  discountedPriceDisplay?: string;
  badgeText?: string;
  hook?: string;
  cta?: string;
}

export const SEGMENT_PALETTES: Record<string, { background: string; accent: string }> = {
  "moda-calcados-acessorios": { background: "#FAFAFA", accent: "#EC4899" },
  "bebidas-adegas-conveniencia": { background: "#FFF7ED", accent: "#EA580C" },
  "padaria-confeitaria-doces": { background: "#FFFBEB", accent: "#D97706" },
  "beleza-estetica": { background: "#FAF5FF", accent: "#D946EF" },
  "petshop": { background: "#FFFFFF", accent: "#F97316" },
  "variedades-utilidades": { background: "#FFFFFF", accent: "#A855F7" },
  "mercados-mercearias": { background: "#F0FDF4", accent: "#16A34A" },
  "restaurantes-lanchonetes": { background: "#FFF7ED", accent: "#EA580C" },
  "farmacia-saude": { background: "#F0FDF4", accent: "#16A34A" },
  "casa-decoracao": { background: "#FFFDF5", accent: "#D97706" },
  "eletronicos-tecnologia": { background: "#F8FAFC", accent: "#2563EB" },
  "servicos-locais": { background: "#EFF6FF", accent: "#0EA5E9" },
  "outros": { background: "#FFFFFF", accent: "#22C55E" },
};

export function resolveCampaignAccentColor(
  paletteAccent: string,
  storeSegment: string,
  brandColor: string
): string {
  if (paletteAccent && paletteAccent !== "#000000") return paletteAccent;
  const segmentPalette = SEGMENT_PALETTES[storeSegment];
  if (segmentPalette) return segmentPalette.accent;
  return brandColor || "#22C55E";
}

export function resolveCampaignBackgroundColor(storeSegment: string): string {
  const segmentPalette = SEGMENT_PALETTES[storeSegment];
  return segmentPalette?.background || "#FFFFFF";
}

export function getStoreInitials(storeName: string): string {
  const words = storeName.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return storeName.trim().slice(0, 2).toUpperCase();
}
