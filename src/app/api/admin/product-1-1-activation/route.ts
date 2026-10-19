import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAdmin } from "@/lib/admin/require-admin";
import { apiHandler } from "@/lib/auth/api-handler";
import { requireSameOrigin } from "@/lib/auth/csrf";
import { supabaseAdmin } from "@/lib/supabase/server";
import { ProductActivationRequestSchema } from "@/lib/product-1-1/activation/schemas";
import { readProductActivationState } from "@/lib/product-1-1/activation/activation-state";
import { resolveCanonicalInstanceIdentity } from "@/lib/product-1-1/authorization/instance-identity";

export const runtime = "nodejs";

/**
 * F56.2b2e (56.2.7) - acao normal de ativacao/desligamento do Produto 1:1.
 *
 * Uma unica RPC transacional faz flags + autorizacoes. Depois da RPC (inclusive
 * em replay idempotente), o endpoint RELE o estado e devolve `currentMode`;
 * a UI nunca mostra o modo historico do replay como estado atual.
 */
export const POST = apiHandler(async (request: Request) => {
  const admin = await requireAdmin();
  requireSameOrigin(request);

  let body;
  try {
    body = ProductActivationRequestSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Dados invalidos", details: error.errors },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "Corpo da requisicao invalido" },
      { status: 400 },
    );
  }

  const { data, error } = await supabaseAdmin.rpc(
    "admin_set_product_1_1_activation",
    {
      p_actor_id: admin.userId,
      p_mode: body.mode,
      p_instance_identity: resolveCanonicalInstanceIdentity(),
      p_reason: body.reason,
      p_operation_id: body.operationId,
    },
  );

  if (error) {
    const message = error.message ?? "";
    if (message.includes("invalid_mode") || message.includes("missing_")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    if (message.includes("flags_unavailable")) {
      return NextResponse.json({ error: "flags_unavailable" }, { status: 503 });
    }
    console.error("[product-1-1-activation] rpc failed:", message);
    return NextResponse.json(
      { error: "activation_internal_error" },
      { status: 500 },
    );
  }

  const result = (data ?? {}) as Record<string, unknown>;
  if (result.conflict === true) {
    return NextResponse.json(
      { error: "operation_id_conflict", conflict: true },
      { status: 409 },
    );
  }
  if (result.success !== true) {
    return NextResponse.json(
      { error: "activation_rpc_invalid_response" },
      { status: 502 },
    );
  }

  let currentState;
  try {
    currentState = await readProductActivationState();
  } catch (readError) {
    console.error(
      "[product-1-1-activation] current state read failed:",
      readError instanceof Error ? readError.message : String(readError),
    );
    return NextResponse.json(
      { error: "activation_state_unavailable", result },
      { status: 503 },
    );
  }

  return NextResponse.json({
    result,
    currentMode: currentState.mode,
    currentState,
  });
});
