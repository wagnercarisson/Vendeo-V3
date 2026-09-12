import type { TokenUsage } from "@/lib/ai-cost/types";
import type { AiModelTarget } from "../model-resolver";
import { getApiKey } from "../api-keys";
import type { AiAdapter, AiInvocationRequest, AiInvocationResult } from "../types";

/**
 * Adapter do protocolo `chat-completions` (OpenAI Chat Completions).
 *
 * Cobre texto, visão e JSON mode/structured outputs. O adapter conhece apenas
 * o shape do protocolo — não decide prompt, modelo ou regra de negócio (o
 * modelo vem do `target` resolvido pelo gateway; o prompt vem do caller).
 * Nenhuma env-var de modelo/provider é lida aqui (só a chave via `getApiKey`).
 */
export class ChatCompletionsAdapter implements AiAdapter {
  readonly protocol = "chat-completions" as const;

  async invoke(request: AiInvocationRequest, target: AiModelTarget): Promise<AiInvocationResult> {
    const { default: OpenAI } = await import("openai");
    const openai = new OpenAI({ apiKey: getApiKey(target.provider) });

    const params: Record<string, unknown> = {
      model: target.model,
      messages: buildMessages(request),
    };
    if (request.temperature !== undefined) params.temperature = request.temperature;
    if (request.maxTokens !== undefined) params.max_tokens = request.maxTokens;

    if (request.responseFormat === "json_schema" && request.jsonSchema) {
      const { zodResponseFormat } = await import("openai/helpers/zod");
      params.response_format = zodResponseFormat(
        request.jsonSchema.schema as never,
        request.jsonSchema.name,
      );
    } else if (request.responseFormat === "json_object") {
      params.response_format = { type: "json_object" };
    }

    const response = await openai.chat.completions.create(params as never, {
      signal: request.signal,
    });
    const content = response.choices?.[0]?.message?.content ?? "";

    return {
      content,
      model: target.model,
      usage: normalizeChatUsage(response.usage),
    };
  }
}

function buildMessages(request: AiInvocationRequest): unknown[] {
  if (request.messages && request.messages.length > 0) {
    return request.messages.map((message) => ({ role: message.role, content: message.content }));
  }

  const messages: unknown[] = [];
  if (request.system) {
    messages.push({ role: "system", content: request.system });
  }

  const productImages = request.productImagesDataUrls ?? [];
  if (productImages.length > 0 || request.identityImageUrl) {
    const content: unknown[] = [{ type: "text", text: request.prompt }];
    for (const url of productImages) {
      content.push({
        type: "image_url",
        image_url: request.imageDetail ? { url, detail: request.imageDetail } : { url },
      });
    }
    if (request.identityImageUrl) {
      content.push({ type: "image_url", image_url: { url: request.identityImageUrl } });
    }
    messages.push({ role: "user", content });
  } else {
    messages.push({ role: "user", content: request.prompt });
  }

  return messages;
}

/** Normaliza `usage` do Chat Completions para o `TokenUsage` canônico. */
export function normalizeChatUsage(usage: unknown): TokenUsage | undefined {
  if (!usage || typeof usage !== "object") return undefined;
  const raw = usage as {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    prompt_tokens_details?: { cached_tokens?: number };
  };

  const normalized: TokenUsage = {};
  if (raw.prompt_tokens !== undefined) normalized.promptTokens = raw.prompt_tokens;
  if (raw.completion_tokens !== undefined) normalized.completionTokens = raw.completion_tokens;
  if (raw.total_tokens !== undefined) normalized.totalTokens = raw.total_tokens;
  if (raw.prompt_tokens_details?.cached_tokens !== undefined) {
    normalized.cachedInputTokens = raw.prompt_tokens_details.cached_tokens;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}
