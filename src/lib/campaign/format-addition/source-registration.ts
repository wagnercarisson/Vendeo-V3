import "server-only";

import { createHash } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { resolveReusableSquareSource } from "@/lib/campaign/composition-artifacts/resolve-source";
import { persistCompositionArtifact } from "@/lib/campaign/composition-artifacts/persist";
import { retrieveCompositionArtifact } from "@/lib/campaign/composition-artifacts/retrieve";
import {
  CompositionArtifactStorage,
  type DownloadBytesResult,
} from "@/lib/campaign/composition-artifacts/storage";
import {
  validateAuthorizationContext,
  isArtifactUuid,
} from "@/lib/campaign/composition-artifacts/identity";
import type {
  ArtifactRecord,
  AuthorizationContext,
  PersistArtifactResult,
  ResolveSquareSourceReason,
} from "@/lib/campaign/composition-artifacts/types";
import type { SourceValidationFailureReason } from "@/lib/campaign/composition-artifacts/source-validation";
import { artifactStoragePath } from "@/lib/product-1-1/artifact/artifact-path";
import { supabaseAdmin } from "@/lib/supabase/server";

import { computeChecksumSha256 } from "@/lib/campaign/composition-artifacts/integrity";

import type {
  FormatAdditionSourceOrigin,
  FormatAdditionUnavailableReason,
} from "./types";

/**
 * F62/62-03 — Registro estável da fonte e ponte de proveniência.
 *
 * Server-only. Não gera imagem, não chama provider, não cria operação
 * financeira e não altera a campanha. A cópia `square_original` é byte-idêntica
 * à fonte validada e a identidade é estável:
 * - fluxo novo: operação `1:1` primária entregue (lida pela RPC canônica que
 *   exclui adições);
 * - legado: UUID sintético determinístico derivado de loja/campanha.
 */

export type SourceBridgeFailureReason =
  | FormatAdditionUnavailableReason
  | ResolveSquareSourceReason
  | SourceValidationFailureReason
  | "invalid_input"
  | "source_origin_invalid"
  | "source_operation_artifact_mismatch"
  | "primary_operation_missing"
  | "primary_operation_not_delivered"
  | "primary_operation_read_failed"
  | "source_download_failed"
  | "source_checksum_mismatch"
  | "bridge_identity_conflict"
  | "bridge_metadata_conflict"
  | "bridge_provenance_conflict"
  | "bridge_readback_failed"
  | "persistence_failure"
  | "indeterminate";

export type SourceBridgePersistence = "created" | "reused";

export type EnsureSourceBridgeResult =
  | {
      readonly ok: true;
      readonly artifact: ArtifactRecord;
      readonly sourceOrigin: FormatAdditionSourceOrigin;
      readonly sourceRegistrationOperationId: string;
      readonly persistence: SourceBridgePersistence;
    }
  | {
      readonly ok: false;
      readonly reason: SourceBridgeFailureReason;
      readonly detail?: string;
      readonly existing?: ArtifactRecord | null;
    };

export type PrimaryOperationRead =
  | { readonly kind: "found"; readonly operationId: string; readonly status: string }
  | { readonly kind: "missing" }
  | { readonly kind: "read_failed"; readonly detail?: string };

export interface SourceBridgeDeps {
  readonly client?: SupabaseClient;
  readonly resolveSource?: typeof resolveReusableSquareSource;
  readonly persist?: typeof persistCompositionArtifact;
  readonly retrieve?: typeof retrieveCompositionArtifact;
  readonly storage?: {
    downloadBytes(path: string, bucket?: string): Promise<DownloadBytesResult>;
  };
  readonly readPrimaryOperation?: (input: {
    readonly storeId: string;
    readonly campaignId: string;
  }) => Promise<PrimaryOperationRead>;
  readonly acceptLegacy1024?: true;
}

export interface EnsureSourceBridgeInput {
  readonly storeId: string;
  readonly campaignId: string;
  readonly sourceOrigin: FormatAdditionSourceOrigin;
  readonly authorization: AuthorizationContext;
}

function fail(
  reason: SourceBridgeFailureReason,
  extra?: { readonly detail?: string; readonly existing?: ArtifactRecord | null },
): EnsureSourceBridgeResult {
  const result: {
    ok: false;
    reason: SourceBridgeFailureReason;
    detail?: string;
    existing?: ArtifactRecord | null;
  } = { ok: false, reason };
  if (extra?.detail !== undefined) result.detail = extra.detail;
  if (extra?.existing !== undefined) result.existing = extra.existing;
  return Object.freeze(result);
}

/**
 * UUID sintético determinístico para a identidade de registro da fonte legada.
 * Não é operação financeira e não pode coincidir com a operação da adição.
 */
