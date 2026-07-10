import "server-only";
import { createServerClient, supabaseAdmin } from "@/lib/supabase/server";
import type { CampaignStatus } from "./types";

export interface CampaignListItem {
  id: string;
  productName: string;
  status: CampaignStatus;
  createdAt: string;
  thumbnailUrl: string | null;
  storagePath: string;
}

function mapToListItem(row: {
  id: string;
  product_name: string;
  status: string;
  created_at: string;
  storage_path: string;
}): CampaignListItem {
  return {
    id: row.id,
    productName: row.product_name,
    status: row.status as CampaignStatus,
    createdAt: row.created_at,
    thumbnailUrl: null,
    storagePath: row.storage_path,
  };
}

export async function listCampaigns(
  storeId: string,
): Promise<CampaignListItem[]> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("campaigns")
    .select("id, product_name, status, created_at, storage_path")
    .eq("store_id", storeId)
    .in("status", ["ready", "error"])
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(error.message);
  }

  const items = (data ?? []).map(mapToListItem);
  const thumbnails = await generateBatchThumbnailUrls(items);

  return items.map((item) => ({
    ...item,
    thumbnailUrl: thumbnails[item.id] ?? null,
  }));
}

export async function generateBatchThumbnailUrls(
  items: Pick<CampaignListItem, "id" | "status" | "storagePath">[],
): Promise<Record<string, string | null>> {
  const readyItems = items.filter(
    (item) => item.status === "ready" && item.storagePath,
  );

  const thumbnails: Record<string, string | null> = {};
  for (const item of readyItems) {
    thumbnails[item.id] = null;
  }

  const results = await Promise.allSettled(
    readyItems.map((item) =>
      supabaseAdmin.storage
        .from("campaign-images")
        .createSignedUrl(item.storagePath, 3600)
        .then((res) => ({ id: item.id, url: res.data?.signedUrl ?? null })),
    ),
  );

  for (const result of results) {
    if (result.status === "fulfilled" && result.value.url) {
      thumbnails[result.value.id] = result.value.url;
    }
  }

  return thumbnails;
}
