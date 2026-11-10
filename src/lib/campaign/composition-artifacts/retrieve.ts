import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabase/server";

import { verifyCampaignAccess } from "./access";
import {
  COMPOSITION_ARTIFACT_BUCKET,
  compositionArtifactStoragePath,
} from "./artifact-path";
import { validateArtifactIdentity } from "./identity";
import { verifyCompositionArtifactBytes } from "./integrity";
import { getArtifactByIdentity } from "./repository";
import { CompositionArtifactStorage } from "./storage";
import type {
  ArtifactIdentity,
  ArtifactRecord,
  AuthorizationContext,
  RetrieveArtifactResult,
} from "./types";

export interface RetrieveCompositionArtifactInput {
  readonly identity: ArtifactIdentity;
  readonly authorization: AuthorizationContext;
}

export interface RetrieveDeps {
  readonly client?: SupabaseClient;
}

function invalid(reason: string): RetrieveArtifactResult {
  return Object.freeze({ kind: "invalid" as const, reason });
}

function metadataConflict(
  artifact: ArtifactRecord,
  reason: string,
): RetrieveArtifactResult {
  return Object.freeze({
    kind: "metadata_conflict" as const,
    artifact,
    reason,
  });
}

/**
 * Recupera um artefato de composição e valida os bytes contra a linha
 * persistida. Server-only, sem URL, sem escrita e sem promoção de órfão.
 */
export async function retrieveCompositionArtifact(
  input: RetrieveCompositionArtifactInput,
  deps: RetrieveDeps = {},
): Promise<RetrieveArtifactResult> {
  const client = deps.client ?? supabaseAdmin;

  // (1) Identidade e autorização antes de qualquer I/O.
  const identityResult = validateArtifactIdentity(input.identity);
  if (!identityResult.ok) {
    return invalid(identityResult.reason);
  }
  const identity = identityResult.identity;

  const access = await verifyCampaignAccess(
    {
      storeId: identity.storeId,
      campaignId: identity.campaignId,
      authorization: input.authorization,
    },
    client,
  );
  if (!access.ok) {
    return invalid(access.reason);
  }

  // (2) A ausência do artefato é determinada pela ausência da linha.
  const row = await getArtifactByIdentity(identity, client);
  if (row.kind === "read_failed") {
    return Object.freeze({ kind: "indeterminate" as const });
  }
  if (row.kind === "absent") {
    return Object.freeze({ kind: "absent" as const });
  }
  const artifact = row.record;

  // (3) A linha precisa apontar para o path determinístico e o bucket interno.
  const expectedPath = compositionArtifactStoragePath(identity);
  if (artifact.storagePath !== expectedPath) {
    return metadataConflict(artifact, "storage_path_mismatch");
  }
  if (artifact.storageBucket !== COMPOSITION_ARTIFACT_BUCKET) {
    return metadataConflict(artifact, "storage_bucket_mismatch");
  }

  // (4) Download com ausência provada vs indeterminate.
  const storage = new CompositionArtifactStorage(client);
  const download = await storage.downloadBytes(artifact.storagePath);
  if (download.kind === "absent") {
    return Object.freeze({ kind: "absent" as const });
  }
  if (download.kind === "indeterminate") {
    return Object.freeze({ kind: "indeterminate" as const });
  }

  // (5) Integridade real do conteúdo.
  const integrity = await verifyCompositionArtifactBytes(
    download.bytes,
    identity.role,
  );
  if (!integrity.ok) {
    return invalid(integrity.reason);
  }

  // (6) Metadados recuperados precisam coincidir com a linha.
  if (integrity.width !== artifact.width) {
    return metadataConflict(artifact, "width_mismatch");
  }
  if (integrity.height !== artifact.height) {
    return metadataConflict(artifact, "height_mismatch");
  }
  if (integrity.mimeType !== artifact.mimeType) {
    return metadataConflict(artifact, "mime_mismatch");
  }
  if (integrity.byteSize !== artifact.byteSize) {
    return metadataConflict(artifact, "byte_size_mismatch");
  }
  if (integrity.checksumSha256 !== artifact.checksumSha256) {
    return metadataConflict(artifact, "checksum_mismatch");
  }

  return Object.freeze({
    kind: "integral" as const,
    artifact,
    bytes: download.bytes,
  });
}
