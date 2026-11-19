import "server-only";

import type { NewFlowGenerateImageRequest } from "@/lib/image-generation/schema";
import { createCampaign } from "@/lib/campaign/persistence";
import { isProduct9_16TwoStageEnabled } from "@/lib/feature-flags/feature-flag-service";
import { requireLegalClearance } from "@/lib/legal/clearance";
import { getStoreReadiness } from "@/lib/store-readiness";
import { checkRateLimit } from "@/lib/rate-limit/rate-limit";
import { getLaunchConfig } from "@/lib/launch-config/config";
import { CreditService } from "@/lib/credit/credit-service";
import { supabaseAdmin } from "@/lib/supabase/server";
import { classifyTwoFormatCampaign } from "../contracts";
import type { JointBaseInput } from "./joint-base";
import { buildJointResumeContext, readJointResumeContext } from "./joint-resume-context";
import { createTwoFormatRunDeps } from "./run-two-format-deps";
import { runTwoFormatGeneration } from "./run-two-format";

const JOINT_FORMAT = "1:1+9:16" as const;

function productImagesFrom(newFlow: NewFlowGenerateImageRequest) {
  if (newFlow.productImages && newFlow.productImages.length > 0) {
    return newFlow.productImages.map((image) => image.dataUrl);
  }
  return newFlow.productImageDataUrl ? [newFlow.productImageDataUrl] : [];
}

function contentFrom(
  newFlow: NewFlowGenerateImageRequest,
): JointBaseInput["content"] {
  const briefing = {
    product: {
      name: newFlow.productName,
      description: newFlow.description ?? null,
    },
    offer: {
      originalPriceText: newFlow.originalPriceCents ?? null,
      discountedPriceText: newFlow.discountedPriceCents ?? null,
      badge: newFlow.badgeText ?? null,
      validity: newFlow.validity ?? null,
    },
    backgroundDirection: newFlow.backgroundDirection,
  };
  return {
    briefing: briefing as never,
    briefingText: JSON.stringify(briefing),
    campaignIntent: newFlow.campaignIntent,
    backgroundDirection: newFlow.backgroundDirection,
    productImagesDataUrls: productImagesFrom(newFlow),
    referenceSelections: [] as never,
    usdBrlRateAtGeneration: null,
    creditValueBrlAtGeneration: null,
  };
}

function jointSnapshot(newFlow: NewFlowGenerateImageRequest, context: ReturnType<typeof buildJointResumeContext>) {
  return {
    productName: newFlow.productName,
    productDescription: newFlow.description ?? null,
    campaignFormat: JOINT_FORMAT,
    formatContractVersion: "f60.7-two-format-v1",
    generationOrigin: "two_format_two_stage",
    generationContractVersion: "f60.7-two-format-v1",
    jointResumeContext: context,
  };
}

