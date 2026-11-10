/**
 * F60.1 — Política pura de papel, formato, dimensão e MIME.
 *
 * Sem I/O, sem `server-only`, sem `sharp`, sem Supabase. A tabela é fechada e
 * fail-closed; qualquer papel/dimensão/MIME fora do contrato é recusado.
 */

import type { ArtifactFormat, ArtifactRole } from "./types";

export interface RolePolicyEntry {
  readonly format: ArtifactFormat;
  readonly width: number;
  readonly height: number;
  readonly mimeType: "image/jpeg";
}

export const ROLE_POLICY = Object.freeze({
  square_original: Object.freeze({
    format: "1:1",
    width: 1024,
    height: 1024,
    mimeType: "image/jpeg",
  }),
  square_prepared: Object.freeze({
    format: "1:1",
    width: 1152,
    height: 1152,
    mimeType: "image/jpeg",
  }),
  vertical: Object.freeze({
    format: "9:16",
    width: 1080,
    height: 1920,
    mimeType: "image/jpeg",
  }),
} as const satisfies Record<ArtifactRole, RolePolicyEntry>);

/** Limite do bucket `campaign-internal-artifacts` (10 MB). */
export const MAX_ARTIFACT_BYTES = 10_485_760 as const;

/** Limite conservador de pixels para a decodificação completa. */
export const MAX_ARTIFACT_PIXELS = 16_777_216 as const;

export type RolePolicyFailureReason =
  | "unsupported_role"
  | "dimension_mismatch"
  | "mime_not_jpeg"
  | "format_mismatch"
  | "pixel_limit_exceeded";

export type RolePolicyCheck =
  | { readonly ok: true; readonly format: ArtifactFormat }
  | { readonly ok: false; readonly reason: RolePolicyFailureReason };

/** `true` somente para os três papéis conhecidos. */
export function isArtifactRole(value: unknown): value is ArtifactRole {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(ROLE_POLICY, value)
  );
}

/**
 * Valida dimensão/MIME de um papel. A ordem é explícita:
 * papel → MIME → limite de pixels → dimensão exata.
 */
export function checkRolePolicy(
  role: string,
  width: number,
  height: number,
  mimeType: string,
): RolePolicyCheck {
  if (!isArtifactRole(role)) {
    return Object.freeze({ ok: false as const, reason: "unsupported_role" as const });
  }

  const policy = ROLE_POLICY[role];

  if (mimeType !== policy.mimeType) {
    return Object.freeze({ ok: false as const, reason: "mime_not_jpeg" as const });
  }

  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    width * height > MAX_ARTIFACT_PIXELS
  ) {
    return Object.freeze({
      ok: false as const,
      reason: "pixel_limit_exceeded" as const,
    });
  }

  if (width !== policy.width || height !== policy.height) {
    return Object.freeze({
      ok: false as const,
      reason: "dimension_mismatch" as const,
    });
  }

  return Object.freeze({ ok: true as const, format: policy.format });
}
