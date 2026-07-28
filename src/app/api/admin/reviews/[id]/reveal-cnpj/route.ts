import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/require-admin";
import { supabaseAdmin } from "@/lib/supabase/server";
import { apiHandler } from "@/lib/auth/api-handler";

export const POST = apiHandler(async (_request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin();
  const { id } = await params;

  const { data: store, error } = await supabaseAdmin
    .from("stores")
    .select("id, cnpj_normalized")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!store) {
    return NextResponse.json({ error: "Loja não encontrada" }, { status: 404 });
  }

  await supabaseAdmin.from("admin_audit_log").insert({
    action: "reveal_cnpj",
    target_type: "store",
    target_id: id,
    actor_id: admin.userId,
    reason: "CNPJ revelado por admin",
    metadata: { cnpj_revealed: true },
  });

  return NextResponse.json({ cnpj: store.cnpj_normalized || null });
});
