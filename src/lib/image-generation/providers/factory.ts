/**
 * Provider factory — selects image provider based on IMAGE_PROVIDER env var.
 *
 * Supported values:
 *   "openai" (default) — OpenAIImageProvider
 *   "gemini" (future)  — not yet implemented
 *
 * Unrecognized values log a warning and fall back to OpenAI at runtime
 * (graceful degradation, does not block generation).
 */

import { IMAGE_PROVIDER } from "@/lib/image-generation/config";
import type { ImageProvider } from "@/lib/image-generation/providers/types";
import { OpenAIImageProvider } from "@/lib/image-generation/providers/openai";

/**
 * Create an ImageProvider instance based on the IMAGE_PROVIDER env var.
 * Defaults to OpenAIImageProvider when the env var is unset, empty,
 * or contains an unrecognized value.
 */
export function createImageProvider(): ImageProvider {
  const provider = IMAGE_PROVIDER;

  switch (provider) {
    case "openai":
      return new OpenAIImageProvider();
    default:
      console.warn(
        `[createImageProvider] provider "${provider}" desconhecido — usando OpenAI como fallback.`
      );
      return new OpenAIImageProvider();
  }
}
