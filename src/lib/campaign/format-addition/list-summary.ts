import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { resolveCampaignFormat } from "@/lib/campaign/format-resolution";
import type { FormatAdditionPresentationInput } from "@/lib/campaign/format-presentation";

import type { FormatAdditionSourceOrigin } from "./types";

/**
 * F62/62-06 — leitura em LOTE das adições para lista/dashboard.
 *
 * Até quatro consultas em lote por página (`campaign_format_additions`, crédito,
 * artefato vertical e outcome), independentemente do número de cards. Retornos
 * antecipados (sem candidatos/sem operações) podem executar menos consultas; o
 * caminho completo nunca faz N+1. O DTO do cliente recebe apenas
 * `formatAddition` sanitizado; `operationId` permanece server-only.
 */

export type FormatAdditionListState =
  | "delivered"
  | "processing"
  | "unknown"
  | "absent";

export interface FormatAdditionListSummary {
  readonly campaignId: string;
  /** Server-only; nunca vai ao DTO do cliente. */
  readonly operationId: string;
  readonly state: FormatAdditionListState;
  readonly sourceOrigin: FormatAdditionSourceOrigin;
  readonly refunded: boolean;
  /** A miniatura permanece a quadrada; nenhum path é exposto. */
  readonly preferredThumbnailPath: null;
}

export interface FormatAdditionListCampaignRow {
  readonly id: string;
  readonly input_snapshot: Record<string, unknown> | null;
}

const ADDITION_COLUMNS =
  "campaign_id, operation_id, source_origin, status, created_at";
const CREDIT_STATUSES = ["reserved", "art_uploaded", "delivered", "refunded"] as const;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function formatAdditionPresentation(
  summary: FormatAdditionListSummary,
): FormatAdditionPresentationInput {
  return summary.state === "absent"
    ? {
        format: "9:16",
        state: "absent",
        ...(summary.refunded ? { refunded: true } : {}),
      }
    : { format: "9:16", state: summary.state };
}

function pickAddition(
  rows: readonly Record<string, unknown>[],
): Record<string, unknown> | null {
  let refunded: Record<string, unknown> | null = null;
  for (const row of rows) {
    if (row.status === "delivered" || row.status === "open") return row;
    if (row.status === "refunded" && refunded === null) refunded = row;
  }
  return refunded;
}

