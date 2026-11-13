import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { apiHandler } from "@/lib/auth/api-handler";
import { requireSameOrigin } from "@/lib/auth/csrf";
import { requireApiUser } from "@/lib/auth/require-user";
import { requireOwnership } from "@/lib/auth/store-ownership";
import { notFound } from "@/lib/api-error-response";
import { getCampaign } from "@/lib/campaign/persistence";
import { ContinueGenerationRequestSchema } from "@/lib/image-generation/schema";
import { isProduct9_16TwoStageEnabled } from "@/lib/feature-flags/feature-flag-service";
import { resolveCampaignGenerationOrigin } from "@/lib/product-9-16-two-stage/orchestration/origin";
import { ProductTwoStageOperationClient } from "@/lib/product-9-16-two-stage/two-stage-operation-client";
import { supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * F60.5 — continuacao AUTORIZADA da mesma operacao 9:16 por expansao.
 *
 * Nao abre operacao, nao reserva, nao aceita conteudo e nao fabrica falha. O
 * retry real e decidido por `ProductTwoStageOperationClient.resume` dentro do
 * orquestrador; a rota so valida identidade/origem/linha de controle.
 */
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
    if (!campaign) return notFound("Campaign not found");
    await requireOwnership(campaign.store_id, user.userId);

    let body;
    try {
      body = ContinueGenerationRequestSchema.parse(await request.json());
    } catch (error) {
      if (error instanceof ZodError) {
        return NextResponse.json(
          { error: { code: "invalid_body", message: "Dados inválidos" } },
          { status: 400 },
        );
      }
      return NextResponse.json(
        { error: { code: "invalid_body", message: "Corpo da requisição inválido" } },
        { status: 400 },
      );
    }

    if (
      body.requestIds.base.toLowerCase() ===
      body.requestIds.expansion.toLowerCase()
    ) {
      return NextResponse.json(
        { error: { code: "invalid_body", message: "requestIds devem ser distintos." } },
        { status: 400 },
      );
    }

    const origin = resolveCampaignGenerationOrigin(campaign.input_snapshot);
    if (origin.kind !== "two_stage_9_16") {
      return NextResponse.json(
        { error: { code: "operation_origin_conflict", message: "Origem da campanha divergente." } },
        { status: 409 },
      );
    }

    const control = new ProductTwoStageOperationClient(
      supabaseAdmin as never,
    );
    const lookup = await control.getOperationView({
      campaignId: id,
      operationId: body.operationId,
    });
    if (lookup.kind === "absent") {
      return NextResponse.json(
        { error: { code: "operation_not_found", message: "Operação não encontrada." } },
        { status: 409 },
      );
    }
    if (lookup.kind === "read_failed") {
      return NextResponse.json(
        { error: { code: "operation_unavailable", message: "Operação indisponível." } },
        { status: 503 },
      );
    }

    let allowNewPaidStep = false;
    try {
      allowNewPaidStep = await isProduct9_16TwoStageEnabled();
    } catch {
      allowNewPaidStep = false;
    }

    const { runNineSixteenTwoStageGeneration } = await import(
      "@/lib/product-9-16-two-stage/orchestration/run-nine-sixteen"
    );
    const { createNineSixteenDeps } = await import(
      "@/lib/product-9-16-two-stage/orchestration/delivery-deps"
    );

    return runNineSixteenTwoStageGeneration(
      {
        mode: "continue",
        storeId: campaign.store_id,
        campaignId: id,
        operationId: body.operationId,
        authorization: { kind: "owner", userId: user.userId },
        requestStartedAtMs: Date.now(),
        acquisitionIds: body.requestIds,
        allowNewPaidStep,
      },
      createNineSixteenDeps({ client: supabaseAdmin }),
    );
  },
);
