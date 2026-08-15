import type { TokenUsage } from "@/lib/ai-cost/types";

/**
 * Input for AI image generation.
 */
export interface ImageProviderInput {
  prompt: string;
  productImageDataUrl?: string;
  /** F41 D7: lista ordenada de dataUrls das imagens do produto; posição 0 = primary. */
  productImagesDataUrls?: string[];
  identityImageUrl?: string;
  size?: "1024x1024" | "2048x2048";
  quality?: "low" | "medium" | "high" | "auto";
  signal?: AbortSignal;
  attempt?: number;
}

/**
 * Meta de auditoria do usage bruto do provider (F38.1 — Responses API
 * image_generation). Usado APENAS para auditoria/calibração — não entra em
 * nenhum cálculo; o cálculo usa o usage normalizado (`TokenUsage`).
 */
export interface ImageProviderUsageMeta {
  /** usage bruto sanitizado do provider (response.usage) — auditoria/calibração. */
  providerUsageRaw?: Record<string, unknown>;
  /** Fonte do usage: caminho Responses image_generation | Image API edit. */
  providerUsageSource?: "responses.image_generation" | "images.edit";
  /** Modelo real usado no responses.create() (mainline, ex: gpt-5.5). */
  responsesModel?: string;
  /** true quando a chamada usou a tool image_generation. */
  imageGenerationTool?: boolean;
}

/**
 * Output from AI image generation.
 */
export interface ImageProviderOutput {
  imageBase64: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  model: string;
  usage?: TokenUsage;
  /** F38.1: auditoria do usage bruto + flags do caminho de geração (não entra em cálculo). */
  usageMeta?: ImageProviderUsageMeta;
}

/**
 * Abstract provider interface for AI image generation.
 *
 * Implementations receive a validated ImageProviderInput and return
 * an ImageProviderOutput with the generated image data.
 *
 * NOTE: This is a SEPARATE interface from AIProvider (campaign-intelligence).
 * Image generation and campaign text generation are distinct capabilities
 * with different interfaces, different providers, and different fallback paths.
 */
export interface ImageProvider {
  readonly name: string;

  /**
   * Generate an image from the given input.
   * @param input - Validated input with prompt and optional product image
   * @returns A promise resolving to ImageProviderOutput with base64 image data
   */
  generateImage(input: ImageProviderInput): Promise<ImageProviderOutput>;
}
