import "server-only";

import sharp from "sharp";

import {
  DELIVERED_HEIGHT,
  DELIVERED_WIDTH,
  assertProviderDimensions,
  hasEqualAspect,
} from "../dimensions";

/**
 * F59 — Pipeline da arte vertical 9:16.
 *
 * Fonte exigida: exatamente 1152×2048 (dimensão devolvida pelo provider).
 * Entrega: JPEG sRGB 1080×1920, qualidade 90, redução proporcional por fator
 * único 0,9375. Sem upscale, crop, pad, ajuste com fundo ou faixas.
 *
 * A verificação final é por DECODE COMPLETO dos pixels, não apenas extensão ou
 * metadados de header.
 */

export type VerticalResizeErrorCode =
  | "source_decode_failed"
  | "source_dimension_mismatch"
  | "source_aspect_mismatch"
  | "artifact_format_not_jpeg"
  | "artifact_dimension_mismatch";

export class VerticalResizeError extends Error {
  constructor(
    public readonly code: VerticalResizeErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "VerticalResizeError";
  }
}

export interface VerticalJpegResult {
  readonly buffer: Buffer;
  readonly width: 1080;
  readonly height: 1920;
  readonly mimeType: "image/jpeg";
  readonly sourceWidth: 1152;
  readonly sourceHeight: 2048;
}

export interface VerifiedVerticalJpeg {
  readonly width: number;
  readonly height: number;
  readonly mimeType: "image/jpeg";
}

function mapDimensionError(reason: string): VerticalResizeError {
  if (reason === "provider_aspect_mismatch") {
    return new VerticalResizeError("source_aspect_mismatch");
  }
  return new VerticalResizeError("source_dimension_mismatch");
}

/**
 * Verifica o JPEG entregue por decode completo: formato real `jpeg`, 1080×1920.
 */
export async function verifyVerticalJpeg1080x1920(
  buffer: Buffer,
): Promise<VerifiedVerticalJpeg> {
  let metadata: sharp.Metadata;
  try {
    metadata = await sharp(buffer, { failOn: "error" }).metadata();
  } catch {
    throw new VerticalResizeError("artifact_format_not_jpeg");
  }
  if (metadata.format !== "jpeg") {
    throw new VerticalResizeError("artifact_format_not_jpeg");
  }

  let decoded: { info: sharp.OutputInfo };
  try {
    decoded = await sharp(buffer, { failOn: "error" })
      .raw()
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw new VerticalResizeError("artifact_dimension_mismatch");
  }

  if (
    decoded.info.width !== DELIVERED_WIDTH ||
    decoded.info.height !== DELIVERED_HEIGHT
  ) {
    throw new VerticalResizeError("artifact_dimension_mismatch");
  }

  return {
    width: decoded.info.width,
    height: decoded.info.height,
    mimeType: "image/jpeg",
  };
}

/**
 * Reduz 1152×2048 → 1080×1920 por fator único (0,9375), converte para sRGB e
 * codifica JPEG q90. Falha fechada para qualquer outra fonte.
 */
export async function resizeVerticalToJpeg1080x1920(
  input: Buffer,
): Promise<VerticalJpegResult> {
  if (!Buffer.isBuffer(input) || input.length === 0) {
    throw new VerticalResizeError("source_decode_failed");
  }

  let metadata: sharp.Metadata;
  try {
    metadata = await sharp(input, { failOn: "error" }).metadata();
  } catch {
    throw new VerticalResizeError("source_decode_failed");
  }
  if (!metadata.width || !metadata.height) {
    throw new VerticalResizeError("source_decode_failed");
  }

  const check = assertProviderDimensions(metadata.width, metadata.height);
  if (!check.ok) throw mapDimensionError(check.reason);
  if (!hasEqualAspect(metadata.width, metadata.height)) {
    throw new VerticalResizeError("source_aspect_mismatch");
  }

  // Decode completo da fonte: detecta truncamento que `metadata()` não vê.
  try {
    await sharp(input, { failOn: "error" })
      .raw()
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw new VerticalResizeError("source_decode_failed");
  }

  let output: Buffer;
  try {
    output = await sharp(input, { failOn: "error" })
      .resize(DELIVERED_WIDTH, DELIVERED_HEIGHT, {
        fit: "fill",
        kernel: "lanczos3",
      })
      .toColorspace("srgb")
      .jpeg({ quality: 90, chromaSubsampling: "4:4:4" })
      .toBuffer();
  } catch {
    throw new VerticalResizeError("source_decode_failed");
  }

  const verified = await verifyVerticalJpeg1080x1920(output);

  return Object.freeze({
    buffer: output,
    width: DELIVERED_WIDTH,
    height: DELIVERED_HEIGHT,
    mimeType: "image/jpeg",
    sourceWidth: 1152,
    sourceHeight: 2048,
  });
}
