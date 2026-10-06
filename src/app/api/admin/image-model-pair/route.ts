import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAdmin } from "@/lib/admin/require-admin";
import { ImageModelPairConfigUpdateSchema } from "@/lib/admin/schemas";
import { apiHandler } from "@/lib/auth/api-handler";
import { supabaseAdmin } from "@/lib/supabase/server";
import { buildImageModelPairConfigView } from "@/lib/ai/image-model-pair-config-view";
import { invalidateImageModelPairConfigCache } from "@/lib/ai/image-model-pair-config-service";

/**
 * Superfície administrativa da configuração do par principal/fallback do novo
 * fluxo Produto 1:1 (F56.1, D-04/D-05/D-09/D-23).
 *
 * - `GET`: protegido por `requireAdmin`, devolve o view model (catálogo elegível,
 *   par vigente, origem, versão e cobertura de pricing por par). Somente leitura.
 * - `PUT`: protegido por `requireAdmin`, valida o corpo com Zod e persiste por
 *   **RPC auditada** `admin_set_image_model_pair_config` (motivo obrigatório,
 *   idempotência por `operation_id`, auditoria na mesma transação). Em sucesso,
 *   **invalida o cache** de leitura. NUNCA muta pela query builder (D-04).
 *
 * Isolamento do legado (D-07): esta rota não toca `ai_model_selection` nem o
 * pipeline vigente. Nenhuma geração, provider ou crédito é acionado aqui.
 */

function invalidBody(error: ZodError): Response {
  return NextResponse.json({ error: "Dados inválidos", details: error.errors }, { status: 400 });
}

function rpcError(error: { message: string }): Response {
  const message = error.message ?? "";
  const badRequestCodes = [
    "missing_reason",
    "invalid_quality",
    "model_not_in_catalog",
    "missing_operation_id",
  ];
  return NextResponse.json(
    { error: message },
    { status: badRequestCodes.some((code) => message.includes(code)) ? 400 : 500 },
  );
}

export const GET = apiHandler(async () => {
  await requireAdmin();
  try {
    return NextResponse.json(await buildImageModelPairConfigView());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao ler a configuração do par" },
      { status: 500 },
    );
  }
});

export const PUT = apiHandler(async (request: Request) => {
  const admin = await requireAdmin();

  let body;
  try {
    body = ImageModelPairConfigUpdateSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof ZodError) return invalidBody(error);
    return NextResponse.json({ error: "Corpo da requisição inválido" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.rpc("admin_set_image_model_pair_config", {
    p_actor_id: admin.userId,
    p_primary_model: body.primaryModel,
    p_primary_quality: body.primaryQuality,
    p_fallback_model: body.fallbackModel,
    p_fallback_quality: body.fallbackQuality,
    p_reason: body.reason,
    p_operation_id: body.operationId,
  });
  if (error) return rpcError(error);

  invalidateImageModelPairConfigCache();
  return NextResponse.json({ config: data });
});
