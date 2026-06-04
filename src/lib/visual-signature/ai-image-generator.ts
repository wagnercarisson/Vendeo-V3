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
    customPrompt?: string;
  }): Promise<CascadeResult> {
    const startTime = Date.now();
    console.log('[ai-image-generator] generate() iniciado', { storeName: params.storeName, segment: params.segment, attempt: params.attempt });

    let prompt: string;
    if (params.customPrompt) {
      prompt = params.customPrompt;
      console.log('[ai-image-generator] usando customPrompt fornecido pelo Art Director');
    } else if (params.simplifiedPrompt) {
      prompt = `Crie uma imagem de assinatura visual profissional para a loja ${params.storeName}.
Segmento: ${params.segment}
Cor da marca: ${params.brandColor}
Tom: ${params.tone}
Design simples e limpo com o nome da loja em destaque.
Sem textos promocionais. Apenas a imagem PNG.`;
      console.log('[ai-image-generator] usando prompt simplificado');
    } else {
      console.log('[ai-image-generator] carregando prompt visual-signature-generator...');
      prompt = this.promptLoader.load("visual-signature-generator", {
        storeName: params.storeName,
        segment: params.segment,
        brandColor: params.brandColor,
        tone: params.tone,
      });
      console.log('[ai-image-generator] prompt carregado', { promptLength: prompt.length });
    }

    console.log('[ai-image-generator] fazendo dynamic import da OpenAI SDK...');
    const { default: OpenAI } = await import("openai");
    console.log('[ai-image-generator] OpenAI SDK importada');

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    console.log('[ai-image-generator] OpenAI client instanciado');

    const model =
      process.env.IMAGE_GENERATION_RESPONSES_MODEL || "gpt-5.5";
    console.log('[ai-image-generator] model selecionado', { model });

    const timeoutMs = Number(process.env.IMAGE_GENERATION_GLOBAL_TIMEOUT_MS) || 300000;
    console.log('[ai-image-generator] timeout config', { timeoutMs });

    try {
      console.log('[ai-image-generator] ⏳ ANTES da chamada OpenAI responses.create()', { timestamp: new Date().toISOString() });
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
        { signal: params.signal, timeout: timeoutMs }
      );
      console.log('[ai-image-generator] ✅ DEPOIS da chamada OpenAI responses.create()', { timestamp: new Date().toISOString(), elapsedMs: Date.now() - startTime });

      const imageOutput = response.output?.find(
        (
          item
        ): item is typeof item & {
          type: "image_generation_call";
          result: string;
        } => item.type === "image_generation_call"
      );

      if (!imageOutput?.result) {
        console.log('[ai-image-generator] resposta sem image_generation output', { outputTypes: response.output?.map(o => o.type) });
        throw new Error("No image generated in Responses API response");
      }
      console.log('[ai-image-generator] image_generation output encontrado');

      const imageBase64 = imageOutput.result;
      console.log('[ai-image-generator] validando imagem...', { base64Length: imageBase64.length });

      const validator = new VisualSignatureValidator();
      const validation = await validator.validate({
        imageBase64,
        storeName: params.storeName,
      });

      if (!validation.valid) {
        console.log('[ai-image-generator] validação falhou', { reason: validation.reason });
        throw new Error(
          `Image validation failed: ${validation.reason || "Unknown reason"}`
        );
      }
      console.log('[ai-image-generator] imagem validada OK');

      const buffer = Buffer.from(imageBase64, "base64");
      console.log('[ai-image-generator] fazendo upload para storage...');
      const { storagePath, assetUrl } = await uploadToStorage({
        storeId: params.storeId,
        buffer,
        mimeType: "image/png",
      });
      console.log('[ai-image-generator] upload concluído', { storagePath, assetUrl });

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

      const promptUsed = prompt;

      console.log('[ai-image-generator] ✅ fluxo completo', { elapsedMs, tier });
      return {
        tier,
        assetUrl,
        storagePath,
        mimeType: "image/png",
        metadata,
        prompt: promptUsed
      };
    } catch (error) {
      const elapsedMs = Date.now() - startTime;
      const message =
        error instanceof Error ? error.message : "Unknown error";
      console.log('[ai-image-generator] ❌ catch — erro', { elapsedMs, message, stack: error instanceof Error ? error.stack : '' });
      throw new Error(`ai_image_generation_failed: ${message}`);
    }
  }
}
