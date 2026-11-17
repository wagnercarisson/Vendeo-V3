import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAdmin } from "@/lib/admin/require-admin";
import { NineSixteenExpansionConfigUpdateSchema } from "@/lib/admin/schemas";
import { apiHandler } from "@/lib/auth/api-handler";
import { supabaseAdmin } from "@/lib/supabase/server";
import { buildNineSixteenExpansionConfigView } from "@/lib/ai/nine-sixteen-expansion-model-config-view";
import { invalidateNineSixteenExpansionConfigCache } from "@/lib/ai/nine-sixteen-expansion-model-config-service";

/**
 * Superfície administrativa da configuração da expansão 9:16 (F60.6, D7/D1/D2).
 *
 * - `GET`: protegido por `requireAdmin`, devolve a view **tolerante** com estado
 *   vigente/ausente/inválida/falha de leitura, lista fechada de modelos e
 *   qualidades e cobertura de pricing das quatro combinações. É sempre 200: a
 *   view não lança e falha de leitura NÃO vira ausência nem 500.
 * - `PUT`: protegido por `requireAdmin`, valida o corpo com Zod estrito
 *   (`model`/`quality`/`reason`/`operationId` apenas), deriva o ator da sessão
 *   administrativa (`admin.userId` — nunca do corpo) e persiste pela RPC
 *   auditada `admin_set_nine_sixteen_expansion_model_config`. O cache de leitura
 *   só é invalidado **após** o sucesso. NUNCA muta pela query builder e não
 *   expõe DELETE/reset.
 *
 * Isolamento: esta rota não toca `ai_model_selection`, `image_model_pair_config`
 * nem snapshots da base quadrada. Nenhuma geração, provider ou crédito é
 * acionado aqui.
 */

/** Códigos de bad request da RPC auditada (todos → 400). */
const RPC_BAD_REQUEST_CODES = [
  "missing_reason",
  "missing_operation_id",
  "missing_actor_id",
  "actor_not_admin",
  "invalid_model",
  "invalid_quality",
  "model_not_in_catalog",
  "model_not_in_expansion_list",
  "operation_id_conflict",
  "operation_config_conflict",
] as const;

function invalidBody(error: ZodError): Response {
  return NextResponse.json({ error: "Dados inválidos", details: error.errors }, { status: 400 });
}

function rpcError(error: { message: string }): Response {
  const message = error.message ?? "";
  const isBadRequest = RPC_BAD_REQUEST_CODES.some((code) => message.includes(code));
  return NextResponse.json({ error: message }, { status: isBadRequest ? 400 : 500 });
}

export const GET = apiHandler(async () => {
  await requireAdmin();
  // A view é tolerante por contrato: qualquer estado conhecido (incluindo falha
  // de leitura) é 200. Não há `try/catch -> 500` de leitura aqui.
  return NextResponse.json(await buildNineSixteenExpansionConfigView());
});

export const PUT = apiHandler(async (request: Request) => {
  const admin = await requireAdmin();

  let body;
  try {
    body = NineSixteenExpansionConfigUpdateSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof ZodError) return invalidBody(error);
    return NextResponse.json({ error: "Corpo da requisição inválido" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.rpc(
    "admin_set_nine_sixteen_expansion_model_config",
    {
      p_actor_id: admin.userId,
      p_model: body.model,
      p_quality: body.quality,
      p_reason: body.reason,
      p_operation_id: body.operationId,
    },
  );
  if (error) return rpcError(error);

  // Invalidação APENAS após sucesso: conflito/erro não pode derrubar o cache.
  invalidateNineSixteenExpansionConfigCache();
  return NextResponse.json({ config: data });
});
