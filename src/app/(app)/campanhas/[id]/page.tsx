import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/auth/require-user";
import { getCurrentStore } from "@/lib/auth/store-ownership";
import { listArtVersions } from "@/lib/campaign/persistence";
import { isCampaignApprovalEnabled } from "@/lib/feature-flags/feature-flag-service";
import { supabaseAdmin } from "@/lib/supabase/server";
import { IMAGE_GENERATION_GLOBAL_TIMEOUT_MS } from "@/lib/image-generation/config";
import { getCorrectionReport } from "@/lib/campaign/correction-reports";
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

// F37.2 (R7): teto de staleness do consumo = timeout global de geração + 30s.
const CORRECTION_GENERATION_STALE_AFTER_MS = IMAGE_GENERATION_GLOBAL_TIMEOUT_MS + 30_000;

export default async function CampaignDetailPage({ params }: PageProps) {
  const { id } = await params;

  const user = await requirePageUser();

  const store = await getCurrentStore(user.userId);
  if (!store) {
    notFound();
  }

  let campaign = await getCampaignForDisplay(id);
  if (!campaign) {
    notFound();
  }

  let props = mapCampaignToProps(campaign, id);

  if (campaign.status === "ready" && campaign.storage_path) {
    const signedUrl = await generateSignedPreviewUrl(campaign.storage_path);
    props.imageUrl = signedUrl;
  }

  // F37.1 (D2/decisão 3) + F37.2 (R1/R7): deriva o estado de aprovação para
  // campanhas ready. `pending` (v1/v2) e `regenerating` ganham props da candidata
  // ativa; os demais estados (approved/legacy/not_enabled) seguem como entrega.
  if (campaign.status === "ready") {
    const flagEnabled = await isCampaignApprovalEnabled();
    let versions = flagEnabled ? await listArtVersions(id) : [];
    let state = computeApprovalState(campaign, versions, flagEnabled);

    // F37.2 (R7): recuperação preguiçosa — se derivou `regenerating`, tenta
    // reverter um consumo preso além do teto. Se `recovered:true`, RECARREGA
    // campanha/versões do banco ANTES de recalcular (nunca re-derivar sobre os
    // mesmos objetos em memória).
    if (state.status === "regenerating") {
      try {
        const { data: recoverData, error: recoverError } = await supabaseAdmin.rpc(
          "recover_campaign_correction_generation",
          {
            p_campaign_id: id,
            p_stale_before: new Date(
              Date.now() - CORRECTION_GENERATION_STALE_AFTER_MS
            ).toISOString(),
          }
        );
        if (recoverError) {
          console.error(
            `[campanhas/[id]] recover_campaign_correction_generation failed (best-effort) — ${recoverError.message}`
          );
        }
        if ((recoverData as { recovered?: boolean } | null)?.recovered === true) {
          const reloaded = await getCampaignForDisplay(id);
          if (reloaded) {
            campaign = reloaded;
            versions = await listArtVersions(id);
            state = computeApprovalState(campaign, versions, flagEnabled);
            props = mapCampaignToProps(campaign, id);
            if (campaign.status === "ready" && campaign.storage_path) {
              props.imageUrl = await generateSignedPreviewUrl(campaign.storage_path);
            }
          }
        }
      } catch (err) {
        console.error(
          `[campanhas/[id]] recover exception (best-effort) — ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }
    }

    if (state.status === "pending" || state.status === "regenerating") {
      const candidate = getActiveCandidateArtVersion(versions);
      const isV1 = candidate?.version_number === 1;

      let hasOpportunity = false;
      if (isV1) {
        try {
          const report = await getCorrectionReport(id);
          hasOpportunity = !report || report.status === "open";
        } catch (err) {
          console.error(
            `[campanhas/[id]] getCorrectionReport failed (best-effort) — ${
              err instanceof Error ? err.message : String(err)
            }`
          );
        }
      }

      props.approval = {
        state,
        candidateImageUrl: candidate?.storage_path
          ? await generateSignedPreviewUrl(candidate.storage_path)
          : null,
        candidateVersionId: candidate?.id ?? null,
        isV1,
        hasOpportunity,
      };
    }
  }

  return <CampaignPageClient {...props} />;
}
