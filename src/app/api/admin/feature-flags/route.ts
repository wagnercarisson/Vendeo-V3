import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAdmin } from "@/lib/admin/require-admin";
import { apiHandler } from "@/lib/auth/api-handler";
import { supabaseAdmin } from "@/lib/supabase/server";
import { FORCE_BRIEF_VISION_CHECK_KEY } from "@/lib/feature-flags/feature-flag-service";

// F43 (D5): superfície admin mínima da flag `force_brief_vision_check` — motivo
// obrigatório + auditoria (`admin_update_feature_flag` RPC) + idempotência via
// operationId (precedente operation-costs/economic-parameters).

export const PUT = apiHandler(async (request: Request) => {
  const admin = await requireAdmin();

  let body: { key: string; enabled: boolean; reason: string; operationId?: string };
  try {
    const raw = await request.json();
    body = raw;
    if (
      typeof body.key !== "string" ||
      body.key.trim() === "" ||
      typeof body.enabled !== "boolean" ||
      typeof body.reason !== "string" ||
      body.reason.trim() === ""
    ) {
      return NextResponse.json(
        { error: "key, enabled e reason (obrigatório) são necessários" },
        { status: 400 },
      );
    }
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Corpo da requisição inválido" },
      { status: 400 },
    );
  }

  const { data, error } = await supabaseAdmin.rpc("admin_update_feature_flag", {
    p_key: body.key.trim(),
    p_enabled: body.enabled,
    p_reason: body.reason.trim(),
    p_actor_id: admin.userId,
    p_operation_id: body.operationId ?? crypto.randomUUID(),
  });

  if (error) {
    const msg = error.message ?? "";
    if (
      msg.includes("missing_key") ||
      msg.includes("missing_reason") ||
      msg.includes("missing_operation_id")
    ) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    if (msg.includes("flag_not_found")) {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const result = data as Record<string, unknown>;
  return NextResponse.json({
    id: result.id,
    key: result.key,
    enabled: result.enabled,
    idempotent: result.idempotent,
  });
});

// GET: retorna o estado atual da flag (tela "Controles operacionais").
export const GET = apiHandler(async () => {
  const admin = await requireAdmin();

  const { data, error } = await supabaseAdmin
    .from("feature_flags")
    .select("id, key, enabled, description, updated_by, updated_at")
    .eq("key", FORCE_BRIEF_VISION_CHECK_KEY)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "Falha ao ler a flag", details: error.message },
      { status: 503 },
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: "feature_flags não encontrada (migration aplicada?)" },
      { status: 404 },
    );
  }

  return NextResponse.json({ flag: data });
});