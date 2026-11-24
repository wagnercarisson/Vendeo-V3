import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { retrieveCompositionArtifact } from "@/lib/campaign/composition-artifacts/retrieve";
import { createNodeHttpDownloadTransport } from "@/lib/campaign/composition-artifacts/node-http-download";
import { downloadStorageObjectViaNodeHttp } from "@/lib/product-1-1/artifact/node-http-storage-download";
import { supabaseAdmin } from "@/lib/supabase/server";

import { isValidSquareReleaseDeduction, squareReleaseKey } from "./identity";
import type {
  SquareReleaseArtifactIdentity,
  SquareReleaseDeductionRow,
  SquareReleaseIdentity,
  SquareReleaseResult,
  SquareReleaseState,
  SquareReleaseSummary,
} from "./types";

export type SquareReleaseArtifactRead =
  | { readonly kind: "found"; readonly artifact: SquareReleaseArtifactIdentity }
  | { readonly kind: "absent" }
  | { readonly kind: "read_failed" };

export type SquareReleaseLedgerRead =
  | { readonly kind: "none" }
  | { readonly kind: "delivered"; readonly deductionId: string }
  | {
      readonly kind: "refunded";
      readonly deductionId: string;
      readonly refundId: string;
    }
  | { readonly kind: "invalid" }
  | { readonly kind: "read_failed" };

export type SquareReleaseArtifactProbe =
  | { readonly kind: "integral" }
  | { readonly kind: "absent" }
  | { readonly kind: "invalid" }
  | { readonly kind: "indeterminate" };

export interface SquareReleaseReaderDeps {
  readonly client?: SupabaseClient;
}

export interface SquareReleaseProbeDeps extends SquareReleaseReaderDeps {
  readonly downloadBytes?: ReturnType<typeof createNodeHttpDownloadTransport>;
}

export async function readSquareReleaseArtifact(
  input: {
    readonly storeId: string;
    readonly campaignId: string;
    readonly verticalOperationId: string;
  },
  deps: SquareReleaseReaderDeps = {},
): Promise<SquareReleaseArtifactRead> {
  const client = deps.client ?? supabaseAdmin;
  const { data, error } = await client
    .from("campaign_composition_artifacts")
    .select("id, checksum_sha256")
    .eq("store_id", input.storeId)
    .eq("campaign_id", input.campaignId)
    .eq("operation_id", input.verticalOperationId)
    .eq("role", "square_original")
    .eq("format", "1:1")
    .maybeSingle();

  if (error) return { kind: "read_failed" };
  if (!data) return { kind: "absent" };
  const row = data as Record<string, unknown>;
  if (typeof row.id !== "string" || typeof row.checksum_sha256 !== "string") {
    return { kind: "read_failed" };
  }
  return {
    kind: "found",
    artifact: { artifactId: row.id, checksumSha256: row.checksum_sha256 },
  };
}

export async function readSquareReleaseLedger(
  identity: SquareReleaseIdentity,
  deps: SquareReleaseReaderDeps = {},
): Promise<SquareReleaseLedgerRead> {
  const client = deps.client ?? supabaseAdmin;
  const key = squareReleaseKey(identity);
  const { data, error } = await client
    .from("credit_transactions")
    .select("id, type, amount, campaign_id, idempotency_key, metadata")
    .eq("store_id", identity.storeId)
    .eq("idempotency_key", key)
    .maybeSingle();

  if (error) return { kind: "read_failed" };
  if (!data) return { kind: "none" };

  const row = data as SquareReleaseDeductionRow;
  if (!isValidSquareReleaseDeduction(row, identity)) return { kind: "invalid" };

  const refund = await client
    .from("credit_transactions")
    .select("id")
    .eq("store_id", identity.storeId)
    .eq("type", "refund")
    .eq("reference", row.id)
    .maybeSingle();
  if (refund.error) return { kind: "read_failed" };
  if (refund.data) {
    const refundRow = refund.data as Record<string, unknown>;
    if (typeof refundRow.id !== "string") return { kind: "read_failed" };
    return { kind: "refunded", deductionId: row.id, refundId: refundRow.id };
  }
  return { kind: "delivered", deductionId: row.id };
}

