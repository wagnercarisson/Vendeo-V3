/**
 * F60.1 — Contratos puros de artefatos de composição.
 *
 * Este módulo não tem I/O, não importa `server-only`, `sharp`, Supabase ou
 * `node:crypto`. Ele apenas descreve identidade, autorização, papéis,
 * proveniência, evidência e resultados tipados.
 */

export type ArtifactRole = "square_original" | "square_prepared" | "vertical";

export type ArtifactFormat = "1:1" | "9:16";

export type ArtifactOrigin =
  | "provider_generation"
  | "deterministic_preparation"
  | "ai_expansion";

export type ArtifactSourceKind =
  | "none"
  | "internal_artifact"
  | "delivered_campaign_source";

export type SourceOrigin =
  | "legacy_campaign"
  | "new_flow_1_1"
  | "composition_artifact";

export type AuthorizationContext =
  | { readonly kind: "owner"; readonly userId: string }
  | { readonly kind: "system" };

export interface ArtifactIdentity {
  readonly storeId: string;
  readonly campaignId: string;
  readonly operationId: string;
  readonly role: ArtifactRole;
}

export interface ReusableSquareSource {
  readonly origin: SourceOrigin;
  readonly storeId: string;
  readonly campaignId: string;
  readonly operationId?: string;
  readonly artifactId?: string;
  readonly bucket: string;
  readonly storagePath: string;
  readonly width: number;
  readonly height: number;
  readonly mimeType: string;
  readonly byteSize: number;
  readonly checksumSha256: string;
  readonly role?: ArtifactRole;
}

/**
 * Candidato de campanha entregue no modo resolução: o caminho e a identidade
 * vêm do banco; dimensão/checksum são preenchidos pelo recálculo server-side.
 */
export interface DeliveredCampaignSourceCandidate {
  readonly origin: "legacy_campaign" | "new_flow_1_1";
  readonly storeId: string;
  readonly campaignId: string;
  readonly storagePath: string;
  readonly width?: number;
  readonly height?: number;
  readonly mimeType?: string;
  readonly byteSize?: number;
  readonly checksumSha256?: string;
}

export type ArtifactSource =
  | { readonly kind: "none" }
  | { readonly kind: "internal_artifact"; readonly artifactId: string }
  | {
      readonly kind: "delivered_campaign_source";
      readonly descriptor: ReusableSquareSource;
    };

export interface PersistArtifactInput {
  readonly identity: ArtifactIdentity;
  readonly authorization: AuthorizationContext;
  readonly bytes: Buffer;
  readonly origin: ArtifactOrigin;
  readonly source: ArtifactSource;
  readonly sourceCampaignId?: string | null;
  readonly provenance?: Record<string, unknown>;
}

export interface ArtifactRecord {
  readonly id: string;
  readonly storeId: string;
  readonly campaignId: string;
  readonly operationId: string;
  readonly role: ArtifactRole;
  readonly format: ArtifactFormat;
  readonly origin: ArtifactOrigin;
  readonly derivedFromArtifactId: string | null;
  readonly sourceCampaignId: string | null;
  readonly storageBucket: string;
  readonly storagePath: string;
  readonly width: number;
  readonly height: number;
  readonly mimeType: string;
  readonly byteSize: number;
  readonly checksumSha256: string;
  readonly provenance: Record<string, unknown>;
  readonly createdAt: string;
}

export type EvidenceFailureReason =
  | "evidence_missing"
  | "evidence_invalid"
  | "evidence_mismatch";

export interface ObjectEvidence {
  readonly v: 1;
  readonly storeId: string;
  readonly campaignId: string;
  readonly operationId: string;
  readonly role: ArtifactRole;
  readonly origin: ArtifactOrigin;
  readonly sourceKind: ArtifactSourceKind;
  readonly sourceArtifactId?: string;
  readonly sourceCampaignId?: string;
  readonly sourceOrigin?: SourceOrigin;
  readonly sourceChecksumSha256?: string;
  readonly width: number;
  readonly height: number;
  readonly mimeType: string;
  readonly byteSize: number;
  readonly checksumSha256: string;
  readonly provenanceDigest: string;
}

