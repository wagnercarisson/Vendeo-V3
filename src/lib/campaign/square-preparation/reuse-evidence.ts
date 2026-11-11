import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  buildObjectEvidence,
  verifyObjectEvidence,
} from "@/lib/campaign/composition-artifacts/evidence";
import { CompositionArtifactStorage } from "@/lib/campaign/composition-artifacts/storage";
import type { ArtifactRecord } from "@/lib/campaign/composition-artifacts/types";

/**
 * F60.2 (quick 261111-idz) — Verificação READ-ONLY da evidência durável do
 * `square_prepared`.
 *
 * `retrieveCompositionArtifact` compara bytes↔linha, mas não lê a metadata do
 * objeto. O atalho de reuse exige uma checagem adicional: montar a evidência
 * esperada com `buildObjectEvidence` (F60.1), ler a metadata com
 * `CompositionArtifactStorage.readObjectInfo` e validar com
 * `verifyObjectEvidence`. Nenhum cálculo de evidência/digest é reimplementado e
 * nada é escrito, apagado ou corrigido. Nunca lança.
 */

export type ReuseEvidenceResult =
  | { readonly kind: "verified" }
  | {
      readonly kind: "not_verified";
      readonly reason:
        | "row_invalid"
        | "object_absent"
        | "indeterminate"
        | "evidence_missing"
        | "evidence_invalid"
        | "evidence_mismatch";
    };

export interface ReuseEvidenceDeps {
  readonly client?: SupabaseClient;
}

function notVerified(
  reason: Extract<ReuseEvidenceResult, { kind: "not_verified" }>["reason"],
): ReuseEvidenceResult {
  return Object.freeze({ kind: "not_verified" as const, reason });
}

/**
 * `verified` somente quando a evidência durável gravada no objeto prepared
 * corresponde exatamente à evidência esperada para a fonte validada.
 */
export async function verifyPreparedReuseEvidence(
  artifact: ArtifactRecord,
  source: { readonly artifactId: string; readonly checksumSha256: string },
  deps: ReuseEvidenceDeps = {},
): Promise<ReuseEvidenceResult> {
  const expected = buildObjectEvidence({
    storeId: artifact.storeId,
    campaignId: artifact.campaignId,
    operationId: artifact.operationId,
    role: artifact.role,
    origin: artifact.origin,
    sourceKind: "internal_artifact",
    sourceArtifactId: source.artifactId,
    sourceOrigin: "composition_artifact",
    sourceChecksumSha256: source.checksumSha256,
    width: artifact.width,
    height: artifact.height,
    mimeType: artifact.mimeType,
    byteSize: artifact.byteSize,
    checksumSha256: artifact.checksumSha256,
    provenance: artifact.provenance,
  });

  if (!expected.ok) {
    // A linha não permite construir a evidência esperada (proveniência/digest
    // malformados): o atalho é recusado e a F60.1 decide.
    return notVerified("row_invalid");
  }

  const storage = new CompositionArtifactStorage(deps.client);
  const info = await storage.readObjectInfo(artifact.storagePath);
  if (info.kind === "absent") return notVerified("object_absent");
  if (info.kind === "indeterminate") return notVerified("indeterminate");

  const verification = verifyObjectEvidence(info.metadata, expected.evidence);
  if (!verification.ok) return notVerified(verification.reason);

  return Object.freeze({ kind: "verified" as const });
}