export async function probeSquareReleaseArtifact(
  identity: SquareReleaseIdentity,
  deps: SquareReleaseProbeDeps = {},
): Promise<SquareReleaseArtifactProbe> {
  try {
    const result = await retrieveCompositionArtifact(
      {
        identity: {
          storeId: identity.storeId,
          campaignId: identity.campaignId,
          operationId: identity.verticalOperationId,
          role: "square_original",
        },
        authorization: { kind: "system" },
      },
      {
        client: deps.client ?? supabaseAdmin,
        downloadBytes:
          deps.downloadBytes ??
          createNodeHttpDownloadTransport((input) =>
            downloadStorageObjectViaNodeHttp({
              bucket: input.bucket,
              path: input.path,
              timeoutMs: 15000,
            }),
          ),
      },
    );
    switch (result.kind) {
      case "integral":
        return { kind: "integral" };
      case "absent":
        return { kind: "absent" };
      case "indeterminate":
        return { kind: "indeterminate" };
      case "invalid":
      case "metadata_conflict":
        return { kind: "invalid" };
    }
  } catch {
    return { kind: "indeterminate" };
  }
}

function ledgerToState(ledger: SquareReleaseLedgerRead): SquareReleaseState {
  switch (ledger.kind) {
    case "delivered":
      return "delivered";
    case "refunded":
      return "refunded";
    case "invalid":
      return "unavailable";
    case "read_failed":
      return "unknown";
    case "none":
      return "eligible";
  }
}

export async function readSquareReleaseSummary(
  input: {
    readonly storeId: string;
    readonly campaignId: string;
    readonly verticalOperationId: string;
  },
  deps: SquareReleaseReaderDeps = {},
): Promise<SquareReleaseSummary> {
  const artifact = await readSquareReleaseArtifact(input, deps);
  if (artifact.kind === "absent") {
    return { campaignId: input.campaignId, state: "incompatible", refunded: false };
  }
  if (artifact.kind === "read_failed") {
    return { campaignId: input.campaignId, state: "unknown", refunded: false };
  }
  const identity: SquareReleaseIdentity = {
    storeId: input.storeId,
    campaignId: input.campaignId,
    verticalOperationId: input.verticalOperationId,
    artifactId: artifact.artifact.artifactId,
    checksumSha256: artifact.artifact.checksumSha256,
  };
  const ledger = await readSquareReleaseLedger(identity, deps);
  const state = ledgerToState(ledger);
  return {
    campaignId: input.campaignId,
    state,
    refunded: ledger.kind === "refunded",
  };
}

/**
 * GET/POST do modal: estado durável, com probe de bytes somente quando ainda
 * não existe liberação. Uma liberação já paga não regride por falha transitória
 * de Storage; o download revalida os bytes na entrega.
 */
export async function readSquareReleaseStateForApi(
  identity: SquareReleaseIdentity,
  deps: SquareReleaseProbeDeps = {},
): Promise<SquareReleaseResult> {
  const ledger = await readSquareReleaseLedger(identity, deps);
  if (ledger.kind === "delivered") {
    return { state: "delivered", reason: null, refunded: false };
  }
  if (ledger.kind === "refunded") {
    return {
      state: "refunded",
      reason: "release_refunded",
      refunded: true,
    };
  }
  if (ledger.kind === "invalid") {
    return { state: "unavailable", reason: "release_unknown", refunded: false };
  }
  if (ledger.kind === "read_failed") {
    return { state: "unknown", reason: "release_unknown", refunded: false };
  }

  const probe = await probeSquareReleaseArtifact(identity, deps);
  switch (probe.kind) {
    case "integral":
      return { state: "eligible", reason: null, refunded: false };
    case "absent":
      return { state: "incompatible", reason: "artifact_absent", refunded: false };
    case "invalid":
      return { state: "unavailable", reason: "artifact_invalid", refunded: false };
    case "indeterminate":
      return {
        state: "unknown",
        reason: "artifact_indeterminate",
        refunded: false,
      };
  }
}
