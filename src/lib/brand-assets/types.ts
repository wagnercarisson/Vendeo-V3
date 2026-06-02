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
  status: BrandProfileStatus;
  created_at: string; updated_at: string;
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
  metadata?: Record<string, unknown>; version?: number;
  status: BrandProfileStatus;
}

export interface StoreDirectionFields {
  subsegment: string | null;
  tone_of_voice: string | null;
  positioning: string | null;
  short_description: string | null;
  slogan: string | null;
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

export interface VariantGenerationResult {
  variant_type: BrandAssetVariantType;
  buffer: Buffer;
  width: number;
  height: number;
  size_bytes: number;
  success: boolean;
  error?: string;
}
