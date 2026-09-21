import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/auth/api-handler";
import { requireApiUser } from "@/lib/auth/require-user";
import { supabaseAdmin } from "@/lib/supabase/server";

export const GET = apiHandler(async () => {
  const user = await requireApiUser();
  const { data, error } = await supabaseAdmin.from("credit_notifications").select("id,kind,payload,created_at,inapp_read_at").eq("user_id", user.userId).neq("kind", "support_notice").order("created_at", { ascending: false }).limit(20);
  if (error) throw error;
  return NextResponse.json({ notifications: data ?? [], unreadCount: (data ?? []).filter(row => !row.inapp_read_at).length });
});

export const POST = apiHandler(async (request: NextRequest) => {
  const user = await requireApiUser();
  const body = await request.json().catch(() => ({})) as { id?: string };
  if (!body.id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  const { error } = await supabaseAdmin.from("credit_notifications").update({ inapp_read_at: new Date().toISOString() }).eq("id", body.id).eq("user_id", user.userId).is("inapp_read_at", null).neq("kind", "support_notice");
  if (error) throw error;
  return NextResponse.json({ ok: true });
});
