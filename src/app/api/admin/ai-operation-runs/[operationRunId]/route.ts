import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/require-admin";
import { apiHandler } from "@/lib/auth/api-handler";
import {
  OperationRunsService,
  OperationRunsUnavailableError,
} from "@/lib/ai-cost/operation-runs-service";

const operationRunIdSchema = z.string().uuid();

/**
 * GET /api/admin/ai-operation-runs/[operationRunId] — detalhe call-level (D4).
 *
 * A rota só valida e repassa: o OperationRunsService (38-2-05) deriva
 * estimatedCostBrl (D1/D4), badges por evento (D5) e os componentes
 * textComponentUsd/imageToolComponentUsd. A rota NUNCA deriva BRL/badge.
 *
 * 200 { run, events } | 400 (operationRunId inválido — zod) |
 * 403 sem admin | 503 fail-closed (OperationRunsUnavailableError).
 */
export const GET = apiHandler(
  async (
    _request: Request,
    { params }: { params: Promise<{ operationRunId: string }> },
  ) => {
    await requireAdmin();

    const { operationRunId } = await params;
    const parsed = operationRunIdSchema.safeParse(operationRunId);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dados inválidos", details: parsed.error.errors },
        { status: 400 },
      );
    }

    try {
      const detail = await new OperationRunsService().getRunDetail(
        parsed.data,
      );
      return NextResponse.json(detail);
    } catch (err) {
      if (err instanceof OperationRunsUnavailableError) {
        return NextResponse.json(
          { error: "operation_runs_unavailable" },
          { status: 503 },
        );
      }
      throw err;
    }
  },
);
