import { NextRequest, NextResponse } from "next/server";

import { apiHandler } from "@/lib/auth/api-handler";
import { requireSameOrigin } from "@/lib/auth/csrf";
import { requireApiUser } from "@/lib/auth/require-user";
import { requireOwnership } from "@/lib/auth/store-ownership";
import { notFound } from "@/lib/api-error-response";
import { getCampaign } from "@/lib/campaign/persistence";
import { classifyCampaignFlow } from "@/lib/campaign/new-flow-marker";
import { getLaunchConfig } from "@/lib/launch-config/config";
import type { CampaignIntent } from "@/lib/campaign/types";
import { ProductOneToOneAttemptStartClient } from "@/lib/product-1-1/orchestration/attempt-start-client";
import { resolveProductFlowAuthorization } from "@/lib/product-1-1/authorization/authorization-service";
import { resolvePilotSpendGate, resolvePilotCopyEstimatedUsd } from "@/lib/product-1-1/pilot/resolve-pilot-spend-gate";
import { resolveEligibilityContext } from "@/lib/product-1-1/submission/eligibility-context";
import {
  ProductOneToOneCopyRecoveryClient,
  ProductOneToOneCopyRecoveryError,
  toAcquisitionMode,
  type CopyRecoveryStateView,
} from "@/lib/product-1-1/copy/copy-recovery";
import { CopyRecoveryRequestSchema } from "@/lib/product-1-1/copy/recovery-schemas";

export const runtime = "nodejs";

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * F56.2b2a (B2.1 / B2A-D3/D5 / lacuna 6) — rota AUTENTICADA e com OWNERSHIP da
 * recuperação de copy do Produto 1:1.
 *
 *  - `GET` é QUERY-ONLY: devolve o estado PERSISTIDO verbatim (tentativa
 *    corrente, `attemptActive` por LEASE, `waitRemainingMs`, contadores
 *    auto/manual, `definitive`, `copyDelivery`). NUNCA inicia tentativa/geração/
 *    cobrança (espelha `generation-status/route.ts`).
 *  - `POST` executa EXATAMENTE UMA tentativa identificada por acionamento — e
 *    SOMENTE os textos (`campaign_copy`): NÃO regenera/altera a imagem, NÃO
 *    consome crédito adicional. A rota NÃO importa nem chama crédito/artefato.
 *
 * A BARREIRA DE NÃO-ATIVAÇÃO/IDENTIDADE (lacuna 6) roda ANTES de qualquer IA:
 * classificação PERSISTIDA do fluxo (`classifyCampaignFlow`), identidade da
 * operação (`operationId` do corpo DEVE casar com a operação persistida) e a
 * elegibilidade/autorização vigente (`resolveProductFlowAuthorization`). `mode`/
 * `attemptSeq`/`attemptToken` do cliente são SOLICITAÇÕES (schema Zod `.strict()`)
 * — NUNCA autoridade (a identidade corrente/vencedor vem do servidor).
 */

function resolveCampaignIntent(value: unknown): CampaignIntent {
  return value === "spotlight" || value === "exclusive" ? value : "offer";
}

function emptyRecoveryState(): CopyRecoveryStateView {
  return Object.freeze({
    attemptSeq: 0,
    state: null,
    attemptActive: false,
    waitRemainingMs: 0,
    autoAttempts: 0,
    manualAttempts: 0,
    definitive: false,
    copyDelivery: null,
  });
}

/**
 * Resultado DISCRIMINADO da leitura da operação persistida. `absent` SOMENTE
 * quando o cliente devolve `null`/`undefined` (operação genuinamente inexistente);
 * `error` quando a leitura LANÇA (RPC ausente/falha). NUNCA tratar `error` como
 * `absent` — falha de leitura ≠ campanha nova.
 */
type CampaignOperationLoad =
  | { status: "found"; operation: CampaignOperation }
  | { status: "absent" }
  | { status: "error" };

/** Operação persistida (não-nula) derivada do próprio cliente autorizado. */
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
    {
      error: {
        code: "recovery_unavailable",
        message: "Recuperação indisponível.",
      },
    },
    { status },
  );
}

/**
 * Runner input resolvido SERVER-SIDE (briefing/contexto/pricing) a partir do
 * snapshot PERSISTIDO da campanha + da loja AUTORIZADA. O snapshot é
 * ESTRUTURAL — nenhuma verdade do cliente é aceita aqui.
 */
