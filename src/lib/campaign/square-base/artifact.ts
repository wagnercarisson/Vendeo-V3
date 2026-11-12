import "server-only";

/**
 * F60.4 — Conversão e persistência do `square_original` pela F60.1.
 *
 * Pipeline (design D3 / T-60.4-12):
 * data URL → `dataUrlToCampaignImage` → validação de dimensão/formato por Sharp
 * → `resizeToJpeg1024` → `persistCompositionArtifact` (origem
 * `provider_generation`, `source: { kind: "none" }`, `provenance: {}`) →
 * `retrieveCompositionArtifact` (única fonte autoritativa de artefato/bytes).
 *
 * A validação de dimensão ANTES do resize evita barras brancas silenciosas: uma
 * imagem 900×1024 ou 2048×1024 é recusada como `resize_failed`, nunca
 * convertida com `contain` para 1024×1024. O membro público
 * `invalid_output.reason` usa apenas a união fechada
 * `empty_image | decode_failed | resize_failed`; motivos internos vivem em
 * `detail`.
 *
 * Nenhum ramo executa upload, remoção, atualização, URL assinada ou URL
 * pública diretamente.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";

import { supabaseAdmin } from "@/lib/supabase/server";

import { dataUrlToCampaignImage } from "@/lib/campaign/persistence";
import { persistCompositionArtifact } from "@/lib/campaign/composition-artifacts/persist";
import { retrieveCompositionArtifact } from "@/lib/campaign/composition-artifacts/retrieve";
import type {
  ArtifactIdentity,
  ArtifactRecord,
  AuthorizationContext,
  PersistArtifactResult,
} from "@/lib/campaign/composition-artifacts/types";
import { resizeToJpeg1024 } from "@/lib/product-1-1/artifact/artifact-store";

import { SQUARE_BASE_ORIGIN, SQUARE_BASE_TARGET } from "./policy";
import type { ArtOutcome } from "./types";

const SUPPORTED_PROVIDER_FORMATS = new Set(["jpeg", "png", "webp"]);

export type ConvertProviderImageFailureReason =
  | "empty_image"
  | "decode_failed"
  | "resize_failed";

export type ConvertProviderImageFailureDetail =
  | "not_image"
  | "dimensions_mismatch"
  | "aspect_mismatch"
  | "decode_threw"
  | "resize_threw";

export type ConvertProviderImageResult =
  | {
      readonly ok: true;
      readonly bytes: Buffer;
      readonly width: number;
      readonly height: number;
      readonly mimeType: "image/jpeg";
    }
  | {
      readonly ok: false;
      readonly reason: ConvertProviderImageFailureReason;
      readonly detail?: ConvertProviderImageFailureDetail;
    };

export interface ConvertProviderImageInput {
  readonly imageBase64: string;
  readonly mimeType?: string;
}

export interface ConvertProviderImageDeps {
  readonly resize?: typeof resizeToJpeg1024;
}

function failure(
  reason: ConvertProviderImageFailureReason,
  detail?: ConvertProviderImageFailureDetail,
): ConvertProviderImageResult {
  return detail === undefined
    ? Object.freeze({ ok: false as const, reason })
    : Object.freeze({ ok: false as const, reason, detail });
}

/**
 * Converte o retorno do provider em JPEG 1024×1024. Nunca lança: toda recusa é
 * um membro fechado.
 */
