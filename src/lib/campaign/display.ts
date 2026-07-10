import "server-only";
import { createServerClient, supabaseAdmin } from "@/lib/supabase/server";
import { IMAGE_GENERATION_GLOBAL_TIMEOUT_MS } from "@/lib/image-generation/config";
import type { CampaignRecord, CampaignStatus } from "./types";

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface CampaignPageProps {
  imageUrl: string | null;
  caption: string;
  hashtags: string[];
  ctaPost: string;
  displayStatus: "ready" | "generating" | "stale" | "error";
  productName: string;
  createdAt: string;
  updatedAt: string;
  downloadUrl: string;
  campaignId: string;
  isPublicationCopyEdited: boolean;
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
): { caption: string; hashtags: string[]; cta_post: string } {
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

export function mapCampaignToProps(campaign: CampaignRecord, id: string): CampaignPageProps {
  const effective = getEffectivePublicationCopy(campaign);
  return {
    imageUrl: null,
    caption: effective.caption,
    hashtags: effective.hashtags,
    ctaPost: effective.cta_post,
    displayStatus: computeDisplayStatus(campaign),
    productName: campaign.product_name ?? "",
    createdAt: campaign.created_at ?? new Date().toISOString(),
    updatedAt: campaign.updated_at ?? new Date().toISOString(),
    downloadUrl: `/api/campaign/${id}/download`,
    campaignId: id,
    isPublicationCopyEdited: campaign.publication_copy_current !== null,
  };
}
