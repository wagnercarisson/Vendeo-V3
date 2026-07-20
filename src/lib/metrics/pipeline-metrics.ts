import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

export async function getSuccessRate(hours: number): Promise<number | null> {
  const { data, error } = await supabaseAdmin
    .from("generation_events")
    .select("status", { count: "exact", head: false })
    .eq("generation_type", "campaign_pipeline")
    .gte("created_at", hoursAgo(hours));

  if (error || !data || data.length === 0) return null;

  const successCount = data.filter((row) => row.status === "success").length;
  return Math.round((successCount / data.length) * 100);
}

export async function getErrorRate(hours: number): Promise<number | null> {
  const { data, error } = await supabaseAdmin
    .from("generation_events")
    .select("status", { count: "exact", head: false })
    .eq("generation_type", "campaign_pipeline")
    .gte("created_at", hoursAgo(hours));

  if (error || !data || data.length === 0) return 0;

  const failedCount = data.filter((row) => row.status === "failed").length;
  return Math.round((failedCount / data.length) * 100);
}

export async function getAvgCost(hours: number): Promise<number | null> {
  const { data, error } = await supabaseAdmin
    .from("generation_events")
    .select("estimated_cost_usd")
    .eq("generation_type", "campaign_pipeline")
    .not("estimated_cost_usd", "is", null)
    .gte("created_at", hoursAgo(hours));

  if (error || !data || data.length === 0) return null;

  const total = data.reduce((sum, row) => sum + (row.estimated_cost_usd ?? 0), 0);
  return Number((total / data.length).toFixed(6));
}

export async function getAvgDuration(hours: number): Promise<number | null> {
  const { data, error } = await supabaseAdmin
    .from("generation_events")
    .select("duration_ms")
    .eq("generation_type", "campaign_pipeline")
    .not("duration_ms", "is", null)
    .gte("created_at", hoursAgo(hours));

  if (error || !data || data.length === 0) return null;

  const total = data.reduce((sum, row) => sum + (row.duration_ms ?? 0), 0);
  return Math.round(total / data.length);
}

export async function getCreditsGranted(hours: number): Promise<number | null> {
  const { count, error } = await supabaseAdmin
    .from("credit_transactions")
    .select("id", { count: "exact", head: true })
    .eq("type", "grant")
    .gte("created_at", hoursAgo(hours));

  if (error) return null;
  return count ?? 0;
}

export async function getRefundRate(hours: number): Promise<number | null> {
  const { data, error } = await supabaseAdmin
    .from("credit_transactions")
    .select("type")
    .neq("type", "grant")
    .gte("created_at", hoursAgo(hours));

  if (error || !data || data.length === 0) return 0;

  const refundCount = data.filter((row) => row.type === "refund").length;
  return Math.round((refundCount / data.length) * 100);
}

export async function getActiveUsers(hours: number): Promise<number | null> {
  const { data, error } = await supabaseAdmin
    .from("generation_events")
    .select("user_id")
    .eq("generation_type", "campaign_pipeline")
    .not("user_id", "is", null)
    .gte("created_at", hoursAgo(hours));

  if (error || !data) return null;

  const uniqueUsers = new Set(data.map((row) => row.user_id));
  return uniqueUsers.size;
}
