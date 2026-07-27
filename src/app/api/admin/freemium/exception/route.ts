import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/require-admin";
import { apiHandler } from "@/lib/auth/api-handler";
import { z } from "zod";

const ExceptionSchema = z.object({
  storeId: z.string().uuid(),
  reason: z.string().min(10, "Motivo deve ter no m\u00ednimo 10 caracteres").max(500),
});

export const POST = apiHandler(async (request: NextRequest) => {
  const admin = await requireAdmin();
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  const parsed = ExceptionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors.map(e => e.message).join("; ") },
      { status: 400 }
    );
  }

  const { storeId, reason } = parsed.data;

  const { data, error } = await supabaseAdmin.rpc("admin_grant_freemium_exception", {
    p_store_id: storeId,
    p_reason: reason,
    p_granted_by: admin.userId,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
});
