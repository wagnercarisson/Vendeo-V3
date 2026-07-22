import { NextResponse } from "next/server";
import crypto from "crypto";
import { requireAdmin } from "@/lib/admin/require-admin";
import { apiHandler } from "@/lib/auth/api-handler";
import { getLaunchConfig } from "@/lib/launch-config/config";
import { supabaseAdmin } from "@/lib/supabase/server";
import { logPipelineEvent } from "@/lib/logging/pipeline-logger";

export const POST = apiHandler(async (request: Request) => {
  const admin = await requireAdmin();

  const config = getLaunchConfig();
  if (!config.monthlyCreditsEnabled) {
    return NextResponse.json({ skipped: true });
  }

  const traceId = crypto.randomUUID();

  const { data, error } = await supabaseAdmin.rpc("grant_monthly_credits", {
    p_amount: config.monthlyCreditsAmount,
    p_bonus_cap: config.monthlyBonusCap,
    p_min_store_age_days: config.monthlyCreditsMinStoreAgeDays,
  });

  if (error) {
    logPipelineEvent({
      event: "admin.monthly_credits",
      traceId,
      phase: "post_parallel",
      status: "failed",
      errorMessage: error.message,
      metadata: { actor_id: admin.userId },
    });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  logPipelineEvent({
    event: "admin.monthly_credits",
    traceId,
    phase: "post_parallel",
    status: "complete",
    metadata: { actor_id: admin.userId, ...(data as Record<string, unknown>) },
  });

  return NextResponse.json(data);
});
