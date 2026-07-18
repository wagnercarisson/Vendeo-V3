import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/require-admin";
import { supabaseAdmin } from "@/lib/supabase/server";
import { GrantCreditsRequestSchema } from "@/lib/admin/schemas";
import { apiHandler } from "@/lib/auth/api-handler";
import { ZodError } from "zod";

export const POST = apiHandler(async (request: Request) => {
  const admin = await requireAdmin();

  let body;
  try {
    body = GrantCreditsRequestSchema.parse(await request.json());
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Dados inválidos", details: err.errors },
        { status: 400 },
      );
    }
    throw err;
  }

  const { data, error } = await supabaseAdmin.rpc("admin_grant_credits", {
    p_actor_id: admin.userId,
    p_store_id: body.storeId,
    p_amount: body.amount,
    p_reason: body.reason,
    p_operation_id: body.operationId,
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
    transaction_id: result.transaction_id,
    audit_id: result.audit_id,
    idempotent: result.idempotent,
    newBalance: result.newBalance,
  });
});
