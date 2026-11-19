import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { classifyTwoFormatCampaign } from "./contracts";
import {
  deriveTwoFormatDeliveryView,
  type TwoFormatArtifactState,
  type TwoFormatCreditState,
  type TwoFormatDeliverySource,
  type TwoFormatDeliveryView,
  type TwoFormatLinkState,
} from "./read-model";
import { resolveTwoFormatAccess } from "./access";
import type {
  TwoFormatDeliveryLink,
  TwoFormatDeliveryState,
  TwoFormatFormat,
} from "./types";

/**
 * F60.7 C3 — leitura em LOTE para lista/dashboard.
 *
 * Cinco consultas no total (campanhas, operações, vínculos, créditos e
 * artefatos), independentemente do número de cards. Agrupa por campanha e
 * reutiliza o derivador puro `deriveTwoFormatDeliveryView`; nunca expõe
 * `input_snapshot`.
 */

export interface TwoFormatListSummary {
  readonly campaignId: string;
  readonly operationId: string | null;
  readonly formats: Readonly<Record<TwoFormatFormat, TwoFormatDeliveryState>>;
  readonly preferredFormat: TwoFormatFormat | null;
  readonly preferredThumbnailPath: string | null;
  readonly view: TwoFormatDeliveryView | null;
}

export interface TwoFormatListCampaignRow {
  readonly id: string;
  readonly input_snapshot: Record<string, unknown> | null;
}

const CREDIT_STATUSES = ["reserved", "art_uploaded", "delivered", "refunded"] as const;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function linkFor(
  row: Record<string, unknown>,
): TwoFormatDeliveryLink | null {
  const campaignId = row.campaign_id;
  const operationId = row.operation_id;
  const storeId = row.store_id;
  const format = row.format;
  const deliveryOperationId = row.delivery_operation_id;
  const artifactRole = row.artifact_role;
  const createdAt = row.created_at;
  if (
    typeof campaignId !== "string" ||
    typeof operationId !== "string" ||
    typeof storeId !== "string" ||
    (format !== "1:1" && format !== "9:16") ||
    typeof deliveryOperationId !== "string" ||
    (artifactRole !== "square_original" && artifactRole !== "vertical") ||
    typeof createdAt !== "string"
  ) {
    return null;
  }
  return {
    campaignId,
    operationId,
    storeId,
    format,
    deliveryOperationId,
    artifactRole,
    createdAt,
  };
}

function sourceFor(input: {
  format: TwoFormatFormat;
  link: TwoFormatLinkState;
  credits: Map<string, TwoFormatCreditState>;
  artifacts: Map<string, TwoFormatArtifactState>;
  operationId: string;
}): TwoFormatDeliverySource {
  if (input.link.kind !== "found") {
    return {
      format: input.format,
      link: input.link,
      credit: { kind: "missing" },
      artifact: { kind: "missing" },
    };
  }
  const credit =
    input.credits.get(input.link.link.deliveryOperationId) ?? { kind: "missing" };
  const role = input.link.link.artifactRole;
  const artifact =
    input.artifacts.get(`${input.operationId}:${role}`) ?? { kind: "missing" };
  return { format: input.format, link: input.link, credit, artifact };
}

function preferredFormatFor(view: TwoFormatDeliveryView): TwoFormatFormat | null {
  return view.square.state === "delivered"
    ? "1:1"
    : view.vertical.state === "delivered"
      ? "9:16"
      : null;
}

/**
 * Retorna o mapa por campanha. `thumbnailFormat` é o formato preferido; o
 * chamador resolve `thumbnailPath` com `resolveTwoFormatAccess` (autoridade
 * única) e assina em lote.
 */
