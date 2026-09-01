import type { CampaignBriefSnapshot } from "./brief";

export type { CampaignBriefSnapshot };

export type CampaignIntent = "offer" | "spotlight" | "exclusive";

export type CampaignStatus = "generating" | "ready" | "error";

// F37.1 (D5/D7): estado de aprovação da campanha + versões de arte.
export type CampaignApprovalStatus = "pending_approval" | "approved";

export type ArtVersionStatus = "pending" | "approved" | "rejected";

export interface CampaignArtVersion {
  id: string;
  campaign_id: string;
  version_number: number; // 1..3
  status: ArtVersionStatus;
  storage_path: string | null; // NULL após descarte do asset
  asset_status: "active" | "discarded";
  asset_deleted_at: string | null;
  brief_snapshot: Record<string, unknown>; // campaign_brief_v1 (F39), sem base64
  render_snapshot: Record<string, unknown> | null;
  generation_metadata: Record<string, unknown> | null;
  rejection_reason: Record<string, unknown> | null;
  correction_in_progress: boolean; // decisão 5 — inalcançável na 37.1
  created_at: string;
}

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
  publication_copy_current: Record<string, unknown> | null;
  storage_path: string;
  error_message: string | null;
  approval_status: CampaignApprovalStatus;
  rejection_count: number;
  approved_version_id: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCampaignInput {
  productName: string;
  inputSnapshot: Record<string, unknown>;
  identitySnapshot?: Record<string, unknown>;
  /** F38.1 (D1/D2): operation_run_id do run (campaign_delivery) — persistido na
   * criação da campanha (campaigns.operation_run_id), preparando o reuso cross-request
   * pela F37. Requests independentes nesta fase ainda criam novo run. */
  operationRunId?: string;
  /** F41 D5: id pré-gerado pela rota (path de inputs {storeId}/{campaignId}/inputs/... conhecido antes do snapshot). */
  campaignId?: string;
  /** F41 D5: registro auxiliar dos inputs persistidos; o snapshot campaign_brief_v1 é o canônico. */
  storagePaths?: Array<{ imageId: string; storagePath: string }>;
}

export interface CampaignReadyData {
  generationMetadata: Record<string, unknown>;
  renderSnapshot: Record<string, unknown>;
  publicationCopySnapshot: Record<string, unknown>;
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
  title?: string;
  caption: string;
  hashtags: string[];
  cta_post: string;
}

export interface GenerationMetadata {
  provider: string;
  model: string;
  durationMs: number;
  generatedAt: string;
  corrections?: Record<string, { from: string; to: string; reason: string }>;
}
