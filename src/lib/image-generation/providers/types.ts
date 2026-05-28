/**
 * Input for AI image generation.
 */
export interface ImageProviderInput {
  prompt: string;
  productImageDataUrl?: string;
  size?: "1024x1024" | "2048x2048";
  quality?: "low" | "medium" | "high" | "auto";
}

/**
 * Output from AI image generation.
 */
export interface ImageProviderOutput {
  imageBase64: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  model: string;
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
