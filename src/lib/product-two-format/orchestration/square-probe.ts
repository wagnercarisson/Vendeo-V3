import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  buildObjectEvidence,
  verifyObjectEvidence,
} from "@/lib/campaign/composition-artifacts/evidence";
import { verifyCampaignAccess } from "@/lib/campaign/composition-artifacts/access";
import {
  COMPOSITION_ARTIFACT_BUCKET,
  compositionArtifactStoragePath,
} from "@/lib/campaign/composition-artifacts/artifact-path";
import { computeChecksumSha256 } from "@/lib/campaign/composition-artifacts/integrity";
import { getArtifactByIdentity } from "@/lib/campaign/composition-artifacts/repository";
import { retrieveCompositionArtifact } from "@/lib/campaign/composition-artifacts/retrieve";
import { CompositionArtifactStorage } from "@/lib/campaign/composition-artifacts/storage";
import type {
  ArtifactIdentity,
  ArtifactRecord,
} from "@/lib/campaign/composition-artifacts/types";
import { isCompatibleSquareBaseArtifact } from "@/lib/campaign/square-base/gate";
import {
  SQUARE_BASE_ORIGIN,
  SQUARE_BASE_TARGET,
} from "@/lib/campaign/square-base/policy";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * F60.7 Subfatia B — sonda server-only do `square_original` conjunto.
 *
 * É a ÚNICA evidência válida do 1:1 conjunto (a sonda 1:1 legada é proibida).
 * Preserva as garantias do gate de reutilização da base:
 * - linha antes do objeto; objeto sem linha é estado conservador;
 * - compatibilidade estrita (`isCompatibleSquareBaseArtifact`);
 * - evidência durável F60.1 (`buildObjectEvidence` + `verifyObjectEvidence`),
 *   não apenas bytes/checksum do retrieve;
 * - ausência comprovada, invalidez e indeterminação são distintas.
 *
 * Nunca infere integridade por `storage_path` isolado, nome de arquivo ou
 * presença de objeto, e nunca promove a `integral` sem todas as provas.
 */

export type JointSquareProbeResult =
  | {
      readonly kind: "integral";
      readonly storagePath: string;
      readonly artifactId: string;
      readonly width: 1024;
      readonly height: 1024;
      readonly mimeType: "image/jpeg";
    }
  | { readonly kind: "absent" }
  | { readonly kind: "invalid"; readonly reason: string }
  | { readonly kind: "indeterminate" };

export interface JointSquareProbe {
  probeSquareOriginal(input: {
    storeId: string;
    campaignId: string;
    operationId: string;
  }): Promise<JointSquareProbeResult>;
}

export interface JointSquareProbeDeps {
  readonly client?: SupabaseClient;
  readonly getRow?: typeof getArtifactByIdentity;
  readonly retrieve?: typeof retrieveCompositionArtifact;
  readonly storage?: CompositionArtifactStorage;
}

function invalid(reason: string): JointSquareProbeResult {
  return Object.freeze({ kind: "invalid" as const, reason });
}

export class CompositionSquareOriginalProbe implements JointSquareProbe {
  private readonly client: SupabaseClient;
  private readonly getRow: typeof getArtifactByIdentity;
  private readonly retrieve: typeof retrieveCompositionArtifact;
  private readonly storage: CompositionArtifactStorage;

  constructor(deps: JointSquareProbeDeps = {}) {
    this.client = deps.client ?? supabaseAdmin;
    this.getRow = deps.getRow ?? getArtifactByIdentity;
    this.retrieve = deps.retrieve ?? retrieveCompositionArtifact;
    this.storage = deps.storage ?? new CompositionArtifactStorage(this.client);
  }

  private async probe(input: {
    storeId: string;
    campaignId: string;
    operationId: string;
  }): Promise<JointSquareProbeResult> {
    const identity: ArtifactIdentity = {
      storeId: input.storeId,
      campaignId: input.campaignId,
      operationId: input.operationId,
      role: "square_original",
    };

    // (1) Vínculo campanha → loja antes de qualquer leitura de arte.
    const access = await verifyCampaignAccess(
      {
        storeId: input.storeId,
        campaignId: input.campaignId,
        authorization: { kind: "system" },
      },
      this.client,
    );
    if (!access.ok) return { kind: "indeterminate" };

    // (2) Linha antes do objeto. Linha ausente não prova ausência de arte.
    const row = await this.getRow(identity, this.client);
    if (row.kind === "read_failed") return { kind: "indeterminate" };
    if (row.kind === "absent") {
      const info = await this.storage.readObjectInfo(
        compositionArtifactStoragePath(identity),
      );
      if (info.kind === "indeterminate") return { kind: "indeterminate" };
      if (info.kind === "found") return invalid("object_without_row");
      return { kind: "absent" };
    }
    const artifact: ArtifactRecord = row.record;

    // (3) Conteúdo integral + path/bucket/dimensão/MIME/checksum.
    const retrieved = await this.retrieve(
      { identity, authorization: { kind: "system" } },
      { client: this.client },
    );
    if (retrieved.kind === "indeterminate") return { kind: "indeterminate" };
    if (retrieved.kind === "absent") return { kind: "absent" };
    if (retrieved.kind !== "integral") return invalid("object_invalid");

    // (4) Compatibilidade estrita do gate da base.
    if (!isCompatibleSquareBaseArtifact(retrieved.artifact)) {
      return invalid("incompatible");
    }
    if (
      retrieved.artifact.storageBucket !== COMPOSITION_ARTIFACT_BUCKET ||
      retrieved.artifact.storagePath !== compositionArtifactStoragePath(identity)
    ) {
      return invalid("path_mismatch");
    }

    // (5) Evidência durável F60.1: bytes/checksum NÃO bastam sozinhos.
    const expected = buildObjectEvidence({
      storeId: identity.storeId,
      campaignId: identity.campaignId,
      operationId: identity.operationId,
      role: SQUARE_BASE_TARGET.role,
      origin: SQUARE_BASE_ORIGIN,
      sourceKind: "none",
      width: SQUARE_BASE_TARGET.width,
      height: SQUARE_BASE_TARGET.height,
      mimeType: SQUARE_BASE_TARGET.mimeType,
      byteSize: retrieved.bytes.byteLength,
      checksumSha256: computeChecksumSha256(retrieved.bytes),
      provenance: {},
    });
    if (!expected.ok) return invalid("evidence_invalid");

    const info = await this.storage.readObjectInfo(artifact.storagePath);
    if (info.kind === "indeterminate") return { kind: "indeterminate" };
    if (info.kind === "absent") return invalid("row_object_missing");
    const evidence = verifyObjectEvidence(info.metadata, expected.evidence);
    if (!evidence.ok) return invalid("object_unverified");

    return Object.freeze({
      kind: "integral" as const,
      storagePath: retrieved.artifact.storagePath,
      artifactId: retrieved.artifact.id,
      width: 1024 as const,
      height: 1024 as const,
      mimeType: "image/jpeg" as const,
    });
  }

  async probeSquareOriginal(input: {
    storeId: string;
    campaignId: string;
    operationId: string;
  }): Promise<JointSquareProbeResult> {
    try {
      return await this.probe(input);
    } catch {
      // Indeterminação de leitura nunca vira ausência/invalidez.
      return { kind: "indeterminate" };
    }
  }
}
