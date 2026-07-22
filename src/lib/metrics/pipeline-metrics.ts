import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

// ─── Campaign domain ──────────────────────────────────────────────

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

// ─── Shared domain-refund classifier ──────────────────────────────

/**
 * Shared helper for cross-window refund reference resolution.
 *
 * 1. Queries all credit_transactions in the time window.
 * 2. Separates deductions and refunds.
 * 3. Classifies eligible deductions using `isDomainDeduction` predicate.
 * 4. Classifies refunds whose reference is in the eligible set.
 * 5. Cross-window step: for orphan refunds (reference not in any eligible set),
 *    does a second SELECT .in("id", orphanRefs) with no time filter.
 * 6. Classifies referenced deductions from the second query.
 * 7. Returns { deductionCount, refundCount }.
 */
async function classifyDomainRefunds(
  hours: number,
  isDomainDeduction: (deduction: {
    id: string;
    metadata: Record<string, unknown> | null;
    campaign_id: string | null;
  }) => boolean,
): Promise<{ deductionCount: number; refundCount: number }> {
  const { data, error } = await supabaseAdmin
    .from("credit_transactions")
    .select("id, type, amount, campaign_id, metadata, reference")
    .gte("created_at", hoursAgo(hours));

  if (error || !data || data.length === 0) return { deductionCount: 0, refundCount: 0 };

  // Separate deductions and refunds
  const deductions: Array<{ id: string; campaign_id: string | null; metadata: Record<string, unknown> | null; reference: string | null }> = [];
  const refunds: Array<{ id: string; reference: string | null }> = [];

  for (const row of data) {
    if (row.type === "deduction") {
      deductions.push(row as any);
    } else if (row.type === "refund") {
      refunds.push(row as any);
    }
  }

  // Classify eligible deductions
  const eligibleIds = new Set<string>();
  let deductionCount = 0;

  for (const d of deductions) {
    if (isDomainDeduction(d)) {
      eligibleIds.add(d.id);
      deductionCount++;
    }
  }

  // Classify refunds referencing eligible deductions
  const orphanRefs: string[] = [];
  let refundCount = 0;

  for (const r of refunds) {
    if (r.reference && eligibleIds.has(r.reference)) {
      refundCount++;
    } else if (r.reference) {
      orphanRefs.push(r.reference);
    }
  }

  // Cross-window step: resolve orphan refunds via second query (no time filter)
  if (orphanRefs.length > 0) {
    const { data: outsideData, error: outsideError } = await supabaseAdmin
      .from("credit_transactions")
      .select("id, type, amount, campaign_id, metadata, reference")
      .in("id", orphanRefs);

    if (!outsideError && outsideData && outsideData.length > 0) {
      for (const orphanDeduction of outsideData) {
        if (orphanDeduction.type === "deduction" && isDomainDeduction(orphanDeduction as any)) {
          // The deduction is in our domain, so the refund belongs here
          refundCount++;
        }
      }
    }
  }

  return { deductionCount, refundCount };
}

function isCampaignDeduction(d: { id: string; campaign_id: string | null; metadata: Record<string, unknown> | null }): boolean {
  const metadata = d.metadata as Record<string, unknown> | null;
  const feature = metadata?.feature as string | undefined;

  if (feature === "campaign_pipeline") return true;
  if ((!metadata || !metadata.feature) && d.campaign_id) return true;
  return false;
}

function isVsDeduction(d: { id: string; campaign_id: string | null; metadata: Record<string, unknown> | null }): boolean {
  const metadata = d.metadata as Record<string, unknown> | null;
  const feature = metadata?.feature as string | undefined;
  return feature === "visual_signature";
}

export async function getRefundRate(hours: number): Promise<number | null> {
  const { deductionCount, refundCount } = await classifyDomainRefunds(hours, isCampaignDeduction);

  return deductionCount > 0
    ? Math.round((refundCount / deductionCount) * 100)
    : 0;
}

// ─── Visual Signature (VS) domain ─────────────────────────────────

