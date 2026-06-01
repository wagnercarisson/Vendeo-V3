import { PromptLoader } from "@/lib/image-generation/prompt-loader";
import { uploadToStorage, persistSignature } from "./persistence";
import type { CascadeResult, VisualSignatureMetadata } from "./types";

export class VisualSignatureValidator {
  async validate(params: {
    imageBase64: string;
    storeName: string;
  }): Promise<{ valid: boolean; reason?: string }> {
    if (!params.imageBase64 || params.imageBase64.length === 0) {
      return { valid: false, reason: "Empty image data" };
    }

    let buffer: Buffer;
    try {
      buffer = Buffer.from(params.imageBase64, "base64");
    } catch {
      return { valid: false, reason: "Invalid base64 encoding" };
    }

    if (buffer.length < 100) {
      return { valid: false, reason: "Image too small (less than 100 bytes)" };
    }

    if (buffer.length < 1024) {
      return { valid: false, reason: "Image too small (less than 1KB)" };
    }

    return { valid: true };
  }
}

export class AiImageGenerator {
  private promptLoader: PromptLoader;

  constructor(opts?: { promptLoader?: PromptLoader }) {
    this.promptLoader = opts?.promptLoader ?? new PromptLoader();
  }

  async generate(params: {
    storeId: string;
    storeName: string;
    segment: string;
    brandColor: string;
    tone: string;
    signal?: AbortSignal;
    attempt?: number;
    simplifiedPrompt?: boolean;
  }): Promise<CascadeResult> {
    const startTime = Date.now();

    let prompt: string;
    if (params.simplifiedPrompt) {
      prompt = `Crie uma imagem de assinatura visual profissional para a loja ${params.storeName}.
Segmento: ${params.segment}
Cor da marca: ${params.brandColor}
Tom: ${params.tone}
Design simples e limpo com o nome da loja em destaque.
Sem textos promocionais. Apenas a imagem PNG.`;
    } else {
      prompt = this.promptLoader.load("visual-signature-generator", {
        storeName: params.storeName,
        segment: params.segment,
        brandColor: params.brandColor,
        tone: params.tone,
      });
    }

    const { default: OpenAI } = await import("openai");
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const model =
      process.env.IMAGE_GENERATION_RESPONSES_MODEL || "gpt-5.5";

    try {
      const response = await openai.responses.create(
        {
          model,
          input: [
            {
              role: "user",
              content: [
                { type: "input_text" as const, text: prompt },
              ],
            },
          ],
          tools: [
            {
              type: "image_generation" as const,
              size: "1024x1024" as const,
              quality: "auto" as const,
            },
          ],
        },
        { signal: params.signal }
      );

      const imageOutput = response.output?.find(
        (
          item
        ): item is typeof item & {
          type: "image_generation_call";
          result: string;
        } => item.type === "image_generation_call"
      );

      if (!imageOutput?.result) {
        throw new Error("No image generated in Responses API response");
      }

      const imageBase64 = imageOutput.result;
      const validator = new VisualSignatureValidator();
      const validation = await validator.validate({
        imageBase64,
        storeName: params.storeName,
      });

      if (!validation.valid) {
        throw new Error(
          `Image validation failed: ${validation.reason || "Unknown reason"}`
        );
      }

      const buffer = Buffer.from(imageBase64, "base64");
      const { storagePath, assetUrl } = await uploadToStorage({
        storeId: params.storeId,
        buffer,
        mimeType: "image/png",
      });

      const tier =
        params.attempt !== undefined && params.attempt >= 1
          ? "image_retry"
          : "image_direct";

      const elapsedMs = Date.now() - startTime;
      const metadata: VisualSignatureMetadata = {
        generation_tier: tier,
        provider: "openai",
        model,
        elapsedMs,
      };

      const generationMode =
        params.attempt !== undefined && params.attempt >= 1
          ? "automatic"
          : "user_choice";

      const signatureType =
        tier === "image_direct" ? "ai_generated" : "automatic_generated";

      await persistSignature({
        store_id: params.storeId,
        storage_path: storagePath,
        asset_url: assetUrl,
        type: signatureType,
        status: "draft",
        generation_mode: generationMode,
        prompt,
        metadata,
      });

      return {
        tier,
        assetUrl,
        storagePath,
        mimeType: "image/png",
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";
      throw new Error(`ai_image_generation_failed: ${message}`);
    }
  }
}
