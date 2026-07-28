import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/require-admin";
import { supabaseAdmin } from "@/lib/supabase/server";
import { apiHandler } from "@/lib/auth/api-handler";

export const POST = apiHandler(async (_request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin();
  const { id } = await params;

  const { data, error } = await supabaseAdmin.rpc("admin_reject_store_verification", {
    p_store_id: id,
    p_admin_id: admin.userId,
  });

  if (error) {
    const msg = error.message?.toLowerCase() ?? "";
    if (msg.includes("store_not_found")) {
      return NextResponse.json({ error: "Loja não encontrada" }, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
});
