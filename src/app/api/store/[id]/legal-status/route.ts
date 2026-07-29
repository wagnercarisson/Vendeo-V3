import { NextRequest, NextResponse } from "next/server";
import { requireAuthorizedStore, StoreNotFoundError } from "@/lib/auth/store-ownership";
import { UnauthorizedError } from "@/lib/auth/require-user";
import { apiHandler } from "@/lib/auth/api-handler";
import { getAcceptanceStatus } from "@/lib/legal/acceptance-service";

export const GET = apiHandler(async (
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params;
    await requireAuthorizedStore(id);

    const [tosStatus, aupStatus] = await Promise.all([
      getAcceptanceStatus(id, "terms_of_service"),
      getAcceptanceStatus(id, "acceptable_use"),
    ]);

    return NextResponse.json({
      hasValidAcceptance: tosStatus === "current" && aupStatus === "current",
      tosStatus,
      aupStatus,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof StoreNotFoundError) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }
    throw err;
  }
});
