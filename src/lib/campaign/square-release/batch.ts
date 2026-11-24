import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { resolveCampaignFormat } from "@/lib/campaign/format-resolution";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { FormatReleasePresentationInput } from "@/lib/campaign/format-presentation";

import { isValidSquareReleaseDeduction, squareReleaseKey } from "./identity";
import type {
  SquareReleaseDeductionRow,
  SquareReleaseIdentity,
  SquareReleaseState,
  SquareReleaseSummary,
} from "./types";

export interface SquareReleaseBatchCampaign {
  readonly id: string;
  readonly input_snapshot: Record<string, unknown> | null;
}

export interface SquareReleaseBatchDeps {
  readonly client?: SupabaseClient;
}

const SELECT_DEDUCTION =
  "id, type, amount, campaign_id, idempotency_key, metadata" as const;

/**
 * Leitura em LOTE dos estados da liberação para lista/dashboard.
 *
 * Até quatro consultas por página (operações verticais, artefatos, deduções e
 * refunds), independentemente do número de cards. Nenhum byte é baixado e
 * nenhuma validação binária ocorre por card.
 */
export async function readSquareReleaseListSummaries(
  input: {
    readonly storeId: string;
    readonly campaigns: readonly SquareReleaseBatchCampaign[];
  },
  deps: SquareReleaseBatchDeps = {},
): Promise<Map<string, SquareReleaseSummary>> {
  const client = deps.client ?? supabaseAdmin;
  const candidates = input.campaigns.filter(
    (campaign) => resolveCampaignFormat(campaign.input_snapshot).kind === "9:16",
  );
  const summaries = new Map<string, SquareReleaseSummary>();
  if (candidates.length === 0) return summaries;

  const campaignIds = candidates.map((campaign) => campaign.id);
  const [operations, artifacts] = await Promise.all([
    client
      .from("product_9_16_two_stage_operations")
      .select("campaign_id, operation_id")
      .eq("store_id", input.storeId)
      .in("campaign_id", campaignIds),
    client
      .from("campaign_composition_artifacts")
      .select("campaign_id, operation_id, id, checksum_sha256")
      .eq("store_id", input.storeId)
      .in("campaign_id", campaignIds)
      .eq("role", "square_original")
      .eq("format", "1:1"),
  ]);

  if (operations.error || artifacts.error) {
    for (const campaign of candidates) {
      summaries.set(campaign.id, {
        campaignId: campaign.id,
        state: "unknown",
        refunded: false,
      });
    }
    return summaries;
  }

  const operationByCampaign = new Map<string, string[]>();
  for (const row of (operations.data ?? []) as Record<string, unknown>[]) {
    if (typeof row.campaign_id !== "string" || typeof row.operation_id !== "string") {
      continue;
    }
    const list = operationByCampaign.get(row.campaign_id) ?? [];
    list.push(row.operation_id);
    operationByCampaign.set(row.campaign_id, list);
  }

  const artifactByOperations = new Map<
    string,
    { artifactId: string; checksumSha256: string }[]
  >();
  for (const row of (artifacts.data ?? []) as Record<string, unknown>[]) {
    if (
      typeof row.campaign_id !== "string" ||
      typeof row.operation_id !== "string" ||
      typeof row.id !== "string" ||
      typeof row.checksum_sha256 !== "string"
    ) {
      continue;
    }
    const mapKey = `${row.campaign_id}:${row.operation_id}`;
    const list = artifactByOperations.get(mapKey) ?? [];
    list.push({
      artifactId: row.id,
      checksumSha256: row.checksum_sha256,
    });
    artifactByOperations.set(mapKey, list);
  }

  const identityByCampaign = new Map<string, SquareReleaseIdentity>();
  for (const campaign of candidates) {
    const operationsForCampaign = operationByCampaign.get(campaign.id) ?? [];
    if (operationsForCampaign.length !== 1) {
      summaries.set(campaign.id, {
        campaignId: campaign.id,
        state:
          operationsForCampaign.length === 0 ? "incompatible" : "unknown",
        refunded: false,
      });
      continue;
    }
    const verticalOperationId = operationsForCampaign[0];
    const artifactsForCampaign =
      artifactByOperations.get(`${campaign.id}:${verticalOperationId}`) ?? [];
    if (artifactsForCampaign.length === 0) {
      summaries.set(campaign.id, {
        campaignId: campaign.id,
        state: "incompatible",
        refunded: false,
      });
      continue;
    }
    if (artifactsForCampaign.length !== 1) {
      summaries.set(campaign.id, {
        campaignId: campaign.id,
        state: "unknown",
        refunded: false,
      });
      continue;
    }
    identityByCampaign.set(campaign.id, {
      storeId: input.storeId,
      campaignId: campaign.id,
      verticalOperationId,
      artifactId: artifactsForCampaign[0].artifactId,
      checksumSha256: artifactsForCampaign[0].checksumSha256,
    });
  }

  const identities = [...identityByCampaign.values()];
  if (identities.length === 0) return summaries;

  const keys = identities.map((identity) => squareReleaseKey(identity));
  const deductions = await client
    .from("credit_transactions")
    .select(SELECT_DEDUCTION)
    .eq("store_id", input.storeId)
    .in("idempotency_key", keys);
  if (deductions.error) {
    for (const identity of identities) {
      summaries.set(identity.campaignId, {
        campaignId: identity.campaignId,
        state: "unknown",
        refunded: false,
      });
    }
    return summaries;
  }

  const deductionByIdentity = new Map<
    string,
    { row: SquareReleaseDeductionRow; valid: boolean }
  >();
  for (const raw of (deductions.data ?? []) as Record<string, unknown>[]) {
    if (typeof raw.campaign_id !== "string") continue;
    const row = raw as unknown as SquareReleaseDeductionRow;
    const identity = identityByCampaign.get(raw.campaign_id);
    if (!identity) continue;
    deductionByIdentity.set(identity.campaignId, {
      row,
      valid: isValidSquareReleaseDeduction(row, identity),
    });
  }

  const deductionIds = [...deductionByIdentity.values()]
    .filter((entry) => entry.valid)
    .map((entry) => entry.row.id);
  const refundedIds = new Set<string>();
  if (deductionIds.length > 0) {
    const refunds = await client
      .from("credit_transactions")
      .select("id, reference")
      .eq("store_id", input.storeId)
      .eq("type", "refund")
      .in("reference", deductionIds);
    if (refunds.error) {
      for (const identity of identities) {
        summaries.set(identity.campaignId, {
          campaignId: identity.campaignId,
          state: "unknown",
          refunded: false,
        });
      }
      return summaries;
    }
    for (const row of (refunds.data ?? []) as Record<string, unknown>[]) {
      if (typeof row.reference === "string") refundedIds.add(row.reference);
    }
  }

  for (const identity of identities) {
    const deduction = deductionByIdentity.get(identity.campaignId);
    let state: SquareReleaseState;
    if (!deduction) {
      state = "eligible";
    } else if (!deduction.valid) {
      state = "unavailable";
    } else if (refundedIds.has(deduction.row.id)) {
      state = "refunded";
    } else {
      state = "delivered";
    }
    summaries.set(identity.campaignId, {
      campaignId: identity.campaignId,
      state,
      refunded: state === "refunded",
    });
  }

  return summaries;
}

/**
 * Converte o estado do lote no input de apresentação. `eligible` permanece
 * `null`: o formato continua ausente/not_requested e a ação do chip é decidida
 * pelo DTO da página.
 */
export function squareReleasePresentation(
  summary: SquareReleaseSummary | undefined,
): FormatReleasePresentationInput | null {
  if (!summary || summary.state === "eligible" || summary.state === "incompatible") {
    return null;
  }
  switch (summary.state) {
    case "delivered":
      return { format: "1:1", state: "delivered" };
    case "refunded":
      return { format: "1:1", state: "refunded" };
    case "unknown":
      return { format: "1:1", state: "unknown" };
    case "unavailable":
      return { format: "1:1", state: "unavailable" };
  }
}
