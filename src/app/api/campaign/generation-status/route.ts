import { NextRequest, NextResponse } from "next/server";

import { apiHandler } from "@/lib/auth/api-handler";
import { requireApiUser } from "@/lib/auth/require-user";
import { requireOwnership } from "@/lib/auth/store-ownership";
import { requireSameOrigin } from "@/lib/auth/csrf";
import { getCampaign } from "@/lib/campaign/persistence";
import { GenerationStatusRequestSchema } from "@/lib/image-generation/schema";
import { queryProductOneToOneOperation } from "@/lib/product-1-1/orchestration/resend-query";
import { isProduct9_16TwoStageEnabled } from "@/lib/feature-flags/feature-flag-service";
import { resolveCampaignGenerationOrigin } from "@/lib/product-9-16-two-stage/orchestration/origin";
import { deriveTwoStageStatus } from "@/lib/product-9-16-two-stage/orchestration/status-view";
import { ProductTwoStageOperationClient } from "@/lib/product-9-16-two-stage/two-stage-operation-client";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * F56.2b1b (B1B-D2, C1/C2, F4/F6 / REQ-56.2.2-06) — rota de status do reenvio.
 *
 * QUERY-ONLY: consulta a operação existente pela identidade
 * `campaignId + operationId` e devolve o estado PERSISTIDO verbatim. NÃO inicia
 * tentativa/geração/cobrança e NÃO chama o provider — o reenvio é somente
 * consulta. `requireSameOrigin` protege o POST.
 */

export const runtime = "nodejs";

export const POST = apiHandler(async (request: NextRequest) => {
  requireSameOrigin(request);

  const user = await requireApiUser();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { message: "Corpo da requisição inválido" } },
      { status: 400 },
    );
  }

  const parsed = GenerationStatusRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "invalid_body",
          message: "Dados inválidos para consulta de status.",
          details: parsed.error.flatten().fieldErrors,
        },
      },
      { status: 400 },
    );
  }

  const campaign = await getCampaign(parsed.data.campaignId);
  if (!campaign) {
    return NextResponse.json(
      { error: { message: "Campanha não encontrada." } },
      { status: 404 },
    );
  }

  await requireOwnership(campaign.store_id, user.userId);

  const origin = resolveCampaignGenerationOrigin(campaign.input_snapshot);
  if (origin.kind === "two_stage_9_16") {
    let allowNewPaidStep = false;
    try {
      allowNewPaidStep = await isProduct9_16TwoStageEnabled();
    } catch {
      allowNewPaidStep = false;
    }
    const control = new ProductTwoStageOperationClient(supabaseAdmin as never);
    const lookup = await control.getOperationView({
      campaignId: parsed.data.campaignId,
      operationId: parsed.data.operationId,
    });
    if (lookup.kind === "absent") {
      return NextResponse.json(
        { error: { message: "Operação não encontrada." } },
        { status: 404 },
      );
    }
    if (lookup.kind === "read_failed") {
      return NextResponse.json(
        { error: { code: "status_unavailable", message: "Status indisponível." } },
        { status: 503 },
      );
    }
    return NextResponse.json({
      operation: deriveTwoStageStatus(lookup.view, { allowNewPaidStep }),
    });
  }

  const operation = await queryProductOneToOneOperation({
    storeId: campaign.store_id,
    campaignId: parsed.data.campaignId,
    operationId: parsed.data.operationId,
  });

  if (!operation) {
    return NextResponse.json(
      { error: { message: "Operação não encontrada." } },
      { status: 404 },
    );
  }

  return NextResponse.json({ operation });
});
