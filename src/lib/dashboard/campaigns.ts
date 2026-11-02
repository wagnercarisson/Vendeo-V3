import "server-only";

import { createServerClient } from "@/lib/supabase/server";
import { generateBatchThumbnailUrls } from "@/lib/campaign/list";
import { countReadyCampaigns } from "@/lib/campaign/metrics";

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
    .select("id, product_name, created_at, storage_path")
    .eq("store_id", storeId)
    .eq("status", "ready")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as EligibleCampaignRow[];

  const thumbnails = await generateBatchThumbnailUrls(
    rows.map((row) => ({
      id: row.id,
      status: "ready" as const,
      storagePath: row.storage_path,
    })),
  );

  return rows.map((row) => ({
    id: row.id,
    productName: row.product_name,
    createdAt: row.created_at,
    thumbnailUrl: thumbnails[row.id] ?? null,
  }));
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
