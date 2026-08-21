import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAdmin } from "@/lib/admin/require-admin";
import { apiHandler } from "@/lib/auth/api-handler";
import { supabaseAdmin } from "@/lib/supabase/server";
import { ALL_FEATURE_FLAG_KEYS } from "@/lib/feature-flags/feature-flag-service";

// F43 (D5) + QCW: superfície admin das flags operacionais — motivo obrigatório
// + auditoria (`admin_update_feature_flag` RPC, genérico por key) +
// idempotência via operationId (precedente operation-costs/economic-parameters).

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

// GET: retorna a lista de flags operacionais (tela "Controles operacionais").
export const GET = apiHandler(async () => {
  const admin = await requireAdmin();

  const { data, error } = await supabaseAdmin
    .from("feature_flags")
    .select("id, key, enabled, description, updated_by, updated_at")
    .in("key", [...ALL_FEATURE_FLAG_KEYS]);

  if (error) {
    return NextResponse.json(
      { error: "Falha ao ler as flags", details: error.message },
      { status: 503 },
    );
  }

  return NextResponse.json({ flags: data ?? [] });
});