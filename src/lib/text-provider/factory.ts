import type { TextProvider } from "./types";
import { OpenAITextProvider } from "./openai";
import { MockTextProvider } from "./mock";
import { GeminiTextProvider } from "./gemini";

export function createTextProvider(provider?: string): TextProvider {
  const resolved = provider ?? process.env.TEXT_PROVIDER ?? process.env.TEXT_FALLBACK_PROVIDER ?? "openai";

  switch (resolved) {
    case "openai":
      return new OpenAITextProvider();
    case "gemini":
      return new GeminiTextProvider();
    case "mock":
      return new MockTextProvider();
    default:
      console.warn(
        `[createTextProvider] provider "${resolved}" desconhecido — usando OpenAI como fallback.`
      );
      return new OpenAITextProvider();
  }
}
