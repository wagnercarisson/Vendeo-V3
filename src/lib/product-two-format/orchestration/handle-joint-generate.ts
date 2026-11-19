import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { NewFlowGenerateImageRequest } from "@/lib/image-generation/schema";
import {
  createCampaignWithClient,
  uploadCampaignInputFileWithClient,
} from "@/lib/campaign/persistence";
import { isProduct9_16TwoStageEnabled } from "@/lib/feature-flags/feature-flag-service";
import { requireLegalClearance } from "@/lib/legal/clearance";
import { getStoreReadiness } from "@/lib/store-readiness";
import { checkRateLimit } from "@/lib/rate-limit/rate-limit";
import { getLaunchConfig } from "@/lib/launch-config/config";
import { CreditService } from "@/lib/credit/credit-service";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { RunNineSixteenDeps } from "@/lib/product-9-16-two-stage/orchestration/types";
import { computeInvocationDeadline } from "@/lib/product-9-16-two-stage/orchestration/deadline-budget";

import { classifyTwoFormatCampaign } from "../contracts";
import {
  attachJointResumeContext,
  buildJointInitialSnapshot,
  persistedContentMatches,
  type JointDurableUpload,
  type JointEconomicSnapshot,
} from "./joint-initial-snapshot";
import {
  buildJointResumeContext,
  readJointResumeContext,
  type JointResumeContext,
} from "./joint-resume-context";
import { createTwoFormatRunDeps } from "./run-two-format-deps";
import { runTwoFormatGeneration } from "./run-two-format";

export interface JointGenerateOptions {
  readonly client?: SupabaseClient;
  readonly requestStartedAtMs?: number;
  readonly signal?: AbortSignal;
  readonly economicSnapshot?: JointEconomicSnapshot;
  readonly clock?: () => number;
  readonly callIdFactory?: () => string;
  /** Injetável em testes para a identidade durável (default `randomUUID`). */
  readonly uuid?: () => string;
  /** Seams de provider/DB/Storage para testes de composição real. */
  readonly nineDeps?: RunNineSixteenDeps;
}

interface CampaignRow {
  readonly id: string;
  readonly store_id: string;
  readonly input_snapshot: Record<string, unknown> | null;
}

