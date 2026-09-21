import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/auth/api-handler";
import { requireAdmin } from "@/lib/admin/require-admin";
import { requireSameOrigin } from "@/lib/auth/csrf";
import { supabaseAdmin } from "@/lib/supabase/server";

const Patch = z.object({ id: z.string().uuid(), status: z.enum(["forwarded", "responded", "closed"]), reconsiderEligible: z.boolean().optional(), reason: z.string().trim().min(1).max(500) });

export const GET = apiHandler(async () => {
  await requireAdmin();
  const { data, error } = await supabaseAdmin.from("support_credit_requests").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 503 });
  return NextResponse.json({ requests: data ?? [] });
});

export const PATCH = apiHandler(async (request: NextRequest) => {
  const admin = await requireAdmin();
  requireSameOrigin(request);
  const parsed = Patch.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  const now = new Date().toISOString();
  const timestamps = parsed.data.status === "forwarded" ? { acknowledged_at: now } : parsed.data.status === "responded" ? { responded_at: now } : { closed_at: now };
  const { data, error } = await supabaseAdmin.from("support_credit_requests").update({ status: parsed.data.status, ...timestamps }).eq("id", parsed.data.id).eq("status", "received").select().maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Solicitação não encontrada ou já processada" }, { status: 409 });
  await supabaseAdmin.from("admin_audit_log").insert({ actor_id: admin.userId, action: "support_credit_request_update", target_type: "support_credit_request", target_id: parsed.data.id, reason: parsed.data.reason, metadata: { status: parsed.data.status, reconsiderEligible: parsed.data.reconsiderEligible ?? null } });
  return NextResponse.json({ request: data });
});