export interface BuildObjectEvidenceInput {
  readonly storeId: string;
  readonly campaignId: string;
  readonly operationId: string;
  readonly role: ArtifactRole;
  readonly origin: ArtifactOrigin;
  readonly sourceKind: ArtifactSourceKind;
  readonly sourceArtifactId?: string;
  readonly sourceCampaignId?: string;
  readonly sourceOrigin?: SourceOrigin;
  readonly sourceChecksumSha256?: string;
  readonly width: number;
  readonly height: number;
  readonly mimeType: string;
  readonly byteSize: number;
  readonly checksumSha256: string;
  readonly provenance: Record<string, unknown>;
}

export type ProvenanceFailureReason = "provenance_malformed";

export type MetadataConflictReason =
  | "width_mismatch"
  | "height_mismatch"
  | "mime_mismatch"
  | "byte_size_mismatch"
  | "checksum_mismatch"
  | "source_mismatch";

export type ProvenanceConflictReason =
  | "provenance_mismatch"
  | EvidenceFailureReason;

export type PersistArtifactResult =
  | { readonly kind: "created" }
  | { readonly kind: "reused"; readonly adoption: boolean }
  | {
      readonly kind: "content_conflict";
      readonly existing: ArtifactRecord | null;
      readonly reason: "checksum_mismatch";
    }
  | {
      readonly kind: "identity_conflict";
      readonly existing: ArtifactRecord | null;
      readonly reason:
        | "path_bound_to_other_identity"
        | "store_mismatch"
        | "not_owner"
        | "invalid_identity";
    }
  | {
      readonly kind: "metadata_conflict";
      readonly existing: ArtifactRecord | null;
      readonly reason: MetadataConflictReason;
    }
  | {
      readonly kind: "provenance_conflict";
      readonly existing: ArtifactRecord | null;
      readonly reason: ProvenanceConflictReason;
    }
  | { readonly kind: "invalid_input"; readonly reason: string }
  | { readonly kind: "integrity_failure"; readonly reason: string }
  | {
      readonly kind: "persistence_failure";
      readonly storagePath: string;
      readonly reason: string;
    }
  | { readonly kind: "indeterminate"; readonly reason: string };

export type RetrieveArtifactResult =
  | {
      readonly kind: "integral";
      readonly artifact: ArtifactRecord;
      readonly bytes: Buffer;
    }
  | { readonly kind: "absent" }
  | { readonly kind: "invalid"; readonly reason: string }
  | {
      readonly kind: "metadata_conflict";
      readonly artifact: ArtifactRecord;
      readonly reason: string;
    }
  | { readonly kind: "indeterminate" };

export type ResolveSquareSourceInput =
  | {
      readonly kind: "legacy_campaign";
      readonly storeId: string;
      readonly campaignId: string;
      readonly authorization: AuthorizationContext;
    }
  | {
      readonly kind: "new_flow_1_1";
      readonly storeId: string;
      readonly campaignId: string;
      readonly authorization: AuthorizationContext;
    }
  | {
      readonly kind: "composition_artifact";
      readonly storeId: string;
      readonly campaignId: string;
      readonly operationId: string;
      readonly role: ArtifactRole;
      readonly authorization: AuthorizationContext;
    };

export type ResolveSquareSourceReason =
  | "not_owner"
  | "store_mismatch"
  | "campaign_not_ready"
  | "format_not_square"
  | "path_not_canonical"
  | "artifact_absent"
  | "artifact_invalid"
  | "artifact_indeterminate"
  | "unsupported_dimensions"
  | "unsupported_mime"
  | "role_not_reusable"
  | "source_origin_invalid"
  | "metadata_conflict"
  | "identity_conflict";

export type ResolveSquareSourceResult =
  | { readonly kind: "reusable"; readonly source: ReusableSquareSource }
  | {
      readonly kind: "not_reusable";
      readonly reason: ResolveSquareSourceReason;
    };

export type CompositionArtifactErrorCode =
  | "artifact_upload_failed"
  | "artifact_path_conflict"
  | "artifact_metadata_persist_failed"
  | "artifact_missing"
  | "artifact_invalid_path"
  | "artifact_sign_failed"
  | "artifact_download_failed"
  | "artifact_integrity_failed"
  | "artifact_evidence_failed"
  | "artifact_conflict"
  | "artifact_invalid_input"
  | "artifact_indeterminate";

export class CompositionArtifactError extends Error {
  constructor(
    public readonly code: CompositionArtifactErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "CompositionArtifactError";
  }
}
