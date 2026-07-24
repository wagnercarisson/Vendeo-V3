import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/require-user";
import { apiHandler } from "@/lib/auth/api-handler";
import { recordConsentEvent } from "@/lib/legal/consent";
import { getCurrentVersion } from "@/lib/legal/document-versions";

export const POST = apiHandler(async (request: NextRequest) => {
  const user = await requireApiUser();
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;

  const action = body.action as string;
  if (action !== "granted" && action !== "revoked") {
    return NextResponse.json(
      { error: "action must be 'granted' or 'revoked'" },
      { status: 400 },
    );
  }

  const source = body.source as string;
  if (source !== "signup" && source !== "account_settings") {
    return NextResponse.json(
      { error: "source must be 'signup' or 'account_settings'" },
      { status: 400 },
    );
  }

  const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? "unknown";

  const userAgent = request.headers.get("user-agent") ?? "unknown";

  const currentVersion = await getCurrentVersion("privacy_policy");
  const policyVersion = currentVersion?.version ?? "v1.0";

  await recordConsentEvent({
    userId: user.userId,
    consentType: "commercial_communications",
    action: action as "granted" | "revoked",
    policyVersion,
    ipAddress,
    userAgent,
    source: source as "signup" | "account_settings",
  });

  return NextResponse.json({ ok: true }, { status: 200 });
});
