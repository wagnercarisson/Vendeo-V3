import { PromptLoader } from "@/lib/image-generation/prompt-loader";
import { IMAGE_GENERATION_DEBUG, IMAGE_GENERATION_SIZE, IMAGE_GENERATION_GLOBAL_TIMEOUT_MS, IMAGE_GENERATION_RESPONSES_MODEL } from "@/lib/image-generation/config";
import type { ImageProvider, ImageProviderOutput, ImageProviderUsageMeta } from "@/lib/image-generation/providers/types";
import type { GenerateImageRequest, GenerateImageSuccessResponse, GenerationPhase, GenerationPhaseEvent, ValidationContext, InputValidationResult, ImageReviewResult } from "@/lib/image-generation/schema";
import type { ResolvedCampaignContext } from "@/components/campaign/types";
import type { CampaignBrief } from "@/lib/campaign/brief";
import { InputValidationService } from "@/lib/image-generation/services/input-validation-service";
import { ImageReviewService } from "@/lib/image-generation/services/image-review-service";
import type { ImageReviewInput } from "@/lib/image-generation/services/image-review-service";
import type { GenerationMetricsEvent, GenerationMetrics } from "@/lib/image-generation/metrics/types";
import { MetricsWriter } from "@/lib/image-generation/metrics/writer";
import { logReviewDiagnostic } from "@/lib/image-generation/metrics/review-diagnostics";
import type { ReviewDiagnosticEntry } from "@/lib/image-generation/metrics/review-diagnostics";
import { validatePrompt } from "@/lib/image-generation/services/prompt-validator";
import { STORE_SEGMENTS } from "@/lib/constants";
import type { TokenUsage } from "@/lib/ai-cost/types";

/**
 * Rotating per-phase human-friendly messages in PT-BR for UI display.
 * Messages are selected randomly on each emit — cycles between variants
 * within a phase to avoid repetitive text.
 */
const PHASE_MESSAGES: Record<string, string[]> = {
  input_validation: [
    "Estamos validando as informações do produto.",
    "Checando se a imagem está adequada para publicação.",
  ],
  prompt_assembly: [
    "Criando o ambiente visual da campanha.",
    "Aplicando a assinatura visual da loja.",
    "Pensando em frases de impacto para valorizar a oferta.",
  ],
  image_generation: [
    "Compondo os elementos visuais da arte.",
    "Destacando o preço e a intenção da campanha.",
  ],
  quality_review: [
    "Revisando a campanha antes de entregar.",
    "Preparando sua campanha para entrega.",
  ],
};

const CATEGORY_TO_SEGMENT_GROUP: Record<string, string[]> = {
  "bebidas-adegas-conveniencia": ["bebidas", "alimentos", "bebida", "energetico", "cafe", "cerveja", "refrigerante", "suco", "agua", "comida", "snack", "doce", "salgado"],
  "moda-calcados-acessorios": ["roupa", "calcado", "tenis", "vestuario", "moda", "acessorio", "bolsa", "camiseta", "jeans"],
  "beleza-estetica": ["beleza", "cosmetico", "maquiagem", "perfume", "hidratante", "shampoo", "protetor"],
  "farmacia-saude": ["remedio", "farmacia", "vitamina", "suplemento", "medicamento"],
  "casa-decoracao": ["casa", "decoracao", "moveis", "tapete", "toalha", "almofada"],
  "eletronicos-tecnologia": ["eletronico", "tecnologia", "celular", "computador", "fone", "carregador"],
  "petshop": ["pet", "racao", "cachorro", "gato", "brinquedo pet"],
  "servicos-locais": ["servico", "consulta", "curso", "assinatura"],
  "variedades-utilidades": ["presente", "variedade", "geral"],
  "outros": [],
};

export type GenerateImageServiceResult =
  | { success: true; imageDataUrl: string; inputCorrections?: { productName: { from: string; to: string; reason: string } }; usage?: TokenUsage }
  | { success: false; code: string; message: string; details?: string };

enum GenerationState {
  INITIAL = "INITIAL",
  REVIEW = "REVIEW",
  CORRECT = "CORRECT",
  REGENERATE = "REGENERATE",
  COMPLETE = "COMPLETE",
  ERROR = "ERROR",
}

export class ImageGenerationService {
  private readonly promptLoader: PromptLoader;
  private readonly imageProvider: ImageProvider;
  private readonly inputValidation: InputValidationService;
  private readonly imageReview: ImageReviewService;
  private readonly metricsWriter: MetricsWriter;

  constructor(
    imageProvider: ImageProvider,
    promptLoader?: PromptLoader,
    inputValidation?: InputValidationService,
    imageReview?: ImageReviewService,
    metricsWriter?: MetricsWriter
  ) {
    this.imageProvider = imageProvider;
    this.promptLoader = promptLoader ?? new PromptLoader();
    this.inputValidation = inputValidation ?? new InputValidationService();
    this.imageReview = imageReview ?? new ImageReviewService();
    this.metricsWriter = metricsWriter ?? new MetricsWriter();
  }

