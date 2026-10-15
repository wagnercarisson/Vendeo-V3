import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { apiHandler } from "@/lib/auth/api-handler";
import { requireSameOrigin } from "@/lib/auth/csrf";
import { requireApiUser } from "@/lib/auth/require-user";
import { requireOwnership } from "@/lib/auth/store-ownership";
import { notFound } from "@/lib/api-error-response";
import { getCampaign } from "@/lib/campaign/persistence";
import { classifyCampaignFlow } from "@/lib/campaign/new-flow-marker";
import { ProductOneToOneAttemptStartClient } from "@/lib/product-1-1/orchestration/attempt-start-client";
import { resolveProductFlowAuthorization } from "@/lib/product-1-1/authorization/authorization-service";
import { resolveEligibilityContext } from "@/lib/product-1-1/submission/eligibility-context";
import { ProductOneToOneArtifactRecovery } from "@/lib/product-1-1/artifact/artifact-recovery";

export const runtime = "nodejs";

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * F56.2b2b (B2.2 / B2B-D1, D4 / REQ-56.2.4-01..03, -10) — rota AUTENTICADA e com
 * OWNERSHIP da recuperação de imagem do Produto 1:1.
 *
 * O LOJISTA APENAS SOLICITA: esta rota NUNCA abandona claim, NUNCA declara
 * `refunded` sozinha e NUNCA regenera arte — delega ao serviço de recuperação
 * (que recupera arte íntegra existente e conclui a entrega SEM regenerar). O
 * encerramento financeiro sem sinal de finalidade pertence ao caminho
 * AUTORIZADO e auditado (Plano 04).
 *
 * A BARREIRA DE NÃO-ATIVAÇÃO/IDENTIDADE (lacuna 6) roda ANTES de qualquer
 * efeito: classificação PERSISTIDA do fluxo (`classifyCampaignFlow`), identidade
 * da operação (`operationId` do corpo DEVE casar com a operação persistida) e a
 * elegibilidade/autorização vigente (`resolveProductFlowAuthorization`).
 *
 * `GET` é QUERY-ONLY: devolve a operação PERSISTIDA verbatim, sem iniciar
 * tentativa/geração/cobrança (espelha `generation-status/route.ts`).
 */

const ImageRecoveryRequestSchema = z
  .object({
    operationId: z.string().uuid(),
  })
  .strict();

/**
 * Resultado DISCRIMINADO da leitura da operação persistida. `absent` SOMENTE
 * quando o cliente devolve `null`/`undefined`; `error` quando a leitura LANÇA.
 * NUNCA tratar `error` como `absent` — falha de leitura ≠ operação inexistente.
 */
type CampaignOperationLoad =
  | { status: "found"; operation: CampaignOperation }
  | { status: "absent" }
  | { status: "error" };

type CampaignOperation = NonNullable<
  Awaited<
    ReturnType<
      InstanceType<typeof ProductOneToOneAttemptStartClient>["getCampaignOperation"]
    >
  >
>;

/** Feedback SEGURO e fechado para indisponibilidade de leitura (nunca 200 vazio). */
function recoveryUnavailable(status: number): NextResponse {
  return NextResponse.json(
    { error: { code: "recovery_unavailable", message: "Recuperação indisponível." } },
    { status },
  );
}

export const GET = apiHandler(
  async (
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
  ) => {
    const user = await requireApiUser();

    const { id } = await params;
    if (!UUID_V4_REGEX.test(id)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const campaign = await getCampaign(id);
    if (!campaign) {
      return notFound("Campaign not found");
    }

    await requireOwnership(campaign.store_id, user.userId);

    const load = await loadCampaignOperation(id);
    if (load.status === "error") {
      // Falha de LEITURA da operação (≠ ausência): indisponível, nunca 200 vazio.
      return recoveryUnavailable(503);
    }
    if (load.status === "absent") {
      return NextResponse.json(
        { error: { message: "Operação não encontrada." } },
        { status: 404 },
      );
    }

    // QUERY-ONLY: devolve o estado PERSISTIDO verbatim; não inicia nada.
    return NextResponse.json({ operation: load.operation });
  },
);

export const POST = apiHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
  ) => {
    requireSameOrigin(request);

    const user = await requireApiUser();

    const { id } = await params;
    if (!UUID_V4_REGEX.test(id)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const campaign = await getCampaign(id);
    if (!campaign) {
      return notFound("Campaign not found");
    }

    // Ownership ANTES de qualquer IA/recuperação.
    const store = await requireOwnership(campaign.store_id, user.userId);

    // ── Corpo (.strict()): `operationId` OBRIGATÓRIO (ausência ⇒ 400) ───────
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { code: "invalid_body", message: "Corpo da requisição inválido." } },
        { status: 400 },
      );
    }

    const parsed = ImageRecoveryRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "invalid_body",
            message: "Dados inválidos para a recuperação de imagem.",
            details: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 400 },
      );
    }
    const { operationId } = parsed.data;

    // ── BARREIRA DE NÃO-ATIVAÇÃO/IDENTIDADE — ANTES de qualquer efeito ──────
    const flowClassification = classifyCampaignFlow(campaign.input_snapshot);
    if (flowClassification === "legacy") {
      return NextResponse.json(
        { error: { code: "image_recovery_unavailable", message: "Recuperação indisponível." } },
        { status: 403 },
      );
    }
    if (flowClassification === "indeterminate") {
      return NextResponse.json(
        { error: { code: "image_recovery_unavailable", message: "Recuperação indisponível." } },
        { status: 409 },
      );
    }

    const load = await loadCampaignOperation(id);
    if (load.status === "error") {
      // Falha de LEITURA da identidade persistida (≠ ausência): 503.
      return recoveryUnavailable(503);
    }
    // Sem operação persistida OU `operationId` divergente ⇒ conflito de
    // identidade (o `operationId` do cliente NUNCA é autoridade).
    if (load.status === "absent" || load.operation.operationId !== operationId) {
      return NextResponse.json(
        {
          error: {
            code: "operation_identity_conflict",
            message: "Identidade da operação divergente.",
          },
        },
        { status: 409 },
      );
    }

    let authorizationAllowed = false;
    try {
      const decision = await resolveProductFlowAuthorization(
        resolveEligibilityContext(store),
      );
      authorizationAllowed = decision.allowed === true;
    } catch {
      authorizationAllowed = false;
    }
    if (!authorizationAllowed) {
      // Fluxo `off`/`read_failure` ⇒ NEGA sem recuperação.
      return NextResponse.json(
        { error: { code: "new_flow_ineligible", message: "Novo fluxo indisponível." } },
        { status: 403 },
      );
    }

    // Delegar ao serviço (lojista APENAS solicita). A operação autoritativa vem
    // do servidor, nunca do corpo.
    try {
      const result = await new ProductOneToOneArtifactRecovery().recoverDelivery({
        storeId: campaign.store_id,
        campaignId: id,
        operationId: load.operation.operationId,
      });
      return NextResponse.json({ recovery: result });
    } catch {
      // Indisponibilidade do Storage/crédito: feedback SEGURO (nunca 500 cru).
      return recoveryUnavailable(503);
    }
  },
);

async function loadCampaignOperation(
  campaignId: string,
): Promise<CampaignOperationLoad> {
  try {
    const operation =
      await new ProductOneToOneAttemptStartClient().getCampaignOperation(campaignId);
    if (operation === null || operation === undefined) {
      return { status: "absent" };
    }
    return { status: "found", operation };
  } catch {
    // Leitura INDISPONÍVEL: NUNCA tratar como operação nova — `error` ≠ `absent`.
    return { status: "error" };
  }
}
