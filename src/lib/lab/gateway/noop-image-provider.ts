import type { ImageProvider, ImageProviderInput, ImageProviderOutput } from "@/lib/image-generation/providers/types";

/**
 * Provider de imagem no-op do Laboratório de IA (F48.1, D7/DV-4).
 *
 * O construtor de `ImageGenerationService` exige um `ImageProvider` como
 * primeiro parâmetro. O laboratório só precisa do **seam de montagem de prompt**
 * (`buildDirectorPrompt`) e invoca a capacidade `campaign_image` **direto no
 * gateway** — nunca por este provider.
 *
 * Este stub existe apenas para satisfazer o construtor. Se qualquer caminho o
 * invocar, ele **lança imediatamente**: a falha é a prova de que o provider de
 * imagem não é usado no run (sem fallback automático, sem segunda chamada paga).
 */

/** Código determinístico da invocação indevida do stub. */
export const LAB_NOOP_IMAGE_PROVIDER_INVOKED = "lab_noop_image_provider_invoked";

export function createNoopImageProvider(): ImageProvider {
  return {
    name: "lab-noop-image-provider",
    generateImage(_input: ImageProviderInput): Promise<ImageProviderOutput> {
      throw new Error(LAB_NOOP_IMAGE_PROVIDER_INVOKED);
    },
  };
}
