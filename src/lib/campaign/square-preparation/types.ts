/**
 * F60.2 (quick 261111-idz) — Contrato puro da preparação determinística 1024→1152.
 *
 * Este módulo é puro: não importa `server-only`, `sharp`, Supabase nem
 * `node:crypto`. Ele apenas reusa os tipos da F60.1 e descreve a entrada e a
 * união discriminada de resultado. Nenhum papel, formato, limite de bytes/pixels
 * ou motivo de integridade é redefinido aqui.
 */

import type {
  ArtifactRecord,
  AuthorizationContext,
} from "@/lib/campaign/composition-artifacts/types";

/** Identidade da fonte: sempre o quadrado original interno (1024×1024 JPEG). */
export interface PrepareSquareSourceIdentity {
  readonly storeId: string;
  readonly campaignId: string;
  readonly operationId: string;
  readonly role: "square_original";
}

export interface PrepareSquareInput {
  readonly source: PrepareSquareSourceIdentity;
  readonly preparedOperationId: string;
  readonly authorization: AuthorizationContext;
}

export type PrepareSquareInvalidReason =
  | "source_identity_invalid"
  | "prepared_identity_invalid"
  | "source_role_not_original"
  | "prepared_operation_missing"
  | "authorization_missing"
  | "authorization_invalid"
  | "path_not_accepted"
  | "url_not_accepted";

export type PrepareSquareResult =
  | {
      readonly kind: "prepared";
      readonly artifact: ArtifactRecord;
      readonly bytes: Buffer;
      readonly persistence: "created" | "reused";
    }
  | { readonly kind: "invalid_input"; readonly reason: PrepareSquareInvalidReason }
  | {
      readonly kind: "authorization_denied";
      readonly reason: "not_owner" | "store_mismatch" | "identity_conflict";
    }
  | {
      readonly kind: "source_unavailable";
      readonly reason: "absent" | "invalid" | "indeterminate" | "metadata_conflict";
      readonly detail?: string;
      readonly artifact?: ArtifactRecord;
    }
  | {
      readonly kind: "transform_failed";
      readonly reason:
        | "source_not_jpeg"
        | "source_dimension_mismatch"
        | "source_decode_failed"
        | "output_verification_failed";
      readonly detail?: string;
    }
  | {
      readonly kind: "conflict";
      readonly reason:
        | "content_conflict"
        | "identity_conflict"
        | "metadata_conflict"
        | "provenance_conflict";
      readonly detail: string;
      readonly existing: ArtifactRecord | null;
    }
  | {
      readonly kind: "persistence_failed";
      readonly reason: "integrity_failure" | "persistence_failure" | "invalid_input";
      readonly detail: string;
      readonly storagePath?: string;
    }
  | {
      readonly kind: "readback_failed";
      readonly reason: "absent" | "invalid" | "indeterminate" | "metadata_conflict";
      readonly detail?: string;
      readonly artifact?: ArtifactRecord;
    }
  | { readonly kind: "indeterminate"; readonly stage: "persist" };