export async function readFormatAdditionListSummaries(input: {
  readonly client: SupabaseClient;
  readonly storeId: string;
  readonly campaigns: readonly FormatAdditionListCampaignRow[];
}): Promise<Map<string, FormatAdditionListSummary>> {
  const candidates = input.campaigns.filter(
    (campaign) =>
      resolveCampaignFormat(campaign.input_snapshot).kind === "1:1",
  );
  const result = new Map<string, FormatAdditionListSummary>();
  if (candidates.length === 0) return result;

  const campaignIds = candidates.map((campaign) => campaign.id);
  const additions = await input.client
    .from("campaign_format_additions")
    .select(ADDITION_COLUMNS)
    .in("campaign_id", campaignIds)
    .eq("store_id", input.storeId)
    .order("created_at", { ascending: false });

  if (additions.error) {
    for (const campaign of candidates) {
      result.set(campaign.id, {
        campaignId: campaign.id,
        operationId: "",
        state: "unknown",
        sourceOrigin: "legacy_campaign",
        refunded: false,
        preferredThumbnailPath: null,
      });
    }
    return result;
  }

  const byCampaign = new Map<string, Record<string, unknown>[]>();
  for (const row of (additions.data ?? []) as unknown[]) {
    const record = asRecord(row);
    if (
      record === null ||
      typeof record.campaign_id !== "string" ||
      typeof record.operation_id !== "string" ||
      (record.source_origin !== "new_flow_1_1" &&
        record.source_origin !== "legacy_campaign") ||
      typeof record.status !== "string"
    ) {
      continue;
    }
    const list = byCampaign.get(record.campaign_id) ?? [];
    list.push(record);
    byCampaign.set(record.campaign_id, list);
  }

  const selected = new Map<string, Record<string, unknown>>();
  const operationIds: string[] = [];
  for (const campaign of candidates) {
    const chosen = pickAddition(byCampaign.get(campaign.id) ?? []);
    if (chosen === null) continue;
    selected.set(campaign.id, chosen);
    operationIds.push(chosen.operation_id as string);
  }
  if (operationIds.length === 0) return result;

  const [credits, artifacts, outcomes] = await Promise.all([
    input.client
      .from("product_1_1_campaign_credit_operations")
      .select("operation_id, status")
      .in("operation_id", operationIds)
      .eq("store_id", input.storeId),
    input.client
      .from("campaign_composition_artifacts")
      .select("operation_id, role, format, width, height, mime_type, storage_path")
      .in("operation_id", operationIds)
      .in("role", ["vertical"] as const),
    input.client
      .from("product_generation_operation_outcomes_v")
      .select("operation_id, outcome")
      .in("operation_id", operationIds),
  ]);

  const creditMap = new Map<string, (typeof CREDIT_STATUSES)[number]>();
  if (!credits.error) {
    for (const row of (credits.data ?? []) as unknown[]) {
      const record = asRecord(row);
      if (
        record !== null &&
        typeof record.operation_id === "string" &&
        typeof record.status === "string" &&
        (CREDIT_STATUSES as readonly string[]).includes(record.status)
      ) {
        creditMap.set(
          record.operation_id,
          record.status as (typeof CREDIT_STATUSES)[number],
        );
      }
    }
  }

  const verticalArtifacts = new Set<string>();
  if (!artifacts.error) {
    for (const row of (artifacts.data ?? []) as unknown[]) {
      const record = asRecord(row);
      if (
        record !== null &&
        typeof record.operation_id === "string" &&
        record.role === "vertical" &&
        record.format === "9:16" &&
        record.width === 1080 &&
        record.height === 1920 &&
        record.mime_type === "image/jpeg" &&
        typeof record.storage_path === "string"
      ) {
        verticalArtifacts.add(record.operation_id);
      }
    }
  }

  const outcomeMap = new Map<string, string>();
  if (!outcomes.error) {
    for (const row of (outcomes.data ?? []) as unknown[]) {
      const record = asRecord(row);
      if (
        record !== null &&
        typeof record.operation_id === "string" &&
        typeof record.outcome === "string"
      ) {
        outcomeMap.set(record.operation_id, record.outcome);
      }
    }
  }

  for (const campaign of candidates) {
    const row = selected.get(campaign.id);
    if (!row) continue;
    const operationId = row.operation_id as string;
    const status = row.status as string;
    const sourceOrigin = row.source_origin as FormatAdditionSourceOrigin;
    let state: FormatAdditionListState;
    let refunded = false;

    if (status === "refunded") {
      state = "absent";
      refunded = true;
    } else {
      const credit = creditMap.get(operationId);
      if (credit === "refunded") {
        state = "absent";
        refunded = true;
      } else if (credit === "delivered") {
        state = verticalArtifacts.has(operationId) ? "delivered" : "unknown";
      } else if (
        credits.error ||
        artifacts.error ||
        outcomes.error ||
        credit === undefined
      ) {
        state = "unknown";
      } else if (credit === "reserved" || credit === "art_uploaded") {
        state =
          outcomeMap.get(operationId) === "unknown" ? "unknown" : "processing";
      } else if (status === "delivered") {
        state = verticalArtifacts.has(operationId) ? "delivered" : "unknown";
      } else {
        state = "unknown";
      }
    }

    result.set(campaign.id, {
      campaignId: campaign.id,
      operationId,
      state,
      sourceOrigin,
      refunded,
      preferredThumbnailPath: null,
    });
  }

  return result;
}
