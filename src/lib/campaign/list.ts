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

export interface ListCampaignsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: Array<"ready" | "error">;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: "created_at" | "product_name" | "status";
  sortOrder?: "asc" | "desc";
}

export interface ListCampaignsResult {
  items: CampaignListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
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
  params?: ListCampaignsParams,
): Promise<ListCampaignsResult> {
  const supabase = await createServerClient();

  const {
    page = 1,
    pageSize = 10,
    search,
    status = ["ready", "error"],
    dateFrom,
    dateTo,
    sortBy = "created_at",
    sortOrder = "desc",
  } = params ?? {};

  let query = supabase
    .from("campaigns")
    .select("id, product_name, status, created_at, storage_path", { count: "exact" })
    .eq("store_id", storeId)
    .in("status", status);

  if (search) {
    query = query.ilike("product_name", `%${search}%`);
  }

  if (dateFrom) {
    query = query.gte("created_at", dateFrom);
  }

  if (dateTo) {
    query = query.lte("created_at", dateTo);
  }

  query = query.order(sortBy, { ascending: sortOrder === "asc" });

  const from = (page - 1) * pageSize;
  const to = page * pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const items = (data ?? []).map(mapToListItem);
  const thumbnails = await generateBatchThumbnailUrls(items);
  const itemsWithThumbnails = items.map((item) => ({
    ...item,
    thumbnailUrl: thumbnails[item.id] ?? null,
  }));

  const total = count ?? itemsWithThumbnails.length;

  return {
    items: itemsWithThumbnails,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize) || 1,
  };
}

export async function countCampaignsFiltered(
  storeId: string,
  params?: ListCampaignsParams,
): Promise<number> {
  const supabase = await createServerClient();

  const {
    search,
    status = ["ready", "error"],
    dateFrom,
    dateTo,
  } = params ?? {};

  let query = supabase
    .from("campaigns")
    .select("*", { count: "exact", head: true })
    .eq("store_id", storeId)
    .in("status", status);

  if (search) {
    query = query.ilike("product_name", `%${search}%`);
  }

  if (dateFrom) {
    query = query.gte("created_at", dateFrom);
  }

  if (dateTo) {
    query = query.lte("created_at", dateTo);
  }

  const { count, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
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
