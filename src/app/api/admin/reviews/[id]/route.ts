import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/require-admin";
import { supabaseAdmin } from "@/lib/supabase/server";
import { apiHandler } from "@/lib/auth/api-handler";

export const GET = apiHandler(async (_request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  await requireAdmin();
  const { id } = await params;

  const { data: store, error } = await supabaseAdmin
    .from("stores")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!store) {
    return NextResponse.json({ error: "Loja não encontrada" }, { status: 404 });
  }

  const { data: auditLog } = await supabaseAdmin
    .from("admin_audit_log")
    .select("action, actor_id, created_at, reason, metadata")
    .eq("target_type", "store")
    .eq("target_id", id)
    .order("created_at", { ascending: false })
    .limit(20);

  return NextResponse.json({
    id: store.id,
    name: store.name,
    verification_status: store.verification_status,
    verification_reasons: store.verification_reasons || [],
    verification_data: store.verification_data,
    cnpj_normalized: store.cnpj_normalized,
    cnpj_official_data: store.cnpj_official_data,
    razao_social: store.razao_social,
    nome_fantasia: store.nome_fantasia,
    is_test_store: store.is_test_store,
    created_at: store.created_at,
    audit_log: auditLog || [],
  });
});
