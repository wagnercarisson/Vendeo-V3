import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAdmin } from "@/lib/admin/require-admin";
import { AiCostsQuerySchema } from "@/lib/admin/schemas";
import { apiHandler } from "@/lib/auth/api-handler";
import {
  AiCostAdminService,
  AiCostAdminUnavailableError,
} from "@/lib/ai-cost/admin-service";

export const GET = apiHandler(async (request: Request) => {
  await requireAdmin();

  const { searchParams } = new URL(request.url);
  const parsed = AiCostsQuerySchema.safeParse({
    storeId: searchParams.get("store_id") ?? undefined,
    userId: searchParams.get("user_id") ?? undefined,
    provider: searchParams.get("provider") ?? undefined,
    model: searchParams.get("model") ?? undefined,
    generationType: searchParams.get("generation_type") ?? undefined,
    operationRunId: searchParams.get("operation_run_id") ?? undefined,
    campaignId: searchParams.get("campaign_id") ?? undefined,
    hours: searchParams.get("hours") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", details: parsed.error.errors },
      { status: 400 },
    );
  }

  const filters = parsed.data;

  let aggregations;
  try {
    aggregations = await new AiCostAdminService().getAiCosts({
      storeId: filters.storeId,
      userId: filters.userId,
      provider: filters.provider,
      model: filters.model,
      generationType: filters.generationType,
      operationRunId: filters.operationRunId,
      campaignId: filters.campaignId,
      hours: filters.hours,
    });
  } catch (err) {
    if (err instanceof AiCostAdminUnavailableError) {
      return NextResponse.json(
        { error: "ai_costs_unavailable" },
        { status: 503 },
      );
    }
    throw err;
  }

  return NextResponse.json(aggregations);
});
