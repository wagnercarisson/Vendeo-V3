import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAdmin } from "@/lib/admin/require-admin";
import {
  VisualSignatureModelConfigResetSchema,
  VisualSignatureModelConfigUpdateSchema,
} from "@/lib/admin/schemas";
import { apiHandler } from "@/lib/auth/api-handler";
import { requireSameOrigin } from "@/lib/auth/csrf";
import { supabaseAdmin } from "@/lib/supabase/server";
import { resolveVisualSignatureAdminEnvironment } from "@/lib/visual-signature/admin-environment";
import { buildVisualSignatureAdminConfigView } from "@/lib/visual-signature/admin-config-view";

/**
 * Superfície administrativa da configuração DEDICADA da Assinatura Visual
 * (`scope='visual_signature'`), consumida apenas pelo card
 * `visual_signature_image`.
 *
 * - `PUT`: grava exclusivamente pela RPC v3 auditada com 9 argumentos; ator,
 *   reasoning `low`, ambiente e identidade são derivados server-side. Depois do
 *   sucesso, relê a configuração e devolve `confirmed` apenas quando a
 *   releitura prova o estado gravado.
 * - `DELETE`: remove exclusivamente pela RPC dedicada (5 argumentos, sem
 *   ambiente) usando a versão vigente como expectativa.
 *
 * Nenhuma mutação direta de tabela e nenhuma RPC genérica de seleção. Mensagens
 * do banco nunca são ecoadas: apenas códigos allowlistados.
 */

const PUT_BAD_REQUEST_CODES = [
  "invalid_orchestrator",
  "invalid_image_model",
  "invalid_image_quality",
  "invalid_preset_tuple",
  "invalid_reasoning",
  "invalid_environment_scope",
  "orchestrator_not_in_catalog",
] as const;

const DELETE_BAD_REQUEST_CODES = ["missing_config_version_id", "missing_reason"] as const;

const DELETE_CONFLICT_CODES = [
  "operation_id_conflict",
  "config_missing",
  "config_version_mismatch",
  "instance_identity_mismatch",
  "deactivate_required",
] as const;

function invalidBody(error: ZodError): Response {
  return NextResponse.json({ error: "Dados inválidos", details: error.errors }, { status: 400 });
}

function invalidJson(): Response {
  return NextResponse.json({ error: "Corpo da requisição inválido" }, { status: 400 });
}

function sanitizedLog(code: string): void {
  console.error("[visual-signature-model-config]", { code });
}

function matchesAny(message: string, codes: readonly string[]): string | null {
  const lower = message.toLowerCase();
  return codes.find((code) => lower.includes(code)) ?? null;
}

function rpcMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "";
}

function rpcErrorResponse(error: unknown, badRequestCodes: readonly string[], conflictCodes: readonly string[]): Response {
  const message = rpcMessage(error);
  const badRequest = matchesAny(message, badRequestCodes);
  if (badRequest) return NextResponse.json({ error: badRequest }, { status: 400 });
  const conflict = matchesAny(message, conflictCodes);
  if (conflict) return NextResponse.json({ error: conflict }, { status: 409 });
  sanitizedLog("unexpected_error");
  return NextResponse.json({ error: "unexpected_error" }, { status: 500 });
}

interface RpcData {
  success?: unknown;
  config_version_id?: unknown;
}

function acceptedRpcData(data: unknown): RpcData | null {
  if (!data || typeof data !== "object") return null;
  const candidate = data as RpcData;
  if (candidate.success !== true) return null;
  return candidate;
}

function environmentFailure(): Response {
  sanitizedLog("environment_unresolved");
  return NextResponse.json({ error: "environment_unresolved" }, { status: 500 });
}

async function parseBody<T>(request: Request, schema: { parse: (input: unknown) => T }): Promise<
  { ok: true; body: T } | { ok: false; response: Response }
> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { ok: false, response: invalidJson() };
  }
  try {
    return { ok: true, body: schema.parse(raw) };
  } catch (error) {
    if (error instanceof ZodError) return { ok: false, response: invalidBody(error) };
    return { ok: false, response: invalidJson() };
  }
}

export const PUT = apiHandler(async (request: Request) => {
  const admin = await requireAdmin();
  requireSameOrigin(request);

  const parsed = await parseBody(request, VisualSignatureModelConfigUpdateSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;

  let environment;
  try {
    environment = resolveVisualSignatureAdminEnvironment();
  } catch {
    return environmentFailure();
  }

  let result;
  try {
    result = await supabaseAdmin.rpc("admin_set_visual_signature_model_config_v3", {
      p_actor_id: admin.userId,
      p_orchestrator_model: body.orchestratorModel,
      p_image_model: body.imageModel,
      p_image_quality: body.imageQuality,
      p_reasoning_effort: "low",
      p_reason: body.reason,
      p_operation_id: body.operationId,
      p_environment_scope: environment.environmentScope,
      p_instance_identity: environment.instanceIdentity,
    });
  } catch {
    sanitizedLog("unexpected_error");
    return NextResponse.json({ error: "unexpected_error" }, { status: 500 });
  }

  if (result.error) return rpcErrorResponse(result.error, PUT_BAD_REQUEST_CODES, ["operation_id_conflict"]);

  const data = acceptedRpcData(result.data);
  if (!data) return NextResponse.json({ error: "invalid_rpc_response" }, { status: 502 });

  const view = await buildVisualSignatureAdminConfigView();

  if (view.status === "error") {
    return NextResponse.json({ saved: true, confirmed: false, warning: "save_confirmation_failed" });
  }

  const expectedVersion = typeof data.config_version_id === "string" ? data.config_version_id : null;
  const confirmed =
    view.status === "dedicated" &&
    view.config.orchestratorModel === body.orchestratorModel &&
    view.config.imageModel === body.imageModel &&
    view.config.imageQuality === body.imageQuality &&
    (expectedVersion === null || view.config.configVersionId === expectedVersion);

  if (!confirmed) {
    return NextResponse.json({
      saved: true,
      confirmed: false,
      warning: "save_confirmation_mismatch",
      view,
    });
  }

  return NextResponse.json({ saved: true, confirmed: true, view });
});

export const DELETE = apiHandler(async (request: Request) => {
  const admin = await requireAdmin();
  requireSameOrigin(request);

  const parsed = await parseBody(request, VisualSignatureModelConfigResetSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;

  let environment;
  try {
    environment = resolveVisualSignatureAdminEnvironment();
  } catch {
    return environmentFailure();
  }

  let result;
  try {
    result = await supabaseAdmin.rpc("admin_reset_visual_signature_model_config", {
      p_actor_id: admin.userId,
      p_expected_config_version_id: body.expectedConfigVersionId,
      p_reason: body.reason,
      p_operation_id: body.operationId,
      p_instance_identity: environment.instanceIdentity,
    });
  } catch {
    sanitizedLog("unexpected_error");
    return NextResponse.json({ error: "unexpected_error" }, { status: 500 });
  }

  if (result.error) return rpcErrorResponse(result.error, DELETE_BAD_REQUEST_CODES, DELETE_CONFLICT_CODES);

  const data = acceptedRpcData(result.data);
  if (!data) return NextResponse.json({ error: "invalid_rpc_response" }, { status: 502 });

  const view = await buildVisualSignatureAdminConfigView();

  if (view.status === "error") {
    return NextResponse.json({ removed: true, confirmed: false, warning: "reset_confirmation_failed" });
  }

  if (view.status === "legacy") {
    return NextResponse.json({ removed: true, confirmed: true, view: { status: "legacy" } });
  }

  return NextResponse.json({
    removed: true,
    confirmed: false,
    warning: "reset_confirmation_mismatch",
    view,
  });
});
