import "server-only";
import { createServerClient, supabaseAdmin } from "@/lib/supabase/server";
import { IMAGE_GENERATION_GLOBAL_TIMEOUT_MS } from "@/lib/image-generation/config";
import type {
  CampaignArtVersion,
  CampaignRecord,
  CampaignStatus,
} from "./types";

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// F37.1 (D2): estado de aprovação da campanha — derivado de campaign_art_versions
// + campaigns (single source). `regenerating` deriva do marcador
// correction_in_progress (decisão 5) e é inalcançável na 37.1 (nenhum fluxo o
// ativa — correção é 37.2); entra no contrato para preservar isDeliveryReleased.
export type ApprovalDisplayState =
  | { status: "not_enabled" } // flag off → comportamento atual (entrega livre)
  | { status: "legacy" } // flag on, zero linhas em campaign_art_versions → entregue como hoje
  | { status: "pending" } // flag on, campanha nova não aprovada → revisão (gate)
  | { status: "approved"; approvedAt: string }
  | { status: "regenerating" }; // derivado de correction_in_progress (decisão 5) — inalcançável na 37.1

export interface CampaignPageProps {
  imageUrl: string | null;
  caption: string;
  hashtags: string[];
  ctaPost: string;
  title?: string;
  displayStatus: "ready" | "generating" | "stale" | "error";
  productName: string;
  createdAt: string;
  updatedAt: string;
  downloadUrl: string;
  campaignId: string;
  isPublicationCopyEdited: boolean;
  /** F37.1 (D2/decisão 3): estado de aprovação + candidata ativa (só quando pending). */
  approval?: {
    state: ApprovalDisplayState;
    candidateImageUrl?: string | null;
    candidateVersionId?: string | null;
  };
}

export async function getCampaignForDisplay(id: string): Promise<CampaignRecord | null> {
  if (!UUID_V4_REGEX.test(id)) {
    return null;
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as CampaignRecord | null;
}

export async function generateSignedPreviewUrl(storagePath: string): Promise<string | null> {
  if (!storagePath) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .storage
    .from("campaign-images")
    .createSignedUrl(storagePath, 3600);

  if (error) {
    throw new Error(error.message);
  }

  return data.signedUrl;
}

export function getEffectivePublicationCopy(
  campaign: CampaignRecord
): { title?: string; caption: string; hashtags: string[]; cta_post: string } {
  const current = campaign.publication_copy_current as Record<string, unknown> | null;
  const snapshot = campaign.publication_copy_snapshot as Record<string, unknown> | null;

  if (
    current &&
    typeof current.caption === "string" &&
    Array.isArray(current.hashtags) &&
    current.hashtags.every((tag) => typeof tag === "string") &&
    typeof current.cta_post === "string"
  ) {
    return {
      title: typeof current.title === "string" ? current.title : undefined,
      caption: current.caption,
      hashtags: current.hashtags,
      cta_post: current.cta_post,
    };
  }

  if (
    snapshot &&
    typeof snapshot.caption === "string" &&
    Array.isArray(snapshot.hashtags) &&
    snapshot.hashtags.every((tag) => typeof tag === "string") &&
    typeof snapshot.cta_post === "string"
  ) {
    return {
      title: typeof snapshot.title === "string" ? snapshot.title : undefined,
      caption: snapshot.caption,
      hashtags: snapshot.hashtags,
      cta_post: snapshot.cta_post,
    };
  }

  return { caption: "", hashtags: [], cta_post: "" };
}

export function computeDisplayStatus(
  campaign: { status: CampaignStatus; updated_at: string }
): "ready" | "generating" | "stale" | "error" {
  if (campaign.status === "ready") return "ready";
  if (campaign.status === "error") return "error";

  if (campaign.status === "generating") {
    const staleThreshold = IMAGE_GENERATION_GLOBAL_TIMEOUT_MS + 30_000;
    const elapsed = Date.now() - new Date(campaign.updated_at).getTime();
    if (elapsed > staleThreshold) return "stale";
    return "generating";
  }

  return "error";
}

// F37.1 (D2): deriva o estado de aprovação da campanha. Ordem: !flagEnabled →
// not_enabled; flag + zero versões → legacy; approved_version_id → approved
// (+approvedAt); candidata ativa com correction_in_progress → regenerating
// (inalcançável na 37.1 — contrato reservado); senão pending. NÃO deriva de
// campaign.status (decisão 5 — permanece generating|ready|error).
export function computeApprovalState(
  campaign: CampaignRecord,
  versions: CampaignArtVersion[],
  flagEnabled: boolean
): ApprovalDisplayState {
  if (!flagEnabled) {
    return { status: "not_enabled" };
  }

  if (versions.length === 0) {
    return { status: "legacy" };
  }

  if (campaign.approved_version_id != null) {
    return {
      status: "approved",
      approvedAt: campaign.approved_at ?? "",
    };
  }

  const activeCandidate = versions.find((v) => v.asset_status === "active");
  if (activeCandidate?.correction_in_progress === true) {
    return { status: "regenerating" };
  }

  return { status: "pending" };
}

// F37.1 (D2): true para not_enabled | legacy | approved; false para pending |
// regenerating. Base fail-closed dos gates de download/publication-copy.
export function isDeliveryReleased(state: ApprovalDisplayState): boolean {
  switch (state.status) {
    case "not_enabled":
    case "legacy":
    case "approved":
      return true;
    case "pending":
    case "regenerating":
      return false;
  }
}

// F37.1 (decisão 3): retorna a candidata ativa (asset_status='active') — fonte
// oficial da arte da revisão. null → legado usa campaigns.storage_path; aprovada
// usa campaigns.storage_path repontado no approve (D8).
export function getActiveCandidateArtVersion(
  versions: CampaignArtVersion[]
): CampaignArtVersion | null {
  return versions.find((v) => v.asset_status === "active") ?? null;
}

export function mapCampaignToProps(campaign: CampaignRecord, id: string): CampaignPageProps {
  const effective = getEffectivePublicationCopy(campaign);
  return {
    imageUrl: null,
    caption: effective.caption,
    hashtags: effective.hashtags,
    ctaPost: effective.cta_post,
    title: effective.title ?? undefined,
    displayStatus: computeDisplayStatus(campaign),
    productName: campaign.product_name ?? "",
    createdAt: campaign.created_at ?? new Date().toISOString(),
    updatedAt: campaign.updated_at ?? new Date().toISOString(),
    downloadUrl: `/api/campaign/${id}/download`,
    campaignId: id,
    isPublicationCopyEdited: campaign.publication_copy_current !== null,
  };
}
