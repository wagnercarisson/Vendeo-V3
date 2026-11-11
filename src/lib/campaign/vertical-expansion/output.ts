import "server-only";

/**
 * F60.3 — Validação por conteúdo do retorno do provider e exportação vertical.
 *
 * O retorno (`images.edit`) é dado NÃO CONFIÁVEL: antes de qualquer coisa os
 * bytes passam por limite de tamanho, detecção de formato, decodificação
 * COMPLETA dos pixels e checagem de dimensão/proporção. O `returnedSize` é
 * medido dos bytes decodificados — nunca copiado do tamanho solicitado.
 *
 * A exportação reusa o pipeline vertical existente
 * (`resizeVerticalToJpeg1080x1920` + `verifyVerticalJpeg1080x1920`): fator único
 * 0,9375, sRGB, JPEG q90. Não há recorte, preenchimento, extensão nem
 * redimensionamento próprio. Nada é gravado em disco, Storage, banco ou provider,
 * e o bruto 1152×2048 nunca é persistido por este módulo.
 */

import sharp from "sharp";

import { MAX_ARTIFACT_BYTES } from "@/lib/campaign/composition-artifacts/role-policy";
import {
  PROVIDER_SIZE,
  assertProviderDimensions,
  hasEqualAspect,
} from "@/lib/product-vertical-9-16/dimensions";
import {
  VerticalResizeError,
  resizeVerticalToJpeg1080x1920,
  verifyVerticalJpeg1080x1920,
  type VerticalResizeErrorCode,
} from "@/lib/product-vertical-9-16/artifact/resize";

/** Formatos aceitos na resposta do provider (`images.edit` devolve PNG). */
const ACCEPTED_PROVIDER_FORMATS: ReadonlySet<string> = new Set(["jpeg", "png"]);

export type ProviderImageValidationReason =
  | "not_image"
  | "decode_failed"
  | "dimensions_mismatch"
  | "aspect_mismatch";

export type ProviderImageValidation =
  | {
      readonly ok: true;
      readonly width: 1152;
      readonly height: 2048;
      readonly returnedSize: "1152x2048";
    }
  | {
      readonly ok: false;
      readonly reason: ProviderImageValidationReason;
      readonly returnedSize: string | null;
    };

export type ExportVerticalJpegOutcome =
  | {
      readonly ok: true;
      readonly buffer: Buffer;
      readonly width: 1080;
      readonly height: 1920;
      readonly mimeType: "image/jpeg";
      readonly sourceWidth: 1152;
      readonly sourceHeight: 2048;
    }
  | { readonly ok: false; readonly reason: VerticalResizeErrorCode };

function invalid(
  reason: ProviderImageValidationReason,
  returnedSize: string | null = null,
): ProviderImageValidation {
  return Object.freeze({ ok: false as const, reason, returnedSize });
}

/**
 * Valida o retorno do provider por conteúdo: limite de bytes, formato
 * `jpeg`/`png`, decode completo, proporção 9:16 por inteiros e dimensão exata
 * 1152×2048. Nunca lança e nunca inventa `returnedSize` a partir do solicitado.
 */
export async function validateProviderImageBytes(
  bytes: Buffer,
): Promise<ProviderImageValidation> {
  if (
    !Buffer.isBuffer(bytes) ||
    bytes.byteLength === 0 ||
    bytes.byteLength > MAX_ARTIFACT_BYTES
  ) {
    return invalid("not_image");
  }

  let format: string | undefined;
  try {
    const metadata = await sharp(bytes, { failOn: "error" }).metadata();
    format = metadata.format;
  } catch {
    return invalid("not_image");
  }

  if (format === undefined || !ACCEPTED_PROVIDER_FORMATS.has(format)) {
    return invalid("not_image");
  }

  let width: number;
  let height: number;
  try {
    const decoded = await sharp(bytes, { failOn: "error" })
      .raw()
      .toBuffer({ resolveWithObject: true });
    width = decoded.info.width;
    height = decoded.info.height;
  } catch {
    return invalid("decode_failed");
  }

  const returnedSize = `${width}x${height}`;

  if (!hasEqualAspect(width, height)) {
    return invalid("aspect_mismatch", returnedSize);
  }

  const dimensionCheck = assertProviderDimensions(width, height);
  if (!dimensionCheck.ok) {
    return invalid("dimensions_mismatch", returnedSize);
  }

  return Object.freeze({
    ok: true as const,
    width: 1152 as const,
    height: 2048 as const,
    returnedSize: PROVIDER_SIZE,
  });
}

/**
 * Exporta o retorno válido para JPEG 1080×1920 pelo pipeline vertical existente.
 * `VerticalResizeError` é traduzido em `{ ok: false, reason }` — nunca escapa.
 */
export async function exportVerticalJpeg(bytes: Buffer): Promise<ExportVerticalJpegOutcome> {
  try {
    const resized = await resizeVerticalToJpeg1080x1920(bytes);
    await verifyVerticalJpeg1080x1920(resized.buffer);

    return Object.freeze({
      ok: true as const,
      buffer: resized.buffer,
      width: resized.width,
      height: resized.height,
      mimeType: resized.mimeType,
      sourceWidth: resized.sourceWidth,
      sourceHeight: resized.sourceHeight,
    });
  } catch (error) {
    if (error instanceof VerticalResizeError) {
      return Object.freeze({ ok: false as const, reason: error.code });
    }
    return Object.freeze({ ok: false as const, reason: "source_decode_failed" as const });
  }
}
