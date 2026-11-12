import "server-only";

import { defaultAiModelResolver } from "@/lib/ai";
import { ChatCompletionsAdapter } from "@/lib/ai/adapters/chat-completions";
import { GeminiAdapter } from "@/lib/ai/adapters/gemini";
import { ResponsesAdapter } from "@/lib/ai/adapters/responses";
import { AiGateway, type AiInvoker } from "@/lib/ai/gateway";
import type { AiModelResolver } from "@/lib/ai/model-resolver";
import type { AiAdapterRegistry } from "@/lib/ai/types";

/**
 * F60.4 — invoker DEDICADO da copy da base quadrada.
 *
 * O caminho produtivo da copy usa um gateway cujo registry não permite retry
 * HTTP oculto do SDK:
 *
 * - `chat-completions` e `responses` são construídos com `maxRetries: 0`
 *   (opção ADITIVA dos adapters de texto; o default sem a opção permanece
 *   byte-idêntico);
 * - `gemini` usa o adapter existente, cuja execução é uma única
 *   `generateContent` (o SDK não possui camada de retry);
 * - o protocolo de imagem NUNCA é registrado: a copy só fala texto.
 *
 * O gateway e o registry padrão do produto permanecem intocados — apenas este
 * módulo compõe a instância no-retry. O resolver é injetável para testes; em
 * produção usa o resolver persistido compartilhado (somente leitura).
 */

export interface SquareBaseCopyInvokerDeps {
  /** Resolver de modelo (default: o resolver persistido do produto). */
  readonly resolver?: AiModelResolver;
}

/** Registry no-retry do módulo (texto apenas). */
function createSquareBaseCopyAdapterRegistry(): AiAdapterRegistry {
  return {
    get: (protocol) => {
      if (protocol === "chat-completions") {
        return new ChatCompletionsAdapter({ maxRetries: 0 });
      }
      if (protocol === "responses") {
        return new ResponsesAdapter({ maxRetries: 0 });
      }
      if (protocol === "gemini") {
        return new GeminiAdapter();
      }
      return undefined;
    },
  };
}

/** Cria um invoker de copy no-retry vinculado ao resolver informado. */
export function createSquareBaseCopyInvoker(
  deps: SquareBaseCopyInvokerDeps = {},
): AiInvoker {
  return new AiGateway(
    deps.resolver ?? defaultAiModelResolver,
    createSquareBaseCopyAdapterRegistry(),
  );
}

/** Instância de produção do invoker de copy (resolver padrão, registry no-retry). */
export const squareBaseCopyInvoker: AiInvoker = createSquareBaseCopyInvoker();
