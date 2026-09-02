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
 * The fallback sends ALL available references to the Image API edit in a
 * deterministic order — product primary (base), auxiliary product images
 * (productImagesDataUrls) and the store visual identity (identityImageUrl),
 * when available — so the delivered art preserves the store's visual
 * signature instead of silently dropping references.
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

    // attempt 1+ → skip to Image API edit fallback (quando há primary — gate
    // relaxado MQJ; a premissa F41 D7 de "1 imagem" foi superada pelo SDK
    // v6.39 multi-image)
    if (attempt >= 1 && this.canUseEditFallback(input)) {
      return this.fallbackToImageApi(openai, input, size);
    }

    try {
      const content: (
        | { type: "input_text"; text: string }
        | { type: "input_image"; image_url: string; detail: "auto" | "low" | "high" | "original" }
      )[] = [
        { type: "input_text", text: input.prompt },
      ];

      const productImages =
        input.productImagesDataUrls ??
        (input.productImageDataUrl ? [input.productImageDataUrl] : []);
      for (const url of productImages) {
        content.push({ type: "input_image" as const, image_url: url, detail: "auto" as const });
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

      // Fallback to Image API edit when a product primary is available and the
      // error is not auth/quota/rate-limit (isResponsesApiError mantido — erros
      // de auth/quota/rate-limit continuam propagando sem fallback)
      if (this.canUseEditFallback(input) && this.isResponsesApiError(err)) {
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
   * MQJ: gate do fallback images.edit — exige APENAS a existência de uma primary
   * (imagem do produto); qualquer contagem de imagens é aceita. O gate F41 D7
   * restringia o fallback a "SÓ com primary única (1 imagem)" porque images.edit
   * era considerado limitado a 1 base image (TODO histórico removido de
   * fallbackToImageApi). Verificado no SDK openai@^6.39.0 —
   * ImageEditParamsBase.image: Uploadable | Array<Uploadable>, com até 16
   * imagens para os GPT image models (incl. gpt-image-2, o modelo do fallback):
   * a premissa não existe mais; o fallback agora envia TODAS as referências e
   * não degrada fidelidade. Sem primary → fallback NÃO usado (input sem imagem
   * de produto segue no caminho Responses, comportamento inalterado).
   */
  private canUseEditFallback(input: ImageProviderInput): boolean {
    return Boolean(input.productImageDataUrl) || (input.productImagesDataUrls?.length ?? 0) >= 1;
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
   * Sends all available references to images.edit in a deterministic order —
   * [primary, auxiliares de productImagesDataUrls..., identity?] — with the
   * product primary as the edit base image and the prompt as instruction.
   */

  private async fallbackToImageApi(
    openai: any,
    input: ImageProviderInput,
    size: string
  ): Promise<ImageProviderOutput> {
    const { toFile } = await import("openai");

    // MQJ: resolve a primary (legado ou posição 0 da lista) — ela é a base do
    // edit e vai SEMPRE na posição 0 do envio ao images.edit.
    const productImageDataUrl =
      input.productImageDataUrl ?? input.productImagesDataUrls?.[0];

    if (!productImageDataUrl) {
      throw new Error(
        "Invalid productImageDataUrl. Expected data:image/png|jpeg|webp;base64,..."
      );
    }

    const primary = parseEditImageDataUrl(
      productImageDataUrl,
      "Invalid productImageDataUrl. Expected data:image/png|jpeg|webp;base64,..."
    );

    const primaryFile = await toFile(
      primary.buffer,
      `product.${primary.extension}`,
      { type: primary.mimeType }
    );

    // Ordem determinística do images.edit: [primary, auxiliares..., identity?].
    // Primary SEMPRE na posição 0; auxiliares iteradas a partir do índice 1
    // (a posição 0 da lista já foi enviada como primary).
    const files = [primaryFile];

    const productImagesDataUrls = input.productImagesDataUrls;
    if (productImagesDataUrls && productImagesDataUrls.length > 1) {
      for (let i = 1; i < productImagesDataUrls.length; i++) {
        const referenceDataUrl = productImagesDataUrls[i];
        // Dedupe do shape real de produção: quando o service envia
        // productImageDataUrl === productImagesDataUrls[0] (ou há repetições),
        // a imagem já enviada nunca entra duas vezes no array.
        if (referenceDataUrl === productImageDataUrl) {
          continue;
        }
        const reference = parseEditImageDataUrl(
          referenceDataUrl,
          "Invalid product reference image data URL. Expected data:image/png|jpeg|webp;base64,..."
        );
        files.push(
          await toFile(
            reference.buffer,
            `reference-${i}.${reference.extension}`,
            { type: reference.mimeType }
          )
        );
      }
    }

    // Fetch identity image for fallback — already validated by validateIdentityReference.
    // MQJ: a identidade é essencial — fetch falho bloqueia com o erro explícito
    // PT-BR existente (nunca gera arte sem a assinatura visual); fetch OK → o
    // identityFile entra POR ÚLTIMO no array.
    let identityFile: File | undefined;
    if (input.identityImageUrl) {
      try {
        const identityResponse = await fetch(input.identityImageUrl);
        if (identityResponse.ok) {
          const identityBuffer = Buffer.from(await identityResponse.arrayBuffer());
          identityFile = await toFile(identityBuffer, 'identity.png', { type: 'image/png' });
          files.push(identityFile);
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

    // Log operacional mínimo (console.error, sem telemetria/métricas): modelo
    // usado, quantidade de imagens enviadas e flag de identidade.
    const identityIncluded = Boolean(identityFile);
    console.error(
      '[OpenAIImageProvider] images.edit fallback — model=' + this.editFallbackModel +
        ', images=' + files.length +
        ', identityIncluded=' + identityIncluded +
        ', promptChars=' + input.prompt.length
    );

    // MQJ: o SDK openai@^6.39.0 suporta image: Uploadable | Array<Uploadable>
    // (até 16 imagens nos GPT image models, incl. gpt-image-2, o modelo do
    // fallback). 1 imagem → escalar (wire format atual preservado); 2+ → array
    // na ordem determinística [primary, auxiliares..., identity?].
    const response = await openai.images.edit({
      model: this.editFallbackModel,
      image: files.length === 1 ? files[0] : files,
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

/**
 * Parses a product/reference image data URL for the images.edit fallback.
 * Validates with the SAME png|jpeg|webp regex used by the primary path and
 * throws the explicit message when the data URL does not match. Reused for the
 * primary image and for each auxiliary reference (productImagesDataUrls[1..]).
 */
function parseEditImageDataUrl(
  dataUrl: string,
  invalidMessage: string
): {
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  extension: string;
  buffer: Buffer;
} {
  const match = dataUrl.match(
    /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/i
  );

  if (!match) {
    throw new Error(invalidMessage);
  }

  const mimeType = match[1].toLowerCase() as
    | "image/png"
    | "image/jpeg"
    | "image/webp";

  const extension =
    mimeType === "image/png"
      ? "png"
      : mimeType === "image/webp"
        ? "webp"
        : "jpg";

  return {
    mimeType,
    extension,
    buffer: Buffer.from(match[2], "base64"),
  };
}
