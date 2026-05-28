import type { ImageProvider, ImageProviderInput, ImageProviderOutput } from "./types";
import {
  IMAGE_GENERATION_MODEL,
  IMAGE_GENERATION_QUALITY,
  IMAGE_GENERATION_SIZE,
} from "@/lib/image-generation/config";

/**
 * OpenAIImageProvider — real AI provider that calls OpenAI's Responses API
 * with the image_generation tool as the primary path.
 *
 * Fallback: Image API edits when the Responses API is unavailable for the
 * specific use case (e.g., model not found, tool not supported).
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
  private readonly model: string;

  /**
   * @param model - OpenAI model identifier. Defaults to IMAGE_GENERATION_MODEL
   *                from config.ts ("gpt-image-2" or IMAGE_GENERATION_MODEL env var).
   */
  constructor(model?: string) {
    this.model = model ?? IMAGE_GENERATION_MODEL;
  }

  async generateImage(input: ImageProviderInput): Promise<ImageProviderOutput> {
    // ── Step 1: Dynamic import (same pattern as OpenAIProvider in campaign-intelligence) ──
    const { default: OpenAI } = await import("openai");
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const size = input.size ?? IMAGE_GENERATION_SIZE;
    const quality = input.quality ?? IMAGE_GENERATION_QUALITY;

    try {
      // ── Step 2: Primary path — Responses API with image_generation tool ──
      const response = await openai.responses.create({
        model: this.model,
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: input.prompt },
              ...(input.productImageDataUrl
                ? [{ type: "input_image" as const, image_url: input.productImageDataUrl, detail: "auto" as const }]
                : []),
            ],
          },
        ],
        tools: [
          {
            type: "image_generation" as const,
            size,
            quality: quality as "auto" | "low" | "medium" | "high",
          },
        ],
      });

      // Extract the generated image from the response
      const imageOutput = response.output?.find(
        (item): item is typeof item & { type: "image_generation_call"; result: string } =>
          item.type === "image_generation_call"
      );

      if (!imageOutput?.result) {
        throw new Error("No image generated in Responses API response");
      }

      // The result is already a base64-encoded image string from gpt-image-2
      const imageBase64 = imageOutput.result;

      return {
        imageBase64,
        mimeType: "image/png" as const,
        model: this.model,
      };
    } catch (err) {
      // ── Step 3: Fallback — Image API edit when product image reference
      //            is needed and Responses API path failed ──────────────
      if (input.productImageDataUrl && this.isResponsesApiError(err)) {
        return this.fallbackToImageApi(openai, input, size);
      }
      throw err;
    }
  }

  /**
   * Detect whether the error indicates Responses API unavailability
   * (as opposed to auth, rate limit, or network errors).
   */
  private isResponsesApiError(err: unknown): boolean {
    const message = err instanceof Error ? err.message : String(err);
    return (
      message.includes("not supported") ||
      message.includes("image_generation") ||
      message.includes("responses") ||
      message.includes("model_not_found") ||
      message.includes("tool")
    );
  }

  /**
   * Fallback: Use the Image API edit endpoint.
   * Requires a PNG with alpha channel as mask — sends the product image
   * as the base image and the prompt as instruction.
   */
  private async fallbackToImageApi(
    openai: any,
    input: ImageProviderInput,
    size: string
  ): Promise<ImageProviderOutput> {
    const base64Data = input.productImageDataUrl!.replace(
      /^data:image\/\w+;base64,/,
      ""
    );

    const response = await openai.images.edit({
      model: this.model,
      image: Buffer.from(base64Data, "base64"),
      prompt: input.prompt,
      size: size as "1024x1024" | "256x256" | "512x512",
      n: 1,
      response_format: "b64_json",
    });

    const imageBase64 = response.data[0]?.b64_json;
    if (!imageBase64) {
      throw new Error("Image API returned no image data");
    }

    return {
      imageBase64,
      mimeType: "image/png",
      model: this.model,
    };
  }
}
