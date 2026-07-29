import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/auth/api-handler";
import { getStoreReadiness } from "@/lib/store-readiness";
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

  const readiness = await getStoreReadiness(parsed.data.storeId);
  return NextResponse.json(readiness);
});
