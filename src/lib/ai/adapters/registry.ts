import type { AiProtocol } from "../model-resolver";
import type { AiAdapter, AiAdapterRegistry } from "../types";
import { ChatCompletionsAdapter } from "./chat-completions";
import { ResponsesAdapter } from "./responses";
import { ImagesAdapter } from "./images";
import { GeminiAdapter } from "./gemini";

/**
 * Registry de adapters por protocolo de wire (F46, D2). O gateway escolhe o
 * adapter pelo `protocol` do alvo selecionado — nunca pelo segmento/serviço.
 */
export function createDefaultAdapterRegistry(): AiAdapterRegistry {
  const adapters: Record<AiProtocol, AiAdapter> = {
    "chat-completions": new ChatCompletionsAdapter(),
    responses: new ResponsesAdapter(),
    images: new ImagesAdapter(),
    gemini: new GeminiAdapter(),
  };

  return {
    get: (protocol: AiProtocol) => adapters[protocol],
  };
}

/** Implementação padrão com os 4 adapters (chat-completions/responses/images/gemini). */
export const defaultAdapterRegistry: AiAdapterRegistry = createDefaultAdapterRegistry();
