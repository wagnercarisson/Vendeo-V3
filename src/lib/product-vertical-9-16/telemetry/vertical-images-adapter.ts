import "server-only";

import sharp from "sharp";

import { UpstreamImagesAdapter } from "@/lib/ai/adapters/upstream-images";
import type {
  AiAdapter,
  AiInvocationRequest,
  AiInvocationResult,
  AiModelTarget,
} from "@/lib/ai/types";

/**
 * F59/D-16 — adapter de imagens do vertical.
 *
 * Envolve o adapter `images` existente SEM alterar o 1:1: os bytes devolvidos são
 * decodificados para registrar `returnedSize` REAL. Em falha/timeout o adapter
 * base lança antes de produzir bytes e nenhum metadata é inventado (o outcome é
 * coberto pelo decorador do sink).
 */
export class VerticalImagesAdapter implements AiAdapter {
  readonly protocol: AiAdapter["protocol"];

  constructor(private readonly base: AiAdapter = new UpstreamImagesAdapter()) {
    this.protocol = base.protocol;
  }

  async invoke(
    request: AiInvocationRequest,
    target: AiModelTarget,
  ): Promise<AiInvocationResult> {
    const result = await this.base.invoke(request, target);
    if (typeof result.imageBase64 !== "string" || result.imageBase64.length === 0) {
      return result;
    }

    let returnedSize: string | null = null;
    try {
      const meta = await sharp(Buffer.from(result.imageBase64, "base64")).metadata();
      returnedSize =
        typeof meta.width === "number" && typeof meta.height === "number"
          ? `${meta.width}x${meta.height}`
          : null;
    } catch {
      // Dimensão desconhecida é `null` — nunca bloqueia a geração nem copia o
      // tamanho solicitado.
      returnedSize = null;
    }

    return {
      ...result,
      metadata: {
        ...(result.metadata ?? {}),
        returnedSize,
      },
    };
  }
}
