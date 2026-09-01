import { NextRequest, NextResponse } from "next/server";
import { requireSameOrigin } from "@/lib/auth/csrf";
import { requireApiUser } from "@/lib/auth/require-user";
import { getCampaign, listArtVersions } from "@/lib/campaign/persistence";
import { requireOwnership } from "@/lib/auth/store-ownership";
import { validatePublicationCopy } from "@/lib/campaign/publication-copy";
import { computeApprovalState, isDeliveryReleased } from "@/lib/campaign/display";
import { isCampaignApprovalEnabled } from "@/lib/feature-flags/feature-flag-service";
import { supabaseAdmin } from "@/lib/supabase/server";
import { apiHandler } from "@/lib/auth/api-handler";
import { notFound } from "@/lib/api-error-response";

export const dynamic = "force-dynamic";

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const PATCH = apiHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  requireSameOrigin(request);

  const user = await requireApiUser();

  const { id } = await params;
  if (!UUID_V4_REGEX.test(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const campaign = await getCampaign(id);
  if (!campaign) {
    return notFound("Campaign not found");
  }

  await requireOwnership(campaign.store_id, user.userId);

  // F37.1 (D2/decisão 4): gate de aprovação — enquanto a candidata não é
  // aprovada (pending/regenerating com flag on), a edição/restore da copy é
  // bloqueada (403, nada persistido). not_enabled/legacy/approved → normal.
  if (await isCampaignApprovalEnabled()) {
    const versions = await listArtVersions(campaign.id);
    const state = computeApprovalState(campaign, versions, true);
    if (!isDeliveryReleased(state)) {
      return NextResponse.json({ error: "Campaign pending approval" }, { status: 403 });
    }
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const validation = validatePublicationCopy(body);
  if (!validation.valid) {
    return NextResponse.json(
      { error: "Validation failed", issues: validation.issues },
      { status: 400 },
    );
  }

  if ("restore" in validation.data && validation.data.restore === true) {
    const { error: updateError } = await supabaseAdmin
      .from("campaigns")
      .update({ publication_copy_current: null })
      .eq("id", id);

    if (updateError) throw new Error(updateError.message);

    const snapshot = campaign.publication_copy_snapshot as Record<string, unknown> | null;
    return NextResponse.json({
      restored: true,
      publication_copy_snapshot: snapshot ?? { caption: "", hashtags: [], cta_post: "" },
    });
  }

  const { error: updateError } = await supabaseAdmin
    .from("campaigns")
    .update({ publication_copy_current: validation.data })
    .eq("id", id);

  if (updateError) throw new Error(updateError.message);

  return NextResponse.json({ publication_copy_current: validation.data });
});
