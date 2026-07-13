import "server-only";

import { createServerClient } from "@/lib/supabase/server";

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
