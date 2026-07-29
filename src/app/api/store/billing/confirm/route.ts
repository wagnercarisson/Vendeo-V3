import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/require-user";
import { requireOwnership } from "@/lib/auth/store-ownership";
import { supabaseAdmin } from "@/lib/supabase/server";
import { apiHandler } from "@/lib/auth/api-handler";
import { StoreNotFoundError } from "@/lib/auth/store-ownership";
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
    await requireOwnership(storeId, user.userId);
  } catch (err) {
    if (err instanceof StoreNotFoundError) {
      return NextResponse.json({ error: "Loja não encontrada ou acesso negado" }, { status: 404 });
    }
    throw err;
  }

  const upsertData: Record<string, unknown> = {
    store_id: storeId,
    ...(billingData ?? {}),
  };

  if (confirmed) {
    upsertData.billing_data_confirmed_at = new Date().toISOString();
  }

  const { data: result, error } = await supabaseAdmin
    .from("store_billing_info")
    .upsert(upsertData)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, billingInfo: result });
});
