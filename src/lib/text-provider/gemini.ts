import type { TextProvider, TextProviderOptions, TextProviderResult } from "./types";
import { defaultAiGateway } from "@/lib/ai";
import type { AiInvocationRequest, AiInvoker, AiTelemetryContext } from "@/lib/ai";

/**
 * Fachada de compatibilidade/teste (F46-03, D11).
 *
 * NÃO instancia `new GoogleGenerativeAI()` nem lê env-var de modelo: delega à
 * camada única (gateway) no alvo de **fallback** de `campaign_copy` (default
 * `gemini` no registry). Exige um `AiTelemetryContext` injetado — nunca cria
 * `NoopAiTelemetrySink` internamente.
 */
export class GeminiTextProvider implements TextProvider {
  readonly name = "gemini";

  constructor(
    private readonly telemetry: AiTelemetryContext,
    private readonly invoker: AiInvoker = defaultAiGateway,
  ) {}

  async generateText(prompt: string, options?: TextProviderOptions): Promise<TextProviderResult> {
    const request: AiInvocationRequest = {
      prompt,
      system: options?.system,
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
    };
    if (options?.signal) {
      request.signal = options.signal;
    }

    const result = await this.invoker.invoke("campaign_copy", request, this.telemetry, "fallback");

    return {
      content: result.content ?? "",
      usage: {
        promptTokens: result.usage?.promptTokens ?? 0,
        completionTokens: result.usage?.completionTokens ?? 0,
      },
      model: result.model,
    };
  }
}
