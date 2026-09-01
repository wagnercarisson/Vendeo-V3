import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireApiUser } from "@/lib/auth/require-user";
import { requireOwnership } from "@/lib/auth/store-ownership";
import { apiHandler } from "@/lib/auth/api-handler";
import { notFound } from "@/lib/api-error-response";
import { getCampaign, listArtVersions } from "@/lib/campaign/persistence";
import { computeApprovalState, isDeliveryReleased } from "@/lib/campaign/display";
import { isCampaignApprovalEnabled } from "@/lib/feature-flags/feature-flag-service";

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const GET = apiHandler(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params;

  const user = await requireApiUser();

  if (!UUID_V4_REGEX.test(id)) {
    return NextResponse.json({ error: "Invalid campaign ID" }, { status: 400 });
  }

  const campaign = await getCampaign(id);
  if (!campaign) {
    return notFound("Campaign not found");
  }

  await requireOwnership(campaign.store_id, user.userId);

  // F37.1 (D2/decisão 4): gate de aprovação — enquanto a candidata não é
  // aprovada (pending/regenerating com flag on), o download é bloqueado (403).
  // not_enabled/legacy/approved → serve como hoje (approved → storage_path
  // repontado no approve; legacy/not_enabled → path atual).
  if (await isCampaignApprovalEnabled()) {
    const versions = await listArtVersions(campaign.id);
    const state = computeApprovalState(campaign, versions, true);
    if (!isDeliveryReleased(state)) {
      return NextResponse.json({ error: "Campaign pending approval" }, { status: 403 });
    }
  }

  const { data: fileData, error: downloadError } = await supabaseAdmin
    .storage
    .from("campaign-images")
    .download(campaign.storage_path ?? "");

  if (downloadError || !fileData) {
    return NextResponse.json(
      { error: "Failed to download image" },
      { status: 502 }
    );
  }

  const safeName = campaign.product_name.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase() || "campanha";
  const dateStr = campaign.created_at?.split("T")[0] ?? new Date().toISOString().split("T")[0];
  const filename = `${safeName}-${dateStr}.jpg`;

  return new NextResponse(fileData, {
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
});
