/**
 * Provider factory — instancia o provider de imagem padrão (OpenAI).
 *
 * F46-07 (D5/D8): a escolha de provider/modelo é do registry em código
 * (`src/lib/ai/model-registry.ts`); este factory NÃO lê env-var de provider.
 * O único provider implementado é OpenAI — `gemini` permanece futuro. O
 * provider apenas delega à camada única (AI Gateway).
 */

import type { ImageProvider } from "@/lib/image-generation/providers/types";
import { OpenAIImageProvider } from "@/lib/image-generation/providers/openai";

/** Cria o provider de imagem padrão (OpenAI), delegando à camada única. */
export function createImageProvider(): ImageProvider {
  return new OpenAIImageProvider();
}
