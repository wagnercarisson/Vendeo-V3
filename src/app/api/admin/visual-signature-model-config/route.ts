import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { requireAdmin } from "@/lib/admin/require-admin";
import {
  VisualSignatureModelConfigResetSchema,
  VisualSignatureModelConfigUpdateSchema,
  VisualSignatureReleaseCommandSchema,
} from "@/lib/admin/schemas";
import { apiHandler } from "@/lib/auth/api-handler";
import { requireSameOrigin } from "@/lib/auth/csrf";
import { supabaseAdmin } from "@/lib/supabase/server";
import { buildVisualSignatureModelConfigView } from "@/lib/ai/visual-signature-model-config-view";
import { invalidateVisualSignatureModelConfigCache } from "@/lib/ai/visual-signature-model-config-service";
import {
  VisualSignatureValidationGuardError,
  assertVisualSignatureAdminEnvironment,
} from "@/lib/visual-signature/local-validation/guard";

/**
 * F47.1 (D10) — superfície administrativa da configuração dedicada da
 * Assinatura Visual.
 *
 * - GET: requireAdmin; view model somente leitura; sem cache.
 * - PUT/DELETE: requireAdmin + requireSameOrigin; corpo estrito; guard local
 *   ANTES da escrita; RPC auditada exclusiva; cache invalidado no sucesso.
 *
 * Nenhuma escrita direta na tabela. Nenhum endpoint/RPC do Produto 1:1 ou da
 * seleção genérica é chamado. Erros de RPC são mapeados para códigos seguros.
 */

export const dynamic = "force-dynamic";

const SAFE_RPC_CODES = [
  "missing_reason",
  "missing_operation_id",
  "missing_actor_id",
  "missing_instance_identity",
  "operation_id_conflict",
  "invalid_orchestrator",
  "invalid_preset",
  "invalid_reasoning",
  "orchestrator_not_in_catalog",
  "visual_signature_validation_disabled",
  "visual_signature_validation_not_local",
  "visual_signature_validation_endpoint_not_loopback",
  "visual_signature_validation_instance_mismatch",
  "visual_signature_validation_provider_key_missing",
  "visual_signature_environment_missing",
  "visual_signature_environment_invalid",
  "visual_signature_preview_forbidden",
  "visual_signature_production_disabled",
  "visual_signature_production_ref_missing",
  "visual_signature_production_ref_mismatch",
  "visual_signature_production_endpoint_invalid",
  "missing_config_version_id",
  "invalid_published",
  "invalid_environment_scope",
  "preset_not_evaluated",
  "config_missing",
  "release_state_missing",
  "config_version_mismatch",
  "instance_identity_mismatch",
  "config_not_published",
  "deactivate_required",
  "invalid_activation_mode",
  "pilot_allowlist_required",
  "pilot_allowlist_not_allowed",
  "invalid_pilot_store",
] as const;

function safeCode(message: string, fallback: string): string {
  return SAFE_RPC_CODES.find((code) => message.includes(code)) ?? fallback;
}

function rpcError(error: { message?: string }): Response {
  const code = safeCode(error.message ?? "", "visual_signature_model_config_write_failed");
  const status = code === "operation_id_conflict" ? 409 : code.endsWith("write_failed") ? 500 : 400;
  return NextResponse.json({ error: code }, { status });
}

function guardError(error: unknown): Response {
  if (error instanceof VisualSignatureValidationGuardError) {
    return NextResponse.json({ error: error.code }, { status: 409 });
  }
  return NextResponse.json(
    { error: "visual_signature_validation_unavailable" },
    { status: 409 },
  );
}

function invalidBody(error: ZodError): Response {
  return NextResponse.json(
    { error: "Dados inválidos", details: error.errors },
    { status: 400 },
  );
}

async function parseBody<T>(
  request: Request,
  parser: { parse(input: unknown): T },
): Promise<T | Response> {
  try {
    return parser.parse(await request.json());
  } catch (error) {
    if (error instanceof ZodError) return invalidBody(error);
    return NextResponse.json({ error: "Corpo da requisição inválido" }, { status: 400 });
  }
}

