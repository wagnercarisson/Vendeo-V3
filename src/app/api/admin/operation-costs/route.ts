import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAdmin } from "@/lib/admin/require-admin";
import { UpdateOperationCostRequestSchema } from "@/lib/admin/schemas";
import { apiHandler } from "@/lib/auth/api-handler";
import {
  OperationCostService,
  OperationCostUnavailableError,
} from "@/lib/credit/operation-cost-service";
import { supabaseAdmin } from "@/lib/supabase/server";

export const GET = apiHandler(async () => {
  await requireAdmin();

  let costs;
  try {
    costs = await new OperationCostService().getAllCosts();
  } catch (err) {
    if (err instanceof OperationCostUnavailableError) {
      return NextResponse.json(
        { error: "operation_cost_unavailable" },
        { status: 503 },
      );
    }
    throw err;
  }

  const userIds = [
    ...new Set(
      costs
        .map((c) => c.updatedByUserId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const { data: users } = await supabaseAdmin
    .from("users")
    .select("id, email")
    .in("id", userIds.length > 0 ? userIds : ["none"]);

  const userMap: Record<string, string> = {};
  for (const u of users ?? []) {
    userMap[u.id] = u.email;
  }

  const operations = costs.map((c) => ({
    operationKey: c.operationKey,
    costCredits: c.costCredits,
    enabled: c.enabled,
    updatedBy: c.updatedByUserId
      ? (userMap[c.updatedByUserId] ?? null)
      : null,
    updatedAt: c.updatedAt,
    source: c.source,
  }));

  return NextResponse.json({ operations });
});

export const PUT = apiHandler(async (request: Request) => {
  const admin = await requireAdmin();

  let body;
  try {
    body = UpdateOperationCostRequestSchema.parse(await request.json());
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Dados inválidos", details: err.errors },
        { status: 400 },
      );
    }
    throw err;
  }

  const { data, error } = await supabaseAdmin.rpc(
    "admin_update_operation_cost",
    {
      p_actor_id: admin.userId,
      p_operation_key: body.operationKey,
      p_cost_credits: body.costCredits,
      p_enabled: null,
      p_reason: body.reason,
      p_operation_id: body.operationId ?? null,
    },
  );

  if (error) {
    const msg = error.message ?? "";
    if (
      msg.includes("operation_key_not_found") ||
      msg.includes("operation_cost_xor_violation") ||
      msg.includes("operation_cost_reason_required") ||
      msg.includes("operation_cost_invalid")
    ) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const result = data as Record<string, unknown>;
  return NextResponse.json({
    operation_key: result.operation_key,
    cost_credits: result.cost_credits,
    enabled: result.enabled,
    audit_id: result.audit_id,
    updated_at: result.updated_at,
    idempotent: result.idempotent,
  });
});
