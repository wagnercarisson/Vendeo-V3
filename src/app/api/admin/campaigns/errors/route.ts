import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/require-admin";
import { supabaseAdmin } from "@/lib/supabase/server";
import { apiHandler } from "@/lib/auth/api-handler";
import type { AdminCampaignError } from "@/lib/admin/schemas";

export const GET = apiHandler(async (request: Request) => {
  await requireAdmin();

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10)), 100);
  const offset = (page - 1) * pageSize;

  const { data, error, count } = await supabaseAdmin
    .from("campaigns")
    .select("*, stores(name)", { count: "exact" })
    .eq("status", "error")
    .order("updated_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const campaigns = (data ?? []).map((row: Record<string, unknown>) => ({
    campaignId: row.id,
    productName: row.product_name ?? row.productName ?? "",
    storeId: row.store_id,
    storeName: (row.stores as Record<string, unknown> | undefined)?.name ?? null,
    userEmail: "",
    errorMessage: row.error_message ?? row.errorMessage ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  return NextResponse.json({
    data: campaigns as AdminCampaignError[],
    total: count ?? 0,
    page,
    pageSize,
  });
});
