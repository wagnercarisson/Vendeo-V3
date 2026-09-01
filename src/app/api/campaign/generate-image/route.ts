import { NextRequest } from "next/server";
import { GenerateImageRequestSchema } from "@/lib/image-generation/schema";
import { IMAGE_GENERATION_GLOBAL_TIMEOUT_MS, MAX_PRODUCT_IMAGE_BASE64_SIZE, MAX_PRODUCT_IMAGES_AGGREGATE_BASE64_SIZE, IMAGE_GENERATION_RESPONSES_MODEL } from "@/lib/image-generation/config";
import { OperationCostService, OperationCostUnavailableError } from "@/lib/credit/operation-cost-service";
import type { OperationCostResolution } from "@/lib/credit/types";
import { ImageGenerationService } from "@/lib/image-generation/services/image-generation-service";
import type { GenerateImageServiceResult } from "@/lib/image-generation/services/image-generation-service";
import { InputValidationService } from "@/lib/image-generation/services/input-validation-service";
import { isForceBriefVisionCheckEnabled, isCampaignApprovalEnabled } from "@/lib/feature-flags/feature-flag-service";
import { createImageProvider } from "@/lib/image-generation/providers/factory";
import { resolveStoreIdentity, validateIdentityReference, buildCampaignBrief } from "@/lib/store-identity-service";
import { buildCampaignBriefFromFlat, buildCampaignBriefSnapshot, mimeTypeFromDataUrl } from "@/lib/campaign/brief";
import { requireSameOrigin } from "@/lib/auth/csrf";
import { requireApiUser } from "@/lib/auth/require-user";
import { requireOwnership } from "@/lib/auth/store-ownership";
import { getStoreReadiness } from "@/lib/store-readiness";
import { apiHandler } from "@/lib/auth/api-handler";
import { supabaseAdmin } from '@/lib/supabase/server';
import type { CampaignInput } from "@/components/campaign/types";
import { createCampaign, dataUrlToCampaignImage, uploadCampaignImage, uploadCampaignInputImage, removeCampaignInputs, updateCampaignReady, updateCampaignError, deleteCampaignImage, createArtVersion } from "@/lib/campaign/persistence";
import { transcodeToJpeg } from "@/lib/campaign/image-processor";
import { checkRateLimit, recordGenerationAttempt } from "@/lib/rate-limit/rate-limit";
import { CreditService } from "@/lib/credit/credit-service";
import { CopyDirectorService } from "@/lib/copy/copy-director-service";
import { createTextProvider } from "@/lib/text-provider/factory";
import { mapBriefToCopyDirectorInput, buildDeterministicCopy, buildCommercialFrame } from "@/lib/copy/mapper";
import type { CopyDirectorResult } from "@/lib/copy/schema";
import type { CampaignIntent } from "@/lib/campaign/types";
import { isRetryableError } from "@/lib/copy/errors";
import { getLaunchConfig } from "@/lib/launch-config/config";
import { logPipelineEvent } from "@/lib/logging/pipeline-logger";
import { AiCostTracker, resolveAiCost } from "@/lib/ai-cost";
import type { AiCallInfo, CostResolution } from "@/lib/ai-cost/types";
import type { GenerationEventType } from "@/lib/visual-signature/types";
import type { ImageProviderUsageMeta } from "@/lib/image-generation/providers/types";
import { requireLegalClearance } from "@/lib/legal/clearance";
import { EconomicParameterService } from "@/lib/economic/economic-parameter-service";

export const runtime = "nodejs";

