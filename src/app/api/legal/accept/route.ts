import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/require-user";
import { apiHandler } from "@/lib/auth/api-handler";
import { registerAcceptance, registerAllContractAcceptances } from "@/lib/legal/acceptance-service";
import type { DocumentType, AcceptanceSource } from "@/lib/legal/types";

export const POST = apiHandler(async (request: NextRequest) => {
  const user = await requireApiUser();
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;

  const storeId = body.storeId as string;
  if (!storeId) {
    return NextResponse.json({ error: "storeId is required" }, { status: 400 });
  }

  const documentTypes = body.documentTypes as string[] | undefined;
  const source = (body.source as string) ?? "login_reacceptance";

  if (!["onboarding", "login_reacceptance", "admin_invite"].includes(source)) {
    return NextResponse.json({ error: "Invalid acceptance source" }, { status: 400 });
  }

  const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? "unknown";

  const userAgent = request.headers.get("user-agent") ?? "unknown";

  if (documentTypes && documentTypes.length > 0) {
    for (const docType of documentTypes) {
      await registerAcceptance({
        storeId,
        userId: user.userId,
        documentType: docType as DocumentType,
        ipAddress,
        userAgent,
        source: source as AcceptanceSource,
      });
    }
  } else {
    await registerAllContractAcceptances({
      storeId,
      userId: user.userId,
      ipAddress,
      userAgent,
      source: source as AcceptanceSource,
    });
  }

  return NextResponse.json({}, { status: 200 });
});
