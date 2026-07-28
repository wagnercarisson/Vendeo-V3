import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/require-admin";
import { supabaseAdmin } from "@/lib/supabase/server";
import { apiHandler } from "@/lib/auth/api-handler";

export const POST = apiHandler(async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin();
  const { id } = await params;

  const body = await request.json().catch(() => null);
  const reason = body?.reason;

  if (!reason || typeof reason !== "string" || reason.trim().length < 3) {
    return NextResponse.json({ error: "Motivo da exceção é obrigatório (mínimo 3 caracteres)" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.rpc("admin_exception_store_verification", {
    p_store_id: id,
    p_admin_id: admin.userId,
    p_reason: reason.trim(),
  });

  if (error) {
    const msg = error.message?.toLowerCase() ?? "";
    if (msg.includes("store_not_found")) {
      return NextResponse.json({ error: "Loja não encontrada" }, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result = data as Record<string, unknown>;
  return NextResponse.json({
    success: true,
    onboardingGranted: true,
  });
});
