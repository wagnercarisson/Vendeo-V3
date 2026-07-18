import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/require-admin";
import { supabaseAdmin } from "@/lib/supabase/server";
import { apiHandler } from "@/lib/auth/api-handler";
import type { AdminUserSummary } from "@/lib/admin/schemas";

export const GET = apiHandler(async (request: Request) => {
  await requireAdmin();

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10)), 100);
  const search = searchParams.get("search") || null;

  const { data, error } = await supabaseAdmin.rpc("admin_get_users_summary", {
    p_search: search,
    p_page: page,
    p_page_size: pageSize,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result = data as { data: AdminUserSummary[]; total: number };

  return NextResponse.json({
    data: result.data,
    total: result.total,
    page,
    pageSize,
  });
});
