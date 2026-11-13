import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabase/server";
import { verifyCampaignAccess } from "@/lib/campaign/composition-artifacts/access";
import {
  COMPOSITION_ARTIFACT_BUCKET,
  compositionArtifactStoragePath,
} from "@/lib/campaign/composition-artifacts/artifact-path";
import {
  buildObjectEvidence,
  verifyObjectEvidence,
} from "@/lib/campaign/composition-artifacts/evidence";
import { getArtifactByIdentity } from "@/lib/campaign/composition-artifacts/repository";
import { retrieveCompositionArtifact } from "@/lib/campaign/composition-artifacts/retrieve";
import { ROLE_POLICY } from "@/lib/campaign/composition-artifacts/role-policy";
import { CompositionArtifactStorage } from "@/lib/campaign/composition-artifacts/storage";
import type {
  ArtifactIdentity,
  ArtifactRecord,
} from "@/lib/campaign/composition-artifacts/types";
import type { ArtifactProbe } from "@/lib/product-1-1/artifact/types";
import type {
  VerticalArtifactProbe,
  VerticalArtifactProbeInput,
  VerticalArtifactProbeResult,
} from "../two-stage-financial-service";

export interface CompositionProbeDeps {
  readonly client?: SupabaseClient;
}

type ProbeOutcome =
  | { readonly kind: "integral"; readonly artifact: ArtifactRecord }
  | { readonly kind: "absent" }
  | { readonly kind: "invalid" }
  | { readonly kind: "indeterminate" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Evidência esperada do objeto `vertical`, reconstruída EXCLUSIVAMENTE dos
 * campos persistidos na linha F60.1. Nunca inventa origem/proveniência.
 */
function expectedEvidence(
  artifact: ArtifactRecord,
): ReturnType<typeof buildObjectEvidence> {
  const provenance = isRecord(artifact.provenance) ? artifact.provenance : {};
  const sourceOrigin = provenance.sourceOrigin;
  const sourceArtifactId = artifact.derivedFromArtifactId;
  const sourceChecksum = provenance.sourceChecksumSha256;
  const base = {
    storeId: artifact.storeId,
    campaignId: artifact.campaignId,
    operationId: artifact.operationId,
    role: "vertical" as const,
    origin: artifact.origin,
    width: artifact.width,
    height: artifact.height,
    mimeType: artifact.mimeType,
    byteSize: artifact.byteSize,
    checksumSha256: artifact.checksumSha256,
    provenance,
  };

  if (
    typeof sourceArtifactId === "string" &&
    sourceOrigin === "composition_artifact" &&
    typeof sourceChecksum === "string"
  ) {
    return buildObjectEvidence({
      ...base,
      sourceKind: "internal_artifact",
      sourceArtifactId,
      sourceOrigin,
      sourceChecksumSha256: sourceChecksum,
    });
  }

  return buildObjectEvidence({ ...base, sourceKind: "none" });
}

export class CompositionVerticalProbe
  implements VerticalArtifactProbe
{
  private readonly client: SupabaseClient;

  constructor(deps: CompositionProbeDeps = {}) {
    this.client = deps.client ?? supabaseAdmin;
  }

  private async probe(
    input: VerticalArtifactProbeInput,
  ): Promise<ProbeOutcome> {
    const identity: ArtifactIdentity = {
      storeId: input.storeId,
      campaignId: input.campaignId,
      operationId: input.operationId,
      role: "vertical",
    };

    // Binding campanha -> loja antes de qualquer leitura de arte.
    const access = await verifyCampaignAccess(
      {
        storeId: input.storeId,
        campaignId: input.campaignId,
        authorization: { kind: "system" },
      },
      this.client,
    );
    if (!access.ok) return { kind: "indeterminate" };

    // (1) Linha ANTES do objeto: linha ausente != objeto ausente.
    const row = await getArtifactByIdentity(identity, this.client);
    if (row.kind === "read_failed") return { kind: "indeterminate" };
    if (row.kind === "absent") return { kind: "absent" };
    const artifact = row.record;

    // (2) Conteúdo integral + path/bucket/dimensão/MIME conferidos.
    const retrieved = await retrieveCompositionArtifact(
      { identity, authorization: { kind: "system" } },
      { client: this.client },
    );
    if (retrieved.kind === "indeterminate") return { kind: "indeterminate" };
    if (retrieved.kind === "absent") return { kind: "absent" };
    if (retrieved.kind !== "integral") return { kind: "invalid" };

    if (
      artifact.storageBucket !== COMPOSITION_ARTIFACT_BUCKET ||
      artifact.storagePath !== compositionArtifactStoragePath(identity)
    ) {
      return { kind: "invalid" };
    }
    if (
      artifact.format !== ROLE_POLICY.vertical.format ||
      artifact.width !== ROLE_POLICY.vertical.width ||
      artifact.height !== ROLE_POLICY.vertical.height ||
      artifact.mimeType !== ROLE_POLICY.vertical.mimeType
    ) {
      return { kind: "invalid" };
    }

    // (3) Evidência durável do objeto confere com a linha.
    const storage = new CompositionArtifactStorage(this.client);
    const info = await storage.readObjectInfo(artifact.storagePath);
    if (info.kind === "indeterminate") return { kind: "indeterminate" };
    if (info.kind === "absent") return { kind: "absent" };
    const expected = expectedEvidence(artifact);
    if (!expected.ok) return { kind: "invalid" };
    if (!verifyObjectEvidence(info.metadata, expected.evidence).ok) {
      return { kind: "invalid" };
    }

    return { kind: "integral", artifact };
  }

  async probeVerticalArtifact(
    input: VerticalArtifactProbeInput,
  ): Promise<VerticalArtifactProbeResult> {
    const outcome = await this.probe(input);
    switch (outcome.kind) {
      case "integral":
        return Object.freeze({
          kind: "integral" as const,
          format: "9:16" as const,
          width: 1080 as const,
          height: 1920 as const,
          mimeType: "image/jpeg" as const,
          storagePath: outcome.artifact.storagePath,
          evidenceRef: outcome.artifact.id,
        });
      case "absent":
        return Object.freeze({ kind: "absent" as const });
      case "invalid":
        return Object.freeze({ kind: "invalid" as const });
      case "indeterminate":
        return Object.freeze({ kind: "indeterminate" as const });
    }
  }

  async probeArtifact(input: {
    storeId: string;
    campaignId: string;
    operationId: string;
  }): Promise<ArtifactProbe> {
    const outcome = await this.probe(input);
    if (outcome.kind !== "integral") {
      return Object.freeze({ kind: outcome.kind });
    }
    const artifact = outcome.artifact;
    return Object.freeze({
      kind: "integral" as const,
      ref: Object.freeze({
        storagePath: artifact.storagePath,
        width: artifact.width,
        height: artifact.height,
        mimeType: artifact.mimeType,
      }),
      width: artifact.width,
      height: artifact.height,
      mimeType: artifact.mimeType,
      storagePath: artifact.storagePath,
    });
  }
}
