import "server-only";

import { createHash } from "node:crypto";
import sharp from "sharp";

import {
  MAX_ARTIFACT_BYTES,
  MAX_ARTIFACT_PIXELS,
  checkRolePolicy,
  isArtifactRole,
} from "./role-policy";
import type { ArtifactRole } from "./types";

export type IntegrityFailureReason =
  | "unsupported_role"
  | "byte_limit_exceeded"
  | "pixel_limit_exceeded"
  | "not_jpeg"
  | "decode_failed"
  | "dimension_mismatch"
  | "mime_not_jpeg";

export type IntegrityResult =
  | {
      readonly ok: true;
      readonly width: number;
      readonly height: number;
      readonly mimeType: "image/jpeg";
      readonly byteSize: number;
      readonly checksumSha256: string;
    }
  | { readonly ok: false; readonly reason: IntegrityFailureReason };

/** SHA-256 hexadecimal minúsculo dos bytes efetivamente gravados. */
export function computeChecksumSha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Verifica o artefato por CONTEÚDO: limites antes do decode, formato JPEG,
 * limite de pixels pelo header e decode COMPLETO de pixels.
 */
export async function verifyCompositionArtifactBytes(
  bytes: Buffer,
  role: ArtifactRole | string,
): Promise<IntegrityResult> {
  if (!isArtifactRole(role)) {
    return Object.freeze({ ok: false as const, reason: "unsupported_role" as const });
  }

  if (
    !Buffer.isBuffer(bytes) ||
    bytes.byteLength === 0 ||
    bytes.byteLength > MAX_ARTIFACT_BYTES
  ) {
    return Object.freeze({
      ok: false as const,
      reason: "byte_limit_exceeded" as const,
    });
  }

  let metadata: { format?: string; width?: number; height?: number };
  try {
    metadata = await sharp(bytes).metadata();
  } catch {
    return Object.freeze({ ok: false as const, reason: "not_jpeg" as const });
  }

  if (metadata.format !== "jpeg") {
    return Object.freeze({ ok: false as const, reason: "not_jpeg" as const });
  }

  const declaredWidth = metadata.width;
  const declaredHeight = metadata.height;
  if (!declaredWidth || !declaredHeight) {
    return Object.freeze({ ok: false as const, reason: "decode_failed" as const });
  }

  if (declaredWidth * declaredHeight > MAX_ARTIFACT_PIXELS) {
    return Object.freeze({
      ok: false as const,
      reason: "pixel_limit_exceeded" as const,
    });
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
    return Object.freeze({ ok: false as const, reason: "decode_failed" as const });
  }

  const policy = checkRolePolicy(role, width, height, "image/jpeg");
  if (!policy.ok) {
    const reason: IntegrityFailureReason =
      policy.reason === "mime_not_jpeg"
        ? "mime_not_jpeg"
        : policy.reason === "pixel_limit_exceeded"
          ? "pixel_limit_exceeded"
          : "dimension_mismatch";
    return Object.freeze({ ok: false as const, reason });
  }

  return Object.freeze({
    ok: true as const,
    width,
    height,
    mimeType: "image/jpeg" as const,
    byteSize: bytes.byteLength,
    checksumSha256: computeChecksumSha256(bytes),
  });
}