async function readCampaign(
  client: SupabaseClient,
  campaignId: string,
): Promise<CampaignRow | null> {
  const result = await client
    .from("campaigns")
    .select("id, store_id, input_snapshot")
    .eq("id", campaignId)
    .maybeSingle<CampaignRow>();
  if (result.error) throw new Error(result.error.message);
  return result.data ?? null;
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

async function paidGates(input: {
  storeId: string;
  userId: string;
  client: SupabaseClient;
}): Promise<Response | null> {
  const clearance = await requireLegalClearance({
    storeId: input.storeId,
    userId: input.userId,
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
  const readiness = await getStoreReadiness(input.storeId);
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
  const rateLimit = await checkRateLimit(input.storeId, {
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
  const balance = await new CreditService(input.client).getBalance(input.storeId);
  if (balance < 2) {
    return errorResponse(
      "insufficient_credits",
      "Saldo insuficiente para 2 créditos.",
      402,
    );
  }
  return null;
}

function readPersistedContext(snapshot: unknown): JointResumeContext | null {
  const read = readJointResumeContext(snapshot);
  return read.kind === "found" ? read.context : null;
}

function hasDurableResumeContext(snapshot: unknown): boolean {
  return (
    snapshot !== null &&
    typeof snapshot === "object" &&
    !Array.isArray(snapshot) &&
    (snapshot as Record<string, unknown>).resumeContext !== undefined
  );
}

async function uploadInputs(
  client: SupabaseClient,
  storeId: string,
  campaignId: string,
  uploads: readonly JointDurableUpload[],
): Promise<Response | null> {
  for (const item of uploads) {
    const uploaded = await uploadCampaignInputFileWithClient(
      client,
      storeId,
      campaignId,
      {
        contentId: item.descriptor.contentId,
        mimeType: item.descriptor.mimeType,
        dataUrlPrefix: item.descriptor.dataUrlPrefix,
        buffer: item.buffer,
      },
    );
    if (uploaded.kind === "conflict") {
      return errorResponse(
        "input_conflict",
        "Conteúdo de entrada divergente.",
        409,
      );
    }
    if (uploaded.kind === "indeterminate") {
      return errorResponse(
        "input_unavailable",
        "Não foi possível armazenar as imagens de entrada.",
        503,
      );
    }
  }
  return null;
}

/**
 * C1 — ramo server dedicado do formato conjunto.
 *
 * A rota é a ÚNICA dona da identidade durável. O snapshot completo é construído
 * no servidor, o INSERT é o CAS da identidade e a corrida adota o snapshot,
 * o conteúdo e a identidade vencedores — nunca os da requisição perdedora.
 */
export async function handleJointGenerateRequest(
  input: {
    newFlow: NewFlowGenerateImageRequest;
    userId: string;
  },
  options: JointGenerateOptions = {},
): Promise<Response> {
  const { newFlow, userId } = input;
  const client = options.client ?? (supabaseAdmin as unknown as SupabaseClient);
  const requestStartedAtMs = options.requestStartedAtMs ?? Date.now();
  const deadlineAtMs = computeInvocationDeadline(requestStartedAtMs);
  const economicSnapshot = options.economicSnapshot ?? {
    usdBrlRateAtGeneration: null,
    creditValueBrlAtGeneration: null,
  };

  let campaign: CampaignRow | null;
  try {
    campaign = await readCampaign(client, newFlow.campaignId);
  } catch {
    return errorResponse("operation_unavailable", "Campanha indisponível.", 503);
  }
  if (campaign && campaign.store_id !== newFlow.storeId) {
    return errorResponse(
      "operation_identity_conflict",
      "Identidade de campanha divergente.",
      409,
    );
  }

  const runDeps = createTwoFormatRunDeps({
    client,
    ...(options.clock === undefined ? {} : { clock: options.clock }),
    ...(options.callIdFactory === undefined
      ? {}
      : { callIdFactory: options.callIdFactory }),
    ...(options.nineDeps === undefined ? {} : { nineDeps: options.nineDeps }),
  });

  let lookup;
  try {
    lookup = await runDeps.readOperationView({
      campaignId: newFlow.campaignId,
      operationId: newFlow.operationId,
    });
  } catch {
    return errorResponse("operation_unavailable", "Operação indisponível.", 503);
  }
  if (lookup.kind === "read_failed") {
    return errorResponse("operation_unavailable", "Operação indisponível.", 503);
  }

  if (campaign) {
    const classification = classifyTwoFormatCampaign(campaign.input_snapshot);
    if (classification.kind === "inconsistent") {
      return errorResponse(
        "operation_identity_conflict",
        "Contrato conjunto inconsistente.",
        409,
      );
    }
    if (classification.kind !== "two_format") {
      return errorResponse(
        "operation_identity_conflict",
        "Campanha não é conjunta.",
        409,
      );
    }
    const persistedContext = readPersistedContext(campaign.input_snapshot);
    if (!persistedContext) {
      // Sem identidade durável não há como retomar; não há backfill silencioso.
      return errorResponse(
        "operation_identity_conflict",
        "Identidade conjunta ausente ou inválida.",
        409,
      );
    }

    if (lookup.kind === "found") {
      // POST inicial repetido: replay READ-ONLY. Nunca autoriza etapa paga.
      return runTwoFormatGeneration(
        {
          mode: "new",
          storeId: newFlow.storeId,
          campaignId: newFlow.campaignId,
          operationId: newFlow.operationId,
          authorization: { kind: "owner", userId },
          allowNewPaidStep: false,
          requestStartedAtMs,
          deadlineAtMs,
          inputSnapshot: campaign.input_snapshot,
          squareDeliveryId: persistedContext.squareDeliveryId,
          initialRequestId: persistedContext.initialRequestIds.base,
          ...(options.signal === undefined ? {} : { signal: options.signal }),
        },
        runDeps,
      );
    }

    // Campanha existe, operação NÃO. Só uma submissão NOVA (flag ON) pode abrir.
    const enabled = await enabledOrFalse();
    if (!enabled) {
      return errorResponse(
        "generation_unavailable",
        "Nova geração conjunta indisponível. Nenhuma operação foi criada.",
        503,
      );
    }
    if (!hasDurableResumeContext(campaign.input_snapshot)) {
      return errorResponse(
        "operation_identity_conflict",
        "Conteúdo durável da campanha ausente.",
        409,
      );
    }

    const preflight = await runDeps.preflightJointSelection();
    if (!preflight.ok) {
      return errorResponse(
        preflight.reason,
        "Seleção de expansão indisponível.",
        503,
      );
    }
    const gate = await paidGates({ storeId: newFlow.storeId, userId, client });
    if (gate) return gate;

    // Revalida a autoridade do CONTEÚDO persistido contra o corpo atual. Um
    // reenvio divergente é recusado; o snapshot vencedor permanece autoridade.
    const built = await buildJointInitialSnapshot({
      newFlow,
      client,
      economicSnapshot,
    });
    if (!built.ok) {
      return errorResponse(built.code, built.message, built.status);
    }
    if (!persistedContentMatches(campaign.input_snapshot, built.frozenContentHash)) {
      return errorResponse(
        "operation_identity_conflict",
        "Conteúdo de campanha divergente.",
        409,
      );
    }
    const uploaded = await uploadInputs(
      client,
      newFlow.storeId,
      newFlow.campaignId,
      built.uploads,
    );
    if (uploaded) return uploaded;

    return runTwoFormatGeneration(
      {
        mode: "new",
        storeId: newFlow.storeId,
        campaignId: newFlow.campaignId,
        operationId: newFlow.operationId,
        authorization: { kind: "owner", userId },
        allowNewPaidStep: true,
        requestStartedAtMs,
        deadlineAtMs,
        inputSnapshot: campaign.input_snapshot,
        squareDeliveryId: persistedContext.squareDeliveryId,
        initialRequestId: persistedContext.initialRequestIds.base,
        preflight,
        ...(options.signal === undefined ? {} : { signal: options.signal }),
      },
      runDeps,
    );
  }

  // Campanha INEXISTENTE: criação inicial.
  const enabled = await enabledOrFalse();
  if (!enabled) {
    return errorResponse(
      "generation_unavailable",
      "Nova geração conjunta indisponível. Nenhuma operação foi criada.",
      503,
    );
  }
  const preflight = await runDeps.preflightJointSelection();
  if (!preflight.ok) {
    return errorResponse(
      preflight.reason,
      "Seleção de expansão indisponível.",
      503,
    );
  }
  const gate = await paidGates({ storeId: newFlow.storeId, userId, client });
  if (gate) return gate;

  const built = await buildJointInitialSnapshot({
    newFlow,
    client,
    economicSnapshot,
  });
  if (!built.ok) {
    return errorResponse(built.code, built.message, built.status);
  }

  const context = buildJointResumeContext({
    operationId: newFlow.operationId,
    ...(options.uuid === undefined ? {} : { uuid: options.uuid }),
  });
  const submittedSnapshot = attachJointResumeContext(built.inputSnapshot, context);

  let effectiveSnapshot: Record<string, unknown> = submittedSnapshot;
  let effectiveContext: JointResumeContext = context;
  let insertFailed = false;
  try {
    await createCampaignWithClient(
      client,
      newFlow.storeId,
      {
        productName: newFlow.productName,
        inputSnapshot: submittedSnapshot,
        identitySnapshot: built.identitySnapshot ?? undefined,
      },
      newFlow.campaignId,
    );
  } catch {
    insertFailed = true;
  }

  if (insertFailed) {
    // Corrida: relê o vencedor e adota snapshot/conteúdo/identidade vencedores.
    let raced: CampaignRow | null;
    try {
      raced = await readCampaign(client, newFlow.campaignId);
    } catch {
      return errorResponse("operation_unavailable", "Campanha indisponível.", 503);
    }
    if (!raced || raced.store_id !== newFlow.storeId) {
      return errorResponse(
        "operation_identity_conflict",
        "Campanha divergente.",
        409,
      );
    }
    if (classifyTwoFormatCampaign(raced.input_snapshot).kind !== "two_format") {
      return errorResponse(
        "operation_identity_conflict",
        "Contrato conjunto divergente.",
        409,
      );
    }
    const racedContext = readPersistedContext(raced.input_snapshot);
    if (!racedContext) {
      return errorResponse(
        "operation_identity_conflict",
        "Identidade conjunta ausente.",
        409,
      );
    }
    if (!persistedContentMatches(raced.input_snapshot, built.frozenContentHash)) {
      return errorResponse(
        "operation_identity_conflict",
        "Conteúdo de campanha divergente.",
        409,
      );
    }
    effectiveSnapshot = raced.input_snapshot as Record<string, unknown>;
    effectiveContext = racedContext;
  }

  const uploaded = await uploadInputs(
    client,
    newFlow.storeId,
    newFlow.campaignId,
    built.uploads,
  );
  if (uploaded) return uploaded;

  return runTwoFormatGeneration(
    {
      mode: "new",
      storeId: newFlow.storeId,
      campaignId: newFlow.campaignId,
      operationId: newFlow.operationId,
      authorization: { kind: "owner", userId },
      allowNewPaidStep: true,
      requestStartedAtMs,
      deadlineAtMs,
      inputSnapshot: effectiveSnapshot,
      squareDeliveryId: effectiveContext.squareDeliveryId,
      initialRequestId: effectiveContext.initialRequestIds.base,
      preflight,
      ...(options.signal === undefined ? {} : { signal: options.signal }),
    },
    runDeps,
  );
}
