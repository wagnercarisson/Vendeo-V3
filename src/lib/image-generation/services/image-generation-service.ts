import { PromptLoader } from "@/lib/image-generation/prompt-loader";
import { IMAGE_GENERATION_SIZE } from "@/lib/image-generation/config";
import type { ImageProvider } from "@/lib/image-generation/providers/types";
import type { GenerateImageRequest, GenerateImageSuccessResponse } from "@/lib/image-generation/schema";
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
    body: GenerateImageRequest
  ): Promise<GenerateImageServiceResult> {
    // ── Step 1: Pre-generation input validation ────────────────────
    const validationResult = await this.inputValidation.validate(
      body.productName,
      body.productImageDataUrl,
      body.inputValidationOverride
    );

    let effectiveProductName = body.productName;
    let inputCorrections: { productName: { from: string; to: string; reason: string } } | undefined;

    switch (validationResult.classification) {
      case "conflict":
        return {
          success: false,
          code: "product_image_conflict",
          message: "O nome do produto digitado não corresponde à imagem enviada.",
          details: validationResult.suggestedProductName
            ? JSON.stringify({ suggestedProductName: validationResult.suggestedProductName })
            : undefined,
        };
      case "low-confidence":
        return {
          success: false,
          code: "product_image_low_confidence",
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
        // proceed as-is
        break;
    }

    // ── Step 2: State machine — generation + review lifecycle ────
    let state = GenerationState.INITIAL;
    let attempts = 0;
    const maxAttempts = 3; // 1 initial + 1 correction + 1 regeneration

    const promptVariables = this.buildPromptVariables(body, effectiveProductName);

    let lastReviewIssues: string[] = [];
    let currentImageBase64: string | null = null;
    let currentMimeType: string = "image/png";

    while (state !== GenerationState.COMPLETE && state !== GenerationState.ERROR) {
      if (attempts >= maxAttempts) {
        return {
          success: false,
          code: "review_failed",
          message: "Não foi possível gerar uma imagem que passasse na revisão de qualidade após todas as tentativas.",
          details: lastReviewIssues.length > 0
            ? JSON.stringify({ issues: lastReviewIssues })
            : undefined,
        };
      }

      try {
        // ── Generate ────────────────────────────────────────────
        const promptText = this.assemblePrompt(state, promptVariables, lastReviewIssues);

        const providerOutput = await this.imageProvider.generateImage({
          prompt: promptText,
          productImageDataUrl: body.productImageDataUrl,
          size: IMAGE_GENERATION_SIZE,
        });

        currentImageBase64 = providerOutput.imageBase64;
        currentMimeType = providerOutput.mimeType;

        // ── Review ──────────────────────────────────────────────
        const imageDataUrl = `data:${currentMimeType};base64,${currentImageBase64}`;

        const reviewInput: ImageReviewInput = {
          productName: effectiveProductName,
          storeName: body.storeName,
          discountedPrice: this.formatPriceBRL(body.discountedPriceCents),
          originalPrice: body.originalPriceCents > 0
            ? this.formatPriceBRL(body.originalPriceCents)
            : undefined,
        };

        const reviewResult = await this.imageReview.review(imageDataUrl, reviewInput);

        if (reviewResult.passed) {
          state = GenerationState.COMPLETE;
        } else {
          const criticalIssues = reviewResult.issues.filter((i) => i.severity === "critical");
          lastReviewIssues = reviewResult.issues.map((i) => i.description);

          if (criticalIssues.length > 0) {
            // Advance state machine
            if (state === GenerationState.INITIAL) {
              state = GenerationState.CORRECT;
            } else if (state === GenerationState.CORRECT) {
              state = GenerationState.REGENERATE;
            } else {
              // REGENERATE failed too → error
              state = GenerationState.ERROR;
            }
          } else {
            // Only minor issues → accept
            state = GenerationState.COMPLETE;
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          success: false,
          code: "provider_failure",
          message: "Falha ao gerar imagem. Tente novamente.",
          details: process.env.NODE_ENV === "development" ? message : undefined,
        };
      }

      attempts++;
    }

    // ── Step 3: Build success response ─────────────────────────
    const imageDataUrl = `data:${currentMimeType};base64,${currentImageBase64}`;

    const response: GenerateImageServiceResult = {
      success: true,
      imageDataUrl,
    };

    if (inputCorrections) {
      response.inputCorrections = inputCorrections;
    }

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
      originalPrice: body.originalPriceCents > 0
        ? this.formatPriceBRL(body.originalPriceCents)
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
}
