export type CampaignStatus = "generating" | "ready" | "error";

export interface CampaignRecord {
  id: string;
  store_id: string;
  status: CampaignStatus;
  product_name: string;
  input_snapshot: Record<string, unknown> | null;
  identity_snapshot: Record<string, unknown> | null;
  generation_metadata: Record<string, unknown> | null;
  render_snapshot: Record<string, unknown> | null;
  publication_copy_snapshot: Record<string, unknown> | null;
  storage_path: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCampaignInput {
  productName: string;
  inputSnapshot: Record<string, unknown>;
  identitySnapshot?: Record<string, unknown>;
}

export interface CampaignReadyData {
  generationMetadata: Record<string, unknown>;
  renderSnapshot: Record<string, unknown>;
  publicationCopySnapshot: Record<string, unknown>;
}

export interface InputSnapshot {
  productName: string;
  originalPriceCents?: number;
  discountedPriceCents: number;
  badgeText?: string;
  hook?: string;
  cta?: string;
  description?: string;
  objective?: string;
  campaignDetails?: string;
  additionalDetails?: string;
  targetChannel?: string;
  format?: string;
  validity?: string;
  availabilityNotes?: string;
  sensitiveConstraints?: string;
  inputValidationOverride?: string;
  productImage: { provided: true; mimeType: string };
}

export interface IdentitySnapshot {
  storeName: string;
  storeSegment: string;
  brandColor: string;
  identityState: "text_only" | "logo" | "visual_signature";
  signature: { url: string | null; type: "logo" | "visual_signature" | null };
  storeInitials: string;
  brandProfile?: string;
  toneOfVoice?: string;
  subsegment?: string;
  positioning?: string;
  shortDescription?: string;
  slogan?: string;
}

export interface RenderSnapshot {
  format: "jpeg";
  width: 1080;
  height: 1080;
  aspectRatio: "1:1";
  mimeType: "image/jpeg";
  quality: 90;
  colorSpace: "srgb";
}

export interface PublicationCopySnapshot {
  title: string;
  subtitle?: string;
  hook: string;
  cta: string;
  badgeText: string;
  priceDisplay: string;
}

export interface GenerationMetadata {
  provider: string;
  model: string;
  durationMs: number;
  generatedAt: string;
  corrections?: Record<string, { from: string; to: string; reason: string }>;
}
