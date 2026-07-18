import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/require-admin";
import { supabaseAdmin } from "@/lib/supabase/server";
import { apiHandler } from "@/lib/auth/api-handler";
import type { AdminAuditLogEntry } from "@/lib/admin/schemas";

export const GET = apiHandler(async (request: Request) => {
  await requireAdmin();

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10)), 100);
  const offset = (page - 1) * pageSize;
  const actorId = searchParams.get("actorId");
  const action = searchParams.get("action");
  const targetType = searchParams.get("targetType");
  const targetId = searchParams.get("targetId");

  let query = supabaseAdmin
    .from("admin_audit_log")
    .select("*", { count: "exact" });

  if (actorId) query = query.eq("actor_id", actorId);
  if (action) query = query.eq("action", action);
  if (targetType) query = query.eq("target_type", targetType);
  if (targetId) query = query.eq("target_id", targetId);

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const entries = (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id,
    actorId: row.actor_id,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    reason: row.reason,
    operationId: row.operation_id,
    metadata: row.metadata,
    createdAt: row.created_at,
  }));

  return NextResponse.json({
    data: entries as AdminAuditLogEntry[],
    total: count ?? 0,
    page,
    pageSize,
  });
});
