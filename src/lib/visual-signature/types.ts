export type VisualSignatureType =
  | "ai_generated"
  | "automatic_generated"
  | "fallback_typographic";

export type VisualSignatureStatus = "draft" | "active" | "archived";

export type GenerationMode = "user_choice" | "automatic" | "fallback";

export type GenerationTier = "image_direct" | "image_retry" | "typographic";

export type CascadeAttemptStatus = "failed" | "rejected" | "timeout";

export interface CascadeAttempt {
  tier: "image_direct" | "image_retry";
  provider: string;
  model: string;
  elapsedMs: number;
  status: CascadeAttemptStatus;
  errorCode: string;
  errorMessageSanitized: string;
}

export interface VisualSignatureMetadata {
  generation_tier: GenerationTier;
  provider?: string;
  model?: string;
  elapsedMs?: number;
  fallbackReason?: string;
  previousAttempts?: CascadeAttempt[];
  totalElapsedMs?: number;
  generationParams?: Record<string, unknown>;
  artDirectorOutput?: VisualSignatureArtDirectorOutput;
}

export interface VisualSignatureRecord {
  id: string;
  store_id: string;
  storage_path: string;
  asset_url: string;
  type: VisualSignatureType;
  status: VisualSignatureStatus;
  generation_mode: GenerationMode | null;
  prompt: string | null;
  metadata: VisualSignatureMetadata | null;
  created_at: string;
  updated_at: string;
}

export interface CreateVisualSignatureInput {
  store_id: string;
  storage_path: string;
  asset_url: string;
  type: VisualSignatureType;
  status: VisualSignatureStatus;
  generation_mode?: GenerationMode;
  prompt?: string;
  metadata?: VisualSignatureMetadata;
}

export interface VisualSignatureSnapshot {
  visualSignatureUrl: string | null;
  visualSignatureType: VisualSignatureType | null;
}

export type CascadeResult =
  | {
      tier: "image_direct" | "image_retry";
      assetUrl: string;
      storagePath: string;
      mimeType: "image/png";
      prompt: string;
      metadata: VisualSignatureMetadata;
    }
  | {
      tier: "typographic";
      assetUrl: string;
      storagePath: string;
      mimeType: "image/svg+xml";
      prompt?: string;
      metadata?: VisualSignatureMetadata;
    };

export type GenerateVariationsResult =
  | { variations: CascadeResult[]; success: true }
  | { success: false; error: string };

export type LogoStatus = 'uploaded' | 'generated' | 'explicit_none' | 'failed' | 'exhausted' | null;

export type GenerationEventType = 'visual_signature' | 'brand_profile_without_logo' | 'brand_profile_with_logo';

export type GenerationEventStatus = 'success' | 'failed' | 'rejected' | 'timeout';

export interface GenerationEventRecord {
  id: string;
  store_id: string;
  generation_type: GenerationEventType;
  provider: string | null;
  model: string | null;
  duration_ms: number | null;
  estimated_cost_usd: number | null;
  attempt_number: number;
  status: GenerationEventStatus;
  error_type: string | null;
  prompt_version: string | null;
  approved: boolean | null;
  rejected: boolean | null;
  asset_generated: boolean | null;
  asset_id: string | null;
  has_logo: boolean | null;
  has_generated_signature: boolean | null;
  has_brand_profile: boolean | null;
  input_data_hash: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface GenerationEventInsert {
  store_id: string;
  generation_type: GenerationEventType;
  provider?: string | null;
  model?: string | null;
  duration_ms?: number | null;
  estimated_cost_usd?: number | null;
  attempt_number?: number;
  status: GenerationEventStatus;
  error_type?: string | null;
  prompt_version?: string | null;
  approved?: boolean | null;
  rejected?: boolean | null;
  asset_generated?: boolean | null;
  asset_id?: string | null;
  has_logo?: boolean | null;
  has_generated_signature?: boolean | null;
  has_brand_profile?: boolean | null;
  input_data_hash?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface VisualSignatureArtDirectorOutput {
  creative_description: string;
  suggested_colors: string[];
  visual_direction: string;
  elements_used: string[];
}

export interface VisualSignatureWithoutLogoInput {
  storeId: string;
  storeName: string;
  segment: string;
  subsegment: string | null;
  tone_of_voice: string | null;
  positioning: string | null;
  short_description: string | null;
  slogan: string | null;
  city: string | null;
  state: string | null;
  brandColor: string | null;
  rejectionContext?: {
    reason: string;
    attempt: number;
  } | null;
}

export interface BrandProfilerInput {
  storeId: string;
  storeName: string;
  segment: string;
  subsegment: string | null;
  tone_of_voice: string | null;
  positioning: string | null;
  short_description: string | null;
  slogan: string | null;
  city: string | null;
  state: string | null;
  brandColor: string | null;
  artDirectorOutput: VisualSignatureArtDirectorOutput;
  visualSignatureId: string;
  assetUrl: string;
  referenceCardUrl?: string | null;
}

export interface BrandProfilerWithoutLogoResult {
  logo_colors_detected: string[];
  safe_color_tokens: Record<string, string>;
  visual_style: string;
  visual_tone: string;
  typography_direction: string;
  brand_personality: string;
  campaign_guidelines: string;
  campaign_brief: string;
  inferred_primary_color: string;
  inferred_accent_color: string;
  confidence_score: number;
}
