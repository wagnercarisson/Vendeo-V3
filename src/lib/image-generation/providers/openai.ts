import type { ImageProvider, ImageProviderInput, ImageProviderOutput, ImageProviderUsageMeta } from "./types";
import {
  IMAGE_GENERATION_RESPONSES_MODEL,
  IMAGE_EDIT_FALLBACK_MODEL,
  IMAGE_GENERATION_QUALITY,
  IMAGE_GENERATION_SIZE,
} from "@/lib/image-generation/config";

/**
 * OpenAIImageProvider — real AI provider that calls OpenAI's Responses API
 * with the image_generation tool as the primary path.
 *
 * The model passed to responses.create() MUST be a mainline model that supports
 * the image_generation tool — NOT a GPT Image model such as gpt-image-2.
 *
 * Fallback: use Image API edits when the Responses API is unavailable,
 * insufficient, or fails for the specific prompt + image reference flow.
 *
 * The fallback uses the Image API directly with a GPT Image model such as
 * gpt-image-2. Do not use the GPT Image model as the `model` parameter for
 * responses.create(); use it only in the Image API fallback.
 *
 * Requires OPENAI_API_KEY in environment.
 *
 * All user-facing strings in the prompt are in Brazilian Portuguese (PT-BR).
 * The provider name is "openai".
 *
 * NOTE: This provider does NOT handle input validation — it assumes validated
 * input has already passed through InputValidationService.
 */

export class OpenAIImageProvider implements ImageProvider {
  readonly name = "openai";
  private readonly responsesModel: string;
  private readonly editFallbackModel: string;

  /**
   * @param responsesModel - Model for responses.create() (mainline model, not gpt-image-2).
   *                         Defaults to IMAGE_GENERATION_RESPONSES_MODEL from config.
   * @param editFallbackModel - Model for Image API edit fallback, typically a GPT Image model such as gpt-image-2.
   *                            Defaults to IMAGE_EDIT_FALLBACK_MODEL from config.
   */
  constructor(responsesModel?: string, editFallbackModel?: string) {
    this.responsesModel = responsesModel ?? IMAGE_GENERATION_RESPONSES_MODEL;
    this.editFallbackModel = editFallbackModel ?? IMAGE_EDIT_FALLBACK_MODEL;
  }

  async generateImage(input: ImageProviderInput): Promise<ImageProviderOutput> {
    const { default: OpenAI } = await import("openai");
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const size = input.size ?? IMAGE_GENERATION_SIZE;
    const quality = input.quality ?? IMAGE_GENERATION_QUALITY;
    const attempt = input.attempt ?? 0;

    // attempt 1+ → skip to Image API edit fallback
    if (attempt >= 1 && input.productImageDataUrl) {
      return this.fallbackToImageApi(openai, input, size);
    }

    try {
      const content: (
        | { type: "input_text"; text: string }
        | { type: "input_image"; image_url: string; detail: "auto" | "low" | "high" | "original" }
      )[] = [
        { type: "input_text", text: input.prompt },
      ];

      if (input.productImageDataUrl) {
        content.push({ type: "input_image" as const, image_url: input.productImageDataUrl, detail: "auto" as const });
      }

      if (input.identityImageUrl) {
        content.push({ type: "input_image" as const, image_url: input.identityImageUrl, detail: "low" as const });
      }

      const response = await openai.responses.create({
        model: this.responsesModel,
        input: [{ role: "user", content }],
        tools: [
          {
            type: "image_generation" as const,
            size,
            quality: quality as "auto" | "low" | "medium" | "high",
          },
        ],
      }, { signal: input.signal });

      const imageOutput = response.output?.find(
        (item): item is typeof item & { type: "image_generation_call"; result: string } =>
          item.type === "image_generation_call"
      );

      if (!imageOutput?.result) {
        throw new Error("No image generated in Responses API response");
      }

      const imageBase64 = imageOutput.result;

      // F38.1: breakdown granular do usage da Responses API image_generation.
      // A API expõe input_tokens/output_tokens totais + detalhes por dimensão
      // (cached/text/image). Diferenciamos text vs image na entrada e na saída —
      // a imagem gerada sai em output_tokens_details.image_tokens, e a foto do
      // produto entra em input_tokens_details.image_tokens.
      const inputDetails = response.usage?.input_tokens_details as
        | { cached_tokens?: number; text_tokens?: number; image_tokens?: number }
        | undefined;
      const outputDetails = response.usage?.output_tokens_details as
        | { text_tokens?: number; image_tokens?: number }
        | undefined;

      const usageRaw = response.usage
        ? (response.usage as unknown as Record<string, unknown>)
        : undefined;

      const usage = response.usage
        ? {
            promptTokens: response.usage.input_tokens ?? undefined,
            completionTokens: response.usage.output_tokens ?? undefined,
            totalTokens: (response.usage.input_tokens ?? 0) + (response.usage.output_tokens ?? 0) || undefined,
            cachedInputTokens: inputDetails?.cached_tokens ?? undefined,
            imageTokens: outputDetails?.image_tokens ?? undefined,
            inputTextTokens:
              inputDetails?.text_tokens ??
              (response.usage.input_tokens !== undefined && inputDetails?.image_tokens !== undefined
                ? Math.max(0, response.usage.input_tokens - (inputDetails.image_tokens ?? 0))
                : undefined),
            inputImageTokens: inputDetails?.image_tokens ?? undefined,
            outputTextTokens:
              outputDetails?.text_tokens ??
              (response.usage.output_tokens !== undefined && outputDetails?.image_tokens !== undefined
                ? Math.max(0, response.usage.output_tokens - (outputDetails.image_tokens ?? 0))
                : undefined),
            outputImageTokens: outputDetails?.image_tokens ?? undefined,
          }
        : undefined;

      // F38.1: auditoria — usage bruto sanitizado + flags do caminho de geração.
      // NÃO entra em cálculo; usado para auditoria/calibração do pricing.
      const usageMeta: ImageProviderUsageMeta | undefined = response.usage
        ? {
            providerUsageRaw: usageRaw,
            providerUsageSource: "responses.image_generation",
            responsesModel: this.responsesModel,
            imageGenerationTool: true,
          }
        : undefined;

      return {
        imageBase64,
        mimeType: "image/png" as const,
        model: this.responsesModel,
        usage,
        usageMeta,
      };
    } catch (err) {
      const errorCode =
        err && typeof err === "object" && "code" in err
          ? (err as { code: string }).code
          : "unknown";
      const errorStatus =
        err && typeof err === "object" && "status" in err
          ? (err as { status: number }).status
          : 0;
      const errorType =
        err && typeof err === "object" && "type" in err
          ? (err as { type: string }).type
          : typeof err;
      const errorMessage = err instanceof Error ? err.message : String(err);

      console.error(
        `[OpenAIImageProvider] provider error — type=${errorType} code=${errorCode} status=${errorStatus} message=${errorMessage}`
      );

      // Fallback to Image API edit when product image is available
      // and error is not auth/quota/rate-limit
      if (input.productImageDataUrl && this.isResponsesApiError(err)) {
        console.error(
          `[OpenAIImageProvider] falling back to Image API edit (model=${this.editFallbackModel})`
        );
        return this.fallbackToImageApi(openai, input, size);
      }

      throw new Error(
        `image provider error (${errorCode || "unknown"})`
      );
    }
  }

