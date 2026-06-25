import { PromptLoader } from "@/lib/image-generation/prompt-loader";
import { IMAGE_GENERATION_DEBUG, IMAGE_GENERATION_SIZE, IMAGE_GENERATION_GLOBAL_TIMEOUT_MS, IMAGE_GENERATION_RESPONSES_MODEL } from "@/lib/image-generation/config";
import type { ImageProvider } from "@/lib/image-generation/providers/types";
import type { GenerateImageRequest, GenerateImageSuccessResponse, GenerationPhase, GenerationPhaseEvent, ValidationContext, InputValidationResult, ImageReviewResult } from "@/lib/image-generation/schema";
import { InputValidationService } from "@/lib/image-generation/services/input-validation-service";
import { ImageReviewService } from "@/lib/image-generation/services/image-review-service";
import type { ImageReviewInput } from "@/lib/image-generation/services/image-review-service";
import type { GenerationMetricsEvent, GenerationMetrics } from "@/lib/image-generation/metrics/types";
import { MetricsWriter } from "@/lib/image-generation/metrics/writer";
import { logReviewDiagnostic } from "@/lib/image-generation/metrics/review-diagnostics";
import type { ReviewDiagnosticEntry } from "@/lib/image-generation/metrics/review-diagnostics";
import { validatePrompt } from "@/lib/image-generation/services/prompt-validator";
import { STORE_SEGMENTS } from "@/lib/constants";

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
  | { success: true; imageDataUrl: string; inputCorrections?: { productName: { from: string; to: string; reason: string } } }
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
    body: GenerateImageRequest,
    onPhaseChange?: (event: GenerationPhaseEvent) => void,
    signal?: AbortSignal,
    onMetricsEvent?: (event: GenerationMetricsEvent) => void
  ): Promise<GenerateImageServiceResult> {
    const startTime = Date.now();
    const remaining = () => IMAGE_GENERATION_GLOBAL_TIMEOUT_MS - (Date.now() - startTime);
    const runId = crypto.randomUUID();

    const emitMetricsEvent = (phase: string, attempt: number = 0) => {
      if (onMetricsEvent) {
        onMetricsEvent({
          runId,
          phase,
          provider: this.imageProvider.name,
          model: IMAGE_GENERATION_RESPONSES_MODEL,
          elapsedMs: Date.now() - startTime,
          attempt,
        });
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
    const emitSkipped = (phase: GenerationPhase) => emit(phase, "skipped");
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
    emitHuman("input_validation");
    emitMetricsEvent("input_validation");

    const aborted1 = checkAborted();
    if (aborted1) { emitFailed("input_validation", aborted1.message); return abortResult(aborted1); }

    const validationResult = await this.inputValidation.validate(
      body.productName,
      body.productImageDataUrl,
      body.inputValidationOverride
    );

    let effectiveProductName = body.productName;
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
            from: body.productName,
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

    if (body.inputValidationOverride?.productImageCheck === "user_confirmed_continue") {
      metricsHadOverride = true;
      validationContext = {
        overrides: { productImageCheck: "user_confirmed_continue" },
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
    const validationDetail = this.buildValidationDetail(validationResult, body.productName, effectiveProductName);
    if (validationDetail) {
      emit("input_validation", "complete", undefined, validationDetail);
    } else {
      emitComplete("input_validation");
    }
    emitMetricsEvent("input_validation");

    // ── Phase 2: Prompt assembly ────────────────────────────────────
    emitHuman("prompt_assembly");
    emitMetricsEvent("prompt_assembly");

    const aborted2 = checkAborted();
    if (aborted2) { emitFailed("prompt_assembly", aborted2.message); return abortResult(aborted2); }

    const promptVariables = this.buildPromptVariables(body, effectiveProductName, inferredCategory);

    const segmentEntry = STORE_SEGMENTS.find(s => s.value === body.storeSegment);
    const segmentPersona = segmentEntry?.label ?? body.storeSegment;
    const promptDetail = `briefing com persona de ${segmentPersona}, categoria inferida: ${inferredCategory ?? body.storeSegment}`;
    emit("prompt_assembly", "complete", undefined, promptDetail);
    emitMetricsEvent("prompt_assembly");

    // ── Phase 3-4: State machine — generation + review lifecycle ────
    let state = GenerationState.INITIAL;
    let attempts = 0;
    const maxAttempts = 3;

    let lastReviewIssues: string[] = [];
    let currentImageBase64: string | null = null;
    let currentMimeType: string = "image/png";

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
          storeName: body.storeName,
          storeSegment: body.storeSegment,
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
      emitMetricsEvent("image_generation", attempts);

      const aborted3 = checkAborted();
      if (aborted3) { emitFailed("image_generation", aborted3.message); return abortResult(aborted3); }

      const promptText = this.assemblePrompt(state, promptVariables, lastReviewIssues);

      const providerResult = await this.generateWithRetry(promptText, body, signal, remaining);
      if (!providerResult.success) {
        emitFailed("image_generation", providerResult.message);
        await this.metricsWriter.write(this.buildGenerationMetrics({
          runId,
          startTime,
          providerName: this.imageProvider.name,
          model: IMAGE_GENERATION_RESPONSES_MODEL,
          attempts,
          effectiveProductName,
          storeName: body.storeName,
          storeSegment: body.storeSegment,
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
      emitComplete("image_generation");
      emitMetricsEvent("image_generation", attempts);

      // ── Phase 4: Quality review ─────────────────────────────────
      emitHuman("quality_review");
      emitMetricsEvent("quality_review", attempts);

      const imageDataUrl = `data:${currentMimeType};base64,${currentImageBase64}`;

      const reviewInput: ImageReviewInput = {
        productName: effectiveProductName,
        storeName: body.storeName,
        discountedPrice: this.formatPriceBRL(body.discountedPriceCents),
        originalPrice: (body.originalPriceCents ?? 0) > 0
          ? this.formatPriceBRL(body.originalPriceCents ?? 0)
          : undefined,
        validationContext,
      };

      let reviewResult;
      try {
        reviewResult = await this.imageReview.review(imageDataUrl, reviewInput);
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
          hadLogoAsset: !!body.storeLogoUrl,
          hadBrandProfile: !!body.brandProfile,
          hadProductImage: !!body.productImageDataUrl,
        });
        emitFailed("quality_review", "Erro na revisão de qualidade.");
        await this.metricsWriter.write(this.buildGenerationMetrics({
          runId,
          startTime,
          providerName: this.imageProvider.name,
          model: IMAGE_GENERATION_RESPONSES_MODEL,
          attempts,
          effectiveProductName,
          storeName: body.storeName,
          storeSegment: body.storeSegment,
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
          hadLogoAsset: !!body.storeLogoUrl,
          hadBrandProfile: !!body.brandProfile,
          hadProductImage: !!body.productImageDataUrl,
        };

        if (reviewResult.passed) {
          emit("quality_review", "complete", undefined,
            `issues: ${totalIssues} (${criticalCount} críticas, ${minorCount} menores), failureType: ${reviewResult.failureType ?? "null"}`);
          emitMetricsEvent("quality_review", attempts);
          state = GenerationState.COMPLETE;
          logReviewDiagnostic({ ...diagBase, reviewAction: 'complete' });
        } else {
          lastReviewIssues = reviewResult.issues.map((i) => i.description);

          if (reviewResult.failureType === "generated_product_mismatch") {
            emitFailed("quality_review", "A imagem gerada exibiu um nome de produto diferente do informado.");
            emitMetricsEvent("quality_review", attempts);
            await this.metricsWriter.write(this.buildGenerationMetrics({
              runId,
              startTime,
              providerName: this.imageProvider.name,
              model: IMAGE_GENERATION_RESPONSES_MODEL,
              attempts,
              effectiveProductName,
              storeName: body.storeName,
              storeSegment: body.storeSegment,
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
            emitMetricsEvent("quality_review", attempts);
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
    };

    if (inputCorrections) {
      response.inputCorrections = inputCorrections;
    }

    const correctionsCount = body.productName !== effectiveProductName ? 1 : 0;
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
      storeName: body.storeName,
      storeSegment: body.storeSegment,
      reviewPassed: true,
      conflictsDetected: metricsConflictsDetected,
      hadOverride: metricsHadOverride,
    }));
    return response;
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

  private buildCommercialRepertoire(body: GenerateImageRequest): string {
    const parts: string[] = [];

    const hasAvailabilityNotes = !!body.availabilityNotes;
    const hasValidity = !!body.validity;
    const hasCampaignDetails = !!body.campaignDetails;
    const hasAdditionalDetails = !!body.additionalDetails;

    if (body.availabilityNotes) {
      const notes = body.availabilityNotes.toLowerCase();
      const scarcityKeywords = ["poucas unidades", "últimas", "limitado", "estoque"];
      const varietyKeywords = ["vários sabores", "cores variadas", "diversos", "várias"];

      if (scarcityKeywords.some(kw => notes.includes(kw))) {
        parts.push(`- Disponível: ${body.availabilityNotes}`);
      } else if (varietyKeywords.some(kw => notes.includes(kw))) {
        parts.push(`- Variedade disponível: ${body.availabilityNotes}`);
      }
    }

    if (body.validity && (
      body.validity.toLowerCase().includes("/") ||
      body.validity.toLowerCase().includes("até") ||
      body.validity.toLowerCase().includes("válida")
    )) {
      parts.push(`- Oferta válida: ${body.validity}`);
    }

    if (body.campaignDetails) {
      const actionable = body.campaignDetails.replace(/[\[\]]/g, "").trim();
      if (actionable.length > 0) {
        parts.push(`- ${actionable}`);
      }
    }

    if (body.additionalDetails) {
      const actionable = body.additionalDetails.replace(/[\[\]]/g, "").trim();
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

  private buildValidationSummary(body: GenerateImageRequest, effectiveProductName: string): string {
    const parts: string[] = [];

    if (body.productName !== effectiveProductName) {
      parts.push(`• Nome corrigido automaticamente de '${body.productName}' para '${effectiveProductName}'`);
    }

    if (body.inputValidationOverride?.productImageCheck === "user_confirmed_continue") {
      parts.push("• O usuário confirmou que a imagem do produto está correta, mesmo com divergência na pré-validação");
    }

    return parts.join("\n");
  }

  /**
   * Build creative context guidance based on segment, inferred category, and conflict status.
   * Provides the director with a short contextual suggestion for visual positioning.
   * Defaults to empty string when no specific guidance applies.
   */
  private buildCreativeContextGuidance(segment: string, category: string, hasConflict: boolean): string {
    const s = segment.toLowerCase();
    const c = category.toLowerCase();

    if (hasConflict) {
      // Category conflict — balance the two universes
      if (c.includes("eletronico") || c.includes("tecnologia") || c.includes("celular") || c.includes("computador")) {
        return "Equilibre o apelo popular do segmento com o desejo por tecnologia.";
      }
      if (c.includes("bebida") || c.includes("alimento") || c.includes("cerveja") || c.includes("energetico")) {
        return "Valorize o produto com apelo aspiracional. Preço é oportunidade.";
      }
      if (c.includes("moda") || c.includes("roupa") || c.includes("calcado") || c.includes("tenis")) {
        return "Destaque estilo e desejo dentro de um contexto acessível.";
      }
      if (c.includes("beleza") || c.includes("cosmetico") || c.includes("perfume")) {
        return "Eleve o produto como item de desejo — preço é bônus, não motivo principal.";
      }
      if (c.includes("pet") || c.includes("racao")) {
        return "Conecte carinho pelo pet com a conveniência da oferta.";
      }
      if (c.includes("casa") || c.includes("decoracao") || c.includes("movel")) {
        return "Transforme o produto em aspiração para o lar. Preço é o empurrão final.";
      }
      return "Equilibre o universo do produto com a identidade da loja.";
    }

    // Aligned — reinforce segment-specific values
    if (s.includes("bebidas-adegas-conveniencia") || s.includes("bebida")) {
      if (c.includes("energetico")) return "Valorize energia e disposição. Preço é oportunidade.";
      if (c.includes("cerveja")) return "Valorize confraternização e qualidade. Preço é vantagem.";
      if (c.includes("cafe")) return "Valorize aconchego e ritual. Preço é convite.";
      return "Valorize sabor e qualidade. Preço é vantagem.";
    }
    if (s.includes("moda") || s.includes("calcados")) {
      if (c.includes("calcado") || c.includes("tenis")) return "Valorize estilo e performance. Preço é investimento.";
      return "Valorize estilo e personalidade. Preço é oportunidade.";
    }
    if (s.includes("beleza") || s.includes("estetica")) {
      return "Valorize autoestima e cuidado pessoal. Preço é mimo.";
    }
    if (s.includes("farmacia-saude") || s.includes("farmacia")) {
      return "Valorize bem-estar e confiança. Preço é cuidado.";
    }
    if (s.includes("eletronico") || s.includes("tecnologia")) {
      return "Valorize inovação e performance. Preço é investimento inteligente.";
    }
    if (s.includes("casa") || s.includes("decoracao")) {
      return "Valorize conforto e estilo. Preço é transformação.";
    }
    if (s.includes("pet")) {
      return "Valorize carinho e bem-estar do pet. Preço é cuidado.";
    }
    if (s.includes("variedades")) {
      return "Valorize variedade e praticidade. Preço é vantagem.";
    }

    return "";
  }

  private buildPromptVariables(
    body: GenerateImageRequest,
    effectiveProductName: string,
    inferredCategory?: string
  ): Record<string, string> {
    const storeSegment = body.storeSegment;
    const effectiveInferredCategory = inferredCategory ?? storeSegment;
    const hasConflict = inferredCategory
      ? this.isSameCategory(inferredCategory, storeSegment)
      : false;

    const segEntry = STORE_SEGMENTS.find(s => s.value === storeSegment);
    const creativePersona = `Você é um diretor de marketing especializado em ${segEntry?.label ?? storeSegment}.`;

    const categoryConflictDirective = hasConflict
      ? `ATENÇÃO: O produto anunciado é da categoria "${inferredCategory}", que é diferente do segmento principal da loja "${storeSegment}". A direção visual deve refletir o universo de ${inferredCategory}. A identidade da loja (nome, paleta, logo) deve aparecer como assinatura, não como tema visual.`
      : "";

    const commercialRepertoire = this.buildCommercialRepertoire(body);
    const inputValidationSummary = this.buildValidationSummary(body, effectiveProductName);
    const creativeContextGuidance = this.buildCreativeContextGuidance(storeSegment, effectiveInferredCategory, hasConflict);

    return {
      productName: effectiveProductName,
      storeName: body.storeName,
      storeSegment: body.storeSegment,
      storeTone: body.storeTone ?? "profissional",
      brandColor: body.brandColor,
      originalPrice: (body.originalPriceCents ?? 0) > 0
        ? this.formatPriceBRL(body.originalPriceCents ?? 0)
        : "",
      discountedPrice: this.formatPriceBRL(body.discountedPriceCents),
      badgeText: body.badgeText ?? "",
      hook: body.hook ?? "",
      cta: body.cta ?? "",
      objective: body.objective ?? "",
      campaignDetails: body.campaignDetails ?? "",
      additionalDetails: body.additionalDetails ?? "",
      targetChannel: body.targetChannel ?? "Instagram",
      format: body.format ?? "quadrado 1:1",
      validity: body.validity ?? "",
      availabilityNotes: body.availabilityNotes ?? "",
      sensitiveConstraints: body.sensitiveConstraints ?? "",
      storeLogoUrl: body.storeLogoUrl ?? "",

      // Brand profile context (Phase 4.4.1)
      brandProfileSection: this.buildBrandProfileSection(body.brandProfile),
      brandColorsChosen: body.brandProfile?.brand_colors_chosen?.join(', ') ?? '',
      visualStyle: body.brandProfile?.visual_style ?? '',
      visualTone: body.brandProfile?.visual_tone ?? '',
      brandPersonality: body.brandProfile?.brand_personality ?? '',
      campaignGuidelines: body.brandProfile?.campaign_guidelines ?? '',
      campaignBrief: body.brandProfile?.campaign_brief ?? '',
      logoVariantUrl: body.brandProfile?.logoVariantUrl ?? '',

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
    const basePrompt = this.promptLoader.load("campaign-image-director", variables);

    if (state === GenerationState.CORRECT) {
      return `${basePrompt}\n\n---\n**Instrução de Correção:**\n\nA imagem gerada anteriormente apresentou os seguintes problemas:\n${previousIssues.map((i) => `- ${i}`).join("\n")}\n\nCorrija esses problemas específicos enquanto preserva a composição geral e o layout.`;
    }

    if (state === GenerationState.REGENERATE) {
      return `${basePrompt}\n\n---\n**Instrução de Regeneração:**\n\nA tentativa anterior não passou na revisão de qualidade. Os problemas foram:\n${previousIssues.map((i) => `- ${i}`).join("\n")}\n\nGere uma nova imagem do zero, corrigindo todos esses problemas.`;
    }

    return basePrompt;
  }

  private formatPriceBRL(cents: number): string {
    return (cents / 100).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  private async generateWithRetry(
    promptText: string,
    body: GenerateImageRequest,
    signal: AbortSignal | undefined,
    remaining: () => number
  ): Promise<
    | { success: true; imageBase64: string; mimeType: string }
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
          productImageDataUrl: body.productImageDataUrl,
          logoImageUrl: body.storeLogoUrl,
          size: IMAGE_GENERATION_SIZE,
          signal,
          attempt,
        });

        return { success: true, imageBase64: output.imageBase64, mimeType: output.mimeType };
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
      result.failureType = undefined;
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
    logoVariantUrl?: string | null;
  }): string {
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
    if (brandProfile.logoVariantUrl) {
      rows.push(`| **Logo variante** | ${brandProfile.logoVariantUrl} |`);
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
