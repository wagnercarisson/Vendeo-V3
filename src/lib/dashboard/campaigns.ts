import "server-only";

import { createServerClient, supabaseAdmin } from "@/lib/supabase/server";
import { generateBatchThumbnailUrls, generateBatchPreferredThumbnailUrls } from "@/lib/campaign/list";
import {
  readTwoFormatListSummaries,
  type TwoFormatListSummary,
} from "@/lib/product-two-format/list-summary";
import type { TwoFormatDeliveryState, TwoFormatFormat } from "@/lib/product-two-format/types";
import { countReadyCampaigns } from "@/lib/campaign/metrics";
import {
  resolveCampaignFormat,
  type CampaignFormat,
} from "@/lib/campaign/format-resolution";
import {
  buildIndividualFormatPresentation,
  buildJointFormatPresentation,
  buildUnavailableFormatPresentation,
  buildUnknownFormatPresentation,
  type CampaignFormatPresentation,
} from "@/lib/campaign/format-presentation";
import { classifyTwoFormatCampaign } from "@/lib/product-two-format/contracts";

export const DASHBOARD_CAMPAIGN_LIMIT = 3;

/**
 * DTO enxuto exposto ao dashboard. Nunca inclui `storage_path` (T-58-01):
 * somente a URL assinada é propagada ao cliente.
 */
export interface EligibleCampaignCard {
  id: string;
  productName: string;
  createdAt: string;
  thumbnailUrl: string | null;
  /** Quick 261106-qxn — resolvido no servidor; `null` = indisponível. */
  format: CampaignFormat | null;
  joint?: boolean;
  formats?: Readonly<Record<TwoFormatFormat, TwoFormatDeliveryState>>;
  preferredFormat?: TwoFormatFormat | null;
  /**
   * F61 — apresentação PADRONIZADA dos formatos `1:1`/`9:16`, montada
   * SERVER-SIDE com a MESMA matriz da listagem (classificação conjunta antes do
   * individual). Somente estados/booleanos: nenhum snapshot/path/URL.
   */
  readonly formatPresentation: CampaignFormatPresentation;
}

export interface EligibleCampaignOverview {
  count: number;
  items: EligibleCampaignCard[];
}

interface EligibleCampaignRow {
  id: string;
  product_name: string;
  created_at: string;
  storage_path: string;
  input_snapshot: Record<string, unknown> | null;
}

/**
 * F61 — matriz de apresentação (61-CONTEXT §5) para UMA campanha elegível.
 *
 * Mesma ordem da listagem: classificação conjunta ANTES do individual.
 * `inconsistent` ⇒ ambos `unavailable`; conjunto sem leitura ⇒ ambos `unknown`;
 * individual usa `resolveCampaignFormat` (aqui o ciclo é sempre `delivered`,
 * pois todas as linhas chegam com `status = "ready"`).
 *
 * Puro sobre `rows`/`summaries` já obtidos: nenhuma consulta/assinatura extra.
 */
function buildDashboardFormatPresentation(input: {
  readonly inputSnapshot: Record<string, unknown> | null;
  readonly summary: TwoFormatListSummary | undefined;
}): CampaignFormatPresentation {
  const classification = classifyTwoFormatCampaign(input.inputSnapshot);

  if (classification.kind === "inconsistent") {
    return buildUnavailableFormatPresentation();
  }

  if (classification.kind === "two_format") {
    const summary = input.summary;
    if (!summary) return buildUnknownFormatPresentation();

    const view = summary.view;
    if (view === null) {
      return buildJointFormatPresentation({
        "1:1": { state: summary.formats["1:1"], refunded: false },
        "9:16": { state: summary.formats["9:16"], refunded: false },
      });
    }
    return buildJointFormatPresentation({
      "1:1": {
        state: view.square.state,
        refunded: view.square.creditRefunded,
      },
      "9:16": {
        state: view.vertical.state,
        refunded: view.vertical.creditRefunded,
      },
    });
  }

  return buildIndividualFormatPresentation({
    resolution: resolveCampaignFormat(input.inputSnapshot),
    lifecycle: "delivered",
  });
}

/**
 * Consulta no máximo `limit` campanhas elegíveis (`status = "ready"`) da loja,
 * ordenadas por `created_at` desc. O filtro de status acontece na origem: nenhuma
 * campanha `generating`/`error` chega à composição do dashboard (D-01).
 */
export async function queryEligibleCampaigns(
  storeId: string,
  limit = DASHBOARD_CAMPAIGN_LIMIT,
): Promise<EligibleCampaignCard[]> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("campaigns")
    .select("id, product_name, created_at, storage_path, input_snapshot")
    .eq("store_id", storeId)
    .eq("status", "ready")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as EligibleCampaignRow[];

  const summaries = await readTwoFormatListSummaries({
    // RLS: vínculos conjuntos são legíveis apenas por `service_role`. Leitura
    // privilegiada server-side, após a autorização do dashboard, com escopo de
    // loja/campanhas no helper.
    client: supabaseAdmin,
    storeId,
    campaigns: rows.map((row) => ({
      id: row.id,
      input_snapshot: row.input_snapshot,
    })),
  });
  const preferredThumbnails = await generateBatchPreferredThumbnailUrls(
    [...summaries.values()].map((summary) => ({
      id: summary.campaignId,
      preferredThumbnailPath: summary.preferredThumbnailPath,
    })),
  );
  const thumbnails = await generateBatchThumbnailUrls(
    rows
      .filter((row) => !summaries.has(row.id))
      .map((row) => ({
        id: row.id,
        status: "ready" as const,
        storagePath: row.storage_path,
      })),
  );

  return rows.map((row) => {
    const summary = summaries.get(row.id);
    const formatPresentation = buildDashboardFormatPresentation({
      inputSnapshot: row.input_snapshot,
      summary,
    });
    if (summary) {
      return {
        id: row.id,
        productName: row.product_name,
        createdAt: row.created_at,
        thumbnailUrl: preferredThumbnails[row.id] ?? null,
        format: null,
        joint: true,
        formats: summary.formats,
        preferredFormat: summary.preferredFormat,
        formatPresentation,
      };
    }
    const formatResolution = resolveCampaignFormat(row.input_snapshot);
    return {
      id: row.id,
      productName: row.product_name,
      createdAt: row.created_at,
      thumbnailUrl: thumbnails[row.id] ?? null,
      format:
        formatResolution.kind === "unavailable" ? null : formatResolution.kind,
      formatPresentation,
    };
  });
}

/**
 * Composição da seção de campanhas do dashboard: contagem `ready`-only
 * (`countReadyCampaigns`) e até 3 cartões elegíveis, em paralelo.
 */
export async function loadEligibleCampaignOverview(
  storeId: string,
): Promise<EligibleCampaignOverview> {
  const [count, items] = await Promise.all([
    countReadyCampaigns(storeId),
    queryEligibleCampaigns(storeId),
  ]);

  return { count, items };
}