  /**
   * Detect whether the error indicates Responses API unavailability for the
   * image_generation tool specifically (as opposed to auth, rate limit, quota,
   * or network errors). Only match model/tool capability errors so auth errors
   * propagate up instead of silently falling back to another failing path.
   */
  private isResponsesApiError(err: unknown): boolean {
    const message = err instanceof Error ? err.message : String(err);
    // Exclude auth, quota, rate-limit, and network errors — those are not
    // "Responses API doesn't support this" scenarios.
    if (
      message.includes("Incorrect API key") ||
      message.includes("insufficient_quota") ||
      message.includes("rate_limit") ||
      message.includes("429") ||
      message.includes("401")
    ) {
      return false;
    }
    return (
      message.includes("not supported") ||
      message.includes("image_generation is not") ||
      message.includes("model_not_found") ||
      message.includes("tool not found")
    );
  }
  /**
   * Uses IMAGE_EDIT_FALLBACK_MODEL for the Image API edit fallback.
   * The default should be a GPT Image model such as gpt-image-2.
   *
   * The product image is sent as the base image with the prompt as instruction.
   */

  private async fallbackToImageApi(
    openai: any,
    input: ImageProviderInput,
    size: string
  ): Promise<ImageProviderOutput> {
    const { toFile } = await import("openai");

    const dataUrlMatch = input.productImageDataUrl!.match(
      /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/i
    );

    if (!dataUrlMatch) {
      throw new Error(
        "Invalid productImageDataUrl. Expected data:image/png|jpeg|webp;base64,..."
      );
    }

    const mimeType = dataUrlMatch[1].toLowerCase() as
      | "image/png"
      | "image/jpeg"
      | "image/webp";

    const base64Data = dataUrlMatch[2];
    const imageBuffer = Buffer.from(base64Data, "base64");

    const extension =
      mimeType === "image/png"
        ? "png"
        : mimeType === "image/webp"
          ? "webp"
          : "jpg";

    const imageFile = await toFile(imageBuffer, `product.${extension}`, {
      type: mimeType,
    });

    // Fetch identity image for fallback — already validated by validateIdentityReference
    let identityFile: File | undefined;
    if (input.identityImageUrl) {
      try {
        const identityResponse = await fetch(input.identityImageUrl);
        if (identityResponse.ok) {
          const identityBuffer = Buffer.from(await identityResponse.arrayBuffer());
          identityFile = await toFile(identityBuffer, 'identity.png', { type: 'image/png' });
        } else {
          throw new Error(`HTTP ${identityResponse.status}`);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[fallbackToImageApi] Identity fetch failed — ${message}`);
        throw new Error("Falha ao carregar imagem de identidade para a geração de fallback. Tente novamente.");
      }
    }

    // Use a conservative square size for the Image API edit fallback.
    const imageApiSize = "1024x1024";

    // TODO(fallback): OpenAI images.edit aceita apenas uma imagem como base.
    // identityFile está disponível mas não pode ser enviado junto com productFile
    // na mesma chamada. Para enviar ambos, seria necessário compor as imagens
    // (ex.: sobrepor identity como marca d'água) antes de enviar, ou usar
    // a Responses API como caminho único. Esta limitação é pré-existente —
    // antes da fase 5 o fallback também perdia a identidade.
    const response = await openai.images.edit({
      model: this.editFallbackModel,
      image: imageFile,
      prompt: input.prompt,
      size: imageApiSize,
      n: 1,
    }, { signal: input.signal });

    const imageBase64 = response.data?.[0]?.b64_json;

    if (!imageBase64) {
      throw new Error("Image API returned no image data");
    }

    return {
      imageBase64,
      mimeType: "image/png",
      model: this.editFallbackModel,
    };
  }
}
