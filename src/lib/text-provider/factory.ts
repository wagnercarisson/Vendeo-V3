import type { TextProvider } from "./types";
import type { AiTelemetryContext } from "@/lib/ai";
import { OpenAITextProvider } from "./openai";
import { MockTextProvider } from "./mock";
import { GeminiTextProvider } from "./gemini";

/**
 * Factory de compatibilidade/teste (F46-03, D11).
 *
 * NÃO lê `TEXT_PROVIDER`/`TEXT_FALLBACK_PROVIDER` nem env-var de modelo. O
 * provider padrão continua `openai`; `mock` permanece para teste/dev. As
 * fachadas `openai`/`gemini` delegam ao gateway e exigem um
 * `AiTelemetryContext` injetado (nunca criam sink no-op internamente).
 *
 * O caminho de produção NÃO usa este factory: a rota constrói o
 * `CopyDirectorService` com o gateway padrão.
 */
export function createTextProvider(provider?: string, telemetry?: AiTelemetryContext): TextProvider {
  const resolved = provider ?? "openai";

  switch (resolved) {
    case "openai":
      return new OpenAITextProvider(telemetry as AiTelemetryContext);
    case "gemini":
      return new GeminiTextProvider(telemetry as AiTelemetryContext);
    case "mock":
      return new MockTextProvider();
    default:
      console.warn(
        `[createTextProvider] provider "${resolved}" desconhecido — usando OpenAI como fallback.`
      );
      return new OpenAITextProvider(telemetry as AiTelemetryContext);
  }
}
