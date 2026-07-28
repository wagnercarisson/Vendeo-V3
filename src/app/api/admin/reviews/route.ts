import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/require-admin";
import { supabaseAdmin } from "@/lib/supabase/server";
import { apiHandler } from "@/lib/auth/api-handler";
import { maskCnpj } from "@/lib/cnpj/mask";

export const GET = apiHandler(async (request: NextRequest) => {
  await requireAdmin();

  const status = request.nextUrl.searchParams.get("status") || "review";
  const page = Math.max(1, parseInt(request.nextUrl.searchParams.get("page") || "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(request.nextUrl.searchParams.get("limit") || "20", 10)));
  const reason = request.nextUrl.searchParams.get("reason");
  const offset = (page - 1) * limit;

  if (!["review", "defer", "rejected", "approved"].includes(status)) {
    return NextResponse.json({ error: "Status inválido" }, { status: 400 });
  }

  let query = supabaseAdmin
    .from("stores")
    .select("id, name, user_id, created_at, verification_status, verification_reasons, verification_data, cnpj_normalized, cnpj_official_data", { count: "exact" })
    .eq("verification_status", status);

  if (reason) {
    query = query.contains("verification_reasons", [reason]);
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const userIds = [...new Set(data.map(s => s.user_id))];
  const { data: users } = await supabaseAdmin
    .from("users")
    .select("id, email")
    .in("id", userIds.length > 0 ? userIds : ["none"]);

  const userMap: Record<string, string> = {};
  for (const u of (users ?? [])) {
    userMap[u.id] = u.email;
  }

  const reviews = (data ?? []).map(s => ({
    id: s.id,
    name: s.name,
    cnpj_masked: s.cnpj_normalized ? maskCnpj(s.cnpj_normalized) : null,
    user_email: userMap[s.user_id] || null,
    created_at: s.created_at,
    reasons: s.verification_reasons || [],
    decision: (s.verification_data as Record<string, unknown> | null)?.signals || null,
    official_data: s.cnpj_official_data,
  }));

  return NextResponse.json({
    data: reviews,
    total: count ?? 0,
    page,
    limit,
  });
});
