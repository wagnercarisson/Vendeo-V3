import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/require-admin";
import { supabaseAdmin } from "@/lib/supabase/server";
import { GrantCreditsRequestSchema } from "@/lib/admin/schemas";
import { CreditService } from "@/lib/credit/credit-service";
import { apiHandler } from "@/lib/auth/api-handler";
import { ZodError } from "zod";

const creditService = new CreditService();

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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const newBalance = await creditService.getBalance(body.storeId);

  return NextResponse.json({
    transaction_id: (data as Record<string, unknown>).transaction_id,
    audit_id: (data as Record<string, unknown>).audit_id,
    idempotent: (data as Record<string, unknown>).idempotent,
    newBalance,
  });
});
