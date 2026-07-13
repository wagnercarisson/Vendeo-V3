import "server-only";

import { createServerClient } from "@/lib/supabase/server";

import type { CampaignStatus } from "./types";

export async function countCampaigns(storeId: string): Promise<number> {
  const supabase = await createServerClient();

  const { count, error } = await supabase
    .from("campaigns")
    .select("*", { count: "exact", head: true })
    .eq("store_id", storeId)
    .in("status", ["ready", "error"]);

  if (error) throw new Error(error.message);

  return count ?? 0;
}

export async function countReadyCampaigns(storeId: string): Promise<number> {
  const supabase = await createServerClient();

  const { count, error } = await supabase
    .from("campaigns")
    .select("*", { count: "exact", head: true })
    .eq("store_id", storeId)
    .eq("status", "ready");

  if (error) throw new Error(error.message);

  return count ?? 0;
}

export async function getCampaignSuccessRate(
  storeId: string,
): Promise<number> {
  const [total, ready] = await Promise.all([
    countCampaigns(storeId),
    countReadyCampaigns(storeId),
  ]);

  if (total === 0) return 0;

  return Math.round((ready / total) * 100);
}

export async function getRecentCampaigns(
  storeId: string,
  limit = 5,
): Promise<RecentCampaignItem[]> {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("campaigns")
    .select("id, product_name, status, created_at")
    .eq("store_id", storeId)
    .in("status", ["ready", "error"])
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id,
    productName: row.product_name,
    status: row.status as CampaignStatus,
    createdAt: row.created_at,
  }));
}

export interface RecentCampaignItem {
  id: string;
  productName: string;
  status: CampaignStatus;
  createdAt: string;
}
