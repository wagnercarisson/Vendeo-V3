import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { RateLimitResult } from "./types";

const MAX_HOURLY = 10;
const MAX_DAILY = 30;

export async function checkRateLimit(storeId: string): Promise<RateLimitResult> {
  const now = new Date();

  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const { count: hourlyCount } = await supabaseAdmin
    .from("generation_rate_events")
    .select("id", { count: "exact", head: true })
    .eq("store_id", storeId)
    .eq("event_type", "generation_attempt")
    .gte("created_at", oneHourAgo);

  const { count: dailyCount } = await supabaseAdmin
    .from("generation_rate_events")
    .select("id", { count: "exact", head: true })
    .eq("store_id", storeId)
    .eq("event_type", "generation_attempt")
    .gte("created_at", twentyFourHoursAgo);

  const hourlyTotal = hourlyCount ?? 0;
  const dailyTotal = dailyCount ?? 0;

  if (hourlyTotal >= MAX_HOURLY) {
    return { allowed: false, reason: "hourly_limit_exceeded" };
  }

  if (dailyTotal >= MAX_DAILY) {
    return { allowed: false, reason: "daily_limit_exceeded" };
  }

  return {
    allowed: true,
    remaining: { hourly: MAX_HOURLY - hourlyTotal, daily: MAX_DAILY - dailyTotal },
    resetTime: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
  };
}

export async function recordGenerationAttempt(
  storeId: string,
  userId: string,
  campaignId?: string
): Promise<void> {
  await supabaseAdmin.from("generation_rate_events").insert({
    store_id: storeId,
    user_id: userId,
    campaign_id: campaignId ?? null,
    event_type: "generation_attempt",
    metadata: {},
  });
}