export async function readTwoFormatListSummaries(input: {
  readonly client: SupabaseClient;
  readonly storeId: string;
  readonly campaigns: readonly TwoFormatListCampaignRow[];
}): Promise<Map<string, TwoFormatListSummary>> {
  const campaigns = input.campaigns.filter(
    (campaign) =>
      classifyTwoFormatCampaign(campaign.input_snapshot).kind === "two_format",
  );
  const result = new Map<string, TwoFormatListSummary>();
  if (campaigns.length === 0) return result;

  const campaignIds = campaigns.map((campaign) => campaign.id);

  const [operations, links, credits, artifacts] = await Promise.all([
    input.client
      .from("product_9_16_two_stage_operations")
      .select("campaign_id, operation_id")
      .in("campaign_id", campaignIds)
      .eq("store_id", input.storeId),
    input.client
      .from("product_two_format_deliveries")
      .select(
        "campaign_id, operation_id, store_id, format, delivery_operation_id, artifact_role, created_at",
      )
      .in("campaign_id", campaignIds)
      .eq("store_id", input.storeId),
    input.client
      .from("product_1_1_campaign_credit_operations")
      .select("operation_id, status")
      .in("campaign_id", campaignIds)
      .eq("store_id", input.storeId),
    input.client
      .from("campaign_composition_artifacts")
      .select(
        "campaign_id, operation_id, role, format, width, height, mime_type, artifact_path:storage_path",
      )
      .in("campaign_id", campaignIds)
      .in("role", ["square_original", "vertical"] as const),
  ]);

  const readFailed =
    Boolean(operations.error) ||
    Boolean(links.error) ||
    Boolean(credits.error) ||
    Boolean(artifacts.error);
  if (readFailed) {
    for (const campaign of campaigns) {
      result.set(campaign.id, {
        campaignId: campaign.id,
        operationId: null,
        formats: { "1:1": "unknown", "9:16": "unknown" },
        preferredFormat: null,
        preferredThumbnailPath: null,
        view: null,
      });
    }
    return result;
  }

  const operationsByCampaign = new Map<string, string>();
  for (const row of (operations.data ?? []) as Record<string, unknown>[]) {
    if (typeof row.campaign_id === "string" && typeof row.operation_id === "string") {
      operationsByCampaign.set(row.campaign_id, row.operation_id);
    }
  }

  const creditMap = new Map<string, TwoFormatCreditState>();
  for (const row of (credits.data ?? []) as Record<string, unknown>[]) {
    if (
      typeof row.operation_id === "string" &&
      typeof row.status === "string" &&
      (CREDIT_STATUSES as readonly string[]).includes(row.status)
    ) {
      creditMap.set(row.operation_id, {
        kind: "found",
        status: row.status as (typeof CREDIT_STATUSES)[number],
      });
    }
  }

  const artifactMap = new Map<string, TwoFormatArtifactState>();
  for (const row of (artifacts.data ?? []) as Record<string, unknown>[]) {
    const operationId = row.operation_id;
    const role = row.role;
    if (
      typeof operationId !== "string" ||
      (role !== "square_original" && role !== "vertical") ||
      typeof row.format !== "string" ||
      typeof row.width !== "number" ||
      typeof row.height !== "number" ||
      typeof row.mime_type !== "string" ||
      typeof row.artifact_path !== "string"
    ) {
      continue;
    }
    artifactMap.set(`${operationId}:${role}`, {
      kind: "found",
      role,
      format: row.format,
      width: row.width,
      height: row.height,
      mimeType: row.mime_type,
      storagePath: row.artifact_path,
    });
  }

  const linksByCampaign = new Map<string, Record<string, unknown>[]>();
  for (const row of (links.data ?? []) as Record<string, unknown>[]) {
    if (typeof row.campaign_id !== "string") continue;
    const list = linksByCampaign.get(row.campaign_id) ?? [];
    list.push(row);
    linksByCampaign.set(row.campaign_id, list);
  }

  for (const campaign of campaigns) {
    const operationId = operationsByCampaign.get(campaign.id) ?? null;
    if (!operationId) {
      result.set(campaign.id, {
        campaignId: campaign.id,
        operationId: null,
        formats: { "1:1": "unavailable", "9:16": "unavailable" },
        preferredFormat: null,
        preferredThumbnailPath: null,
        view: null,
      });
      continue;
    }
    const linkRows = linksByCampaign.get(campaign.id) ?? [];
    const byFormat = new Map<TwoFormatFormat, TwoFormatLinkState>();
    for (const row of linkRows) {
      const link = linkFor(row);
      if (link === null) continue;
      byFormat.set(link.format, { kind: "found", link });
    }
    const squareLink = byFormat.get("1:1") ?? { kind: "missing" as const };
    const verticalLink = byFormat.get("9:16") ?? { kind: "missing" as const };
    const view = deriveTwoFormatDeliveryView({
      campaignId: campaign.id,
      operationId,
      square: sourceFor({
        format: "1:1",
        link: squareLink,
        credits: creditMap,
        artifacts: artifactMap,
        operationId,
      }),
      vertical: sourceFor({
        format: "9:16",
        link: verticalLink,
        credits: creditMap,
        artifacts: artifactMap,
        operationId,
      }),
    });
    const preferredFormat = preferredFormatFor(view);
    const access =
      preferredFormat === null
        ? null
        : resolveTwoFormatAccess({ view, format: preferredFormat });
    result.set(campaign.id, {
      campaignId: campaign.id,
      operationId,
      formats: {
        "1:1": view.square.state,
        "9:16": view.vertical.state,
      },
      preferredFormat,
      preferredThumbnailPath:
        access?.allowed === true ? access.thumbnailPath : null,
      view,
    });
  }

  return result;
}