export const GET = apiHandler(async () => {
  await requireAdmin();
  try {
    const view = await buildVisualSignatureModelConfigView();
    return NextResponse.json(view, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível ler a configuração da Assinatura Visual." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
});

export const PUT = apiHandler(async (request: Request) => {
  const admin = await requireAdmin();
  requireSameOrigin(request);

  const body = await parseBody(request, VisualSignatureModelConfigUpdateSchema);
  if (body instanceof Response) return body;

  let environment: { environment?: "local_validation" | "production"; instanceIdentity: string };
  try {
    environment = assertVisualSignatureAdminEnvironment();
  } catch (error) {
    return guardError(error);
  }

  const { data, error } = await supabaseAdmin.rpc("admin_set_visual_signature_model_config_v2", {
    p_actor_id: admin.userId,
    p_orchestrator_model: body.orchestratorModel,
    p_image_preset: body.imagePreset,
    // Derivado no servidor; o cliente nunca envia reasoning.
    p_reasoning_effort: "low",
    p_reason: body.reason,
    p_operation_id: body.operationId,
    p_environment_scope: environment.environment ?? "local_validation",
    p_instance_identity: environment.instanceIdentity,
  });
  if (error) return rpcError(error);

  invalidateVisualSignatureModelConfigCache();
  return NextResponse.json({ config: data });
});

export const POST = apiHandler(async (request: Request) => {
  const admin = await requireAdmin();
  requireSameOrigin(request);

  const body = await parseBody(request, VisualSignatureReleaseCommandSchema);
  if (body instanceof Response) return body;

  let environment: { instanceIdentity: string };
  try {
    environment = assertVisualSignatureAdminEnvironment();
  } catch (error) {
    return guardError(error);
  }

  if (body.action === "publish") {
    const { data, error } = await supabaseAdmin.rpc(
      "admin_publish_visual_signature_model_config",
      {
        p_actor_id: admin.userId,
        p_published: body.published,
        p_expected_config_version_id: body.expectedConfigVersionId,
        p_reason: body.reason,
        p_operation_id: body.operationId,
        p_instance_identity: environment.instanceIdentity,
      },
    );
    if (error) return rpcError(error);
    invalidateVisualSignatureModelConfigCache();
    return NextResponse.json({ release: data });
  }

  const { data, error } = await supabaseAdmin.rpc(
    "admin_activate_visual_signature_model_config",
    {
      p_actor_id: admin.userId,
      p_expected_config_version_id: body.expectedConfigVersionId,
      p_mode: body.mode,
      p_pilot_store_ids: body.pilotStoreIds ?? null,
      p_reason: body.reason,
      p_operation_id: body.operationId,
      p_instance_identity: environment.instanceIdentity,
    },
  );
  if (error) return rpcError(error);
  invalidateVisualSignatureModelConfigCache();
  return NextResponse.json({ release: data });
});

export const DELETE = apiHandler(async (request: Request) => {
  const admin = await requireAdmin();
  requireSameOrigin(request);

  const body = await parseBody(request, VisualSignatureModelConfigResetSchema);
  if (body instanceof Response) return body;

  let environment: { environment?: "local_validation" | "production"; instanceIdentity: string };
  try {
    environment = assertVisualSignatureAdminEnvironment();
  } catch (error) {
    return guardError(error);
  }

  const { data, error } = await supabaseAdmin.rpc(
    "admin_reset_visual_signature_model_config",
    {
      p_actor_id: admin.userId,
      p_expected_config_version_id: body.expectedConfigVersionId,
      p_reason: body.reason,
      p_operation_id: body.operationId,
      p_instance_identity: environment.instanceIdentity,
    },
  );
  if (error) return rpcError(error);

  invalidateVisualSignatureModelConfigCache();
  return NextResponse.json({ reset: data });
});
