import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/require-user";
import { apiHandler } from "@/lib/auth/api-handler";
import { upsertStoreBillingInfo } from "@/lib/billing/store-billing-info";
import { z } from "zod";

const ConfirmBillingSchema = z.object({
  storeId: z.string().uuid(),
  billingData: z.record(z.unknown()).optional(),
  confirmed: z.boolean(),
});

export const POST = apiHandler(async (request: NextRequest) => {
  const user = await requireApiUser();
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = ConfirmBillingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors.map(e => e.message).join("; ") },
      { status: 400 }
    );
  }

  const { storeId, billingData, confirmed } = parsed.data;

  try {
    const result = await upsertStoreBillingInfo(
      storeId,
      user.userId,
      (billingData ?? {}) as Partial<import("@/lib/billing/store-billing-info").StoreBillingInfo>,
      { confirm: confirmed },
    );

    return NextResponse.json({ success: true, billingInfo: result });
  } catch (err) {
    if (err instanceof Error && err.name === "StoreNotFoundError") {
      return NextResponse.json({ error: "Loja não encontrada ou acesso negado" }, { status: 404 });
    }
    throw err;
  }
});