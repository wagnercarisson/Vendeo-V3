import type { TokenUsage } from "@/lib/ai-cost/types";
import type { AiModelTarget } from "../model-resolver";
import { getApiKey } from "../api-keys";
import { AiInvocationError } from "../types";
import type { AiAdapter, AiInvocationRequest, AiInvocationResult } from "../types";

/**
 * Adapter do protocolo `responses` (OpenAI Responses API).
 *
 * Cobre visão e a tool `image_generation`. Normaliza o breakdown granular de
 * tokens (input/output separados em text vs image) do `response.usage`,
 * espelhando o provider legado. Não decide prompt/modelo; só usa a chave via
 * `getApiKey`.
 */
export class ResponsesAdapter implements AiAdapter {
  readonly protocol = "responses" as const;

  async invoke(request: AiInvocationRequest, target: AiModelTarget): Promise<AiInvocationResult> {
    const { default: OpenAI } = await import("openai");
    const openai = new OpenAI({ apiKey: getApiKey(target.provider) });

    const content: unknown[] = [{ type: "input_text", text: request.prompt }];
    for (const url of request.productImagesDataUrls ?? []) {
      content.push({
        type: "input_image",
        image_url: url,
        detail: request.imageDetail ?? "auto",
      });
    }
    if (request.identityImageUrl) {
      content.push({ type: "input_image", image_url: request.identityImageUrl, detail: "low" });
    }

    const params: Record<string, unknown> = {
      model: target.model,
      input: [{ role: "user", content }],
    };
    if (request.temperature !== undefined) params.temperature = request.temperature;
    if (request.maxTokens !== undefined) params.max_output_tokens = request.maxTokens;
    const usesImageTool = request.tools === "image_generation";
    if (usesImageTool) {
      params.tools = [
        {
          type: "image_generation",
          size: request.size,
          quality: request.quality,
        },
      ];
    }

    const response = await openai.responses.create(params as never, {
      signal: request.signal,
      ...(request.timeout !== undefined ? { timeout: request.timeout } : {}),
    });

    const output = (response as { output?: Array<{ type?: string; result?: string }> }).output;
    const imageOutput = output?.find((item) => item.type === "image_generation_call");
    const imageBase64 = imageOutput?.result;
    const textContent = (response as { output_text?: string }).output_text;
    const rawUsage = (response as { usage?: unknown }).usage;

    // F46-05 (reabertura): quando a tool `image_generation` foi solicitada e a
    // resposta NÃO traz imagem, isso é uma FALHA de capability do caminho
    // Responses (não um sucesso sem arte) — classifica para que o gateway emita
    // envelope `failed` e o orquestrador acione o fallback `images.edit`.
    if (usesImageTool && !imageBase64) {
      throw new AiInvocationError({
        kind: "capability",
        retryable: false,
        message: "image_generation tool returned no image",
      });
    }

    return {
      content: textContent ? textContent : undefined,
      imageBase64,
      mimeType: imageBase64 ? "image/png" : undefined,
      model: target.model,
      usage: normalizeResponsesUsage(rawUsage),
      // F46-05 (reabertura): o marcador `imageGenerationTool` NÃO pode depender da
      // presença de `usage` — uma imagem bem-sucedida sem usage ainda usou a tool
      // e precisa chegar ao estimador com `imageGenerationTool: true`.
      usageMeta: {
        providerUsageSource: usesImageTool ? "responses.image_generation" : "responses",
        responsesModel: target.model,
        imageGenerationTool: usesImageTool,
        ...(rawUsage && typeof rawUsage === "object"
          ? { providerUsageRaw: rawUsage as Record<string, unknown> }
          : {}),
      },
    };
  }
}

/**
 * Normaliza o breakdown granular da Responses API (F38.1) para `TokenUsage`.
 * Input/output text vs image; cached da entrada.
 */
export function normalizeResponsesUsage(usage: unknown): TokenUsage | undefined {
  if (!usage || typeof usage !== "object") return undefined;
  const raw = usage as {
    input_tokens?: number;
    output_tokens?: number;
    input_tokens_details?: { cached_tokens?: number; text_tokens?: number; image_tokens?: number };
    output_tokens_details?: { text_tokens?: number; image_tokens?: number };
  };

  const inputDetails = raw.input_tokens_details;
  const outputDetails = raw.output_tokens_details;
  const normalized: TokenUsage = {};

  if (raw.input_tokens !== undefined) normalized.promptTokens = raw.input_tokens;
  if (raw.output_tokens !== undefined) normalized.completionTokens = raw.output_tokens;

  const total = (raw.input_tokens ?? 0) + (raw.output_tokens ?? 0);
  if (total > 0) normalized.totalTokens = total;

  if (inputDetails?.cached_tokens !== undefined) {
    normalized.cachedInputTokens = inputDetails.cached_tokens;
  }
  if (outputDetails?.image_tokens !== undefined) {
    normalized.imageTokens = outputDetails.image_tokens;
  }
  if (inputDetails?.text_tokens !== undefined) {
    normalized.inputTextTokens = inputDetails.text_tokens;
  } else if (raw.input_tokens !== undefined && inputDetails?.image_tokens !== undefined) {
    normalized.inputTextTokens = Math.max(0, raw.input_tokens - inputDetails.image_tokens);
  }
  if (inputDetails?.image_tokens !== undefined) {
    normalized.inputImageTokens = inputDetails.image_tokens;
  }
  if (outputDetails?.text_tokens !== undefined) {
    normalized.outputTextTokens = outputDetails.text_tokens;
  } else if (raw.output_tokens !== undefined && outputDetails?.image_tokens !== undefined) {
    normalized.outputTextTokens = Math.max(0, raw.output_tokens - outputDetails.image_tokens);
  }
  if (outputDetails?.image_tokens !== undefined) {
    normalized.outputImageTokens = outputDetails.image_tokens;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}
