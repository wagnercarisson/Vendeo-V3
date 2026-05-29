import { PromptLoader } from "@/lib/image-generation/prompt-loader";
import { IMAGE_GENERATION_SIZE, IMAGE_GENERATION_GLOBAL_TIMEOUT_MS } from "@/lib/image-generation/config";
import type { ImageProvider } from "@/lib/image-generation/providers/types";
import type { GenerateImageRequest, GenerateImageSuccessResponse, GenerationPhase, GenerationPhaseEvent } from "@/lib/image-generation/schema";
import { InputValidationService } from "@/lib/image-generation/services/input-validation-service";
import { ImageReviewService } from "@/lib/image-generation/services/image-review-service";
import type { ImageReviewInput } from "@/lib/image-generation/services/image-review-service";

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

  constructor(
    imageProvider: ImageProvider,
    promptLoader?: PromptLoader,
    inputValidation?: InputValidationService,
    imageReview?: ImageReviewService
  ) {
    this.imageProvider = imageProvider;
    this.promptLoader = promptLoader ?? new PromptLoader();
    this.inputValidation = inputValidation ?? new InputValidationService();
    this.imageReview = imageReview ?? new ImageReviewService();
  }

  async generateImage(
    body: GenerateImageRequest,
    onPhaseChange?: (event: GenerationPhaseEvent) => void,
    signal?: AbortSignal
  ): Promise<GenerateImageServiceResult> {
    const startTime = Date.now();
    const remaining = () => IMAGE_GENERATION_GLOBAL_TIMEOUT_MS - (Date.now() - startTime);

    const emit = (phase: GenerationPhase, status: GenerationPhaseEvent["status"], message?: string, detail?: string) => {
      if (onPhaseChange) {
        onPhaseChange({ phase, status, message, detail });
      }
    };

    const emitRunning = (phase: GenerationPhase, message: string) => emit(phase, "running", message);
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
    emitRunning("input_validation", "Validando informações da campanha...");

    const aborted1 = checkAborted();
    if (aborted1) { emitFailed("input_validation", aborted1.message); return abortResult(aborted1); }

    const validationResult = await this.inputValidation.validate(
      body.productName,
      body.productImageDataUrl,
      body.inputValidationOverride
    );

    let effectiveProductName = body.productName;
    let inputCorrections: { productName: { from: string; to: string; reason: string } } | undefined;

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
    emitComplete("input_validation");

    // ── Phase 2: Prompt assembly ────────────────────────────────────
    emitRunning("prompt_assembly", "Montando briefing criativo...");

    const aborted2 = checkAborted();
    if (aborted2) { emitFailed("prompt_assembly", aborted2.message); return abortResult(aborted2); }

    const promptVariables = this.buildPromptVariables(body, effectiveProductName);
    emitComplete("prompt_assembly");

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
        emitRunning("image_generation", "Tentando novamente...");
      }

      // ── Phase 3: Image generation with provider retry ──────────
      if (attempts === 0) {
        emitRunning("image_generation", "Gerando imagem... isso pode levar até 2 minutos.");
      }

      const aborted3 = checkAborted();
      if (aborted3) { emitFailed("image_generation", aborted3.message); return abortResult(aborted3); }

      const promptText = this.assemblePrompt(state, promptVariables, lastReviewIssues);

      const providerResult = await this.generateWithRetry(promptText, body, signal, remaining);
      if (!providerResult.success) {
        emitFailed("image_generation", providerResult.message);
        return providerResult;
      }

      currentImageBase64 = providerResult.imageBase64;
      currentMimeType = providerResult.mimeType;
      emitComplete("image_generation");

      // ── Phase 4: Quality review ─────────────────────────────────
      emitRunning("quality_review", "Revisando qualidade da imagem...");

      const imageDataUrl = `data:${currentMimeType};base64,${currentImageBase64}`;

      const reviewInput: ImageReviewInput = {
        productName: effectiveProductName,
        storeName: body.storeName,
        discountedPrice: this.formatPriceBRL(body.discountedPriceCents),
        originalPrice: (body.originalPriceCents ?? 0) > 0
          ? this.formatPriceBRL(body.originalPriceCents ?? 0)
          : undefined,
      };

      let reviewResult;
      try {
        reviewResult = await this.imageReview.review(imageDataUrl, reviewInput);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        emitFailed("quality_review", "Erro na revisão de qualidade.");
        return {
          success: false,
          code: "provider_error",
          message: "Erro ao revisar a imagem gerada. Tente novamente.",
          details: process.env.NODE_ENV === "development" ? message : undefined,
        };
      }

      if (reviewResult.passed) {
        emitComplete("quality_review");
        state = GenerationState.COMPLETE;
      } else {
        lastReviewIssues = reviewResult.issues.map((i) => i.description);

        if (reviewResult.failureType === "generated_product_mismatch") {
          emitFailed("quality_review", "A imagem gerada exibiu um nome de produto diferente do informado.");
          return {
            success: false,
            code: "generated_product_mismatch",
            message: "A imagem gerada exibiu um nome de produto diferente do informado.",
            details: JSON.stringify({ issues: lastReviewIssues }),
          };
        }

        const criticalIssuesCount = reviewResult.issues.filter((i) => i.severity === "critical").length;

        if (criticalIssuesCount > 0) {
          if (state === GenerationState.INITIAL) {
            state = GenerationState.CORRECT;
          } else if (state === GenerationState.CORRECT) {
            state = GenerationState.REGENERATE;
          } else {
            state = GenerationState.ERROR;
          }
        } else {
          emitComplete("quality_review");
          state = GenerationState.COMPLETE;
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

    emitComplete("done");
    return response;
  }

  private buildPromptVariables(
    body: GenerateImageRequest,
    effectiveProductName: string
  ): Record<string, string> {
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

    for (let attempt = 0; attempt <= 3; attempt++) {
      try {
        const output = await this.imageProvider.generateImage({
          prompt: promptText,
          productImageDataUrl: body.productImageDataUrl,
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
}

// TODO(4.3.2): Implement contextual override where ImageReviewService ignores
// only the specific product-image conflict the user approved (e.g., wrong_product_name)
// while still reviewing price, legibility, text, store name, and visual quality.
// Currently, strong_conflict blocks generation entirely; light conflict (conflict + low-confidence)
// allows override but the reviewer may still flag the approved mismatch.
// The fix requires passing inputValidationOverride through ImageReviewInput and
// filtering only user-approved issue types in ImageReviewService.parseResult().
// Phase 4.3.1 introduced override-aware cost messaging, but there is no
// concrete credits/billing system yet. When plans/quota are implemented:
//   - Track generation attempts (including retries and correction loops)
//     as separate consumption events when billing by attempt.
//   - Expose remaining quota in the UI so the override dialog can display
//     "Gerar consome 1 de N gerações restantes" instead of generic wording.
//   - Block generation when quota is exhausted, with upgrade prompt.
// Tracked by: phase 4.3.1 adjustments — runbook entry.
