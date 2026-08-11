import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/require-admin";
import { AiOperationRunsQuerySchema } from "@/lib/admin/schemas";
import { apiHandler } from "@/lib/auth/api-handler";
import {
  OperationRunsService,
  OperationRunsUnavailableError,
} from "@/lib/ai-cost/operation-runs-service";

/**
 * GET /api/admin/ai-operation-runs — lista de entregas (D4/D9).
 *
 * A rota só valida e repassa: o OperationRunsService (38-2-05) deriva BRL
 * (D1/D4), badges (D5), segmento (D9), summary/aggregations sobre o conjunto
 * filtrado inteiro e filtra o segmento ANTES de paginar (total consistente).
 * A rota NUNCA deriva BRL/segmento.
 *
 * 200 { runs, summary, aggregations, page, total } | 400 zod (janela > 365d) |
 * 403 sem admin | 503 fail-closed (OperationRunsUnavailableError).
 */
export const GET = apiHandler(async (request: Request) => {
  await requireAdmin();

  const { searchParams } = new URL(request.url);
  const parsed = AiOperationRunsQuerySchema.safeParse({
    periodStart: searchParams.get("period_start") ?? undefined,
    periodEnd: searchParams.get("period_end") ?? undefined,
    storeId: searchParams.get("store_id") ?? undefined,
    operationRunType: searchParams.get("operation_run_type") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    provider: searchParams.get("provider") ?? undefined,
    model: searchParams.get("model") ?? undefined,
    generationType: searchParams.get("generation_type") ?? undefined,
    operationRunId: searchParams.get("operation_run_id") ?? undefined,
    segment: searchParams.get("segment") ?? undefined,
    page: searchParams.get("page") ?? undefined,
    pageSize: searchParams.get("page_size") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", details: parsed.error.errors },
      { status: 400 },
    );
  }

  const filters = parsed.data;

  let result;
  try {
    result = await new OperationRunsService().listRuns({
      periodStart: filters.periodStart,
      periodEnd: filters.periodEnd,
      storeId: filters.storeId,
      operationRunType: filters.operationRunType,
      status: filters.status,
      provider: filters.provider,
      model: filters.model,
      generationType: filters.generationType,
      operationRunId: filters.operationRunId,
      segment: filters.segment,
      page: filters.page,
      pageSize: filters.pageSize,
    });
  } catch (err) {
    if (err instanceof OperationRunsUnavailableError) {
      return NextResponse.json(
        { error: "operation_runs_unavailable" },
        { status: 503 },
      );
    }
    throw err;
  }

  return NextResponse.json(result);
});
