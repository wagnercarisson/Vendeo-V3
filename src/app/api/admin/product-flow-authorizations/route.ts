import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAdmin } from "@/lib/admin/require-admin";
import { apiHandler } from "@/lib/auth/api-handler";
import { requireSameOrigin } from "@/lib/auth/csrf";
import { supabaseAdmin } from "@/lib/supabase/server";
import {
  GrantStageAuthorizationRequestSchema,
  StageAuthorizationQuerySchema,
} from "@/lib/product-1-1/authorization/schemas";
import { SupabaseStageAuthorizationRepository } from "@/lib/product-1-1/authorization/stage-authorization-repository";
import { resolveCanonicalInstanceIdentity } from "@/lib/product-1-1/authorization/instance-identity";

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
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", details: parsed.error.errors },
      { status: 400 },
    );
  }

  try {
    // Identidade canônica derivada EXCLUSIVAMENTE no servidor (nunca do cliente).
    const instanceIdentity = resolveCanonicalInstanceIdentity();
    const events = await new SupabaseStageAuthorizationRepository().listEvents({
      scope: parsed.data.scope,
      instanceIdentity,
    });
    return NextResponse.json({ events });
  } catch (error) {
    // Erro bruto do banco NÃO é ecoado ao cliente (IN-02).
    console.error(
      "[product-flow-authorizations] read failed:",
      error instanceof Error ? error.message : String(error),
    );
    return NextResponse.json(
      { error: "authorization_read_failed" },
      { status: 503 },
    );
  }
});

export const POST = apiHandler(async (request: Request) => {
  const admin = await requireAdmin();
  requireSameOrigin(request);

  let body;
  try {
    body = GrantStageAuthorizationRequestSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Dados inválidos", details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Corpo da requisição inválido" }, { status: 400 });
  }

  // Identidade canônica derivada no servidor (nunca aceita do payload).
  const instanceIdentity = resolveCanonicalInstanceIdentity();

  const { data, error } = await supabaseAdmin.rpc(
    "admin_grant_product_flow_stage_authorization",
    {
      p_actor_id: admin.userId,
      p_stage: body.stage,
      p_scope: body.scope,
      p_instance_identity: instanceIdentity,
      p_reason: body.reason,
      p_operation_id: body.operationId,
    },
  );

  if (error) {
    const message = error.message ?? "";
    const isBadRequest = BAD_REQUEST_CODES.some((code) => message.includes(code));
    if (!isBadRequest) {
      // Erro bruto do banco NÃO é ecoado ao cliente (IN-02).
      console.error("[product-flow-authorizations] grant rpc failed:", message);
    }
    return NextResponse.json(
      { error: isBadRequest ? message : "authorization_internal_error" },
      { status: isBadRequest ? 400 : 500 },
    );
  }

  const result = (data ?? {}) as Record<string, unknown>;

  // Conflito de identidade: mesmo operation_id com conteúdo diferente.
  if (result.conflict === true) {
    return NextResponse.json(
      { error: "operation_id_conflict", conflict: true, operationId: body.operationId },
      { status: 409 },
    );
  }

  // Recusa: consistente apenas quando a solicitação era habilitadora.
  if (result.refused === true) {
    if (body.stage === "off") {
      return NextResponse.json(
        { error: "authorization_rpc_inconsistent_response" },
        { status: 502 },
      );
    }
    return NextResponse.json(
      {
        error: "operational_activation_blocked_in_b1a",
        granted: false,
        refused: true,
        stage: result.stage,
        scope: result.scope,
      },
      { status: 403 },
    );
  }

  // Sucesso de concessão: exige envelope consistente com stage=off e a solicitação.
  if (result.granted === true) {
    const consistentGrant =
      result.success === true &&
      result.refused === false &&
      result.stage === "off" &&
      body.stage === "off" &&
      result.scope === body.scope;

    if (!consistentGrant) {
      return NextResponse.json(
        { error: "authorization_rpc_inconsistent_response" },
        { status: 502 },
      );
    }

    return NextResponse.json({
      granted: true,
      idempotent: result.idempotent === true,
      stage: "off",
      scope: result.scope,
    });
  }

  // Resposta ausente/inválida NUNCA é tratada como sucesso.
  return NextResponse.json(
    { error: "authorization_rpc_invalid_response" },
    { status: 502 },
  );
});