function buildCopyRunnerInput(params: {
  readonly campaignId: string;
  readonly operationId: string;
  readonly storeId: string;
  readonly productName: string;
  readonly inputSnapshot: Record<string, unknown> | null;
  readonly store: {
    readonly name: string;
    readonly segment: string;
    readonly tone_of_voice: string | null;
    readonly positioning: string | null;
    readonly short_description: string | null;
    readonly slogan: string | null;
  };
}) {
  const snapshot =
    params.inputSnapshot && typeof params.inputSnapshot === "object"
      ? params.inputSnapshot
      : {};
  const product = (snapshot.product ?? {}) as Record<string, unknown>;
  const commercial = (snapshot.commercial ?? {}) as Record<string, unknown>;

  const productName =
    typeof product.name === "string" && product.name.length > 0
      ? product.name
      : params.productName;
  const description =
    typeof product.description === "string" ? product.description : null;
  const intent = resolveCampaignIntent(commercial.intent);
  const badgeText =
    typeof commercial.badgeText === "string" ? commercial.badgeText : undefined;
  const originalPriceCents =
    typeof commercial.originalPriceCents === "number"
      ? commercial.originalPriceCents
      : undefined;
  const discountedPriceCents =
    typeof commercial.discountedPriceCents === "number"
      ? commercial.discountedPriceCents
      : undefined;

  return {
    campaignId: params.campaignId,
    operationId: params.operationId,
    storeId: params.storeId,
    briefing: {
      product: { name: productName, description },
      commercial: { intent },
    },
    copyContext: {
      storeName: params.store.name,
      segment: params.store.segment,
      toneOfVoice: params.store.tone_of_voice ?? undefined,
      positioning: params.store.positioning ?? undefined,
      shortDescription: params.store.short_description ?? undefined,
      slogan: params.store.slogan ?? undefined,
      badgeText,
      originalPriceCents,
      discountedPriceCents,
    },
    copyDirectorEnabled: getLaunchConfig().copyDirectorEnabled,
  };
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
      // Sem operação persistida do novo fluxo: nenhum estado inventado.
      return NextResponse.json({ recovery: emptyRecoveryState() });
    }

    let state: CopyRecoveryStateView;
    try {
      state = await new ProductOneToOneCopyRecoveryClient().readCopyRecoveryState({
        campaignId: id,
        operationId: load.operation.operationId,
      });
    } catch {
      // Leitura do ESTADO indisponível: mesmo 503 seguro (nunca 500 passthrough).
      return recoveryUnavailable(503);
    }
    return NextResponse.json({ recovery: state });
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

    // B2A-D5 — ownership ANTES de qualquer IA/serviço de recuperação.
    const store = await requireOwnership(campaign.store_id, user.userId);

    // ── Corpo (.strict()): `requestToken` OBRIGATÓRIO (ausência ⇒ 400) ──────
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: { code: "invalid_body", message: "Corpo da requisição inválido." } },
        { status: 400 },
      );
    }

    const parsed = CopyRecoveryRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "invalid_body",
            message: "Dados inválidos para a recuperação de copy.",
            details: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 400 },
      );
    }
    const recoveryRequest = parsed.data;

    // ── BARREIRA DE NÃO-ATIVAÇÃO/IDENTIDADE (lacuna 6) — ANTES de qualquer IA ─
    const flowClassification = classifyCampaignFlow(campaign.input_snapshot);
    if (flowClassification === "legacy") {
      // A recuperação SÓ existe para o NOVO fluxo.
      return NextResponse.json(
        { error: { code: "copy_recovery_unavailable", message: "Recuperação indisponível." } },
        { status: 403 },
      );
    }
    if (flowClassification === "indeterminate") {
      // Fail-closed: nem novo fluxo (marcador presente) nem legado provado.
      return NextResponse.json(
        { error: { code: "copy_recovery_unavailable", message: "Recuperação indisponível." } },
        { status: 409 },
      );
    }

    const load = await loadCampaignOperation(id);
    if (load.status === "error") {
      // Falha de LEITURA da identidade persistida (≠ ausência): indisponível
      // (503) ANTES de qualquer aquisição/IA. NUNCA confundir com ausência.
      return recoveryUnavailable(503);
    }
    // Sem operação persistida OU `operationId` divergente ⇒ conflito de
    // identidade (o `operationId` do cliente NUNCA é autoridade).
    if (load.status === "absent" || load.operation.operationId !== recoveryRequest.operationId) {
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
      // Fluxo `off`/`read_failure` ⇒ NEGA sem chamada de IA.
      return NextResponse.json(
        { error: { code: "new_flow_ineligible", message: "Novo fluxo indisponível." } },
        { status: 403 },
      );
    }

    const runner = buildCopyRunnerInput({
      campaignId: id,
      operationId: load.operation.operationId,
      storeId: campaign.store_id,
      productName: campaign.product_name,
      inputSnapshot: campaign.input_snapshot,
      store,
    });

    // F56.2b2c (B2.3) — resolução server-side do gate de gasto do piloto.
    // `blocked` (INCERTEZA) ⇒ IMPEDE a chamada (não retira a proteção).
    const pilotGate = await resolvePilotSpendGate({ store });
    if (pilotGate.kind === "blocked") {
      return NextResponse.json(
        { error: { code: "new_flow_ineligible", message: "Recuperação indisponível." } },
        { status: 503 },
      );
    }

    try {
      const result = await new ProductOneToOneCopyRecoveryClient().recoverCopyAttempt({
        campaignId: id,
        operationId: load.operation.operationId,
        mode: toAcquisitionMode(recoveryRequest.mode),
        requestToken: recoveryRequest.requestToken,
        runner,
        // F56.2b2c (B2.3) — conexão server-side OBRIGATÓRIA do gate de gasto do
        // piloto (INDEFINIDO ⇒ piloto INATIVO; preserva o legado). A estimativa da
        // copy é decisão humana aprovada; ausente ⇒ a chamada é BLOQUEADA.
        runnerDeps: {
          pilotSpend: pilotGate.kind === "armed" ? pilotGate.gate : undefined,
          estimatedUsd: resolvePilotCopyEstimatedUsd(),
        },
      });
      return NextResponse.json({ recovery: result });
    } catch (error) {
      if (error instanceof ProductOneToOneCopyRecoveryError) {
        // Feedback SEGURO: código fechado, sem vazar motivo interno.
        return NextResponse.json(
          { error: { code: error.code, message: "Não foi possível executar a recuperação." } },
          { status: error.code === "missing_request_token" ? 400 : 409 },
        );
      }
      throw error;
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
    // Leitura INDISPONÍVEL (fundação INATIVA / RPC ausente/falha): NUNCA tratar
    // como campanha nova — `error` é distinto de `absent` e falha FECHADO.
    return { status: "error" };
  }
}
