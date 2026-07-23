import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/require-user";
import { apiHandler } from "@/lib/auth/api-handler";
import { hasValidPrivacyAcknowledgement } from "@/lib/legal/privacy";
import { getEffectiveConsent } from "@/lib/legal/consent";
import { getCurrentStore } from "@/lib/auth/store-ownership";
import { getAcceptanceStatus } from "@/lib/legal/acceptance-service";

export const GET = apiHandler(async (_request: NextRequest) => {
  const user = await requireApiUser();

  const privacyAcknowledged = await hasValidPrivacyAcknowledgement(user.userId);
  const effectiveConsent = await getEffectiveConsent(user.userId, "commercial_communications");

  const store = await getCurrentStore(user.userId);
  let acceptanceStatus: "current" | "outdated" | "never" | null = null;

  if (store) {
    const termsStatus = await getAcceptanceStatus(store.id, "terms_of_service");
    const aupStatus = await getAcceptanceStatus(store.id, "acceptable_use");

    if (termsStatus === "current" && aupStatus === "current") {
      acceptanceStatus = "current";
    } else if (termsStatus === "never" && aupStatus === "never") {
      acceptanceStatus = "never";
    } else {
      acceptanceStatus = "outdated";
    }
  }

  return NextResponse.json({
    privacyAcknowledged,
    effectiveConsent,
    acceptanceStatus,
  });
});
