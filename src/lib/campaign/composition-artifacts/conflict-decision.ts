/**
 * F60.1 — Decisão pura de idempotência, adoção e conflito.
 *
 * Sem I/O, sem `server-only`, sem `node:crypto`, sem Supabase. Recebe digests e
 * estado do objeto já computados pelo chamador.
 */

import type {
  ArtifactOrigin,
  ArtifactRecord,
  ArtifactSourceKind,
  EvidenceFailureReason,
  PersistArtifactResult,
  SourceOrigin,
} from "./types";

export interface PresentedProvenance {
  readonly origin: ArtifactOrigin;
  readonly sourceKind: ArtifactSourceKind;
  readonly sourceArtifactId?: string;
  readonly sourceCampaignId?: string;
  readonly sourceOrigin?: SourceOrigin;
  readonly sourceChecksumSha256?: string;
}

export type ObjectState =
  | { readonly kind: "absent" }
  | {
      readonly kind: "present";
      readonly checksumSha256: string;
      readonly evidence:
        | { readonly ok: true }
        | { readonly ok: false; readonly reason: EvidenceFailureReason };
    }
  | { readonly kind: "indeterminate" };

export interface DecidePersistOutcomeInput {
  readonly existingRow: ArtifactRecord | null;
  readonly objectState: ObjectState;
  readonly computed: {
    readonly width: number;
    readonly height: number;
    readonly mimeType: string;
    readonly byteSize: number;
    readonly checksumSha256: string;
    readonly provenanceDigest: string;
  };
  readonly presented: PresentedProvenance;
}

function provenanceValue(
  row: ArtifactRecord,
  key: string,
): unknown {
  const provenance = row.provenance;
  if (provenance === null || typeof provenance !== "object") return undefined;
  return (provenance as Record<string, unknown>)[key];
}

function sameOptional(
  left: unknown,
  right: unknown,
): boolean {
  return left === right;
}

function existingProvenanceMatches(
  row: ArtifactRecord,
  presented: PresentedProvenance,
): boolean {
  if (row.origin !== presented.origin) return false;
  if (!sameOptional(row.derivedFromArtifactId ?? undefined, presented.sourceArtifactId)) {
    return false;
  }
  if (!sameOptional(row.sourceCampaignId ?? undefined, presented.sourceCampaignId)) {
    return false;
  }
  if (!sameOptional(provenanceValue(row, "sourceOrigin"), presented.sourceOrigin)) {
    return false;
  }
  if (
    !sameOptional(
      provenanceValue(row, "sourceChecksumSha256"),
      presented.sourceChecksumSha256,
    )
  ) {
    return false;
  }
  return true;
}

function metadataMismatchReason(
  row: ArtifactRecord,
  computed: DecidePersistOutcomeInput["computed"],
): "width_mismatch" | "height_mismatch" | "mime_mismatch" | "byte_size_mismatch" | null {
  if (row.width !== computed.width) return "width_mismatch";
  if (row.height !== computed.height) return "height_mismatch";
  if (row.mimeType !== computed.mimeType) return "mime_mismatch";
  if (row.byteSize !== computed.byteSize) return "byte_size_mismatch";
  return null;
}

/**
 * Decide o desfecho sem executar I/O. `Object.freeze` em todos os retornos.
 */
export function decidePersistOutcome(
  input: DecidePersistOutcomeInput,
): PersistArtifactResult {
  const { existingRow, objectState, computed, presented } = input;

  if (existingRow !== null) {
    if (objectState.kind === "absent") {
      return Object.freeze({
        kind: "integrity_failure" as const,
        reason: "object_absent" as const,
      });
    }
    if (objectState.kind === "indeterminate") {
      return Object.freeze({
        kind: "indeterminate" as const,
        reason: "object_indeterminate" as const,
      });
    }

    if (
      existingRow.checksumSha256 !== computed.checksumSha256 ||
      objectState.checksumSha256 !== computed.checksumSha256
    ) {
      return Object.freeze({
        kind: "content_conflict" as const,
        existing: existingRow,
        reason: "checksum_mismatch" as const,
      });
    }

    const metadataReason = metadataMismatchReason(existingRow, computed);
    if (metadataReason !== null) {
      return Object.freeze({
        kind: "metadata_conflict" as const,
        existing: existingRow,
        reason: metadataReason,
      });
    }

    if (!existingProvenanceMatches(existingRow, presented)) {
      return Object.freeze({
        kind: "provenance_conflict" as const,
        existing: existingRow,
        reason: "provenance_mismatch" as const,
      });
    }

    return Object.freeze({ kind: "reused" as const, adoption: false });
  }

  if (objectState.kind === "indeterminate") {
    return Object.freeze({
      kind: "indeterminate" as const,
      reason: "object_indeterminate" as const,
    });
  }

  if (objectState.kind === "absent") {
    return Object.freeze({ kind: "created" as const });
  }

  if (objectState.checksumSha256 !== computed.checksumSha256) {
    return Object.freeze({
      kind: "content_conflict" as const,
      existing: null,
      reason: "checksum_mismatch" as const,
    });
  }

  if (!objectState.evidence.ok) {
    return Object.freeze({
      kind: "provenance_conflict" as const,
      existing: null,
      reason: objectState.evidence.reason,
    });
  }

  return Object.freeze({ kind: "reused" as const, adoption: true });
}
