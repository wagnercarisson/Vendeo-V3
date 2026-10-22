import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/require-admin";
import { apiHandler } from "@/lib/auth/api-handler";
import { requireSameOrigin } from "@/lib/auth/csrf";
import { supabaseAdmin } from "@/lib/supabase/server";

const ActivateSchema = z.object({
  reason: z.string().trim().min(1, "Motivo obrigatório"),
  operationId: z.string().uuid().optional(),
}).strict();

const SAFE_CONFLICT_CODES = new Set([
  "operation_id_conflict",
  "individual_launch_already_set",
  "trial_offer_not_enabled",
  "launch_at_missing",
  "individual_launch_before_launch_at",
]);

export const POST = apiHandler(async (request: Request) => {
  const admin = await requireAdmin();
  requireSameOrigin(request);

  let parsed: z.infer<typeof ActivateSchema>;
  try {
    parsed = ActivateSchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: "Dados inválidos: reason (obrigatório)" },
      { status: 400 },
    );
  }

  const { data, error } = await supabaseAdmin.rpc(
    "admin_activate_trial_offer_individual_launch",
    {
      p_actor_id: admin.userId,
      p_reason: parsed.reason,
      p_operation_id: parsed.operationId ?? crypto.randomUUID(),
    },
  );

  if (error) {
    const message = error.message ?? "";
    if (
      message.includes("missing_reason") ||
      message.includes("missing_operation_id") ||
      message.includes("missing_actor")
    ) {
      return NextResponse.json({ error: "Motivo obrigatório" }, { status: 400 });
    }
    for (const code of SAFE_CONFLICT_CODES) {
      if (message.includes(code)) {
        return NextResponse.json({ error: code }, { status: 409 });
      }
    }
    return NextResponse.json(
      { error: "Não foi possível ativar a oferta por CNPJ completo" },
      { status: 500 },
    );
  }

  const result = (data ?? {}) as Record<string, unknown>;
  return NextResponse.json({
    success: true,
    idempotent: result.idempotent === true,
    individualLaunchAt:
      typeof result.individual_launch_at === "string"
        ? result.individual_launch_at
        : null,
    cohortState: "active",
  });
});