export async function convertProviderImage(
  input: ConvertProviderImageInput,
  deps: ConvertProviderImageDeps = {},
): Promise<ConvertProviderImageResult> {
  if (
    typeof input.imageBase64 !== "string" ||
    input.imageBase64.trim().length === 0
  ) {
    return failure("empty_image");
  }

  const mimeType =
    typeof input.mimeType === "string" && input.mimeType.length > 0
      ? input.mimeType
      : "image/png";
  const dataUrl = `data:${mimeType};base64,${input.imageBase64}`;

  let decoded: { buffer: Buffer; mimeType: string };
  try {
    decoded = dataUrlToCampaignImage(dataUrl);
  } catch {
    return failure("decode_failed", "decode_threw");
  }

  // Validação de dimensão ANTES do resize (evita barras brancas silenciosas).
  let format: string | undefined;
  let width: number | undefined;
  let height: number | undefined;
  try {
    const metadata = await sharp(decoded.buffer).metadata();
    format = metadata.format;
    width = metadata.width;
    height = metadata.height;
  } catch {
    return failure("decode_failed", "decode_threw");
  }

  if (format === undefined || !SUPPORTED_PROVIDER_FORMATS.has(format)) {
    return failure("decode_failed", "not_image");
  }
  if (typeof width !== "number" || typeof height !== "number") {
    return failure("decode_failed", "not_image");
  }
  if (width !== height) {
    return failure("resize_failed", "aspect_mismatch");
  }
  if (
    width !== SQUARE_BASE_TARGET.width ||
    height !== SQUARE_BASE_TARGET.height
  ) {
    return failure("resize_failed", "dimensions_mismatch");
  }

  const resize = deps.resize ?? resizeToJpeg1024;
  try {
    const jpeg = await resize(decoded.buffer, decoded.mimeType);
    return Object.freeze({
      ok: true as const,
      bytes: jpeg.buffer,
      width: SQUARE_BASE_TARGET.width,
      height: SQUARE_BASE_TARGET.height,
      mimeType: "image/jpeg" as const,
    });
  } catch {
    return failure("resize_failed", "resize_threw");
  }
}

export type SquareBaseArtifactPersistResult =
  | {
      readonly kind: "created";
      readonly artifact: ArtifactRecord;
      readonly snapshotOriginalId: string;
    }
  | {
      readonly kind: "reused";
      readonly artifact: ArtifactRecord;
      readonly adoption: boolean;
      readonly snapshotOriginalId?: string;
    }
  | {
      readonly kind: "existing_artifact_conflict";
      readonly reason:
        | "incompatible"
        | "object_unverified"
        | "object_invalid"
        | "row_object_missing";
      readonly artifact?: ArtifactRecord;
      readonly detail?: string;
    }
  | {
      readonly kind: "persistence_failed";
      readonly reason: "integrity_failure" | "persistence_failure";
      readonly detail: string;
      readonly storagePath?: string;
    }
  | {
      readonly kind: "readback_failed";
      readonly reason: "absent" | "invalid" | "indeterminate" | "metadata_conflict";
      readonly detail?: string;
    };

export interface PersistSquareBaseArtifactInput {
  readonly identity: ArtifactIdentity;
  readonly authorization: AuthorizationContext;
  readonly bytes: Buffer;
  readonly snapshotOriginalId: string;
}

export interface PersistSquareBaseArtifactDeps {
  readonly client?: SupabaseClient;
  readonly persist?: typeof persistCompositionArtifact;
  readonly retrieve?: typeof retrieveCompositionArtifact;
}

function artifactOrUndefined(
  record: ArtifactRecord | null,
): ArtifactRecord | undefined {
  return record ?? undefined;
}

function mapPersistFailure(
  result: Exclude<
    PersistArtifactResult,
    { kind: "created" } | { kind: "reused" }
  >,
): SquareBaseArtifactPersistResult {
  switch (result.kind) {
    case "content_conflict":
      return Object.freeze({
        kind: "existing_artifact_conflict" as const,
        reason: "incompatible" as const,
        artifact: artifactOrUndefined(result.existing),
        detail: result.reason,
      });
    case "identity_conflict":
      return Object.freeze({
        kind: "existing_artifact_conflict" as const,
        reason: "incompatible" as const,
        artifact: artifactOrUndefined(result.existing),
        detail: result.reason,
      });
    case "metadata_conflict":
      return Object.freeze({
        kind: "existing_artifact_conflict" as const,
        reason: "incompatible" as const,
        artifact: artifactOrUndefined(result.existing),
        detail: result.reason,
      });
    case "provenance_conflict": {
      const evidenceAspect =
        result.reason === "evidence_missing" ||
        result.reason === "evidence_invalid" ||
        result.reason === "evidence_mismatch";
      return Object.freeze({
        kind: "existing_artifact_conflict" as const,
        reason: evidenceAspect
          ? ("object_unverified" as const)
          : ("incompatible" as const),
        artifact: artifactOrUndefined(result.existing),
        detail: result.reason,
      });
    }
    case "integrity_failure":
      return Object.freeze({
        kind: "persistence_failed" as const,
        reason: "integrity_failure" as const,
        detail: result.reason,
      });
    case "persistence_failure":
      return Object.freeze({
        kind: "persistence_failed" as const,
        reason: "persistence_failure" as const,
        detail: result.reason,
        storagePath: result.storagePath,
      });
    case "indeterminate":
      return Object.freeze({
        kind: "persistence_failed" as const,
        reason: "persistence_failure" as const,
        detail: result.reason,
      });
    case "invalid_input":
      return Object.freeze({
        kind: "persistence_failed" as const,
        reason: "persistence_failure" as const,
        detail: result.reason,
      });
  }
}