export const POST = apiHandler(async (request: NextRequest) => {
  requireSameOrigin(request);

  // ── Pre-stream: Launch config + run context (D1/D7) ───────────
  // Início do run "campaign_delivery": gera operationRunId (agrupador econômico)
  // + traceId (rastreio técnico) DISTINTOS; o operationRunId é persistido na
  // campanha na criação (D1/D2) e propagado a todos os eventos do run.
  const config = getLaunchConfig();
  const { operationRunId, traceId } = new AiCostTracker().startRun("campaign_delivery");

  // F38.2.1 (D3): snapshot econômico resolvido UMA vez no início do run (padrão
  // telemetria) — propagado a TODAS as chamadas filhas via recordCall. Apenas
  // VALORES: o tracker define a origem `captured_at_generation` na gravação.
  // Best-effort: falha → valores null → fallback legacy em leitura; NUNCA
  // bloqueia a geração (T-38.2.1-05).
  const economicSnapshot = await (async (): Promise<{
    usdBrlRateAtGeneration: number | null;
    creditValueBrlAtGeneration: number | null;
  }> => {
    try {
      const service = new EconomicParameterService();
      const [usd, credit] = await Promise.all([
        service.getParameter("usd_brl_rate"),
        service.getParameter("credit_value_brl"),
      ]);
      return {
        usdBrlRateAtGeneration: usd.value,
        creditValueBrlAtGeneration: credit.value,
      };
    } catch (err) {
      console.error(
        "[generate-image] snapshot econômico indisponível (best-effort):",
        err instanceof Error ? err.message : String(err)
      );
      return { usdBrlRateAtGeneration: null, creditValueBrlAtGeneration: null };
    }
  })();

  if (config.generationPaused) {
    return Response.json(
      { error: { message: "Geração temporariamente indisponível." } },
      { status: 503 }
    );
  }

  // ── Pre-stream: Parse JSON body ──────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: { message: "Corpo da requisição inválido" } },
      { status: 400 }
    );
  }

  // ── Pre-stream: Check for legacy identity fields (BREAKING) ─────
  const LEGACY_FIELDS = ['storeName', 'storeLogoUrl', 'brandProfile', 'storeSegment', 'storeTone', 'brandColor'];
  const hasLegacyFields = LEGACY_FIELDS.some(f => f in body);
  if (hasLegacyFields) {
    return Response.json(
      { error: { message: "Campos de identidade da loja não são mais aceitos como entrada do cliente. Use storeId para resolução no backend." } },
      { status: 400 }
    );
  }

  // ── Pre-stream: Log received fields (safe, no base64 data) ───────
  const safeLog = {
    keys: Object.keys(body),
    storeId: (body as any).storeId ?? null,
    hasProductName: typeof body.productName === 'string' && body.productName.length > 0,
    hasProductImage: typeof body.productImageDataUrl === 'string' && body.productImageDataUrl.length > 0,
    productImageLength: typeof body.productImageDataUrl === 'string' ? body.productImageDataUrl.length : 0,
    hasPrice: typeof body.discountedPriceCents === 'number',
  };
  console.log(`[generate-image] payload_received`, JSON.stringify(safeLog));

  // ── Pre-stream: Regra de exclusividade D2 ───────────────────────
  // Tabela canônica: productImages XOR productImageDataUrl.
  // (1) productImages presente + dataUrl ausente → válido (exatamente 1 primary no zod)
  // (2) productImages ausente + dataUrl presente → legado (mapper gera 1 primary/upload)
  // (3) ambos ausentes → 400
  // (4) ambos presentes → 400 (payload ambíguo — mutuamente exclusivos, não "substitui")
  const hasProductImages = Array.isArray(body.productImages) && body.productImages.length > 0;
  const hasLegacyDataUrl = typeof body.productImageDataUrl === "string" && body.productImageDataUrl.length > 0;
  if (!hasProductImages && !hasLegacyDataUrl) {
    return Response.json(
      { error: { message: "Imagem do produto é obrigatória para gerar a campanha visual." } },
      { status: 400 }
    );
  }
  if (hasProductImages && hasLegacyDataUrl) {
    return Response.json(
      { error: { message: "Payload ambíguo: envie productImages[] OU productImageDataUrl, não ambos." } },
      { status: 400 }
    );
  }

  // ── Pre-stream: Limites D10 — por item + teto agregado (productImages) ─
  if (hasProductImages) {
    const items = body.productImages as Array<{ dataUrl: string }>;
    for (let i = 0; i < items.length; i++) {
      if (items[i].dataUrl.length > MAX_PRODUCT_IMAGE_BASE64_SIZE) {
        return Response.json(
          {
            error: {
              message: `Imagem ${i + 1} do produto excede o limite de ${Math.round(MAX_PRODUCT_IMAGE_BASE64_SIZE / (1024 * 1024))}MB. Comprima a imagem e tente novamente.`,
            },
          },
          { status: 413 }
        );
      }
    }
    const aggregateSize = items.reduce((sum, item) => sum + item.dataUrl.length, 0);
    if (aggregateSize > MAX_PRODUCT_IMAGES_AGGREGATE_BASE64_SIZE) {
      return Response.json(
        {
          error: {
            message: `As imagens do produto excedem o teto agregado de ${Math.round(MAX_PRODUCT_IMAGES_AGGREGATE_BASE64_SIZE / (1024 * 1024))}MB. Reduza a quantidade ou o tamanho das imagens e tente novamente.`,
          },
        },
        { status: 413 }
      );
    }
  }

  // ── Pre-stream: Check payload size limit (legado single) ────────
  if (hasLegacyDataUrl && (body.productImageDataUrl as string).length > MAX_PRODUCT_IMAGE_BASE64_SIZE) {
    return Response.json(
      {
        error: {
          message: `Imagem do produto excede o limite de ${Math.round(MAX_PRODUCT_IMAGE_BASE64_SIZE / (1024 * 1024))}MB. Comprima a imagem e tente novamente.`,
        },
      },
      { status: 413 }
    );
  }

  // ── Pre-stream: Validate full request schema ─────────────────────
  const parsed = GenerateImageRequestSchema.safeParse(body);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(i => ({
      path: i.path.join('.'),
      code: i.code,
      message: i.message,
    }));
    console.log(`[generate-image] validation_fail — Zod safeParse rejeitou`, { issues });
    return Response.json(
      {
        error: {
          message: "Dados de entrada inválidos para geração de imagem",
          details: parsed.error.flatten().fieldErrors,
        },
      },
      { status: 400 }
    );
  }

  // ── Auth & Ownership: requireSameOrigin já executou acima ─────────
  const user = await requireApiUser();
  await requireOwnership(parsed.data.storeId, user.userId);

  // ── Pre-stream: Legal clearance check ────────────────────────────
  const clearance = await requireLegalClearance({
    storeId: parsed.data.storeId,
    userId: user.userId,
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

  // ── Pre-stream: Store readiness guard ─────────────────────────────
  const readiness = await getStoreReadiness(parsed.data.storeId);
  if (!readiness.ready) {
    return Response.json(
      {
        error: {
          message: "Loja não está pronta para gerar campanhas.",
          reasons: readiness.missing.map(m => m.reason),
          missing: readiness.missing.map(m => m.item),
        },
      },
      { status: 412 },
    );
  }

  // ── Pre-stream: Semantic validation + normalization by intent ──────
  // Validation: offer requires discountedPriceCents
  if (parsed.data.campaignIntent === "offer" && !parsed.data.discountedPriceCents) {
    return Response.json(
      { error: { message: "Preço com desconto é obrigatório para ofertas" } },
      { status: 400 }
    );
  }

  // Normalization: exclusive never carries price
  if (parsed.data.campaignIntent === "exclusive" && parsed.data.discountedPriceCents) {
    parsed.data.discountedPriceCents = undefined;
    console.warn("[generate-image] exclusive com discountedPriceCents presente — normalizando para ausente.");
  }

  // ── F43 (D5): flag administrativa de reativação — normalização ponta a ponta ──
  // Com a flag `force_brief_vision_check` LIGADA, remove `brief_review_confirmed`
  // do inputValidationOverride ANTES da checagem pré-stream (route.ts:338) e usa
  // o MESMO input normalizado para a checagem, o brief e o generateImage — assim
  // pré-stream E Phase 1 do serviço executam a IA de visão (capacidade reativável
  // sem redeploy). `user_confirmed_continue` NUNCA é removido ("409 + insistiu").
  // Com a flag DESLIGADA, `brief_review_confirmed` pula nos dois pontos (padrão).
  let effectiveParsedData = parsed.data;
  const forceBriefVisionCheck = await isForceBriefVisionCheckEnabled();
  if (
    forceBriefVisionCheck &&
    parsed.data.inputValidationOverride?.productImageCheck === "brief_review_confirmed"
  ) {
    effectiveParsedData = {
      ...parsed.data,
      inputValidationOverride: undefined,
    };
    logPipelineEvent({
      event: "feature_flag_force_vision_check",
      traceId,
      phase: "pre_stream",
      status: "complete",
      storeId: parsed.data.storeId,
      userId: user.userId,
    });
  }

  // ── Pre-stream: Resolve store identity (backend-side) ────────────
  const { storeId, ...campaignInput } = effectiveParsedData;

  let storeSnapshot;
  try {
    const { data: store, error: storeError } = await supabaseAdmin
      .from("stores")
      .select("id, name, logo_url, segment, brand_color, subsegment, tone_of_voice, positioning, short_description, slogan, identity_state")
      .eq("id", storeId)
      .single();

    if (storeError || !store) {
      console.error(`[generate-image] store not found — ${storeId}`);
      return Response.json(
        { error: { message: "Loja não encontrada." } },
        { status: 404 }
      );
    }

    storeSnapshot = await resolveStoreIdentity(store);
  } catch (err) {
    console.error(`[generate-image] resolveStoreIdentity error — ${err instanceof Error ? err.message : String(err)}`);
    return Response.json(
      { error: { message: "Erro ao resolver identidade da loja." } },
      { status: 500 }
    );
  }

  // Validate identity reference before building brief
  const validatedSnapshot = await validateIdentityReference(storeSnapshot);

  // Build campaign context (wrapper resolvido) + domain brief (mapper puro na fronteira)
  const context = await buildCampaignBrief(validatedSnapshot, campaignInput as CampaignInput);
  const brief = buildCampaignBriefFromFlat(effectiveParsedData, effectiveParsedData.storeId);

  // ── Pre-stream: Rate limit guard (no IA, no stream) ────────────
  logPipelineEvent({ event: "rate_limit_check", traceId, phase: "pre_stream", status: "running", storeId, userId: user.userId });
  const rateLimitResult = await checkRateLimit(storeId, { rateLimitEnabled: config.rateLimitEnabled });
  if (!rateLimitResult.allowed) {
    logPipelineEvent({ event: "rate_limit_check", traceId, phase: "pre_stream", status: "failed", storeId, userId: user.userId, errorCode: rateLimitResult.reason });
    return Response.json(
      { error: "rate_limit_exceeded", retryAfter: rateLimitResult.resetTime ?? "1 hour" },
      { status: 429 }
    );
  }
  logPipelineEvent({ event: "rate_limit_check", traceId, phase: "pre_stream", status: "complete", storeId, userId: user.userId });

  // ── Pre-stream: Record generation attempt ───────────────────────
  await recordGenerationAttempt(storeId, user.userId);

  // ── Pre-stream: Resolve operation cost (D12) ───────────────────
  let cost: OperationCostResolution;
  try {
    cost = await new OperationCostService().getCost("campaign_generation");
  } catch (err) {
    if (err instanceof OperationCostUnavailableError) {
      logPipelineEvent({ event: "operation_cost_unavailable", traceId, phase: "pre_stream", status: "failed", storeId, userId: user.userId });
      return Response.json(
        { error: "operation_cost_unavailable", operationKey: "campaign_generation", message: "Serviço indisponível no momento. Tente novamente em alguns instantes." },
        { status: 503 }
      );
    }
    throw err;
  }
  if (!cost.enabled) {
    return Response.json(
      { error: "operation_disabled", operationKey: cost.operationKey },
      { status: 503 }
    );
  }

  // ── Pre-stream: Balance check (no IA, no stream) ────────────────
  logPipelineEvent({ event: "balance_check", traceId, phase: "pre_stream", status: "running", storeId, userId: user.userId });
  const creditService = new CreditService(supabaseAdmin);
  if (config.creditsChargingEnabled) {
    const balance = await creditService.getBalance(storeId);
    if (balance < cost.costCredits) {
      logPipelineEvent({ event: "balance_check", traceId, phase: "pre_stream", status: "failed", storeId, userId: user.userId, errorCode: "insufficient_balance" });
      return Response.json(
        { error: { message: "Saldo insuficiente. São necessários créditos para gerar uma campanha." } },
        { status: 402 }
      );
    }
  }
  logPipelineEvent({ event: "balance_check", traceId, phase: "pre_stream", status: "complete", storeId, userId: user.userId });

  // ── Pre-stream: Input validation for conflict/confidence ─────────
  if (!effectiveParsedData.inputValidationOverride?.productImageCheck) {
    const inputValidation = new InputValidationService();
    let validationResult: Awaited<ReturnType<typeof inputValidation.validate>>;
    try {
      // F41 D8: validação primary-only — resolve a imagem com role "primary",
      // NUNCA posição 0 (o zod garante exatamente 1 primary, mas a ordem do
      // array é irrelevante — um cliente pode enviar [reference, primary]).
      const primaryDataUrl = hasProductImages
        ? parsed.data.productImages!.find((img) => img.role === "primary")!.dataUrl
        : parsed.data.productImageDataUrl!;
      validationResult = await inputValidation.validate(
        parsed.data.productName,
        primaryDataUrl,
        undefined
      );
    } catch {
      console.error("[generate-image] validation_parse_error — validação quebrou com exceção não tratada");
      return Response.json(
        {
          status: "needs_user_action",
          reason: "product_image_low_confidence",
          message: "Não foi possível confirmar se o nome do produto corresponde à imagem.",
        },
        { status: 409 }
      );
    }

    if (validationResult.classification === "conflict") {
      return Response.json(
        {
          status: "needs_user_action",
          reason: "product_image_conflict",
          message: "O nome do produto digitado não corresponde à imagem enviada.",
          suggestedProductName: validationResult.suggestedProductName,
        },
        { status: 409 }
      );
    }

    if (validationResult.classification === "strong_conflict") {
      return Response.json(
        {
          status: "needs_user_action",
          reason: "product_image_strong_conflict",
          message: "A imagem enviada parece ser de outro produto. Para evitar uma campanha incorreta e consumo desnecessário de geração, corrija o nome do produto ou troque a imagem.",
          suggestedProductName: validationResult.suggestedProductName,
        },
        { status: 409 }
      );
    }

    if (validationResult.classification === "low-confidence") {
      return Response.json(
        {
          status: "needs_user_action",
          reason: "product_image_low_confidence",
          message: "Não foi possível confirmar se o nome do produto corresponde à imagem.",
        },
        { status: 409 }
      );
    }
  }

  // ── Pre-stream: Create campaign record (generating status) + D5 ──
  // F41 D5 (aplica-se aos DOIS fluxos — decisão 2026-08-14): pré-gera campaignId,
  // gera id por imagem, sobe os inputs ANTES do snapshot, monta o snapshot com
  // storagePath por imagem e chama createCampaign com o id pré-gerado.
  logPipelineEvent({ event: "campaign_create", traceId, phase: "pre_stream", status: "running", storeId, userId: user.userId });
  let campaignId: string | undefined;
  let storagePath: string | undefined;
  const campaignIdPre = crypto.randomUUID();
  try {
    // (2) id por imagem — mesma FONTE do loop (domínio, sempre ≥1 via mapper,
    // inclusive no legado que vira 1 elemento); nunca productImages do transporte.
    const imageIds = brief.media.images.map(() => crypto.randomUUID());

    // (3) upload ANTES do snapshot — iterar sobre brief.media.images (objetos do
    // domínio que o snapshot consome), NUNCA sobre o array de transporte.
    for (const [idx, img] of brief.media.images.entries()) {
      const { buffer } = dataUrlToCampaignImage(img.dataUrl!);
      const mimeType = mimeTypeFromDataUrl(img.dataUrl!) ?? img.mimeType;
      await uploadCampaignInputImage(storeId, campaignIdPre, imageIds[idx], { buffer, mimeType });
      img.storagePath = `${storeId}/${campaignIdPre}/inputs/${imageIds[idx]}.jpg`;
    }

    // (4) snapshot COM storagePath por imagem (buildCampaignBriefSnapshot lê brief.media.images[i].storagePath)
    const inputSnapshot: Record<string, unknown> = buildCampaignBriefSnapshot(brief) as unknown as Record<string, unknown>;

    // (5) createCampaign com id pré-gerado (3º argumento opcional)
    const campaign = await createCampaign(storeId, {
      productName: campaignInput.productName,
      inputSnapshot,
      identitySnapshot: validatedSnapshot as unknown as Record<string, unknown>,
      operationRunId,
    }, campaignIdPre);
    campaignId = campaign.id;
    storagePath = campaign.storagePath;
    logPipelineEvent({ event: "campaign_create", traceId, phase: "pre_stream", status: "complete", campaignId: campaign.id, storeId, userId: user.userId });

    // F37.1 (D8/D10): quando a flag está ligada, insere a v1 (candidata
    // pending/active) com brief_snapshot = campaign_brief_v1 persistido.
    // Fail-safe: falha no insert → log + continua; a campanha nasce sem versões
    // e é exibida como legacy (D1 — a flag nunca derruba a geração).
    try {
      if (await isCampaignApprovalEnabled()) {
        await createArtVersion(campaign.id, 1, campaign.storagePath, inputSnapshot);
      }
    } catch (err) {
      console.error(`[generate-image] createArtVersion v1 failed (fail-safe) — ${err instanceof Error ? err.message : String(err)}`);
    }
  } catch (err) {
    logPipelineEvent({ event: "campaign_create", traceId, phase: "pre_stream", status: "failed", storeId, userId: user.userId, errorMessage: err instanceof Error ? err.message : String(err) });
    console.error(`[generate-image] createCampaign error — ${err instanceof Error ? err.message : String(err)}`);
    // F41 D5: limpeza pré-stream — remove os inputs já enviados (sem órfãos)
    try { await removeCampaignInputs(storeId, campaignIdPre); } catch { /* ignore */ }
    return Response.json(
      { error: { message: "Erro ao iniciar registro da campanha." } },
      { status: 500 }
    );
  }

  // ── Pre-stream: Reserve credit before IA ────────────────────────
  let creditTxId: string | undefined;
  if (config.creditsChargingEnabled) {
    logPipelineEvent({ event: "credit_reserve", traceId, phase: "pre_stream", status: "running", campaignId, storeId, userId: user.userId });
    try {
      creditTxId = await creditService.reserveCredit(storeId, cost.costCredits, {
        campaignId,
        idempotencyKey: `reserve_${campaignId}`,
        metadata: {
          feature: "campaign_pipeline",
          operation_key: cost.operationKey,
          operation_cost_credits: cost.costCredits,
          operation_cost_source: cost.source,
        },
      });
      logPipelineEvent({ event: "credit_reserve", traceId, phase: "pre_stream", status: "complete", campaignId, storeId, userId: user.userId });
    } catch (err: unknown) {
      logPipelineEvent({ event: "credit_reserve", traceId, phase: "pre_stream", status: "failed", campaignId, storeId, userId: user.userId, errorMessage: err instanceof Error ? err.message : String(err) });
      try { await deleteCampaignImage(storagePath!); } catch { /* ignore */ }
      try { await supabaseAdmin.from("campaigns").delete().eq("id", campaignId); } catch { /* ignore */ }
      const message = err && typeof err === "object" && "message" in err
        ? (err as { message: string }).message
        : "Erro ao reservar crédito";
      console.error(`[generate-image] reserveCredit error — ${message}`);
      return Response.json(
        { error: { message: message.includes("saldo_insuficiente") ? "Saldo insuficiente." : "Erro ao processar pagamento." } },
        { status: message.includes("saldo_insuficiente") ? 402 : 500 }
      );
    }
  }

  const startTime = performance.now();

  // ── Stream: Open NDJSON stream ──────────────────────────────────
  const streamAbortController = new AbortController();
  const timeoutId = setTimeout(() => streamAbortController.abort(), IMAGE_GENERATION_GLOBAL_TIMEOUT_MS);

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const provider = createImageProvider();
      const imageService = new ImageGenerationService(provider);

      const emit = (event: Record<string, unknown>) => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        } catch {
          // stream closed by client
        }
      };

      // ── ZONA PARALELO: Copy Director ∥ Image Director ───────────
      let copyResult: CopyDirectorResult | undefined;
      let imageResult: GenerateImageServiceResult | undefined;
      let copyError: Error | undefined;
      let imageError: Error | undefined;

      // Helper: emit phase event
      const emitPhase = (phase: string, status: string, message?: string) => {
        emit({ type: "phase", phase, status, message });
      };

      // ── F38.1 (D7/D11): Camada única de registro de custo via AiCostTracker ──
      // Call-level: custo REAL por chamada via resolveAiCost (furo 1) + tokens +
      // duration_ms da chamada (furo 7) + attempt real (furo 6).
      // Delivery (campaign_pipeline): SEMPRE sem custo/tokens (anti-dupla-contagem
      // D1/D6) — o tracker marca a entrega com a flag de pipeline no metadata.
      // Best-effort (D7): nunca lança e nunca bloqueia o pipeline.
      let callCostSum = 0;

      // F38.1 fechamento: metadata call-level para auditoria (furo 8 — coluna
      // call_metadata nunca preenchida na geração de imagem). Carrega o usage bruto
      // sanitizado do provider + flags do caminho de geração (Responses
      // image_generation) E os componentes da fórmula de estimativa (v2) quando o
      // resolvedor aplicou o ajuste provisório da tool.
      const buildCallMetadata = (
        info: AiCallInfo & { usageMeta?: ImageProviderUsageMeta },
        cost?: CostResolution,
      ): Record<string, unknown> | undefined => {
        const usageMeta = info.usageMeta
          ? {
              provider_usage_raw: info.usageMeta.providerUsageRaw,
              provider_usage_source: info.usageMeta.providerUsageSource,
              responses_model: info.usageMeta.responsesModel,
              image_generation_tool: info.usageMeta.imageGenerationTool,
            }
          : undefined;

        const formula =
          cost && (cost.costFormulaVersion || cost.costEstimationNote || cost.textComponentUsd !== undefined)
            ? {
                cost_formula_version: cost.costFormulaVersion,
                text_component_usd: cost.textComponentUsd,
                image_tool_component_usd: cost.imageToolComponentUsd,
                image_tool_pricing_provider: cost.imageToolPricingProvider,
                image_tool_pricing_model: cost.imageToolPricingModel,
                image_tool_pricing_version: cost.imageToolPricingVersion,
                cost_estimation_note: cost.costEstimationNote,
              }
            : undefined;

        return usageMeta || formula ? { ...usageMeta, ...formula } : undefined;
      };

      const recordCall = async (params: {
        generationType: GenerationEventType;
        status: "success" | "failed";
        info: AiCallInfo & { attempt?: number; usageMeta?: ImageProviderUsageMeta };
        errorType?: string;
      }): Promise<void> => {
        try {
          const isDelivery = params.generationType === "campaign_pipeline";
          let cost: CostResolution | undefined;
          if (!isDelivery) {
            cost = await resolveAiCost({
              provider: params.info.provider,
              model: params.info.model,
              usage: params.info.usage,
              providerReportedCostUsd: params.info.providerReportedCostUsd,
              imageGenerationTool: params.info.usageMeta?.imageGenerationTool === true,
              generationType: params.generationType,
            });
            if (typeof cost.estimatedCostUsd === "number") {
              callCostSum += cost.estimatedCostUsd;
            }
          }
          await new AiCostTracker().record({
            operationRunId,
            operationRunType: "campaign_delivery",
            traceId,
            storeId,
            userId: user.userId,
            campaignId,
            generationType: params.generationType,
            provider: params.info.provider,
            model: params.info.model,
            attemptNumber: params.info.attempt ?? 0,
            durationMs: params.info.durationMs,
            status: params.status,
            errorType: params.errorType ?? null,
            tokens: isDelivery ? undefined : params.info.usage,
            cost: isDelivery ? undefined : cost,
            // F38.2.1 (D3): snapshot do run propagado às chamadas filhas —
            // APENAS valores; o tracker define captured_at_generation.
            usdBrlRateAtGeneration: economicSnapshot.usdBrlRateAtGeneration,
            creditValueBrlAtGeneration: economicSnapshot.creditValueBrlAtGeneration,
            metadata: isDelivery ? { duration_is_pipeline: true } : buildCallMetadata(params.info, cost),
          });
        } catch (err) {
          console.error("[generate-image] recordCall failed (best-effort):", err instanceof Error ? err.message : String(err));
        }
      };

      // Copy Director task with retry Gemini fallback
      const copyTask = async (): Promise<void> => {
        logPipelineEvent({ event: "copy_generation", traceId, phase: "parallel", status: "running", campaignId, storeId, userId: user.userId });
        try {
          if (!config.copyDirectorEnabled) {
            const campaignIntent = (campaignInput.campaignIntent ?? "offer") as CampaignIntent;
            const deterministic = buildDeterministicCopy(campaignIntent, {
              productName: campaignInput.productName,
              storeName: context.store.name,
              commercialFrame: buildCommercialFrame(campaignIntent, {
                badgeText: campaignInput.badgeText,
                originalPriceCents: campaignInput.originalPriceCents,
                discountedPriceCents: campaignInput.discountedPriceCents,
              }),
              discountedPriceCents: campaignInput.discountedPriceCents,
              badgeText: campaignInput.badgeText,
            });
            copyResult = deterministic;
            emitPhase("copy_generation", "complete", "Texto determinístico (flag desligada)");
            logPipelineEvent({ event: "copy_generation", traceId, phase: "parallel", status: "complete", campaignId, storeId, userId: user.userId, metadata: { fallback: "deterministic" } });
            return;
          }

          const primaryProvider = createTextProvider("openai");
          const copyDirector = new CopyDirectorService(primaryProvider);

          const copyInput = mapBriefToCopyDirectorInput(brief, context, {
            badgeText: campaignInput.badgeText,
            originalPriceCents: campaignInput.originalPriceCents,
            discountedPriceCents: campaignInput.discountedPriceCents,
          });

          emitPhase("copy_generation", "running", "Gerando texto da campanha...");

          try {
            copyResult = await copyDirector.generateCopy(copyInput, {
              signal: streamAbortController.signal,
            }, (info) => {
              // F38.1 (D11/furo 1): campaign_copy com usage REAL do onCall -> custo via resolveAiCost
              void recordCall({ generationType: "campaign_copy", status: "success", info });
            });
          } catch (firstErr) {
            // Check if retryable and fallback Gemini is configured
            const fallbackProvider = process.env.TEXT_FALLBACK_PROVIDER;

            if (isRetryableError(firstErr) && fallbackProvider === "gemini") {
              emitPhase("copy_retry", "running", "Usando provedor alternativo...");

              try {
                const geminiProvider = createTextProvider("gemini");
                const geminiDirector = new CopyDirectorService(geminiProvider);
                copyResult = await geminiDirector.generateCopy(copyInput, {
                  signal: streamAbortController.signal,
                }, (info) => {
                  void recordCall({ generationType: "campaign_copy", status: "success", info });
                });
              } catch (secondErr) {
                throw secondErr;
              }
            } else if (isRetryableError(firstErr) && fallbackProvider !== "gemini") {
              // No fallback configured — rethrow as-is
              throw firstErr;
            } else {
              // Non-retryable error — throw immediately
              throw firstErr;
            }
          }

          emitPhase("copy_generation", "complete", "Texto da campanha gerado");
          logPipelineEvent({ event: "copy_generation", traceId, phase: "parallel", status: "complete", campaignId, storeId, userId: user.userId });
        } catch (err) {
          copyError = err instanceof Error ? err : new Error(String(err));
          emitPhase("copy_generation", "failed", copyError.message);
          logPipelineEvent({ event: "copy_generation", traceId, phase: "parallel", status: "failed", campaignId, storeId, userId: user.userId, errorMessage: copyError.message });
          // Abort remaining branch
          streamAbortController.abort();
        }
      };

      // Image Director task
      const imageTask = async (): Promise<void> => {
        logPipelineEvent({ event: "image_generation", traceId, phase: "parallel", status: "running", campaignId, storeId, userId: user.userId });
        try {
          emitPhase("image_generation", "running", "Gerando arte com IA...");

          imageResult = await imageService.generateImage(brief, context, (phaseEvent) => {
            emit({ type: "phase", ...phaseEvent });
          }, streamAbortController.signal, (metricsEvent) => {
            // F38.1 (D11): mapeia fases do onMetricsEvent para eventos call-level.
            // Só fases que representam chamadas reais de IA geram evento (D5 —
            // não inventar chamada); done/prompt_assembly são ignoradas.
            switch (metricsEvent.phase) {
              case "input_validation":
                void recordCall({
                  generationType: "campaign_input_validation",
                  status: "success",
                  info: { provider: metricsEvent.provider, model: metricsEvent.model, usage: metricsEvent.usage, durationMs: metricsEvent.durationMs },
                });
                break;
              case "image_generation":
                void recordCall({
                  generationType: "campaign_image",
                  status: "success",
                  info: { provider: metricsEvent.provider, model: metricsEvent.model, usage: metricsEvent.usage, usageMeta: metricsEvent.usageMeta, durationMs: metricsEvent.durationMs, attempt: metricsEvent.attempt },
                });
                break;
              case "quality_review":
                void recordCall({
                  generationType: "campaign_image_review",
                  status: "success",
                  info: { provider: metricsEvent.provider, model: metricsEvent.model, usage: metricsEvent.usage, durationMs: metricsEvent.durationMs, attempt: metricsEvent.attempt },
                });
                break;
              default:
                // prompt_assembly/done — não são chamadas de IA (D5/D11)
                break;
            }
          });

          if (imageResult.success) {
            emitPhase("image_generation", "complete", "Arte gerada com sucesso");
            logPipelineEvent({ event: "image_generation", traceId, phase: "parallel", status: "complete", campaignId, storeId, userId: user.userId });
          } else {
            throw new Error(imageResult.message || "Falha na geração de imagem");
          }
        } catch (err) {
          imageError = err instanceof Error ? err : new Error(String(err));
          emitPhase("image_generation", "failed", imageError.message);
          logPipelineEvent({ event: "image_generation", traceId, phase: "parallel", status: "failed", campaignId, storeId, userId: user.userId, errorMessage: imageError.message });
          // Abort remaining branch
          streamAbortController.abort();
        }
      };

      // ── PREFLIGHT: Validate all prompts before parallel IA calls ──
      const preflightResult = imageService.validatePrompts(brief, context);
      if (!preflightResult.valid) {
        console.error(`[generate-image] prompt_preflight_failed — ${preflightResult.errors.join('; ')}`);
        emit({ type: "error", campaignId: campaignId!, phase: "preflight", code: "invalid_prompt", message: preflightResult.errors.join("; "), httpStatus: 502, retryable: false });
        try { await updateCampaignError(campaignId!, preflightResult.errors.join("; ")); } catch { /* ignore */ }
        try { await creditService.refundCredit(creditTxId!, "invalid_prompt", { idempotencyKey: `refund_${creditTxId}`, metadata: { feature: "campaign_pipeline" } }); } catch { /* ignore */ }
        clearTimeout(timeoutId);
        try { controller.close(); } catch { /* already closed */ }
        return;
      }

      // Execute both in parallel; if one fails, abort the other
      try {
        await Promise.all([copyTask(), imageTask()]);

        // ── ZONA PÓS-PARALELO: Evaluation ─────────────────────────
        if (!copyError && !imageError && imageResult?.success && copyResult) {
          // Both succeeded — merge and persist
          logPipelineEvent({ event: "merge", traceId, phase: "post_parallel", status: "running", campaignId, storeId, userId: user.userId });
          let uploadSucceeded = false;
          try {
            const { buffer, mimeType } = dataUrlToCampaignImage(imageResult.imageDataUrl);
            const jpegImage = await transcodeToJpeg(buffer, mimeType);
            await uploadCampaignImage(storeId, campaignId!, jpegImage);
            uploadSucceeded = true;
            logPipelineEvent({ event: "upload", traceId, phase: "post_parallel", status: "complete", campaignId, storeId, userId: user.userId });

            const durationMs = Math.round(performance.now() - startTime);
            const generationMetadata: Record<string, unknown> = {
              provider: provider.name,
              model: IMAGE_GENERATION_RESPONSES_MODEL,
              durationMs,
              generatedAt: new Date().toISOString(),
            };
            if (imageResult.inputCorrections) {
              generationMetadata.corrections = imageResult.inputCorrections;
            }

            const renderSnapshot: Record<string, unknown> = {
              format: "jpeg",
              width: 1080,
              height: 1080,
              aspectRatio: "1:1",
              mimeType: "image/jpeg",
              quality: 90,
              colorSpace: "srgb",
            };

            const publicationCopySnapshot: Record<string, unknown> = {
              ...copyResult,
            };

            await updateCampaignReady(campaignId!, {
              generationMetadata,
              renderSnapshot,
              publicationCopySnapshot,
            });
            logPipelineEvent({ event: "update_ready", traceId, phase: "post_parallel", status: "complete", campaignId, storeId, userId: user.userId });

            // Credit confirmed (no-op in v1.5)
            logPipelineEvent({ event: "credit_confirm", traceId, phase: "post_parallel", status: "running", campaignId, storeId, userId: user.userId });
            try { await creditService.confirmCredit(creditTxId!); } catch { /* ignore */ }
            logPipelineEvent({ event: "credit_confirm", traceId, phase: "post_parallel", status: "complete", campaignId, storeId, userId: user.userId });

            // F38.1 (D7/D11): os eventos call-level (campaign_copy,
            // campaign_input_validation, campaign_image, campaign_image_review)
            // já foram gravados pelos callbacks onCall/onMetricsEvent acima.
            // Aqui grava-se apenas o delivery marker campaign_pipeline SEM custo
            // e SEM tokens (anti-dupla-contagem D1/D6 — a flag de pipeline entra
            // no metadata pelo tracker) e corrige o furo 2: totalCost = SOMA REAL
            // dos custos call-level registrados (nunca provider name).
            logPipelineEvent({ event: "pipeline_complete", traceId, phase: "post_parallel", status: "complete", campaignId, storeId, userId: user.userId, durationMs, metadata: { totalCost: callCostSum } });
            void recordCall({
              generationType: "campaign_pipeline",
              status: "success",
              info: { provider: provider.name, model: IMAGE_GENERATION_RESPONSES_MODEL, durationMs },
            });

            emit({
              type: "result",
              campaignId: campaignId!,
              campaignUrl: `/campanhas/${campaignId}`,
            });
          } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            console.error(`[generate-image] persistence error — ${errorMessage}`);
            logPipelineEvent({ event: "merge", traceId, phase: "post_parallel", status: "failed", campaignId, storeId, userId: user.userId, errorMessage });

            if (uploadSucceeded) {
              try { await deleteCampaignImage(storagePath!); } catch { /* ignore */ }
            }

            try { await updateCampaignError(campaignId!, errorMessage); } catch { /* ignore */ }

            // Refund credit
            logPipelineEvent({ event: "credit_refund", traceId, phase: "post_parallel", status: "running", campaignId, storeId, userId: user.userId });
            try { await creditService.refundCredit(creditTxId!, "persistence_failure", { idempotencyKey: `refund_${creditTxId}`, metadata: { feature: "campaign_pipeline" } }); } catch { /* ignore */ }
            logPipelineEvent({ event: "credit_refund", traceId, phase: "post_parallel", status: "complete", campaignId, storeId, userId: user.userId });

            emit({
              type: "error",
              campaignId: campaignId!,
              phase: uploadSucceeded ? "update" : "upload",
              code: "persistence_error",
              message: "Erro ao salvar campanha. Crédito estornado.",
              httpStatus: 502,
              retryable: false,
            });
          }
        } else {
          // One or both failed — refund
          const errorMessage = copyError?.message ?? imageError?.message ?? "Erro na geração";
          logPipelineEvent({ event: "generation_failed", traceId, phase: "post_parallel", status: "failed", campaignId, storeId, userId: user.userId, errorMessage });
          try { await updateCampaignError(campaignId!, errorMessage); } catch { /* ignore */ }
          logPipelineEvent({ event: "credit_refund", traceId, phase: "post_parallel", status: "running", campaignId, storeId, userId: user.userId });
          try { await creditService.refundCredit(creditTxId!, "generation_failure", { idempotencyKey: `refund_${creditTxId}`, metadata: { feature: "campaign_pipeline" } }); } catch { /* ignore */ }
          logPipelineEvent({ event: "credit_refund", traceId, phase: "post_parallel", status: "complete", campaignId, storeId, userId: user.userId });

          emit({
            type: "error",
            campaignId: campaignId!,
            phase: "generation",
            code: "generation_failed",
            message: "Falha na geração da campanha. Crédito estornado.",
            httpStatus: 502,
            retryable: false,
          });

          // F38.1 (D7): delivery marker campaign_pipeline failed via tracker —
          // SEM custo/tokens (D1/D6); flag de pipeline entra pelo tracker.
          void recordCall({
            generationType: "campaign_pipeline",
            status: "failed",
            info: { provider: provider.name, model: IMAGE_GENERATION_RESPONSES_MODEL, durationMs: Math.round(performance.now() - startTime) },
            errorType: errorMessage,
          });
        }
      } catch (err) {
        // Catch errors from Promise.all itself (e.g., AbortError)
        const errorMessage = err instanceof Error ? err.message : String(err);
        logPipelineEvent({ event: "generation_aborted", traceId, phase: "post_parallel", status: "failed", campaignId, storeId, userId: user.userId, errorMessage });
        try { await updateCampaignError(campaignId!, errorMessage); } catch { /* ignore */ }
        logPipelineEvent({ event: "credit_refund", traceId, phase: "post_parallel", status: "running", campaignId, storeId, userId: user.userId });
        try { await creditService.refundCredit(creditTxId!, "generation_aborted", { idempotencyKey: `refund_${creditTxId}`, metadata: { feature: "campaign_pipeline" } }); } catch { /* ignore */ }
        logPipelineEvent({ event: "credit_refund", traceId, phase: "post_parallel", status: "complete", campaignId, storeId, userId: user.userId });

        const isTimeout = err instanceof DOMException && err.name === "AbortError";
        emit({
          type: "error",
          campaignId: campaignId!,
          phase: "generation",
          code: isTimeout ? "global_timeout" : "generation_failed",
          message: isTimeout ? "Tempo limite excedido. Crédito estornado." : "Falha na geração. Crédito estornado.",
          httpStatus: isTimeout ? 504 : 502,
          retryable: false,
        });
      } finally {
        clearTimeout(timeoutId);
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "application/x-ndjson" },
  });
});
