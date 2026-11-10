/**
 * F60.1 — Validação pura de identidade, autorização e vínculo loja↔campanha.
 *
 * Sem I/O, sem `server-only`, sem Supabase. Nenhum path/bucket vindo do
 * chamador é aceito como parte da identidade.
 */

import { isArtifactRole } from "./role-policy";
import type { ArtifactIdentity, AuthorizationContext } from "./types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PATH_KEYS = ["storagePath", "path", "bucket", "storageBucket"] as const;

export type IdentityFailureReason =
  | "invalid_input"
  | "invalid_uuid"
  | "invalid_role"
  | "path_not_accepted";

export type IdentityValidation =
  | { readonly ok: true; readonly identity: ArtifactIdentity }
  | { readonly ok: false; readonly reason: IdentityFailureReason };

export type AuthorizationFailureReason =
  | "authorization_missing"
  | "authorization_invalid";

export type AuthorizationValidation =
  | { readonly ok: true; readonly authorization: AuthorizationContext }
  | { readonly ok: false; readonly reason: AuthorizationFailureReason };

export type CampaignStoreBinding =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "store_mismatch" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

/** UUID canônico, case-insensitive. */
export function isArtifactUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/**
 * Valida a identidade e recusa qualquer chave de path/bucket. O papel é
 * validado contra a fonte única `ROLE_POLICY`.
 */
export function validateArtifactIdentity(input: unknown): IdentityValidation {
  if (!isRecord(input)) {
    return Object.freeze({ ok: false as const, reason: "invalid_input" as const });
  }

  if (PATH_KEYS.some((key) => hasOwn(input, key))) {
    return Object.freeze({
      ok: false as const,
      reason: "path_not_accepted" as const,
    });
  }

  const storeId = input.storeId;
  const campaignId = input.campaignId;
  const operationId = input.operationId;
  const role = input.role;

  if (
    !isArtifactUuid(storeId) ||
    !isArtifactUuid(campaignId) ||
    !isArtifactUuid(operationId)
  ) {
    return Object.freeze({ ok: false as const, reason: "invalid_uuid" as const });
  }

  if (!isArtifactRole(role)) {
    return Object.freeze({ ok: false as const, reason: "invalid_role" as const });
  }

  return Object.freeze({
    ok: true as const,
    identity: Object.freeze({ storeId, campaignId, operationId, role }),
  });
}

/**
 * `owner` exige `userId` não vazio; `system` é uma capacidade de servidor.
 * O contexto é recebido já resolvido — este módulo não lê request/body.
 */
export function validateAuthorizationContext(
  input: unknown,
): AuthorizationValidation {
  if (input === null || input === undefined) {
    return Object.freeze({
      ok: false as const,
      reason: "authorization_missing" as const,
    });
  }
  if (!isRecord(input)) {
    return Object.freeze({
      ok: false as const,
      reason: "authorization_invalid" as const,
    });
  }

  if (input.kind === "system") {
    return Object.freeze({
      ok: true as const,
      authorization: Object.freeze({ kind: "system" as const }),
    });
  }

  if (input.kind === "owner") {
    const userId = input.userId;
    if (typeof userId !== "string" || userId.trim().length === 0) {
      return Object.freeze({
        ok: false as const,
        reason: "authorization_invalid" as const,
      });
    }
    return Object.freeze({
      ok: true as const,
      authorization: Object.freeze({ kind: "owner" as const, userId }),
    });
  }

  return Object.freeze({
    ok: false as const,
    reason: "authorization_invalid" as const,
  });
}

/** Confere o vínculo campanha→loja; nunca lança. */
export function checkCampaignStoreBinding(
  campaignStoreId: unknown,
  identityStoreId: unknown,
): CampaignStoreBinding {
  if (
    typeof campaignStoreId !== "string" ||
    typeof identityStoreId !== "string" ||
    campaignStoreId !== identityStoreId
  ) {
    return Object.freeze({ ok: false as const, reason: "store_mismatch" as const });
  }
  return Object.freeze({ ok: true as const });
}
