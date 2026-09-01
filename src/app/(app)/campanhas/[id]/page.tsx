import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/auth/require-user";
import { getCurrentStore } from "@/lib/auth/store-ownership";
import { listArtVersions } from "@/lib/campaign/persistence";
import { isCampaignApprovalEnabled } from "@/lib/feature-flags/feature-flag-service";
import {
  getCampaignForDisplay,
  generateSignedPreviewUrl,
  mapCampaignToProps,
  computeApprovalState,
  getActiveCandidateArtVersion,
} from "@/lib/campaign/display";
import CampaignPageClient from "./client";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CampaignDetailPage({ params }: PageProps) {
  const { id } = await params;

  const user = await requirePageUser();

  const store = await getCurrentStore(user.userId);
  if (!store) {
    notFound();
  }

  const campaign = await getCampaignForDisplay(id);
  if (!campaign) {
    notFound();
  }

  const props = mapCampaignToProps(campaign, id);

  if (campaign.status === "ready" && campaign.storage_path) {
    const signedUrl = await generateSignedPreviewUrl(campaign.storage_path);
    props.imageUrl = signedUrl;
  }

  // F37.1 (D2/decisão 3): deriva o estado de aprovação para campanhas ready.
  // pending → props.approval com a candidata ativa (fonte oficial da arte da
  // revisão); demais estados (approved/legacy/not_enabled) → sem approval
  // (ReadyView como hoje, arte de campaigns.storage_path).
  if (campaign.status === "ready") {
    const flagEnabled = await isCampaignApprovalEnabled();
    const versions = flagEnabled ? await listArtVersions(id) : [];
    const state = computeApprovalState(campaign, versions, flagEnabled);
    if (state.status === "pending") {
      const candidate = getActiveCandidateArtVersion(versions);
      props.approval = {
        state,
        candidateImageUrl: candidate?.storage_path
          ? await generateSignedPreviewUrl(candidate.storage_path)
          : null,
        candidateVersionId: candidate?.id ?? null,
      };
    }
  }

  return <CampaignPageClient {...props} />;
}
