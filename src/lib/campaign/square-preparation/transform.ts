import "server-only";

import sharp from "sharp";

import { verifyCompositionArtifactBytes } from "@/lib/campaign/composition-artifacts/integrity";

import {
  SQUARE_PREPARATION_RECIPE,
  SQUARE_PREPARATION_SOURCE,
  SQUARE_PREPARATION_TARGET,
} from "./recipe";

/**
 * F60.2 (quick 261111-idz) — Pipeline Sharp 1024×1024 → 1152×1152.
 *
 * Entrada: JPEG 1024×1024 exato. Saída: JPEG 1152×1152 exato.
 * A conversão é um único fator de escala (9/8 = 1,125) nos dois eixos: sem crop,
 * sem pad, sem barra e sem fundo.
 *
 * NÃO-GARANTIAS: a saída JPEG q90 NÃO é lossless nem pixel-idêntica — é
 * reamostragem com perda. A fidelidade garantida é de geometria dentro da
 * tolerância do Lanczos3 + quantização JPEG. A reprodutibilidade byte-a-byte
 * depende do build de libvips/Sharp; uma troca de versão pode produzir outro
 * checksum e a F60.1 responde `content_conflict` sem sobrescrever.
 *
 * PROIBIDO neste pipeline (e ausente de propósito): auto-orientação por EXIF,
 * cópia de EXIF/ICC, achatamento sobre fundo, expansão/redução de canvas,
 * recorte por extração e qualquer edição criativa. Nenhum caminho lança: todo
 * erro é retorno tipado.
 */

export type SquareTransformFailureReason =
  | "source_not_jpeg"
  | "source_dimension_mismatch"
  | "source_decode_failed"
  | "output_verification_failed";

export type SquareTransformResult =
  | {
      readonly ok: true;
      readonly bytes: Buffer;
      readonly width: 1152;
      readonly height: 1152;
      readonly mimeType: "image/jpeg";
    }
  | {
      readonly ok: false;
      readonly reason: SquareTransformFailureReason;
      readonly detail?: string;
    };

function fail(
  reason: SquareTransformFailureReason,
  detail?: string,
): SquareTransformResult {
  return detail === undefined
    ? Object.freeze({ ok: false as const, reason })
    : Object.freeze({ ok: false as const, reason, detail });
}

export async function transformSquare1024To1152(
  bytes: Buffer,
): Promise<SquareTransformResult> {
  // (a) Buffer não vazio.
  if (!Buffer.isBuffer(bytes) || bytes.length === 0) {
    return fail("source_decode_failed");
  }

  // (b) Formato real declarado pelo decoder.
  let metadata: sharp.Metadata;
  try {
    metadata = await sharp(bytes, { failOn: "error" }).metadata();
  } catch {
    return fail("source_decode_failed");
  }
  if (metadata.format !== "jpeg") {
    return fail("source_not_jpeg");
  }

  // (c) Dimensão exata do papel `square_original`, derivada de ROLE_POLICY.
  if (
    metadata.width !== SQUARE_PREPARATION_SOURCE.width ||
    metadata.height !== SQUARE_PREPARATION_SOURCE.height
  ) {
    return fail("source_dimension_mismatch");
  }

  // (d) Decode COMPLETO da fonte: detecta truncamento que `metadata()` não vê.
  try {
    await sharp(bytes, { failOn: "error" })
      .raw()
      .toBuffer({ resolveWithObject: true });
  } catch {
    return fail("source_decode_failed");
  }

  // (e) Pipeline fechado da receita.
  let output: Buffer;
  try {
    output = await sharp(bytes, { failOn: "error" })
      .resize(SQUARE_PREPARATION_TARGET.width, SQUARE_PREPARATION_TARGET.height, {
        fit: SQUARE_PREPARATION_RECIPE.fit,
        kernel: SQUARE_PREPARATION_RECIPE.kernel,
      })
      .toColorspace(SQUARE_PREPARATION_RECIPE.colorspace)
      .jpeg({
        quality: SQUARE_PREPARATION_RECIPE.jpeg.quality,
        chromaSubsampling: SQUARE_PREPARATION_RECIPE.jpeg.chromaSubsampling,
        progressive: SQUARE_PREPARATION_RECIPE.jpeg.progressive,
        optimiseCoding: SQUARE_PREPARATION_RECIPE.jpeg.optimiseCoding,
        mozjpeg: SQUARE_PREPARATION_RECIPE.jpeg.mozjpeg,
      })
      .toBuffer();
  } catch {
    return fail("source_decode_failed");
  }

  // (f) Verificação F60.1 do OUTPUT: limites + formato + decode completo +
  // política do papel `square_prepared`.
  const integrity = await verifyCompositionArtifactBytes(
    output,
    SQUARE_PREPARATION_TARGET.role,
  );
  if (!integrity.ok) {
    return fail("output_verification_failed", integrity.reason);
  }

  return Object.freeze({
    ok: true as const,
    bytes: output,
    width: SQUARE_PREPARATION_TARGET.width,
    height: SQUARE_PREPARATION_TARGET.height,
    mimeType: SQUARE_PREPARATION_TARGET.mimeType,
  });
}
