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
  const { data, error } = await supabaseAdmin
    .from("credit_transactions")
    .select("amount")
    .eq("type", "grant")
    .gte("created_at", hoursAgo(hours));

  if (error || !data) return null;
  if (data.length === 0) return 0;
  return data.reduce((sum, row) => sum + (row.amount ?? 0), 0);
}

export async function getRefundRate(hours: number): Promise<number | null> {
  const { data, error } = await supabaseAdmin
    .from("credit_transactions")
    .select("id, type, amount, campaign_id, metadata, reference")
    .gte("created_at", hoursAgo(hours));

  if (error || !data) return null;
  if (data.length === 0) return 0;

  // Separate deductions and refunds
  const deductions: Array<{ id: string; campaign_id: string | null; metadata: Record<string, unknown> | null }> = [];
  const refunds: Array<{ reference: string | null }> = [];

  for (const row of data) {
    if (row.type === "deduction") {
      deductions.push(row as any);
    } else if (row.type === "refund") {
      refunds.push(row as any);
    }
  }

  // Classify deductions as campaign or not
  const campaignDeductionIds = new Set<string>();
  let campaignDeductionCount = 0;

  for (const d of deductions) {
    const metadata = d.metadata as Record<string, unknown> | null;
    const feature = metadata?.feature as string | undefined;

    if (feature === "campaign_pipeline") {
      // Explicitly tagged campaign deduction
      campaignDeductionIds.add(d.id);
      campaignDeductionCount++;
    } else if ((!metadata || !metadata.feature) && d.campaign_id) {
      // Legacy campaign deduction: null/empty metadata but campaign_id is set
      campaignDeductionIds.add(d.id);
      campaignDeductionCount++;
    }
    // VS deductions (feature="visual_signature") and anomalies (null metadata + null campaign_id) are excluded
  }

  // Classify refunds: refund inherits classification from the deduction it references
  let campaignRefundCount = 0;
  for (const r of refunds) {
    if (r.reference && campaignDeductionIds.has(r.reference)) {
      campaignRefundCount++;
    }
  }

  return campaignDeductionCount > 0
    ? Math.round((campaignRefundCount / campaignDeductionCount) * 100)
    : 0;
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
