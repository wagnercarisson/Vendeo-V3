import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/require-admin";
import { supabaseAdmin } from "@/lib/supabase/server";
import { CreditService } from "@/lib/credit/credit-service";
import { apiHandler } from "@/lib/auth/api-handler";

const creditService = new CreditService();

export const GET = apiHandler(async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) => {
  await requireAdmin();
  const { id: userId } = await params;

  const store = await supabaseAdmin
    .from("stores")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const storeData = store.data as Record<string, unknown> | null;
  let balance = 0;
  let history: unknown[] = [];
  let campaigns: unknown[] = [];

  if (storeData) {
    const storeId = storeData.id as string;
    balance = await creditService.getBalance(storeId);
    history = await creditService.getHistory(storeId);

    const { data: campData } = await supabaseAdmin
      .from("campaigns")
      .select("*")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false })
      .limit(20);

    campaigns = (campData ?? []) as unknown[];
  }

  return NextResponse.json({
    userId,
    store: storeData ?? null,
    balance,
    history,
    campaigns,
  });
});
