import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/require-user";
import { apiHandler } from "@/lib/auth/api-handler";
import { getCurrentVersion } from "@/lib/legal/document-versions";
import { registerPrivacyAcknowledgement } from "@/lib/legal/privacy";
import { recordConsentEvent } from "@/lib/legal/consent";

export const POST = apiHandler(async (request: NextRequest) => {
  const user = await requireApiUser();
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const communicationsOptIn = body.communicationsOptIn === true;

  const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? "unknown";

  const userAgent = request.headers.get("user-agent") ?? "unknown";

  try {
    const currentVersion = await getCurrentVersion("privacy_policy");
    if (!currentVersion) {
      console.error("[acknowledge-privacy] No privacy_policy version published");
      return NextResponse.json({}, { status: 200 });
    }

    await registerPrivacyAcknowledgement({
      userId: user.userId,
      version: currentVersion.version,
      ipAddress,
      userAgent,
    });

    if (communicationsOptIn) {
      await recordConsentEvent({
        userId: user.userId,
        consentType: "commercial_communications",
        action: "granted",
        policyVersion: currentVersion.version,
        ipAddress,
        userAgent,
        source: "signup",
      });
    }

    return NextResponse.json({}, { status: 200 });
  } catch (error) {
    console.error("[acknowledge-privacy] Error:", error);
    return NextResponse.json({}, { status: 200 });
  }
});
