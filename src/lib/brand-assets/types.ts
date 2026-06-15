export type BrandAssetVariantType = 'original' | 'normalized' | 'on_light' | 'on_dark' | 'square_safe' | 'horizontal_safe';
export type BrandAssetStatus = 'active' | 'archived' | 'failed';
export type BrandAssetSource = 'user_upload' | 'system_generated';

export interface BrandAssetRecord {
  id: string; store_id: string; asset_type: string;
  variant_type: BrandAssetVariantType; source: BrandAssetSource;
  parent_asset_id: string | null; storage_path: string | null;
  mime_type: string; width: number; height: number;
  size_bytes: number; checksum: string; version: number;
  status: BrandAssetStatus; metadata: Record<string, unknown>;
  created_at: string; updated_at: string;
}

export interface CreateBrandAssetInput {
  store_id: string; asset_type?: string; variant_type: BrandAssetVariantType;
  source: BrandAssetSource; parent_asset_id?: string | null;
  storage_path: string | null; mime_type: string;
  width: number; height: number; size_bytes: number;
  checksum: string; version: number; status: BrandAssetStatus;
  metadata?: Record<string, unknown>;
}

export interface BrandAssetVariantGroup {
  original: BrandAssetRecord | null;
  normalized: BrandAssetRecord | null;
  on_light: BrandAssetRecord | null;
  on_dark: BrandAssetRecord | null;
  square_safe: BrandAssetRecord | null;
  horizontal_safe: BrandAssetRecord | null;
}

export type BrandProfileStatus = 'processing' | 'synced' | 'outdated' | 'failed' | 'archived';

export interface BrandProfileRecord {
  id: string; store_id: string; source: string;
  /** Provenance field — points to the original store_brand_assets.id that this profile was derived from.
   *  NEVER nulled after being set. Use identity_state + asset status to determine visual state. */
  active_logo_asset_id: string | null;
  logo_colors_detected: string[];
  brand_colors_chosen: string[];
  safe_color_tokens: Record<string, string>;
  visual_style: string | null; visual_tone: string | null;
  typography_direction: string | null;
  brand_personality: string | null;
  campaign_guidelines: string | null; campaign_brief: string | null;
  confidence_score: number | null;
  metadata: Record<string, unknown>; version: number;
  manual_color_override: Record<string, unknown>;
  status: BrandProfileStatus;
  created_at: string; updated_at: string;
  visual_signature_id?: string | null;
  inferred_primary_color?: string | null;
  inferred_accent_color?: string | null;
  identity_art_director_output?: Record<string, unknown> | null;
}

export interface CreateBrandProfileInput {
  store_id: string; source?: string;
  active_logo_asset_id?: string | null;
  logo_colors_detected?: string[];
  brand_colors_chosen?: string[];
  safe_color_tokens?: Record<string, string>;
  visual_style?: string | null; visual_tone?: string | null;
  typography_direction?: string | null;
  brand_personality?: string | null;
  campaign_guidelines?: string | null; campaign_brief?: string | null;
  confidence_score?: number | null;
  manual_color_override?: Record<string, unknown>;
  metadata?: Record<string, unknown>; version?: number;
  status: BrandProfileStatus;
  visual_signature_id?: string | null;
  inferred_primary_color?: string | null;
  inferred_accent_color?: string | null;
  identity_art_director_output?: Record<string, unknown> | null;
}

export interface StoreDirectionFields {
  subsegment: string | null;
  tone_of_voice: string | null;
  positioning: string | null;
  short_description: string | null;
  slogan: string | null;
}

export interface TextOnlyInferenceInput {
  storeName: string;
  segment: string;
  subsegment: string | null;
  toneOfVoice: string | null;
  positioning: string | null;
  shortDescription: string | null;
  slogan: string | null;
  city: string | null;
  state: string | null;
  userPrimaryColor?: string;
  userAccentColor?: string;
}

export interface TextOnlyInferenceResult {
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

export interface BrandDirectorResult {
  logo_colors_detected: string[];
  safe_color_tokens: Record<string, string>;
  visual_style: string;
  visual_tone: string;
  typography_direction: string;
  brand_personality: string;
  campaign_guidelines: string;
  campaign_brief: string;
  confidence_score: number;
}

export interface LogoUploadResult {
  originalAsset: BrandAssetRecord;
  variants: BrandAssetRecord[];
  profile: BrandProfileRecord | null;
}

export type DriftStatus = 'none' | 'drift' | null

export interface LogoHistoryItem {
  version: number
  asset: BrandAssetRecord
  profile: BrandProfileRecord | null
  created_at: string
  visual_style: string | null
  safe_color_tokens: Record<string, string> | null
  drift_status: DriftStatus
  input_snapshot: Record<string, string | null> | null
}

export interface LogoRestoreRequest {
  asset_id: string
}

export interface LogoRestoreResponse {
  success: boolean
  profile_id: string | null
  drift_detected: boolean
  realigned: boolean
}

export interface VariantGenerationResult {
  variant_type: BrandAssetVariantType;
  buffer: Buffer;
  width: number;
  height: number;
  size_bytes: number;
  success: boolean;
  error?: string;
}
