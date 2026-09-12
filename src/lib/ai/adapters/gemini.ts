import { AuthConfigError, MalformedResponseError } from "@/lib/copy/errors";
import type { TokenUsage } from "@/lib/ai-cost/types";
import type { AiModelTarget } from "../model-resolver";
import { getApiKey } from "../api-keys";
import type { AiAdapter, AiInvocationRequest, AiInvocationResult } from "../types";

/**
 * Adapter do protocolo `gemini` (`GoogleGenerativeAI.generateContent`).
 *
 * Normaliza `usageMetadata`. Propaga `AbortSignal` via `SingleRequestOptions`.
 * Não decide prompt/modelo; usa apenas a chave via `getApiKey`.
 */
export class GeminiAdapter implements AiAdapter {
  readonly protocol = "gemini" as const;

  async invoke(request: AiInvocationRequest, target: AiModelTarget): Promise<AiInvocationResult> {
    const apiKey = getApiKey(target.provider);
    if (!apiKey) {
      throw new AuthConfigError("GEMINI_API_KEY não configurada");
    }

    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: target.model,
      systemInstruction: request.system,
    });

    const result = await model.generateContent(
      {
        contents: [{ role: "user", parts: [{ text: request.prompt }] }],
        generationConfig: {
          temperature: request.temperature,
          maxOutputTokens: request.maxTokens,
        },
      },
      { signal: request.signal },
    );

    const response = result.response;
    const text = response.text();
    if (!text) {
      throw new MalformedResponseError("Gemini retornou resposta vazia");
    }

    return {
      content: text,
      model: target.model,
      usage: normalizeGeminiUsage(response.usageMetadata),
    };
  }
}

/** Normaliza `usageMetadata` do Gemini para o `TokenUsage` canônico. */
export function normalizeGeminiUsage(usage: unknown): TokenUsage | undefined {
  if (!usage || typeof usage !== "object") return undefined;
  const raw = usage as {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };

  const normalized: TokenUsage = {};
  if (raw.promptTokenCount !== undefined) normalized.promptTokens = raw.promptTokenCount;
  if (raw.candidatesTokenCount !== undefined) normalized.completionTokens = raw.candidatesTokenCount;
  if (raw.totalTokenCount !== undefined) normalized.totalTokens = raw.totalTokenCount;

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}
