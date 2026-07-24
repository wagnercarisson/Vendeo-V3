import { NextRequest } from "next/server";
import crypto from "crypto";
import { GenerateImageRequestSchema } from "@/lib/image-generation/schema";
import { IMAGE_GENERATION_GLOBAL_TIMEOUT_MS, MAX_PRODUCT_IMAGE_BASE64_SIZE, IMAGE_GENERATION_RESPONSES_MODEL, COST_PER_GENERATION } from "@/lib/image-generation/config";
import { ImageGenerationService } from "@/lib/image-generation/services/image-generation-service";
import type { GenerateImageServiceResult } from "@/lib/image-generation/services/image-generation-service";
import { InputValidationService } from "@/lib/image-generation/services/input-validation-service";
import { createImageProvider } from "@/lib/image-generation/providers/factory";
import { resolveStoreIdentity, validateIdentityReference, buildCampaignBrief } from "@/lib/store-identity-service";
import { requireSameOrigin } from "@/lib/auth/csrf";
import { requireApiUser } from "@/lib/auth/require-user";
import { requireOwnership } from "@/lib/auth/store-ownership";
import { apiHandler } from "@/lib/auth/api-handler";
import { supabaseAdmin } from '@/lib/supabase/server';
import type { CampaignInput } from "@/components/campaign/types";
import { createCampaign, dataUrlToCampaignImage, uploadCampaignImage, updateCampaignReady, updateCampaignError, deleteCampaignImage } from "@/lib/campaign/persistence";
import { transcodeToJpeg } from "@/lib/campaign/image-processor";
import { checkRateLimit, recordGenerationAttempt } from "@/lib/rate-limit/rate-limit";
import { CreditService } from "@/lib/credit/credit-service";
import { CopyDirectorService } from "@/lib/copy/copy-director-service";
import { createTextProvider } from "@/lib/text-provider/factory";
import { mapBriefToCopyDirectorInput, buildOfferText } from "@/lib/copy/mapper";
import type { CopyDirectorResult } from "@/lib/copy/schema";
import { isRetryableError } from "@/lib/copy/errors";
import { getLaunchConfig } from "@/lib/launch-config/config";
import { logPipelineEvent } from "@/lib/logging/pipeline-logger";
import { estimateAiCost } from "@/lib/ai-cost";
import { requireLegalClearance } from "@/lib/legal/clearance";

export const runtime = "nodejs";