/**
 * Persiste o `square_original` exclusivamente pela F60.1 e faz readback. O
 * artefato/bytes devolvidos vêm SEMPRE do readback.
 */
export async function persistSquareBaseArtifact(
  input: PersistSquareBaseArtifactInput,
  deps: PersistSquareBaseArtifactDeps = {},
): Promise<SquareBaseArtifactPersistResult> {
  const client = deps.client ?? supabaseAdmin;
  const persist = deps.persist ?? persistCompositionArtifact;
  const retrieve = deps.retrieve ?? retrieveCompositionArtifact;

  const persisted = await persist(
    {
      identity: input.identity,
      authorization: input.authorization,
      bytes: input.bytes,
      origin: SQUARE_BASE_ORIGIN,
      source: { kind: "none" },
      provenance: {},
    },
    { client },
  );

  if (persisted.kind !== "created" && persisted.kind !== "reused") {
    return mapPersistFailure(persisted);
  }

  const persistenceKind = persisted.kind;
  const adoption = persisted.kind === "reused" ? persisted.adoption : false;

  const readback = await retrieve(
    { identity: input.identity, authorization: input.authorization },
    { client },
  );

  if (readback.kind === "integral") {
    if (persistenceKind === "created") {
      return Object.freeze({
        kind: "created" as const,
        artifact: readback.artifact,
        snapshotOriginalId: input.snapshotOriginalId,
      });
    }
    return Object.freeze({
      kind: "reused" as const,
      artifact: readback.artifact,
      adoption,
      snapshotOriginalId: input.snapshotOriginalId,
    });
  }

  if (readback.kind === "metadata_conflict") {
    return Object.freeze({
      kind: "readback_failed" as const,
      reason: "metadata_conflict" as const,
      detail: readback.reason,
    });
  }
  if (readback.kind === "invalid") {
    return Object.freeze({
      kind: "readback_failed" as const,
      reason: "invalid" as const,
      detail: readback.reason,
    });
  }
  if (readback.kind === "absent") {
    return Object.freeze({
      kind: "readback_failed" as const,
      reason: "absent" as const,
    });
  }
  return Object.freeze({
    kind: "readback_failed" as const,
    reason: "indeterminate" as const,
  });
}

/**
 * Converte o desfecho de persistência no membro público `ArtOutcome`. Retorna
 * `null` para falhas (o orquestrador as mapeia para o resultado tipado).
 */
export function artifactOutcomeFromPersist(
  result: SquareBaseArtifactPersistResult,
): ArtOutcome | null {
  if (result.kind === "created") {
    return Object.freeze({
      kind: "created" as const,
      artifact: result.artifact,
      snapshotOriginalId: result.snapshotOriginalId,
    });
  }
  if (result.kind === "reused") {
    return result.snapshotOriginalId === undefined
      ? Object.freeze({
          kind: "reused" as const,
          artifact: result.artifact,
          adoption: result.adoption,
        })
      : Object.freeze({
          kind: "reused" as const,
          artifact: result.artifact,
          adoption: result.adoption,
          snapshotOriginalId: result.snapshotOriginalId,
        });
  }
  return null;
}