export function deriveLegacyRegistrationOperationId(
  storeId: string,
  campaignId: string,
): string {
  const hex = createHash("sha256")
    .update(
      `vendeo:f62:legacy-source:${storeId.toLowerCase()}:${campaignId.toLowerCase()}`,
    )
    .digest("hex");
  const variant = ((parseInt(hex.slice(16, 18), 16) & 0x3f) | 0x80)
    .toString(16)
    .padStart(2, "0");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `5${hex.slice(13, 16)}`,
    `${variant}${hex.slice(18, 20)}`,
    hex.slice(20, 32),
  ].join("-");
}

async function readPrimaryOperationViaRpc(
  client: SupabaseClient,
  input: { storeId: string; campaignId: string },
): Promise<PrimaryOperationRead> {
  try {
    const { data, error } = await client.rpc(
      "product_1_1_get_campaign_operation_by_campaign",
      { p_campaign_id: input.campaignId },
    );
    if (error) return { kind: "read_failed", detail: error.message };
    if (data === null) return { kind: "missing" };
    if (typeof data !== "object" || Array.isArray(data)) {
      return { kind: "read_failed", detail: "invalid_payload" };
    }
    const record = data as Record<string, unknown>;
    if (record.success !== true) {
      return { kind: "read_failed", detail: "unsuccessful_payload" };
    }
    if (typeof record.operation_id !== "string") return { kind: "missing" };
    if (typeof record.status !== "string") {
      return { kind: "read_failed", detail: "invalid_status" };
    }
    return {
      kind: "found",
      operationId: record.operation_id,
      status: record.status,
    };
  } catch (error) {
    return {
      kind: "read_failed",
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

function mapPersistFailure(result: PersistArtifactResult): EnsureSourceBridgeResult {
  switch (result.kind) {
    case "content_conflict":
      return fail("source_checksum_mismatch", {
        detail: result.reason,
        existing: result.existing,
      });
    case "identity_conflict":
      return fail("bridge_identity_conflict", {
        detail: result.reason,
        existing: result.existing,
      });
    case "metadata_conflict":
      return fail("bridge_metadata_conflict", {
        detail: result.reason,
        existing: result.existing,
      });
    case "provenance_conflict":
      return fail("bridge_provenance_conflict", {
        detail: result.reason,
        existing: result.existing,
      });
    case "integrity_failure":
      return fail("source_download_failed", { detail: result.reason });
    case "invalid_input":
      return fail("invalid_input", { detail: result.reason });
    case "persistence_failure":
      return fail("persistence_failure", { detail: result.reason });
    case "indeterminate":
      return fail("indeterminate", { detail: result.reason });
    default:
      return fail("persistence_failure", { detail: "unexpected_persist_result" });
  }
}

function verifyBridgeArtifact(
  input: {
    readonly storeId: string;
    readonly campaignId: string;
    readonly sourceOrigin: FormatAdditionSourceOrigin;
    readonly sourceRegistrationOperationId: string;
    readonly sourceStoragePath: string;
    readonly sourceChecksumSha256: string;
  },
  artifact: ArtifactRecord,
): boolean {
  return (
    artifact.storeId === input.storeId.toLowerCase() &&
    artifact.campaignId === input.campaignId.toLowerCase() &&
    artifact.operationId === input.sourceRegistrationOperationId.toLowerCase() &&
    artifact.role === "square_original" &&
    artifact.format === "1:1" &&
    artifact.width === 1024 &&
    artifact.height === 1024 &&
    artifact.mimeType === "image/jpeg" &&
    artifact.storageBucket === "campaign-internal-artifacts" &&
    artifact.storagePath ===
      `${input.storeId.toLowerCase()}/${input.campaignId.toLowerCase()}/${input.sourceRegistrationOperationId.toLowerCase()}/square_original.jpg` &&
    artifact.origin === "delivered_campaign_reuse" &&
    artifact.sourceCampaignId === input.campaignId.toLowerCase() &&
    artifact.checksumSha256 === input.sourceChecksumSha256 &&
    artifact.provenance.sourceOrigin === input.sourceOrigin &&
    artifact.provenance.sourceStoragePath === input.sourceStoragePath &&
    artifact.provenance.sourceChecksumSha256 === input.sourceChecksumSha256
  );
}

/**
 * Garante a ponte `square_original` para a fonte atual. Idempotente pela
 * identidade estável; qualquer divergência é conflito. Nenhum caminho do
 * chamador é aceito além da identidade loja/campanha/origem.
 */
export async function ensureFormatAdditionSourceBridge(
  input: EnsureSourceBridgeInput,
  deps: SourceBridgeDeps = {},
): Promise<EnsureSourceBridgeResult> {
  if (
    !isArtifactUuid(input.storeId) ||
    !isArtifactUuid(input.campaignId) ||
    (input.sourceOrigin !== "new_flow_1_1" &&
      input.sourceOrigin !== "legacy_campaign")
  ) {
    return fail("invalid_input");
  }

  const authorizationResult = validateAuthorizationContext(input.authorization);
  if (!authorizationResult.ok) return fail("invalid_input");

  const storeId = input.storeId.toLowerCase();
  const campaignId = input.campaignId.toLowerCase();
  const client = deps.client ?? supabaseAdmin;
  const resolveSource = deps.resolveSource ?? resolveReusableSquareSource;
  const persist = deps.persist ?? persistCompositionArtifact;
  const retrieve = deps.retrieve ?? retrieveCompositionArtifact;
  const storage = deps.storage ?? new CompositionArtifactStorage(client);

  const resolved = await resolveSource(
    {
      kind: input.sourceOrigin,
      storeId,
      campaignId,
      authorization: authorizationResult.authorization,
    },
    { client },
    { acceptLegacy1024: true },
  );
  if (resolved.kind !== "reusable") {
    return fail(resolved.reason);
  }
  const source = resolved.source;
  if (
    source.origin !== input.sourceOrigin ||
    source.storeId.toLowerCase() !== storeId ||
    source.campaignId.toLowerCase() !== campaignId
  ) {
    return fail("invalid_input");
  }

  let sourceRegistrationOperationId: string;
  if (input.sourceOrigin === "new_flow_1_1") {
    const readPrimary = deps.readPrimaryOperation;
    const primary = readPrimary
      ? await readPrimary({ storeId, campaignId })
      : await readPrimaryOperationViaRpc(client, { storeId, campaignId });

    if (primary.kind === "read_failed") {
      return fail("primary_operation_read_failed", { detail: primary.detail });
    }
    if (primary.kind === "missing") {
      return fail("primary_operation_missing");
    }
    if (primary.status !== "delivered") {
      return fail("primary_operation_not_delivered");
    }
    if (!isArtifactUuid(primary.operationId)) {
      return fail("primary_operation_missing");
    }
    sourceRegistrationOperationId = primary.operationId.toLowerCase();

    const expectedPath = artifactStoragePath(
      storeId,
      campaignId,
      sourceRegistrationOperationId,
    );
    const expectedJpegPath = expectedPath.replace(/\.jpg$/, ".jpeg");
    const actualPath = source.storagePath.toLowerCase();
    if (
      actualPath !== expectedPath.toLowerCase() &&
      actualPath !== expectedJpegPath.toLowerCase()
    ) {
      return fail("source_operation_artifact_mismatch");
    }
  } else {
    sourceRegistrationOperationId = deriveLegacyRegistrationOperationId(
      storeId,
      campaignId,
    );
  }

  let downloaded: DownloadBytesResult;
  try {
    downloaded = await storage.downloadBytes(source.storagePath, source.bucket);
  } catch (error) {
    return fail("source_download_failed", {
      detail: error instanceof Error ? error.message : String(error),
    });
  }
  if (downloaded.kind === "absent") return fail("artifact_absent");
  if (downloaded.kind === "indeterminate") {
    return fail("artifact_indeterminate");
  }

  const checksum = computeChecksumSha256(downloaded.bytes);
  if (checksum !== source.checksumSha256.toLowerCase()) {
    return fail("source_checksum_mismatch");
  }

  const identity = {
    storeId,
    campaignId,
    operationId: sourceRegistrationOperationId,
    role: "square_original" as const,
  };

  const persisted = await persist(
    {
      identity,
      authorization: authorizationResult.authorization,
      bytes: downloaded.bytes,
      origin: "delivered_campaign_reuse",
      source: { kind: "delivered_campaign_source", descriptor: source },
      acceptLegacy1024: deps.acceptLegacy1024 ?? true,
    },
    { client },
  );

  if (persisted.kind !== "created" && persisted.kind !== "reused") {
    return mapPersistFailure(persisted);
  }

  const readback = await retrieve(
    { identity, authorization: authorizationResult.authorization },
    { client },
  );
  if (readback.kind !== "integral") {
    return fail("bridge_readback_failed", {
      detail: readback.kind === "metadata_conflict" ? readback.reason : readback.kind,
    });
  }

  if (
    !verifyBridgeArtifact(
      {
        storeId,
        campaignId,
        sourceOrigin: input.sourceOrigin,
        sourceRegistrationOperationId,
        sourceStoragePath: source.storagePath,
        sourceChecksumSha256: source.checksumSha256,
      },
      readback.artifact,
    )
  ) {
    return fail("bridge_readback_failed", { detail: "bridge_identity_mismatch" });
  }

  return Object.freeze({
    ok: true as const,
    artifact: readback.artifact,
    sourceOrigin: input.sourceOrigin,
    sourceRegistrationOperationId,
    persistence: persisted.kind,
  });
}