async function readCampaign(campaignId: string) {
  const result = await supabaseAdmin
    .from("campaigns")
    .select("id, store_id, input_snapshot")
    .eq("id", campaignId)
    .maybeSingle<{
      id: string;
      store_id: string;
      input_snapshot: Record<string, unknown> | null;
    }>();
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

async function enabledOrFalse(): Promise<boolean> {
  try {
    return await isProduct9_16TwoStageEnabled();
  } catch {
    return false;
  }
}

function errorResponse(code: string, message: string, status: number): Response {
  return Response.json({ error: { code, message } }, { status });
}

/**
 * C1 — ramo server dedicado do formato conjunto.
 * Não executa provider na validação; o runtime usa as RPCs/etapas reais.
 */
export async function handleJointGenerateRequest(input: {
  newFlow: NewFlowGenerateImageRequest;
  userId: string;
}): Promise<Response> {
  const { newFlow, userId } = input;
  const campaign = await readCampaign(newFlow.campaignId);
  if (campaign && campaign.store_id !== newFlow.storeId) {
    return errorResponse("operation_identity_conflict", "Identidade de campanha divergente.", 409);
  }

  let context: ReturnType<typeof buildJointResumeContext>;
  if (campaign) {
    const classification = classifyTwoFormatCampaign(campaign.input_snapshot);
    if (classification.kind === "inconsistent") {
      return errorResponse("operation_identity_conflict", "Contrato conjunto inconsistente.", 409);
    }
    if (classification.kind !== "two_format") {
      return errorResponse("operation_identity_conflict", "Campanha não é conjunta.", 409);
    }
    const read = readJointResumeContext(campaign.input_snapshot);
    if (read.kind !== "found") {
      return errorResponse("operation_identity_conflict", "Identidade conjunta ausente ou inválida.", 409);
    }
    context = read.context;
  } else {
    context = buildJointResumeContext({ operationId: newFlow.operationId });
  }

  const deps = createTwoFormatRunDeps({ client: supabaseAdmin });
  const operation = await deps.readOperationView({
    campaignId: newFlow.campaignId,
    operationId: newFlow.operationId,
  });
  if (operation.kind === "read_failed") {
    return errorResponse("operation_unavailable", "Operação indisponível.", 503);
  }

  let allowNewPaidStep = false;
  let preflightResult: Awaited<ReturnType<typeof deps.preflightJointSelection>> | undefined;
  if (operation.kind !== "found") {
    allowNewPaidStep = await enabledOrFalse();
    if (!allowNewPaidStep) {
      return errorResponse(
        "generation_unavailable",
        "Nova geração conjunta indisponível. Nenhuma operação foi criada.",
        503,
      );
    }

    preflightResult = await deps.preflightJointSelection();
    if (!preflightResult.ok) {
      return errorResponse(
        preflightResult.reason,
        "Seleção de expansão indisponível.",
        503,
      );
    }

    const clearance = await requireLegalClearance({
      storeId: newFlow.storeId,
      userId,
      capability: "content_generation",
    });
    if (!clearance.ok) {
      return Response.json(
        {
          error: "Ação bloqueada por pendência legal.",
          reason: clearance.reason,
          requiredDocuments: clearance.requiredDocuments,
          acceptUrl: "/legal/reaccept",
        },
        { status: 403 },
      );
    }
    const readiness = await getStoreReadiness(newFlow.storeId);
    if (!readiness.ready) {
      return Response.json(
        {
          error: {
            message: "Loja não está pronta para gerar campanhas.",
            reasons: readiness.missing.map((item) => item.reason),
            missing: readiness.missing.map((item) => item.item),
          },
        },
        { status: 412 },
      );
    }
    const config = getLaunchConfig();
    const rateLimit = await checkRateLimit(newFlow.storeId, {
      rateLimitEnabled: config.rateLimitEnabled,
    });
    if (!rateLimit.allowed) {
      return Response.json(
        {
          error: "rate_limit_exceeded",
          retryAfter: rateLimit.resetTime ?? "1 hour",
        },
        { status: 429 },
      );
    }
    const balance = await new CreditService(supabaseAdmin).getBalance(
      newFlow.storeId,
    );
    if (balance < 2) {
      return errorResponse("insufficient_credits", "Saldo insuficiente para 2 créditos.", 402);
    }

    if (!campaign) {
      const snapshot = jointSnapshot(newFlow, context);
      try {
        await createCampaign(
          newFlow.storeId,
          {
            productName: newFlow.productName,
            inputSnapshot: snapshot as unknown as Record<string, unknown>,
          },
          newFlow.campaignId,
        );
      } catch {
        const raced = await readCampaign(newFlow.campaignId);
        if (!raced || raced.store_id !== newFlow.storeId) {
          return errorResponse("operation_identity_conflict", "Campanha divergente.", 409);
        }
        const racedContext = readJointResumeContext(raced.input_snapshot);
        if (racedContext.kind !== "found") {
          return errorResponse("operation_identity_conflict", "Identidade conjunta ausente.", 409);
        }
        context = racedContext.context;
      }
    }
  }

  const preflight = preflightResult;
  return runTwoFormatGeneration(
    {
      mode: "new",
      storeId: newFlow.storeId,
      campaignId: newFlow.campaignId,
      operationId: newFlow.operationId,
      authorization: { kind: "owner", userId },
      allowNewPaidStep,
      requestStartedAtMs: Date.now(),
      deadlineAtMs: Date.now() + 120_000,
      inputSnapshot: (campaign?.input_snapshot ?? jointSnapshot(newFlow, context)) as unknown,
      squareDeliveryId: context.squareDeliveryId,
      initialRequestId: context.initialRequestIds.base,
      content: contentFrom(newFlow),
      ...(preflight === undefined ? {} : { preflight }),
    },
    deps,
  );
}
