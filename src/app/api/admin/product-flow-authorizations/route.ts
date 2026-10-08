import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAdmin } from "@/lib/admin/require-admin";
import { apiHandler } from "@/lib/auth/api-handler";
import { supabaseAdmin } from "@/lib/supabase/server";
import {
  GrantStageAuthorizationRequestSchema,
  StageAuthorizationQuerySchema,
} from "@/lib/product-1-1/authorization/schemas";
import { SupabaseStageAuthorizationRepository } from "@/lib/product-1-1/authorization/stage-authorization-repository";

/**
 * Superfície administrativa da autorização independente de estágio do Produto
 * 1:1 (F56.2b1a, design A2 / tasks 2.2-2.3).
 *
 * - `GET`: protegido por `requireAdmin`; lê o histórico append-only de um
 *   escopo/instância. Somente leitura.
 * - `POST`: protegido por `requireAdmin`; valida o corpo com Zod e persiste por
 *   **RPC auditada** `admin_grant_product_flow_stage_authorization` (motivo e
 *   `operationId` obrigatórios, actor derivado server-side). Nesta change a
 *   concessão de estágio habilitador é **recusada** (403) e auditada; o estado
 *   operacional permanece `off`.
 *
 * Esta rota é a ÚNICA superfície autorizada a importar
 * `src/lib/product-1-1/authorization/**` (exceção estreita da guarda de
 * não-ativação). Nenhuma geração, provider, crédito, entrega ou download é
 * acionado aqui.
 */

const BAD_REQUEST_CODES = [
  "missing_reason",
  "missing_operation_id",
  "missing_actor_id",
  "invalid_stage",
  "invalid_scope",
  "missing_instance_identity",
];

export const GET = apiHandler(async (request: Request) => {
  await requireAdmin();

  const url = new URL(request.url);
  const parsed = StageAuthorizationQuerySchema.safeParse({
    scope: url.searchParams.get("scope") ?? "",
    instanceIdentity: url.searchParams.get("instanceIdentity") ?? "",
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", details: parsed.error.errors },
      { status: 400 },
    );
  }

  try {
    const events = await new SupabaseStageAuthorizationRepository().listEvents(parsed.data);
    return NextResponse.json({ events });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Falha ao ler as autorizações de estágio",
      },
      { status: 503 },
    );
  }
});

export const POST = apiHandler(async (request: Request) => {
  const admin = await requireAdmin();

  let body;
  try {
    body = GrantStageAuthorizationRequestSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Dados inválidos", details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Corpo da requisição inválido" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.rpc(
    "admin_grant_product_flow_stage_authorization",
    {
      p_actor_id: admin.userId,
      p_stage: body.stage,
      p_scope: body.scope,
      p_instance_identity: body.instanceIdentity,
      p_reason: body.reason,
      p_operation_id: body.operationId,
    },
  );

  if (error) {
    const message = error.message ?? "";
    return NextResponse.json(
      { error: message },
      { status: BAD_REQUEST_CODES.some((code) => message.includes(code)) ? 400 : 500 },
    );
  }

  const result = (data ?? {}) as Record<string, unknown>;

  if (result.refused === true) {
    return NextResponse.json(
      {
        error: "operational_activation_blocked_in_b1a",
        granted: false,
        refused: true,
        stage: result.stage,
      },
      { status: 403 },
    );
  }

  if (result.granted === true) {
    return NextResponse.json({
      granted: true,
      idempotent: result.idempotent === true,
      stage: result.stage,
    });
  }

  // Replay/ resposta ausente ou inválida NUNCA é tratada como sucesso.
  return NextResponse.json(
    { error: "authorization_rpc_invalid_response" },
    { status: 502 },
  );
});