export async function getVsSuccessRate(hours: number): Promise<number | null> {
  const { data, error } = await supabaseAdmin
    .from("generation_events")
    .select("status")
    .eq("generation_type", "visual_signature")
    .gte("created_at", hoursAgo(hours));

  if (error || !data || data.length === 0) return null;

  const successCount = data.filter((row) => row.status === "success").length;
  return Math.round((successCount / data.length) * 100);
}

export async function getVsErrorRate(hours: number): Promise<number | null> {
  const { data, error } = await supabaseAdmin
    .from("generation_events")
    .select("status")
    .eq("generation_type", "visual_signature")
    .gte("created_at", hoursAgo(hours));

  if (error || !data || data.length === 0) return 0;

  const failedCount = data.filter((row) => row.status === "failed").length;
  return Math.round((failedCount / data.length) * 100);
}

export async function getVsAvgDuration(hours: number): Promise<number | null> {
  const { data, error } = await supabaseAdmin
    .from("generation_events")
    .select("duration_ms")
    .eq("generation_type", "visual_signature")
    .not("duration_ms", "is", null)
    .gte("created_at", hoursAgo(hours));

  if (error || !data || data.length === 0) return null;

  const total = data.reduce((sum, row) => sum + (row.duration_ms ?? 0), 0);
  return Math.round(total / data.length);
}

export async function getVsCreditsConsumed(hours: number): Promise<number | null> {
  const { data, error } = await supabaseAdmin
    .from("credit_transactions")
    .select("amount")
    .eq("type", "deduction")
    .eq("metadata->>feature", "visual_signature")
    .gte("created_at", hoursAgo(hours));

  if (error || !data) return 0;
  if (data.length === 0) return 0;

  return data.reduce((sum, row) => sum + Math.abs(row.amount ?? 0), 0);
}

export async function getVsCreditsRefunded(hours: number): Promise<number | null> {
  const { data, error } = await supabaseAdmin
    .from("credit_transactions")
    .select("id, type, amount, campaign_id, metadata, reference")
    .gte("created_at", hoursAgo(hours));

  if (error || !data) return 0;
  if (data.length === 0) return 0;

  // Collect refund-type transactions
  const refunds: Array<{ id: string; amount: number; metadata: Record<string, unknown> | null; reference: string | null }> = [];
  for (const row of data) {
    if (row.type === "refund") {
      refunds.push(row as any);
    }
  }

  if (refunds.length === 0) return 0;

  const eligibleRefundIds = new Set<string>();
  const orphanRefs: string[] = [];
  let totalRefunded = 0;

  // First pass: classify by metadata.feature
  for (const r of refunds) {
    const metadata = r.metadata as Record<string, unknown> | null;
    const feature = metadata?.feature as string | undefined;

    if (feature === "visual_signature") {
      eligibleRefundIds.add(r.id);
      totalRefunded += Math.abs(r.amount ?? 0);
    } else if (r.reference) {
      orphanRefs.push(r.reference);
    }
  }

  // Second pass: resolve orphan refunds via reference chain (cross-window)
  if (orphanRefs.length > 0) {
    const { data: outsideData, error: outsideError } = await supabaseAdmin
      .from("credit_transactions")
      .select("id, type, amount, metadata, reference")
      .in("id", orphanRefs);

    if (!outsideError && outsideData && outsideData.length > 0) {
      const outsideMap = new Map(outsideData.map((d) => [d.id, d as any]));

      for (const r of refunds) {
        if (eligibleRefundIds.has(r.id)) continue; // already counted
        if (!r.reference) continue;

        const referenced = outsideMap.get(r.reference);
        if (!referenced) continue;

        const refMetadata = referenced.metadata as Record<string, unknown> | null;
        const refFeature = refMetadata?.feature as string | undefined;

        if (refFeature === "visual_signature") {
          eligibleRefundIds.add(r.id);
          totalRefunded += Math.abs(r.amount ?? 0);
        }
      }
    }
  }

  return totalRefunded;
}

export async function getVsRefundRate(hours: number): Promise<number | null> {
  const { deductionCount, refundCount } = await classifyDomainRefunds(hours, isVsDeduction);

  return deductionCount > 0
    ? Math.round((refundCount / deductionCount) * 100)
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
