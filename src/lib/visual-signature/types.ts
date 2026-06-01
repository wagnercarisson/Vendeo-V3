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
    }
  | {
      tier: "typographic";
      assetUrl: string;
      storagePath: string;
      mimeType: "image/svg+xml";
    };

export type GenerateVariationsResult =
  | { variations: CascadeResult[]; success: true }
  | { success: false; error: string };
