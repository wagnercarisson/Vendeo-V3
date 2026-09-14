import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAdmin } from "@/lib/admin/require-admin";
import {
  AiModelSelectionResetSchema,
  AiModelSelectionUpdateSchema,
} from "@/lib/admin/schemas";
import { apiHandler } from "@/lib/auth/api-handler";
import { supabaseAdmin } from "@/lib/supabase/server";
import { buildAiModelSelectionView } from "@/lib/ai/ai-model-selection-view";
import { invalidateModelSelectionCache } from "@/lib/ai/ai-model-selection-service";

function invalidBody(error: ZodError): Response {
  return NextResponse.json({ error: "Dados inválidos", details: error.errors }, { status: 400 });
}

function rpcError(error: { message: string }): Response {
  const message = error.message ?? "";
  const badRequestCodes = [
    "missing_capability", "missing_primary", "missing_reason", "missing_actor_id", "missing_operation_id",
    "model_not_in_catalog", "fallback_not_supported", "incomplete_fallback", "fallback_model_not_in_catalog",
    "primary_equals_fallback",
  ];
  return NextResponse.json({ error: message }, { status: badRequestCodes.some((code) => message.includes(code)) ? 400 : 500 });
}

export const GET = apiHandler(async () => {
  await requireAdmin();
  try {
    return NextResponse.json(await buildAiModelSelectionView());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao ler seleção" }, { status: 500 });
  }
});

export const PUT = apiHandler(async (request: Request) => {
  const admin = await requireAdmin();
  let body;
  try {
    body = AiModelSelectionUpdateSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof ZodError) return invalidBody(error);
    return NextResponse.json({ error: "Corpo da requisição inválido" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.rpc("admin_set_ai_model_selection", {
    p_capability: body.capability,
    p_provider: body.provider,
    p_model: body.model,
    p_protocol: body.protocol,
    p_fallback_provider: body.fallback?.provider ?? null,
    p_fallback_model: body.fallback?.model ?? null,
    p_fallback_protocol: body.fallback?.protocol ?? null,
    p_reason: body.reason,
    p_actor_id: admin.userId,
    p_operation_id: body.operationId,
  });
  if (error) return rpcError(error);
  invalidateModelSelectionCache();
  return NextResponse.json({ selection: data });
});

export const DELETE = apiHandler(async (request: Request) => {
  const admin = await requireAdmin();
  let body;
  try {
    body = AiModelSelectionResetSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof ZodError) return invalidBody(error);
    return NextResponse.json({ error: "Corpo da requisição inválido" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.rpc("admin_reset_ai_model_selection", {
    p_capability: body.capability,
    p_reason: body.reason,
    p_actor_id: admin.userId,
    p_operation_id: body.operationId,
  });
  if (error) return rpcError(error);
  invalidateModelSelectionCache();
  return NextResponse.json({ reset: data });
});
