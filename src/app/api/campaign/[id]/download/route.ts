import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireApiUser } from "@/lib/auth/require-user";
import { requireOwnership } from "@/lib/auth/store-ownership";
import { apiHandler } from "@/lib/auth/api-handler";
import { notFound } from "@/lib/api-error-response";
import { getCampaign } from "@/lib/campaign/persistence";

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

  const { data: signedData, error: signedError } = await supabaseAdmin
    .storage
    .from("campaign-images")
    .createSignedUrl(campaign.storage_path ?? "", 3600);

  if (signedError || !signedData?.signedUrl) {
    return NextResponse.json(
      { error: "Failed to generate download URL" },
      { status: 502 }
    );
  }

  return NextResponse.redirect(signedData.signedUrl, 302);
});
