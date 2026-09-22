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
  const { data, error } = await supabaseAdmin.rpc("update_support_credit_request", {
    p_actor_id: admin.userId, p_request_id: parsed.data.id, p_status: parsed.data.status,
    p_reconsider_eligible: parsed.data.reconsiderEligible ?? false, p_reason: parsed.data.reason,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: error.message.includes("invalid_support_transition") ? 409 : 500 });
  return NextResponse.json({ request: data });
});
