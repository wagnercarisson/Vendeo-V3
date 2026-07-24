import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/require-user";
import { apiHandler } from "@/lib/auth/api-handler";
import { hasValidPrivacyAcknowledgement } from "@/lib/legal/privacy";
import { getEffectiveConsent } from "@/lib/legal/consent";
import { getAcceptanceStatus } from "@/lib/legal/acceptance-service";

export const GET = apiHandler(async (request: NextRequest) => {
  const user = await requireApiUser();
  const { searchParams } = new URL(request.url);
  const storeId = searchParams.get("storeId");

  const privacyAcknowledged = await hasValidPrivacyAcknowledgement(user.userId);
  const effectiveConsent = await getEffectiveConsent(user.userId, "commercial_communications");

  let acceptanceStatus: "current" | "outdated" | "never" | null = null;
  if (storeId) {
    const termsStatus = await getAcceptanceStatus(storeId, "terms_of_service");
    const aupStatus = await getAcceptanceStatus(storeId, "acceptable_use");

    if (termsStatus === "current" && aupStatus === "current") {
      acceptanceStatus = "current";
    } else if (termsStatus === "outdated" || aupStatus === "outdated") {
      acceptanceStatus = "outdated";
    } else {
      acceptanceStatus = "never";
    }
  }

  return NextResponse.json({ privacyAcknowledged, effectiveConsent, acceptanceStatus });
});
