import { createHash } from "node:crypto";

import {
  SQUARE_RELEASE_COST_CREDITS,
  SQUARE_RELEASE_KEY_PREFIX,
  type SquareReleaseDeductionRow,
  type SquareReleaseIdentity,
} from "./types";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function canonicalSquareReleaseIdentity(
  identity: SquareReleaseIdentity,
): string {
  return [
    SQUARE_RELEASE_KEY_PREFIX,
    identity.storeId,
    identity.campaignId,
    identity.verticalOperationId,
    identity.artifactId,
    identity.checksumSha256,
    "square_original",
    "1:1",
  ].join("|");
}

export function squareReleaseKey(identity: SquareReleaseIdentity): string {
  return `${SQUARE_RELEASE_KEY_PREFIX}:${sha256(
    canonicalSquareReleaseIdentity(identity),
  )}`;
}

export function squareReleaseMetadata(
  identity: SquareReleaseIdentity,
): Record<string, unknown> {
  return {
    kind: "square_release",
    version: 1,
    feature: "square_release",
    vertical_operation_id: identity.verticalOperationId,
    artifact_id: identity.artifactId,
    artifact_role: "square_original",
    artifact_format: "1:1",
    artifact_checksum_sha256: identity.checksumSha256,
    artifact_width: 1024,
    artifact_height: 1024,
    artifact_mime: "image/jpeg",
    cost_credits: SQUARE_RELEASE_COST_CREDITS,
  };
}

function metadataMatches(
  metadata: Record<string, unknown> | null,
  identity: SquareReleaseIdentity,
): boolean {
  if (metadata === null) return false;
  return (
    metadata.kind === "square_release" &&
    metadata.version === 1 &&
    metadata.feature === "square_release" &&
    metadata.vertical_operation_id === identity.verticalOperationId &&
    metadata.artifact_id === identity.artifactId &&
    metadata.artifact_role === "square_original" &&
    metadata.artifact_format === "1:1" &&
    metadata.artifact_checksum_sha256 === identity.checksumSha256 &&
    metadata.artifact_width === 1024 &&
    metadata.artifact_height === 1024 &&
    metadata.artifact_mime === "image/jpeg" &&
    metadata.cost_credits === SQUARE_RELEASE_COST_CREDITS
  );
}

/**
 * Aceita somente a dedução que é o comprovante exato da liberação. A chave
 * sozinha não basta: tipo, valor, campanha e metadados de identidade precisam
 * coincidir com o artefato imutável resolvido no servidor.
 */
export function isValidSquareReleaseDeduction(
  row: SquareReleaseDeductionRow,
  identity: SquareReleaseIdentity,
): boolean {
  return (
    row.type === "deduction" &&
    row.amount === -SQUARE_RELEASE_COST_CREDITS &&
    row.campaign_id === identity.campaignId &&
    row.idempotency_key === squareReleaseKey(identity) &&
    metadataMatches(row.metadata, identity)
  );
}
