import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/require-admin";
import { apiHandler } from "@/lib/auth/api-handler";
import { requireSameOrigin } from "@/lib/auth/csrf";
import { supabaseAdmin } from "@/lib/supabase/server";
import { TRIAL_OFFER_KEY } from "@/lib/credit/trial-offer/constants";

const UpdateSchema = z
  .object({
    enabled: z.boolean(),
    reason: z.string().trim().min(1, "Motivo obrigatório"),
    operationId: z.string().uuid().optional(),
  })
  .strict();

function safeSettings(data: unknown) {
  const row = (data ?? {}) as Record<string, unknown>;
  return {
    enabled: row.enabled === true,
    launchAt: typeof row.launch_at === "string" ? row.launch_at : null,
  };
}

export const GET = apiHandler(async () => {
  await requireAdmin();

  const { data, error } = await supabaseAdmin
    .from("trial_offer_settings")
    .select("enabled, launch_at")
    .eq("offer_key", TRIAL_OFFER_KEY)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "Não foi possível ler a configuração da oferta" },
      { status: 503 },
    );
  }

  return NextResponse.json(safeSettings(data));
});

export const PUT = apiHandler(async (request: Request) => {
  const admin = await requireAdmin();
  requireSameOrigin(request);

  let parsed: z.infer<typeof UpdateSchema>;
  try {
    parsed = UpdateSchema.parse(await request.json());
  } catch {
    return NextResponse.json(
      { error: "Dados inválidos: enabled, reason (obrigatório)" },
      { status: 400 },
    );
  }

  const { data, error } = await supabaseAdmin.rpc(
    "admin_set_trial_offer_enabled",
    {
      p_enabled: parsed.enabled,
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
      message.includes("missing_enabled")
    ) {
      return NextResponse.json({ error: "Motivo obrigatório" }, { status: 400 });
    }
    if (message.includes("operation_id_conflict")) {
      return NextResponse.json(
        { error: "operation_id_conflict" },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Não foi possível atualizar a oferta" },
      { status: 500 },
    );
  }

  const result = (data ?? {}) as Record<string, unknown>;
  return NextResponse.json({
    success: true,
    idempotent: result.idempotent === true,
    enabled: result.enabled === true,
    launchAt: typeof result.launch_at === "string" ? result.launch_at : null,
  });
});
