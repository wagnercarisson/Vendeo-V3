import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/auth/api-handler";
import { getStoreReadiness } from "@/lib/store-readiness";
import { requireAuthorizedStore, StoreNotFoundError } from "@/lib/auth/store-ownership";
import { UnauthorizedError } from "@/lib/auth/require-user";
import { z } from "zod";

const CheckReadinessSchema = z.object({
  storeId: z.string().uuid(),
});

export const POST = apiHandler(async (request: NextRequest) => {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = CheckReadinessSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors.map(e => e.message).join("; ") },
      { status: 400 }
    );
  }

  try {
    await requireAuthorizedStore(parsed.data.storeId);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof StoreNotFoundError) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }
    throw err;
  }

  const readiness = await getStoreReadiness(parsed.data.storeId);
  return NextResponse.json(readiness);
});
