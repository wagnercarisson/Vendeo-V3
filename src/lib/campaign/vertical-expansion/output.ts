import "server-only";

/**
 * F60.3 — Validação por conteúdo do retorno do provider e exportação vertical.
 *
 * O retorno (`images.edit`) é dado NÃO CONFIÁVEL: os bytes passam por limite de
 * tamanho, detecção de formato e checagem de dimensão/proporção no **metadata**
 * antes de qualquer decode de pixels. Só uma imagem com dimensão/proporção
 * aceitável chega ao decode completo, que aplica `limitInputPixels` explícito
 * como defesa adicional. O `returnedSize` vem do metadata — nunca copiado do
 * tamanho solicitado.
 *
 * A exportação reusa o pipeline vertical existente
 * (`resizeVerticalToJpeg1080x1920` + `verifyVerticalJpeg1080x1920`): fator único
 * 0,9375, sRGB, JPEG q90. Não há recorte, preenchimento, extensão nem
 * redimensionamento próprio. Nada é gravado em disco, Storage, banco ou provider,
 * e o bruto 1152×2048 nunca é persistido por este módulo.
 */

import sharp from "sharp";

import {
  MAX_ARTIFACT_BYTES,
  MAX_ARTIFACT_PIXELS,
} from "@/lib/campaign/composition-artifacts/role-policy";
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

/**
 * Limite explícito de pixels de entrada: o canvas exato do provider (1152×2048).
 * Qualquer imagem maior é inválida por contrato e deve ser recusada antes do
 * decode completo, sem alocar o bitmap.
 */
const PROVIDER_INPUT_PIXEL_LIMIT = 1152 * 2048;

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

function isPixelLimitError(error: unknown): boolean {
  return error instanceof Error && /pixel limit/i.test(error.message);
}

/**
 * Valida o retorno do provider por conteúdo: limite de bytes, formato
 * `jpeg`/`png`, dimensão/proporção pelo metadata e só então decode completo da
 * imagem válida. O decode aplica `limitInputPixels` explícito. Nunca lança e
 * nunca inventa `returnedSize` a partir do solicitado.
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

  let metadata: sharp.Metadata;
  try {
    metadata = await sharp(bytes, {
      failOn: "error",
      // O metadata lê apenas o header; o limite amplo evita headers absurdos e
      // permite reportar a dimensão real de imagens inválidas antes do decode.
      limitInputPixels: MAX_ARTIFACT_PIXELS,
    }).metadata();
  } catch (error) {
    return isPixelLimitError(error)
      ? invalid("dimensions_mismatch")
      : invalid("not_image");
  }

  if (
    metadata.format === undefined ||
    !ACCEPTED_PROVIDER_FORMATS.has(metadata.format)
  ) {
    return invalid("not_image");
  }

  const width = metadata.width;
  const height = metadata.height;
  if (!width || !height) {
    return invalid("decode_failed");
  }

  const returnedSize = `${width}x${height}`;

  // Rejeita dimensão/proporção antes de qualquer decode de pixels.
  if (!hasEqualAspect(width, height)) {
    return invalid("aspect_mismatch", returnedSize);
  }

  const dimensionCheck = assertProviderDimensions(width, height);
  if (!dimensionCheck.ok) {
    return invalid("dimensions_mismatch", returnedSize);
  }

  // Só a imagem dentro do contrato chega ao decode completo, com limite
  // explícito de pixels como defesa adicional contra bombs de descompressão.
  let decoded: { info: sharp.OutputInfo };
  try {
    decoded = await sharp(bytes, {
      failOn: "error",
      limitInputPixels: PROVIDER_INPUT_PIXEL_LIMIT,
    })
      .raw()
      .toBuffer({ resolveWithObject: true });
  } catch {
    return invalid("decode_failed");
  }

  // O decode real precisa confirmar o metadata; divergência não é sucesso.
  if (decoded.info.width !== width || decoded.info.height !== height) {
    return invalid(
      "dimensions_mismatch",
      `${decoded.info.width}x${decoded.info.height}`,
    );
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