export const POST = apiHandler(async (request: NextRequest) => {
  requireSameOrigin(request);

  // ── Pre-stream: Launch config + traceId ─────────────────────────
  const config = getLaunchConfig();
  const traceId = crypto.randomUUID();

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

  // ── Pre-stream: Validate productImageDataUrl presence ───────────
  if (!body.productImageDataUrl || typeof body.productImageDataUrl !== "string") {
    return Response.json(
      { error: { message: "Imagem do produto é obrigatória para gerar a campanha visual." } },
      { status: 400 }
    );
  }

  // ── Pre-stream: Check payload size limit ────────────────────────
  if (body.productImageDataUrl.length > MAX_PRODUCT_IMAGE_BASE64_SIZE) {
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

  // ── Pre-stream: Campaign intent guard ──────────────────────────────
  if (parsed.data.campaignIntent !== "offer") {
    return Response.json(
      { error: { message: "Intenção comercial indisponível. Apenas ofertas podem ser geradas no momento." } },
      { status: 400 }
    );
  }

  // ── Pre-stream: Resolve store identity (backend-side) ────────────
  const { storeId, ...campaignInput } = parsed.data;

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

  // Build campaign brief
  const brief = await buildCampaignBrief(validatedSnapshot, campaignInput as CampaignInput);

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

  // ── Pre-stream: Balance check (no IA, no stream) ────────────────
  logPipelineEvent({ event: "balance_check", traceId, phase: "pre_stream", status: "running", storeId, userId: user.userId });
  const creditService = new CreditService(supabaseAdmin);
  if (config.creditsChargingEnabled) {
    const balance = await creditService.getBalance(storeId);
    if (balance < COST_PER_GENERATION) {
      logPipelineEvent({ event: "balance_check", traceId, phase: "pre_stream", status: "failed", storeId, userId: user.userId, errorCode: "insufficient_balance" });
      return Response.json(
        { error: { message: "Saldo insuficiente. São necessários créditos para gerar uma campanha." } },
        { status: 402 }
      );
    }
  }
  logPipelineEvent({ event: "balance_check", traceId, phase: "pre_stream", status: "complete", storeId, userId: user.userId });

  // ── Pre-stream: Input validation for conflict/confidence ─────────
  if (!parsed.data.inputValidationOverride?.productImageCheck) {
    const inputValidation = new InputValidationService();
    let validationResult: Awaited<ReturnType<typeof inputValidation.validate>>;
    try {
      validationResult = await inputValidation.validate(
        parsed.data.productName,
        parsed.data.productImageDataUrl,
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

  // ── Pre-stream: Create campaign record (generating status) ─────
  logPipelineEvent({ event: "campaign_create", traceId, phase: "pre_stream", status: "running", storeId, userId: user.userId });
  let campaignId: string | undefined;
  let storagePath: string | undefined;
  try {
    const inputSnapshot: Record<string, unknown> = {
      productName: campaignInput.productName,
      originalPriceCents: campaignInput.originalPriceCents,
      discountedPriceCents: campaignInput.discountedPriceCents,
      badgeText: campaignInput.badgeText,
      hook: campaignInput.hook,
      cta: campaignInput.cta,
      description: campaignInput.description,
      objective: campaignInput.objective,
      campaignDetails: campaignInput.campaignDetails,
      additionalDetails: campaignInput.additionalDetails,
      targetChannel: campaignInput.targetChannel,
      format: campaignInput.format,
      validity: campaignInput.validity,
      availabilityNotes: campaignInput.availabilityNotes,
      sensitiveConstraints: campaignInput.sensitiveConstraints,
      inputValidationOverride: campaignInput.inputValidationOverride,
      mandatoryArtworkText: campaignInput.mandatoryArtworkText,
      campaignIntent: campaignInput.campaignIntent,
      preserveImageContext: campaignInput.campaignIntent === "offer"
        ? false
        : (campaignInput.preserveImageContext ?? false),
      productImage: { provided: true, mimeType: "image/jpeg" },
    };

    const campaign = await createCampaign(storeId, {
      productName: campaignInput.productName,
      inputSnapshot,
      identitySnapshot: validatedSnapshot as unknown as Record<string, unknown>,
    });
    campaignId = campaign.id;
    storagePath = campaign.storagePath;
    logPipelineEvent({ event: "campaign_create", traceId, phase: "pre_stream", status: "complete", campaignId: campaign.id, storeId, userId: user.userId });
  } catch (err) {
    logPipelineEvent({ event: "campaign_create", traceId, phase: "pre_stream", status: "failed", storeId, userId: user.userId, errorMessage: err instanceof Error ? err.message : String(err) });
    console.error(`[generate-image] createCampaign error — ${err instanceof Error ? err.message : String(err)}`);
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
      creditTxId = await creditService.reserveCredit(storeId, COST_PER_GENERATION, {
        campaignId,
        idempotencyKey: `reserve_${campaignId}`,
        metadata: { feature: "campaign_pipeline" },
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

      // Copy Director task with retry Gemini fallback
      const copyTask = async (): Promise<void> => {
        logPipelineEvent({ event: "copy_generation", traceId, phase: "parallel", status: "running", campaignId, storeId, userId: user.userId });
        try {
          if (!config.copyDirectorEnabled) {
            const offerText = buildOfferText({
              badgeText: campaignInput.badgeText,
              originalPriceCents: campaignInput.originalPriceCents,
              discountedPriceCents: campaignInput.discountedPriceCents,
            });
            copyResult = {
              title: campaignInput.productName,
              caption: `${campaignInput.productName} — ${offerText}`,
              cta_post: "Aproveite!",
              hashtags: [],
            };
            emitPhase("copy_generation", "complete", "Texto determinístico (flag desligada)");
            logPipelineEvent({ event: "copy_generation", traceId, phase: "parallel", status: "complete", campaignId, storeId, userId: user.userId, metadata: { fallback: "deterministic" } });
            return;
          }

          const primaryProvider = createTextProvider("openai");
          const copyDirector = new CopyDirectorService(primaryProvider);

          const copyInput = mapBriefToCopyDirectorInput(brief, {
            badgeText: campaignInput.badgeText,
            originalPriceCents: campaignInput.originalPriceCents,
            discountedPriceCents: campaignInput.discountedPriceCents,
          });

          emitPhase("copy_generation", "running", "Gerando texto da campanha...");

          try {
            copyResult = await copyDirector.generateCopy(copyInput, {
              signal: streamAbortController.signal,
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

          imageResult = await imageService.generateImage(brief, (phaseEvent) => {
            emit({ type: "phase", ...phaseEvent });
          }, streamAbortController.signal);

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
      const preflightResult = imageService.validatePrompts(brief);
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

            // Telemetry — copy generation
            const copyCost = estimateAiCost({ provider: "openai", model: "gpt-4o" });
            try {
              await supabaseAdmin.from("generation_events").insert({
                generation_type: "campaign_copy",
                store_id: storeId,
                user_id: user.userId,
                campaign_id: campaignId,
                provider: "openai",
                model: "gpt-4o",
                status: "success",
                estimated_cost_usd: copyCost?.estimatedCostUsd ?? null,
                trace_id: traceId,
                phase: "copy_generation",
                duration_ms: durationMs,
              });
            } catch (e) {
              console.error("[telemetry] copy insert failed", e instanceof Error ? e.message : String(e));
            }

            // Telemetry — image generation (with real usage when available)
            const imageUsage = imageResult.usage;
            const imageCost = estimateAiCost({ provider: provider.name, model: IMAGE_GENERATION_RESPONSES_MODEL, usage: imageUsage ? { promptTokens: imageUsage.promptTokens, completionTokens: imageUsage.completionTokens, cachedInputTokens: imageUsage.cachedInputTokens } : undefined });
            try {
              await supabaseAdmin.from("generation_events").insert({
                generation_type: "campaign_image",
                store_id: storeId,
                user_id: user.userId,
                campaign_id: campaignId,
                provider: provider.name,
                model: IMAGE_GENERATION_RESPONSES_MODEL,
                status: "success",
                estimated_cost_usd: imageCost?.estimatedCostUsd ?? null,
                duration_ms: durationMs,
                trace_id: traceId,
                phase: "image_generation",
                prompt_tokens: imageUsage?.promptTokens ?? null,
                completion_tokens: imageUsage?.completionTokens ?? null,
                total_tokens: imageUsage?.totalTokens ?? null,
                metadata: { costSource: imageCost?.source ?? null, imageTokens: imageUsage?.imageTokens ?? null },
              });
            } catch (e) {
              console.error("[telemetry] image insert failed", e instanceof Error ? e.message : String(e));
            }

            // Telemetry — pipeline complete (before emit result)
            const pipelineCost = (copyCost?.estimatedCostUsd ?? 0) + (imageCost?.estimatedCostUsd ?? 0);
            const costBreakdown: Record<string, unknown> = {};
            if (copyCost) { costBreakdown.copy = { estimatedCostUsd: copyCost.estimatedCostUsd, source: copyCost.source }; }
            if (imageCost) { costBreakdown.image = { estimatedCostUsd: imageCost.estimatedCostUsd, source: imageCost.source }; }
            logPipelineEvent({ event: "pipeline_complete", traceId, phase: "post_parallel", status: "complete", campaignId, storeId, userId: user.userId, durationMs, metadata: { totalCost: generationMetadata.provider } });
            try {
              await supabaseAdmin.from("generation_events").insert({
                generation_type: "campaign_pipeline",
                store_id: storeId,
                user_id: user.userId,
                campaign_id: campaignId,
                provider: provider.name,
                model: IMAGE_GENERATION_RESPONSES_MODEL,
                status: "success",
                estimated_cost_usd: pipelineCost > 0 ? pipelineCost : null,
                prompt_tokens: imageUsage?.promptTokens ?? null,
                completion_tokens: imageUsage?.completionTokens ?? null,
                total_tokens: imageUsage?.totalTokens ?? null,
                duration_ms: durationMs,
                trace_id: traceId,
                phase: "pipeline_complete",
                metadata: { provider: provider.name, model: IMAGE_GENERATION_RESPONSES_MODEL, costSource: imageCost?.source ?? null, costBreakdown: Object.keys(costBreakdown).length > 0 ? costBreakdown : null },
              });
            } catch (e) {
              console.error("[telemetry] pipeline insert failed", e instanceof Error ? e.message : String(e));
            }

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

          // Telemetry — pipeline failed
          try {
            await supabaseAdmin.from("generation_events").insert({
              generation_type: "campaign_pipeline",
              store_id: storeId,
              user_id: user.userId,
              campaign_id: campaignId,
              provider: provider.name,
              model: IMAGE_GENERATION_RESPONSES_MODEL,
              status: "failed",
              trace_id: traceId,
              phase: "pipeline_complete",
              metadata: { error: errorMessage },
            });
          } catch (e) {
            console.error("[telemetry] pipeline failure insert failed", e instanceof Error ? e.message : String(e));
          }
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
