export const SQUARE_RELEASE_COST_CREDITS = 1 as const;
export const SQUARE_RELEASE_KEY_PREFIX = "square_release:v1" as const;

export type SquareReleaseState =
  | "eligible"
  | "delivered"
  | "refunded"
  | "unknown"
  | "unavailable"
  | "incompatible";

export type SquareReleaseReason =
  | "insufficient_credits"
  | "artifact_absent"
  | "artifact_invalid"
  | "artifact_indeterminate"
  | "operation_unavailable"
  | "release_unknown"
  | "release_refunded";

export interface SquareReleaseIdentity {
  readonly storeId: string;
  readonly campaignId: string;
  readonly verticalOperationId: string;
  readonly artifactId: string;
  readonly checksumSha256: string;
}

export interface SquareReleaseArtifactIdentity {
  readonly artifactId: string;
  readonly checksumSha256: string;
}

export interface SquareReleaseDeductionRow {
  readonly id: string;
  readonly type: string;
  readonly amount: number;
  readonly campaign_id: string;
  readonly idempotency_key: string | null;
  readonly metadata: Record<string, unknown> | null;
}

export interface SquareReleaseSummary {
  readonly campaignId: string;
  readonly state: SquareReleaseState;
  readonly refunded: boolean;
}

export interface SquareReleaseResult {
  readonly state: SquareReleaseState;
  readonly reason: SquareReleaseReason | null;
  readonly refunded: boolean;
}
