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

    const semantic = await this.validateSemantic(params.imageBase64, params.storeName);
    if (!semantic.valid) {
      return semantic;
    }

    return { valid: true };
  }

  private async validateSemantic(
    imageBase64: string,
    storeName: string
  ): Promise<{ valid: boolean; reason?: string }> {
    try {
      const { default: OpenAI } = await import("openai");
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      const model = process.env.IMAGE_VALIDATION_MODEL || "gpt-4o-mini";
      const dataUrl = `data:image/png;base64,${imageBase64}`;

      const response = await openai.responses.create({
        model,
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: `Você é um validador de assinaturas visuais profissionais para lojas.

Analise a imagem enviada e responda APENAS com um JSON válido no formato:
{"valid": true/false, "reason": "motivo se invalido"}

Critérios de rejeição (qualquer um torna inválido):
1. A imagem é apenas um círculo com iniciais/monograma (design genérico)
2. A imagem NÃO contém o nome da loja "${storeName}" de forma legível
3. A imagem parece ser um gradiente vazio, cor sólida, ou sem conteúdo relevante
4. A imagem é um placeholder genérico sem personalização
5. A imagem contém apenas texto promocional, preço, oferta ou CTA

A imagem é VÁLIDA se:
- É uma assinatura visual profissional com o nome "${storeName}" em destaque
- Tem design personalizado (não genérico)
- Pode incluir ícone, símbolo ou elemento gráfico junto com o nome
- Está pronta para ser usada como identidade visual da loja`,
              },
              {
                type: "input_image",
                image_url: dataUrl,
                detail: "low",
              },
            ],
          },
        ],
        temperature: 0.1,
        max_output_tokens: 150,
      });

      const outputText = response.output_text?.trim() || "";
      const jsonMatch = outputText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn("[validator] LLM response did not contain valid JSON, falling back to pass", { outputText });
        return { valid: true };
      }

      const result = JSON.parse(jsonMatch[0]);
      if (result.valid === false) {
        const reason = result.reason || "Semantic validation failed (LLM)";
        console.warn("[validator] LLM validation rejected", { reason, storeName });
        return { valid: false, reason: `Semantic rejection: ${reason}` };
      }

      console.log("[validator] LLM semantic validation passed", { storeName });
      return { valid: true };
    } catch (err) {
      console.warn("[validator] LLM validation error, falling back to pass", { error: err instanceof Error ? err.message : String(err) });
      return { valid: true };
    }
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

      const messageOutput = response.output?.find(
        (item): item is typeof item & { type: "message"; content: Array<{ type: string; text?: string }> } =>
          item.type === "message"
      );

      const aiResponseMessage = messageOutput?.content
        ?.filter(c => c.type === "output_text")
        .map(c => c.text ?? "")
        .join("\n");

      if (!imageOutput?.result) {
        console.log('[ai-image-generator] resposta sem image_generation output', { outputTypes: response.output?.map(o => o.type) });
        throw new Error("No image generated in Responses API response");
      }
      console.log('[ai-image-generator] image_generation output encontrado');
      if (aiResponseMessage) {
        console.log('[ai-image-generator] message output encontrado', { messageLength: aiResponseMessage.length });
      }

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
        prompt: promptUsed,
        aiResponseMessage,
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
