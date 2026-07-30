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
  const includeTest = searchParams.get("include_test") === "1";

  const query = supabaseAdmin
    .from("campaigns")
    .select("*, stores!inner(name, user_id, is_test_store)", { count: "exact" })
    .eq("status", "error");

  if (!includeTest) {
    query.eq("stores.is_test_store", false);
  }

  const { data, error, count } = await query
    .order("updated_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const storeUserIds = [
    ...new Set(
      (data ?? []).map(
        (row: Record<string, unknown>) =>
          (row.stores as Record<string, unknown> | undefined)?.user_id as string,
      ).filter(Boolean) as string[],
    ),
  ];

  const emailMap = new Map<string, string>();
  if (storeUserIds.length > 0) {
    const { data: emails } = await supabaseAdmin.rpc("admin_get_user_emails", {
      p_user_ids: storeUserIds,
    });
    if (emails) {
      for (const entry of emails as Array<{ user_id: string; email: string }>) {
        emailMap.set(entry.user_id, entry.email);
      }
    }
  }

  const campaigns = (data ?? []).map((row: Record<string, unknown>) => ({
    campaignId: row.id,
    productName: row.product_name ?? row.productName ?? "",
    storeId: row.store_id,
    storeName: (row.stores as Record<string, unknown> | undefined)?.name ?? null,
    userEmail: emailMap.get((row.stores as Record<string, unknown> | undefined)?.user_id as string) ?? "",
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
