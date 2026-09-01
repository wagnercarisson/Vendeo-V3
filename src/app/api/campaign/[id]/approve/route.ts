import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSameOrigin } from "@/lib/auth/csrf";
import { requireApiUser } from "@/lib/auth/require-user";
import { requireOwnership } from "@/lib/auth/store-ownership";
import { apiHandler } from "@/lib/auth/api-handler";
import { notFound } from "@/lib/api-error-response";
import { getCampaign } from "@/lib/campaign/persistence";
import { isCampaignApprovalEnabled } from "@/lib/feature-flags/feature-flag-service";
import { supabaseAdmin } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// F37.1 (D6/D8): body estrito — apenas versionId (uuid v4). strict() impede campos extras.
const ApproveBodySchema = z.object({
  versionId: z.string().uuid(),
}).strict();

// F37.1 (D6/D8): aprovação transacional da candidata via RPC approve_campaign_art_version
// (migration 20260901000002). Ordem de guards: CSRF → auth → UUID → getCampaign →
// ownership → flag → status ready → body zod strict → RPC (mapeamento 404/409).
export const POST = apiHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  requireSameOrigin(request);

  const user = await requireApiUser();

  const { id } = await params;
  if (!UUID_V4_REGEX.test(id)) {
    return NextResponse.json({ error: "Invalid campaign ID" }, { status: 400 });
  }

  const campaign = await getCampaign(id);
  if (!campaign) {
    return notFound("Campaign not found");
  }

  await requireOwnership(campaign.store_id, user.userId);

  if (!(await isCampaignApprovalEnabled())) {
    return NextResponse.json({ error: "Approval flow disabled" }, { status: 403 });
  }

  if (campaign.status !== "ready") {
    return NextResponse.json({ error: "Campaign not ready" }, { status: 409 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = ApproveBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body", issues: parsed.error.errors },
      { status: 400 },
    );
  }

  const { data, error } = await supabaseAdmin.rpc("approve_campaign_art_version", {
    p_campaign_id: id,
    p_version_id: parsed.data.versionId,
  });

  if (error) {
    const msg = error.message ?? "";
    if (msg.includes("version_not_found") || msg.includes("version_campaign_mismatch")) {
      return notFound("Version not found");
    }
    if (msg.includes("version_not_pending") || msg.includes("version_not_active")) {
      return NextResponse.json(
        { error: "Version already resolved or invalid" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // Telemetria (D8): sem novo generation_type — o funil usa
  // campaign_art_versions.status + campaigns.approved_at (gravados no RPC).
  return NextResponse.json({
    campaignUrl: `/campanhas/${id}`,
    status: "approved",
  });
});