  async generateImage(
    brief: CampaignBrief,
    context: ResolvedCampaignContext,
    onPhaseChange?: (event: GenerationPhaseEvent) => void,
    signal?: AbortSignal,
    onMetricsEvent?: (event: GenerationMetricsEvent) => void
  ): Promise<GenerateImageServiceResult> {
    const startTime = Date.now();
    const remaining = () => IMAGE_GENERATION_GLOBAL_TIMEOUT_MS - (Date.now() - startTime);
    const runId = crypto.randomUUID();

    const emitMetricsEvent = (phase: string, attempt: number = 0, extra?: Partial<Pick<GenerationMetricsEvent, "usage" | "usageMeta">>) => {
      if (onMetricsEvent) {
        try {
          onMetricsEvent({
            runId,
            phase,
            provider: this.imageProvider.name,
            model: IMAGE_GENERATION_RESPONSES_MODEL,
            elapsedMs: Date.now() - startTime,
            attempt,
            durationMs: Date.now() - startTime,
            ...extra,
          });
        } catch (err) {
          console.error(
            `[ImageGenerationService] onMetricsEvent callback failed (best-effort): ${
              err instanceof Error ? err.message : String(err)
            }`
          );
        }
      }
    };

    const emit = (phase: GenerationPhase, status: GenerationPhaseEvent["status"], message?: string, detail?: string) => {
      if (onPhaseChange) {
        onPhaseChange({ phase, status, message, detail });
      }
    };

    const emitRunning = (phase: GenerationPhase, message: string) => emit(phase, "running", message);
    const emitHuman = (phase: GenerationPhase) => {
      const messages = PHASE_MESSAGES[phase];
      if (messages && messages.length > 0) {
        const message = messages[Math.floor(Math.random() * messages.length)];
        emit(phase, "running", message);
      } else {
        emit(phase, "running", "Processando...");
      }
    };
    const emitComplete = (phase: GenerationPhase) => emit(phase, "complete");
    const emitSkipped = (phase: GenerationPhase, message?: string) => emit(phase, "skipped", message);
    const emitFailed = (phase: GenerationPhase, message?: string) => emit(phase, "failed", message);

    const checkAborted = () => {
      if (signal?.aborted) {
        return {
          code: "global_timeout" as const,
          message: "O tempo limite de geração foi excedido. Tente novamente.",
          details: `global_timeout after ${Date.now() - startTime}ms`,
        };
      }
      return null;
    };

    const abortResult = (info: NonNullable<ReturnType<typeof checkAborted>>): GenerateImageServiceResult => ({
      success: false,
      code: info.code,
      message: info.message,
      details: info.details,
    });

    // ── Phase 1: Pre-generation input validation ────────────────────
    // F43 (D5): confirmação humana pula a IA de visão — a fase é emitida como
    // "skipped" (nunca running → complete, nem complete com detail sem chamada
    // real). Aplica-se a brief_review_confirmed E user_confirmed_continue.
    const inputValidationOverride = context.campaignInput.inputValidationOverride?.productImageCheck;
    const validationSkipped =
      inputValidationOverride === "brief_review_confirmed" ||
      inputValidationOverride === "user_confirmed_continue";

    if (validationSkipped) {
      emitSkipped(
        "input_validation",
        inputValidationOverride === "brief_review_confirmed"
          ? "Brief confirmado pelo usuário"
          : "Validação dispensada"
      );
    } else {
      emitHuman("input_validation");
    }

    const aborted1 = checkAborted();
    if (aborted1) { emitFailed("input_validation", aborted1.message); return abortResult(aborted1); }

    // Captura usage/durationMs da chamada de visão interna (D11) para
    // enriquecer o evento de input_validation SEM emitir evento extra
    // (canal único onMetricsEvent — anti-dupla-contagem T-38.1-22).
    let validationUsage: TokenUsage | undefined;
    let validationCallMade = false;
    const validationResult = await this.inputValidation.validate(
      brief.product.name,
      // PÓS-CONDIÇÃO garantida pelo zod do transporte (schema.ts:30, 400 antes do mapper):
      // em produção o primary SEMPRE tem dataUrl. Fallback "" só por tipagem.
      this.primaryImageDataUrl(brief) ?? "",
      context.campaignInput.inputValidationOverride,
      (info) => {
        validationUsage = info.usage;
        validationCallMade = true;
      }
    );

    // F38.1: evento ÚNICO de input_validation enriquecido com usage REAL da
    // chamada de visão interna (D11). Sem "tick" de início — anti-dupla-contagem
    // T-38.1-22. Só emite quando houve chamada de IA real (override não emite).
    if (validationCallMade) {
      emitMetricsEvent("input_validation", 0, validationUsage ? { usage: validationUsage } : undefined);
    }

    let effectiveProductName = brief.product.name;
    let inputCorrections: { productName: { from: string; to: string; reason: string } } | undefined;
    let metricsConflictsDetected: string[] = [];
    let metricsHadOverride = false;

    if (validationResult.classification === "conflict" || validationResult.classification === "strong_conflict") {
      metricsConflictsDetected.push(validationResult.classification);
    }

    // Extract inferredCategory from validation result
    const inferredCategory = "inferredCategory" in validationResult
      ? (validationResult as any).inferredCategory
      : undefined;

    switch (validationResult.classification) {
      case "conflict":
        emitFailed("input_validation", "O nome do produto digitado não corresponde à imagem enviada.");
        return {
          success: false,
          code: "product_image_conflict",
          message: "O nome do produto digitado não corresponde à imagem enviada.",
          details: validationResult.suggestedProductName
            ? JSON.stringify({ suggestedProductName: validationResult.suggestedProductName })
            : undefined,
        };
      case "strong_conflict":
        emitFailed("input_validation", "A imagem enviada parece ser de outro produto.");
        return {
          success: false,
          code: "product_image_strong_conflict",
          message: "A imagem enviada parece ser de outro produto.",
          details: validationResult.suggestedProductName
            ? JSON.stringify({ suggestedProductName: validationResult.suggestedProductName })
            : undefined,
        };
      case "low-confidence":
        emitFailed("input_validation", "Não foi possível confirmar se o nome do produto corresponde à imagem.");
        return {
          success: false,
          code: "input_low_confidence",
          message: "Não foi possível confirmar se o nome do produto corresponde à imagem.",
          details: undefined,
        };
      case "auto-fix":
        effectiveProductName = validationResult.correctedProductName;
        inputCorrections = {
          productName: {
            from: brief.product.name,
            to: validationResult.correctedProductName,
            reason: validationResult.reason,
          },
        };
        break;
      case "match":
        break;
    }

    // Construct validationContext for review alignment
    let validationContext: ValidationContext | undefined;

    if (inputValidationOverride === "user_confirmed_continue" || inputValidationOverride === "brief_review_confirmed") {
      metricsHadOverride = true;
      validationContext = {
        overrides: { productImageCheck: inputValidationOverride },
      };
    }

    if (inputCorrections) {
      validationContext = {
        ...validationContext,
        inputCorrection: {
          field: "productName" as const,
          from: inputCorrections.productName.from,
          to: inputCorrections.productName.to,
          reason: inputCorrections.productName.reason,
        },
      };
    }

    // Emit detail: input_validation
    // F43 (D5): quando a validação foi pulada (override), NÃO emitir complete
    // nem detail — a fase já foi emitida como "skipped" no início.
    if (!validationSkipped) {
      const validationDetail = this.buildValidationDetail(validationResult, brief.product.name, effectiveProductName);
      if (validationDetail) {
        emit("input_validation", "complete", undefined, validationDetail);
      } else {
        emitComplete("input_validation");
      }
    }

    // ── Phase 2: Prompt assembly ────────────────────────────────────
    emitHuman("prompt_assembly");
    emitMetricsEvent("prompt_assembly");

    const aborted2 = checkAborted();
    if (aborted2) { emitFailed("prompt_assembly", aborted2.message); return abortResult(aborted2); }

    const promptVariables = this.buildPromptVariables(brief, context, effectiveProductName, inferredCategory);

    const segmentEntry = STORE_SEGMENTS.find(s => s.value === context.store.segment);
    const segmentPersona = segmentEntry?.label ?? context.store.segment;
    const promptDetail = `briefing com persona de ${segmentPersona}, categoria inferida: ${inferredCategory ?? context.store.segment}`;
    emit("prompt_assembly", "complete", undefined, promptDetail);
    emitMetricsEvent("prompt_assembly");

    // ── Phase 3-4: State machine — generation + review lifecycle ────
    let state = GenerationState.INITIAL;
    let attempts = 0;
    const maxAttempts = 3;

    let lastReviewIssues: string[] = [];
    let currentImageBase64: string | null = null;
    let currentMimeType: string = "image/png";
    let currentUsage: ImageProviderOutput["usage"] | undefined;
    let currentUsageMeta: ImageProviderUsageMeta | undefined;

    while (state !== GenerationState.COMPLETE && state !== GenerationState.ERROR) {
      if (attempts >= maxAttempts) {
        emitFailed("quality_review", "Não foi possível gerar uma imagem que passasse na revisão de qualidade.");
        await this.metricsWriter.write(this.buildGenerationMetrics({
          runId,
          startTime,
          providerName: this.imageProvider.name,
          model: IMAGE_GENERATION_RESPONSES_MODEL,
          attempts,
          effectiveProductName,
          storeName: context.store.name,
          storeSegment: context.store.segment,
          reviewPassed: false,
          reviewFailureType: "review_failed",
          technicalError: lastReviewIssues.length > 0 ? lastReviewIssues.join("; ") : undefined,
          conflictsDetected: metricsConflictsDetected,
          hadOverride: metricsHadOverride,
        }));
        return {
          success: false,
          code: "review_failed",
          message: "Não foi possível gerar uma imagem que passasse na revisão de qualidade após todas as tentativas.",
          details: lastReviewIssues.length > 0
            ? JSON.stringify({ issues: lastReviewIssues })
            : undefined,
        };
      }

      if (attempts > 0) {
        emitHuman("image_generation");
      }

      const attemptDetail = `tentativa ${attempts + 1}/${maxAttempts}, modelo: ${IMAGE_GENERATION_RESPONSES_MODEL || "gpt-5.5"}, tempo decorrido: ${Math.floor((Date.now() - startTime) / 1000)}s`;
      if (IMAGE_GENERATION_DEBUG) {
        emit("image_generation", "running", undefined, attemptDetail);
      }

      // ── Phase 3: Image generation with provider retry ──────────
      if (attempts === 0) {
        emitHuman("image_generation");
      }

      const aborted3 = checkAborted();
      if (aborted3) { emitFailed("image_generation", aborted3.message); return abortResult(aborted3); }

      const promptText = this.assemblePrompt(state, promptVariables, lastReviewIssues);

      const providerResult = await this.generateWithRetry(promptText, this.primaryImageDataUrl(brief), this.mediaImagesDataUrls(brief), signal, remaining, context.identity.imageUrl ?? undefined);
      if (!providerResult.success) {
        emitFailed("image_generation", providerResult.message);
        await this.metricsWriter.write(this.buildGenerationMetrics({
          runId,
          startTime,
          providerName: this.imageProvider.name,
          model: IMAGE_GENERATION_RESPONSES_MODEL,
          attempts,
          effectiveProductName,
          storeName: context.store.name,
          storeSegment: context.store.segment,
          reviewPassed: false,
          reviewFailureType: "provider_error",
          technicalError: providerResult.details ?? providerResult.message,
          conflictsDetected: metricsConflictsDetected,
          hadOverride: metricsHadOverride,
        }));
        return providerResult;
      }

      currentImageBase64 = providerResult.imageBase64;
      currentMimeType = providerResult.mimeType;
      currentUsage = providerResult.usage;
      currentUsageMeta = providerResult.usageMeta;
      emitComplete("image_generation");
      emitMetricsEvent("image_generation", attempts, currentUsage || currentUsageMeta ? { usage: currentUsage, usageMeta: currentUsageMeta } : undefined);

      // ── Phase 4: Quality review ─────────────────────────────────
      emitHuman("quality_review");

      const imageDataUrl = `data:${currentMimeType};base64,${currentImageBase64}`;

      const reviewInput: ImageReviewInput = {
        productName: effectiveProductName,
        storeName: context.store.name,
        campaignIntent: brief.commercial.intent ?? "offer",
        preserveImageContext: brief.creativeContext.preserveImageContext,
        badgeText: brief.commercial.badgeText,
        discountedPrice: brief.commercial.discountedPriceCents
          ? this.formatPriceBRL(brief.commercial.discountedPriceCents)
          : undefined,
        originalPrice: (brief.commercial.originalPriceCents ?? 0) > 0
          ? this.formatPriceBRL(brief.commercial.originalPriceCents ?? 0)
          : undefined,
        validationContext,
        legalNoticeText: brief.commercial.legalNotice?.enabled
          ? brief.commercial.legalNotice.text
          : undefined,
        campaignDetails: brief.commercial.campaignDetails,
        additionalDetails: brief.commercial.additionalDetails,
        validityText: brief.commercial.validity?.enabled
          ? brief.commercial.validity.displayText
          : undefined,
      };

      let reviewResult;
      // Captura usage/durationMs da revisão de visão interna (D11) para
      // enriquecer o evento de quality_review SEM emitir evento extra
      // (canal único onMetricsEvent — anti-dupla-contagem T-38.1-22).
      let reviewUsage: TokenUsage | undefined;
      try {
        reviewResult = await this.imageReview.review(imageDataUrl, reviewInput, this.mediaImagesDataUrls(brief), (info) => {
          reviewUsage = info.usage;
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[ImageGenerationService] review error — ${message}`);
        logReviewDiagnostic({
          timestamp: new Date().toISOString(),
          runId,
          attempt: attempts,
          reviewPassed: false,
          reviewAction: 'error',
          severity: 'critical',
          failureType: 'review_error',
          issues: [{ type: 'review_error', severity: 'critical', description: message }],
          correctionInstructions: null,
          elapsedMs: Date.now() - startTime,
          provider: this.imageProvider.name,
          model: IMAGE_GENERATION_RESPONSES_MODEL,
          hadLogoAsset: !!context.identity.imageUrl,
          hadBrandProfile: !!context.brandProfile,
          hadProductImage: !!this.primaryImageDataUrl(brief),
        });
        emitFailed("quality_review", "Erro na revisão de qualidade.");
        await this.metricsWriter.write(this.buildGenerationMetrics({
          runId,
          startTime,
          providerName: this.imageProvider.name,
          model: IMAGE_GENERATION_RESPONSES_MODEL,
          attempts,
          effectiveProductName,
          storeName: context.store.name,
          storeSegment: context.store.segment,
          reviewPassed: false,
          reviewFailureType: "review_error",
          technicalError: message,
          conflictsDetected: metricsConflictsDetected,
          hadOverride: metricsHadOverride,
        }));
        return {
          success: false,
          code: "review_error",
          message: "Erro ao executar a revisão de qualidade da imagem. Tente novamente.",
          details: message,
        };
      }

      // Apply validation context filtering before evaluation
      reviewResult = this.applyValidationContextToReviewResult(reviewResult, validationContext);

      {
        const totalIssues = reviewResult.issues.length;
        const criticalCount = reviewResult.issues.filter(i => i.severity === "critical").length;
        const minorCount = reviewResult.issues.filter(i => i.severity === "minor").length;

        const diagBase: Omit<ReviewDiagnosticEntry, 'reviewAction'> = {
          timestamp: new Date().toISOString(),
          runId,
          attempt: attempts,
          reviewPassed: reviewResult.passed,
          severity: criticalCount > 0 ? 'critical' : minorCount > 0 ? 'minor' : 'none',
          failureType: reviewResult.failureType ?? null,
          issues: reviewResult.issues,
          correctionInstructions: null,
          elapsedMs: Date.now() - startTime,
          provider: this.imageProvider.name,
          model: IMAGE_GENERATION_RESPONSES_MODEL,
          hadLogoAsset: !!context.identity.imageUrl,
          hadBrandProfile: !!context.brandProfile,
          hadProductImage: !!this.primaryImageDataUrl(brief),
        };

        if (reviewResult.passed) {
          emit("quality_review", "complete", undefined,
            `issues: ${totalIssues} (${criticalCount} críticas, ${minorCount} menores), failureType: ${reviewResult.failureType ?? "null"}`);
          emitMetricsEvent("quality_review", attempts, reviewUsage ? { usage: reviewUsage } : undefined);
          state = GenerationState.COMPLETE;
          logReviewDiagnostic({ ...diagBase, reviewAction: 'complete' });
        } else {
          lastReviewIssues = reviewResult.issues.map((i) => i.description);

          if (reviewResult.failureType === "generated_product_mismatch") {
            emitFailed("quality_review", "A imagem gerada exibiu um nome de produto diferente do informado.");
            emitMetricsEvent("quality_review", attempts, reviewUsage ? { usage: reviewUsage } : undefined);
            await this.metricsWriter.write(this.buildGenerationMetrics({
              runId,
              startTime,
              providerName: this.imageProvider.name,
              model: IMAGE_GENERATION_RESPONSES_MODEL,
              attempts,
              effectiveProductName,
          storeName: context.store.name,
          storeSegment: context.store.segment,
              reviewPassed: false,
              reviewFailureType: "generated_product_mismatch",
              technicalError: lastReviewIssues.join("; "),
              conflictsDetected: metricsConflictsDetected,
              hadOverride: metricsHadOverride,
            }));
            logReviewDiagnostic({ ...diagBase, reviewAction: 'error' });
            return {
              success: false,
              code: "generated_product_mismatch",
              message: "A imagem gerada exibiu um nome de produto diferente do informado.",
              details: JSON.stringify({ issues: lastReviewIssues }),
            };
          }

          const criticalIssuesCount = criticalCount;

          if (criticalIssuesCount > 0) {
            emit("quality_review", "running", undefined,
              `issues: ${totalIssues} (${criticalCount} críticas, ${minorCount} menores), failureType: ${reviewResult.failureType ?? "null"}`);

            if (state === GenerationState.INITIAL) {
              logReviewDiagnostic({ ...diagBase, reviewAction: 'correct' });
              state = GenerationState.CORRECT;
            } else if (state === GenerationState.CORRECT) {
              logReviewDiagnostic({ ...diagBase, reviewAction: 'regenerate' });
              state = GenerationState.REGENERATE;
            } else {
              logReviewDiagnostic({ ...diagBase, reviewAction: 'error' });
              state = GenerationState.ERROR;
            }
          } else {
            emit("quality_review", "complete", undefined,
              `issues: ${totalIssues} (${criticalCount} críticas, ${minorCount} menores), failureType: ${reviewResult.failureType ?? "null"}`);
            emitMetricsEvent("quality_review", attempts, reviewUsage ? { usage: reviewUsage } : undefined);
            state = GenerationState.COMPLETE;
            logReviewDiagnostic({ ...diagBase, reviewAction: 'skip_minor' });
          }
        }
      }

      attempts++;
    }

    // ── Done ────────────────────────────────────────────────────────
    const imageDataUrl = `data:${currentMimeType};base64,${currentImageBase64}`;

    const response: GenerateImageServiceResult = {
      success: true,
      imageDataUrl,
      usage: currentUsage,
    };

    if (inputCorrections) {
      response.inputCorrections = inputCorrections;
    }

    const correctionsCount = brief.product.name !== effectiveProductName ? 1 : 0;
    emit("done", "complete", undefined,
      `geração concluída em ${Math.floor((Date.now() - startTime) / 1000)}s, ${attempts} tentativas, ${correctionsCount} correções`);
    emitMetricsEvent("done", attempts);

    await this.metricsWriter.write(this.buildGenerationMetrics({
      runId,
      startTime,
      providerName: this.imageProvider.name,
      model: IMAGE_GENERATION_RESPONSES_MODEL,
      attempts,
      effectiveProductName,
      storeName: context.store.name,
      storeSegment: context.store.segment,
      reviewPassed: true,
      conflictsDetected: metricsConflictsDetected,
      hadOverride: metricsHadOverride,
    }));
    return response;
  }

  /**
   * Validate all prompts (director + reviewer) for unresolved placeholders
   * before any IA call is made. Returns valid=false with error descriptions
   * if any prompt contains unresolved {{variable}} patterns.
   *
   * This is a synchronous check — no network calls.
   */
  validatePrompts(brief: CampaignBrief, context: ResolvedCampaignContext): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const campaignIntent = brief.commercial.intent ?? "offer";

    // Check director prompt
    const directorVariables = this.buildPromptVariables(brief, context, brief.product.name, undefined);
    const promptName = `campaign-image-director-${campaignIntent}`;
    let directorPrompt: string;
    try {
      directorPrompt = this.promptLoader.load(promptName, directorVariables);
    } catch {
      errors.push(`Prompt para intent '${campaignIntent}' não encontrado: ${promptName}`);
      return { valid: false, errors };
    }
    const directorCheck = validatePrompt(directorPrompt);
    if (!directorCheck.valid) {
      errors.push(`Diretor de imagem: variáveis não resolvidas: ${directorCheck.unresolvedVariables.join(', ')}`);
    }

    // Check reviewer prompt using shared builder
    const reviewerInput: ImageReviewInput = {
      productName: brief.product.name,
      storeName: context.store.name,
      campaignIntent: brief.commercial.intent,
      preserveImageContext: brief.creativeContext.preserveImageContext,
      badgeText: brief.commercial.badgeText,
      discountedPrice: brief.commercial.discountedPriceCents
        ? this.formatPriceBRL(brief.commercial.discountedPriceCents)
        : undefined,
      originalPrice: (brief.commercial.originalPriceCents ?? 0) > 0
        ? this.formatPriceBRL(brief.commercial.originalPriceCents ?? 0)
        : undefined,
      legalNoticeText: brief.commercial.legalNotice?.enabled
        ? brief.commercial.legalNotice.text
        : undefined,
      campaignDetails: brief.commercial.campaignDetails,
      additionalDetails: brief.commercial.additionalDetails,
      validityText: brief.commercial.validity?.enabled
        ? brief.commercial.validity.displayText
        : undefined,
    };
    const reviewerVars = this.imageReview.buildReviewPromptVariables(reviewerInput);
    const reviewerPrompt = this.promptLoader.load("campaign-image-reviewer", reviewerVars);
    const reviewerCheck = validatePrompt(reviewerPrompt);
    if (!reviewerCheck.valid) {
      errors.push(`Revisor de imagem: variáveis não resolvidas: ${reviewerCheck.unresolvedVariables.join(', ')}`);
    }

    // Verify required contextual variables are present and non-empty
    const requiredReviewerVars = [
      "campaignIntentLabel",
      "expectedPriceBehavior",
      "expectedBadgeBehavior",
      "expectedImageTreatment",
      "expectedCommercialTone",
    ];
    for (const varName of requiredReviewerVars) {
      if (!reviewerVars[varName] || reviewerVars[varName].trim() === "") {
        errors.push(`Revisor: variável contextual '${varName}' está ausente ou vazia.`);
      }
    }

    // Verify old placeholders are not in the reviewer prompt
    const oldPlaceholders = ["{{discountedPrice}}", "{{badgeText}}"];
    for (const placeholder of oldPlaceholders) {
      if (reviewerPrompt.includes(placeholder)) {
        errors.push(`Revisor: placeholder antigo '${placeholder}' ainda está presente no prompt.`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  private buildGenerationMetrics(params: {
    runId: string;
    startTime: number;
    providerName: string;
    model: string;
    attempts: number;
    effectiveProductName: string;
    storeName: string;
    storeSegment: string;
    reviewPassed?: boolean;
    reviewFailureType?: string | null;
    technicalError?: string;
    conflictsDetected: string[];
    hadOverride: boolean;
  }): GenerationMetrics {
    return {
      runId: params.runId,
      timestamp: new Date().toISOString(),
      environment: (process.env.NODE_ENV as GenerationMetrics["environment"]) ?? "development",
      provider: params.providerName,
      model: params.model,
      totalDurationMs: Date.now() - params.startTime,
      retryCount: params.attempts,
      conflictsDetected: params.conflictsDetected,
      hadOverride: params.hadOverride,
      reviewPassed: params.reviewPassed,
      reviewFailureType: params.reviewFailureType ?? null,
      technicalError: params.technicalError,
      sanitizedInputs: {
        productName: params.effectiveProductName,
        storeName: params.storeName,
        storeSegment: params.storeSegment,
      },
    };
  }

  private isSameCategory(inferredCategory: string, storeSegment: string): boolean {
    const normalizedInferred = inferredCategory.toLowerCase();
    const normalizedSegment = storeSegment.toLowerCase();

    for (const [group, keywords] of Object.entries(CATEGORY_TO_SEGMENT_GROUP)) {
      for (const keyword of keywords) {
        if (normalizedInferred.includes(keyword)) {
          return group !== normalizedSegment;
        }
      }
    }

    return false;
  }

  private buildCommercialRepertoire(brief: CampaignBrief): string {
    const parts: string[] = [];
    const campaignIntent = brief.commercial.intent ?? "offer";

    const hasAvailabilityNotes = !!brief.commercial.availabilityNotes;
    const hasValidity = !!brief.commercial.validity;
    const hasCampaignDetails = !!brief.commercial.campaignDetails;
    const hasAdditionalDetails = !!brief.commercial.additionalDetails;

    if (brief.commercial.availabilityNotes && campaignIntent !== "spotlight") {
      const notes = brief.commercial.availabilityNotes.toLowerCase();
      const scarcityKeywords = ["poucas unidades", "últimas", "limitado", "estoque"];
      const varietyKeywords = ["vários sabores", "cores variadas", "diversos", "várias"];

      if (scarcityKeywords.some(kw => notes.includes(kw))) {
        const prefix = campaignIntent === "exclusive" ? "Disponibilidade:" : "Disponível:";
        parts.push(`- ${prefix} ${brief.commercial.availabilityNotes}`);
      } else if (varietyKeywords.some(kw => notes.includes(kw))) {
        parts.push(`- Variedade disponível: ${brief.commercial.availabilityNotes}`);
      }
    }

    if (brief.commercial.validity?.enabled && brief.commercial.validity.displayText && campaignIntent === "offer") {
      parts.push(`- Oferta válida: ${brief.commercial.validity.displayText}`);
    }

    if (brief.commercial.campaignDetails) {
      const actionable = brief.commercial.campaignDetails.replace(/[\[\]]/g, "").trim();
      if (actionable.length > 0) {
        parts.push(`- ${actionable}`);
      }
    }

    if (brief.commercial.additionalDetails) {
      const actionable = brief.commercial.additionalDetails.replace(/[\[\]]/g, "").trim();
      if (actionable.length > 0) {
        parts.push(`- ${actionable}`);
      }
    }

    const result = parts.join("\n");
    if (IMAGE_GENERATION_DEBUG) {
      console.log(
        "[buildCommercialRepertoire]",
        JSON.stringify({
          empty: result === "",
          argsCount: parts.length,
          fieldsPresent: { hasAvailabilityNotes, hasValidity, hasCampaignDetails, hasAdditionalDetails },
          preview: result ? result.slice(0, 120) : "(empty)",
        })
      );
    }
    return result;
  }

  private buildValidationSummary(brief: CampaignBrief, context: ResolvedCampaignContext, effectiveProductName: string): string {
    const parts: string[] = [];

    if (brief.product.name !== effectiveProductName) {
      parts.push(`• Nome corrigido automaticamente de '${brief.product.name}' para '${effectiveProductName}'`);
    }

    if (context.campaignInput.inputValidationOverride?.productImageCheck === "user_confirmed_continue") {
      parts.push("• O usuário confirmou que a imagem do produto está correta, mesmo com divergência na pré-validação");
    }

    return parts.join("\n");
  }

  /**
   * Build creative context guidance based on segment, inferred category, and conflict status.
   * Provides the director with a short contextual suggestion for visual positioning.
   * Defaults to empty string when no specific guidance applies.
   */
  private buildCreativeContextGuidance(segment: string, category: string, hasConflict: boolean, campaignIntent: string = "offer"): string {
    const s = segment.toLowerCase();
    const c = category.toLowerCase();

    let result: string;

    if (hasConflict) {
      if (c.includes("eletronico") || c.includes("tecnologia") || c.includes("celular") || c.includes("computador")) {
        result = "Equilibre o apelo popular do segmento com o desejo por tecnologia.";
      } else if (c.includes("bebida") || c.includes("alimento") || c.includes("cerveja") || c.includes("energetico")) {
        result = "Valorize o produto com apelo aspiracional.";
      } else if (c.includes("moda") || c.includes("roupa") || c.includes("calcado") || c.includes("tenis")) {
        result = "Destaque estilo e desejo dentro de um contexto acessível.";
      } else if (c.includes("beleza") || c.includes("cosmetico") || c.includes("perfume")) {
        result = "Eleve o produto como item de desejo — preço é bônus, não motivo principal.";
      } else if (c.includes("pet") || c.includes("racao")) {
        result = "Conecte carinho pelo pet com a conveniência da oferta.";
      } else if (c.includes("casa") || c.includes("decoracao") || c.includes("movel")) {
        result = "Transforme o produto em aspiração para o lar.";
      } else {
        result = "Equilibre o universo do produto com a identidade da loja.";
      }
    } else if (s.includes("bebidas-adegas-conveniencia") || s.includes("bebida")) {
      if (c.includes("energetico")) result = "Valorize energia e disposição.";
      else if (c.includes("cerveja")) result = "Valorize confraternização e qualidade.";
      else if (c.includes("cafe")) result = "Valorize aconchego e ritual.";
      else result = "Valorize sabor e qualidade.";
    } else if (s.includes("moda") || s.includes("calcados")) {
      if (c.includes("calcado") || c.includes("tenis")) result = "Valorize estilo e performance.";
      else result = "Valorize estilo e personalidade.";
    } else if (s.includes("beleza") || s.includes("estetica")) {
      result = "Valorize autoestima e cuidado pessoal.";
    } else if (s.includes("farmacia-saude") || s.includes("farmacia")) {
      result = "Valorize bem-estar e confiança.";
    } else if (s.includes("eletronico") || s.includes("tecnologia")) {
      result = "Valorize inovação e performance.";
    } else if (s.includes("casa") || s.includes("decoracao")) {
      result = "Valorize conforto e estilo.";
    } else if (s.includes("pet")) {
      result = "Valorize carinho e bem-estar do pet.";
    } else if (s.includes("variedades")) {
      result = "Valorize variedade e praticidade.";
    } else {
      result = "";
    }

    if (campaignIntent === "spotlight") {
      return `${result} Apresentar como destaque ou novidade, sem urgência. Benefício e diferencial são o foco.`.trim();
    }

    if (campaignIntent === "exclusive") {
      return `${result} Valor percebido e exclusividade são os pilares. Tom premium, sem preço.`.trim();
    }

    if (result && campaignIntent === "offer") {
      return `${result} Preço é oportunidade.`;
    }

    return result;
  }

  private buildPromptVariables(
    brief: CampaignBrief,
    context: ResolvedCampaignContext,
    effectiveProductName: string,
    inferredCategory?: string
  ): Record<string, string> {
    const storeSegment = context.store.segment ?? '';
    const effectiveInferredCategory = inferredCategory ?? storeSegment;
    const hasConflict = inferredCategory
      ? this.isSameCategory(inferredCategory, storeSegment)
      : false;

    const segEntry = STORE_SEGMENTS.find(s => s.value === storeSegment);
    const creativePersona = `Você é um diretor de marketing especializado em ${segEntry?.label ?? storeSegment}.`;

    const categoryConflictDirective = hasConflict
      ? `ATENÇÃO: O produto anunciado é da categoria "${inferredCategory}", que é diferente do segmento principal da loja "${storeSegment}". A direção visual deve refletir o universo de ${inferredCategory}. A identidade da loja (nome, paleta, logo) deve aparecer como assinatura, não como tema visual.`
      : "";

    const commercialRepertoire = this.buildCommercialRepertoire(brief);
    const inputValidationSummary = this.buildValidationSummary(brief, context, effectiveProductName);
    const creativeContextGuidance = this.buildCreativeContextGuidance(storeSegment, effectiveInferredCategory, hasConflict, brief.commercial.intent ?? "offer");

    const campaignIntent = brief.commercial.intent ?? "offer";

    const commercialFrame = (() => {
      const dpc = brief.commercial.discountedPriceCents;
      switch (campaignIntent) {
        case "spotlight":
          return dpc ? `Destaque — ${this.formatPriceBRL(dpc)}` : "Destaque do produto";
        case "exclusive":
          return "Produto exclusivo — sem divulgação de preço";
        default: {
          if (!dpc) return "Oferta";
          const formattedDiscounted = this.formatPriceBRL(dpc);
          if (brief.commercial.badgeText) {
            const formattedOriginal = (brief.commercial.originalPriceCents ?? 0) > 0
              ? `de ${this.formatPriceBRL(brief.commercial.originalPriceCents ?? 0)} por `
              : "";
            return `${brief.commercial.badgeText}: ${formattedOriginal}${formattedDiscounted}`;
          }
          return `Apenas ${formattedDiscounted}`;
        }
      }
    })();

    return {
      productName: effectiveProductName,
      storeName: context.store.name ?? '',
      storeSegment,
      storeTone: context.store.toneOfVoice ?? "profissional",
      brandColor: context.store.brandColor ?? "#22C55E",
      originalPrice: (brief.commercial.originalPriceCents ?? 0) > 0
        ? this.formatPriceBRL(brief.commercial.originalPriceCents ?? 0)
        : "",
      discountedPrice: brief.commercial.discountedPriceCents
        ? this.formatPriceBRL(brief.commercial.discountedPriceCents)
        : "",
      badgeText: brief.commercial.badgeText ?? "",
      hook: brief.commercial.hook ?? "",
      cta: brief.commercial.cta ?? "",
      objective: brief.commercial.objective ?? "",
      campaignDetails: brief.commercial.campaignDetails ?? "",
      additionalDetails: brief.commercial.additionalDetails ?? "",
      targetChannel: brief.commercial.targetChannel ?? "Instagram",
      format: brief.commercial.format ?? "quadrado 1:1",
      validity: brief.commercial.validity?.enabled
        ? (brief.commercial.validity.displayText ?? "")
        : "",
      availabilityNotes: brief.commercial.availabilityNotes ?? "",
      sensitiveConstraints: brief.creativeContext.sensitiveConstraints ?? "",
      mandatoryArtworkText: brief.commercial.legalNotice?.enabled
        ? (brief.commercial.legalNotice.text ?? "")
        : "",
      identityImageUrl: context.identity.imageUrl ?? "",
      identityDirective: context.identity.directive ?? "",
      campaignIntent,
      preserveImageDirective: campaignIntent !== "offer" && brief.creativeContext.preserveImageContext
        ? "NÃO recortar o produto. Preservar o contexto original da imagem. Adaptar a composição ao redor do produto sem isolá-lo. Legibilidade continua obrigatória."
        : "",
      commercialFrame,

      // Brand profile context (Phase 4.4.1)
      brandProfileSection: this.buildBrandProfileSection(context.brandProfile ?? null),
      brandColorsChosen: context.brandProfile?.brand_colors_chosen?.join(', ') ?? '',
      visualStyle: context.brandProfile?.visual_style ?? '',
      visualTone: context.brandProfile?.visual_tone ?? '',
      brandPersonality: context.brandProfile?.brand_personality ?? '',
      campaignGuidelines: context.brandProfile?.campaign_guidelines ?? '',
      campaignBrief: context.brandProfile?.campaign_brief ?? '',

      // New creative direction variables
      creativePersona,
      inferredCategory: effectiveInferredCategory,
      hasCategoryConflict: hasConflict ? "sim" : "nao",
      categoryConflictDirective,
      commercialRepertoire,
      inputValidationSummary,
      creativeContextGuidance,
    };
  }

  private assemblePrompt(
    state: GenerationState,
    variables: Record<string, string>,
    previousIssues: string[]
  ): string {
    const intent = variables.campaignIntent ?? "offer";
    const promptName = `campaign-image-director-${intent}`;
    const basePrompt = this.promptLoader.load(promptName, variables);

    if (state === GenerationState.CORRECT) {
      return `${basePrompt}\n\n---\n**Instrução de Correção:**\n\nA imagem gerada anteriormente apresentou os seguintes problemas:\n${previousIssues.map((i) => `- ${i}`).join("\n")}\n\nCorrija esses problemas específicos enquanto preserva a composição geral e o layout.`;
    }

    if (state === GenerationState.REGENERATE) {
      return `${basePrompt}\n\n---\n**Instrução de Regeneração:**\n\nA tentativa anterior não passou na revisão de qualidade. Os problemas foram:\n${previousIssues.map((i) => `- ${i}`).join("\n")}\n\nGere uma nova imagem do zero, corrigindo todos esses problemas.`;
    }

    return basePrompt;
  }

  private formatPriceBRL(cents: number | undefined): string {
    if (cents === undefined || cents === null) return "";
    return (cents / 100).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  // Ponte explícita media.images → provider/input-validation (F39-16, F41-20 D7).
  // Base64 apenas em memória/transporte — o snapshot nunca o expõe (D6/D7).
  private mediaImagesDataUrls(brief: CampaignBrief): string[] {
    return brief.media.images
      .map((img) => ({ img, order: img.role === "primary" ? 0 : 1 }))
      .sort((a, b) => a.order - b.order)
      .map(({ img }) => img.dataUrl)
      .filter((url): url is string => Boolean(url));
  }

  private primaryImageDataUrl(brief: CampaignBrief): string | undefined {
    return this.mediaImagesDataUrls(brief)[0];
  }

  private async generateWithRetry(
    promptText: string,
    productImageDataUrl: string | undefined,
    productImagesDataUrls: string[],
    signal: AbortSignal | undefined,
    remaining: () => number,
    identityImageUrl?: string
  ): Promise<
    | { success: true; imageBase64: string; mimeType: string; usage?: TokenUsage; usageMeta?: ImageProviderUsageMeta }
    | { success: false; code: string; message: string; details?: string }
  > {
    const ESTIMATED_RETRY_DURATION = 30000;
    const retryConfigs: Record<string, { maxRetries: number; backoffs: number[]; terminal: boolean }> = {
      provider_error: { maxRetries: 2, backoffs: [1000, 3000], terminal: false },
      provider_timeout: { maxRetries: 1, backoffs: [0], terminal: false },
      no_image_in_response: { maxRetries: 1, backoffs: [0], terminal: false },
      empty_review: { maxRetries: 1, backoffs: [0], terminal: false },
      insufficient_image: { maxRetries: 2, backoffs: [0, 0], terminal: false },
      review_low_confidence: { maxRetries: 1, backoffs: [0], terminal: false },
      provider_auth_error: { maxRetries: 0, backoffs: [], terminal: true },
      generated_product_mismatch: { maxRetries: 0, backoffs: [], terminal: true },
      global_timeout: { maxRetries: 0, backoffs: [], terminal: true },
    };

    const detectErrorCode = (err: unknown, attemptsMade: number): string => {
      if (signal?.aborted) return "global_timeout";
      if (err && typeof err === "object" && (err as any).name === "AbortError") return "global_timeout";

      const message = err instanceof Error ? err.message : String(err);
      const code = err && typeof err === "object" && "code" in err ? (err as { code: string }).code : "";
      const status = err && typeof err === "object" && "status" in err ? (err as { status: number }).status : 0;

      if (message.includes("Incorrect API key") || message.includes("insufficient_quota")) return "provider_auth_error";
      if (status === 401 || status === 403) return "provider_auth_error";
      if (status === 429 || status === 503 || code === "rate_limit_exceeded") return "provider_error";
      if (message.includes("timeout") || message.includes("TIMEOUT") || status === 504) return "provider_timeout";
      if (status >= 500) return "provider_error";
      if (message.includes("No image generated") || message.includes("no image")) return "no_image_in_response";

      return "provider_error";
    };

    const promptCheck = validatePrompt(promptText);
    if (!promptCheck.valid) {
      console.error(`[ImageGenerationService] prompt_placeholder_error — variáveis não interpoladas: ${promptCheck.unresolvedVariables.join(', ')}`);
      return {
        success: false,
        code: "invalid_prompt",
        message: "O prompt de geração contém placeholders não resolvidos. A campanha não pode ser gerada.",
        details: JSON.stringify({ unresolvedVariables: promptCheck.unresolvedVariables }),
      };
    }

    for (let attempt = 0; attempt <= 3; attempt++) {
      try {
        const output = await this.imageProvider.generateImage({
          prompt: promptText,
          productImageDataUrl,
          productImagesDataUrls,
          identityImageUrl,
          size: IMAGE_GENERATION_SIZE,
          signal,
          attempt,
        });

        return { success: true, imageBase64: output.imageBase64, mimeType: output.mimeType, usage: output.usage, usageMeta: output.usageMeta };
      } catch (err) {
        if (attempt >= 3) {
          const message = err instanceof Error ? err.message : String(err);
          return {
            success: false,
            code: "provider_error",
            message: "Falha ao gerar imagem após múltiplas tentativas.",
            details: process.env.NODE_ENV === "development" ? message : undefined,
          };
        }

        const code = detectErrorCode(err, attempt);

        if (code === "global_timeout") {
          return {
            success: false,
            code: "global_timeout",
            message: "O tempo limite de geração foi excedido. Tente novamente.",
          };
        }

        if (code === "provider_auth_error") {
          const message = err instanceof Error ? err.message : String(err);
          return {
            success: false,
            code: "provider_auth_error",
            message: "Erro de autenticação com o provedor de imagem. Verifique a chave de API.",
            details: process.env.NODE_ENV === "development" ? message : undefined,
          };
        }

        const config = retryConfigs[code];
        if (!config || config.terminal || attempt >= config.maxRetries) {
          const message = err instanceof Error ? err.message : String(err);
          return {
            success: false,
            code,
            message: "Falha ao gerar imagem. Tente novamente.",
            details: process.env.NODE_ENV === "development" ? message : undefined,
          };
        }

        if (remaining() < ESTIMATED_RETRY_DURATION) {
          return {
            success: false,
            code: "global_timeout",
            message: "O tempo limite de geração foi excedido. Tente novamente.",
            details: `budget exhausted before retry ${attempt + 1}`,
          };
        }

        const backoff = config.backoffs[attempt] ?? 0;
        if (backoff > 0) {
          await new Promise((resolve) => setTimeout(resolve, backoff));
        }
      }
    }

    return {
      success: false,
      code: "provider_error",
      message: "Falha ao gerar imagem.",
    };
  }

  private applyValidationContextToReviewResult(result: ImageReviewResult, context?: ValidationContext): ImageReviewResult {
    if (!context || result.passed) {
      return result;
    }

    if (context.overrides?.productImageCheck === "user_confirmed_continue") {
      const OVERRIDE_FILTERABLE_TYPES = new Set(["product_image_conflict", "product_image_low_confidence"]);
      result.issues = result.issues.filter(issue => !OVERRIDE_FILTERABLE_TYPES.has(issue.type));
    }

    // Phase 4.3.3 verification: wrong_product_name blocks (non-terminal, triggers correction)
    // generated_product_mismatch blocks (terminal path — returns error immediately)
    const BLOCKING_TYPES = new Set([
      "wrong_price", "wrong_store_name", "wrong_product_name",
      "generated_product_mismatch", "illegible_text", "insufficient_image",
      "wrong_cta", "bad_composition", "invented_badge", "distorted_product",
      "empty_review", "review_low_confidence",
    ]);

    const hasBlockingIssue = result.issues.some(
      issue => BLOCKING_TYPES.has(issue.type) || issue.severity === "critical"
    );

    if (!hasBlockingIssue) {
      result.passed = true;
      result.failureType = null;
    }

    return result;
  }

  private buildBrandProfileSection(brandProfile?: {
    brand_colors_chosen?: Array<string | null>;
    safe_color_tokens?: Record<string, string>;
    visual_style?: string | null;
    visual_tone?: string | null;
    brand_personality?: string | null;
    campaign_guidelines?: string | null;
    campaign_brief?: string | null;
  } | null): string {
    if (!brandProfile) return '';

    const note = '> **Nota:** Este perfil de marca é contexto criativo direcional para repertório da campanha, não regra obrigatória. Use como referência visual e comercial, preservando seu julgamento criativo na composição.\n';

    const rows: string[] = [
      '| Campo | Valor |',
      '|-------|-------|',
    ];

    if (brandProfile.campaign_guidelines) {
      rows.push(`| **Diretrizes de campanha** | ${brandProfile.campaign_guidelines} |`);
    }
    if (brandProfile.campaign_brief) {
      rows.push(`| **Brief do Diretor de Marca** | ${brandProfile.campaign_brief} |`);
    }
    if (brandProfile.brand_personality) {
      rows.push(`| **Personalidade da marca** | ${brandProfile.brand_personality} |`);
    }
    if (brandProfile.visual_style) {
      rows.push(`| **Estilo visual** | ${brandProfile.visual_style} |`);
    }
    if (brandProfile.visual_tone) {
      rows.push(`| **Tom visual** | ${brandProfile.visual_tone} |`);
    }
    if (brandProfile.brand_colors_chosen?.length) {
      rows.push(`| **Cores da marca** | ${brandProfile.brand_colors_chosen.join(', ')} |`);
    }
    return rows.length > 2 ? note + rows.join('\n') : '';
  }

  private buildValidationDetail(
    result: InputValidationResult,
    originalName: string,
    effectiveName: string
  ): string | undefined {
    if (result.classification === "auto-fix") {
      return `classificação: auto-fix, nome corrigido: '${originalName}' → '${effectiveName}'`;
    }
    if (result.classification === "match") {
      const cat = "inferredCategory" in result ? (result as any).inferredCategory : undefined;
      return cat
        ? `classificação: match, categoria inferida: ${cat}`
        : `classificação: match`;
    }
    return undefined;
  }
}

// TODO(4.3.3): Audit review alignment for edge cases
// - generated_product_mismatch still blocks even with override (verified)
// - wrong_product_name using effectiveProductName (verified)
// - Commercial repertoire should be validated for hallucination risk
