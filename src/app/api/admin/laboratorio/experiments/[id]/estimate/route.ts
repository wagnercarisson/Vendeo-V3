import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin/require-admin";
import { apiHandler } from "@/lib/auth/api-handler";
import { LAB_EXPERIMENT_NOT_FOUND, estimateExperimentPlan } from "@/lib/lab/api/estimate";
import { LabEnvironmentError, assertLabEnvironment, labEnvironmentDeniedBody } from "@/lib/lab/environment-guard";
import { supabaseAdmin } from "@/lib/supabase/server";

// F48.1 (D11/D14): estimativa de custo do plano do experimento
// (repetições × cenários) por componente, com cobertura `complete|partial|missing`.
// Cobertura parcial/indisponível **não** bloqueia: a resposta continua 200 e a UI
// exibe faixa/aviso antes da confirmação da execução.

export const GET = apiHandler(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    await requireAdmin();

    try {
      assertLabEnvironment();
    } catch (error) {
      if (error instanceof LabEnvironmentError) {
        return NextResponse.json(labEnvironmentDeniedBody(error.reason), {
          status: 403,
        });
      }
      throw error;
    }

    const { id } = await params;

    try {
      const estimate = await estimateExperimentPlan({
        client: supabaseAdmin,
        experimentId: id,
      });

      return NextResponse.json({
        perRun: estimate.perRun,
        perRunCoverage: estimate.perRunCoverage,
        plannedRuns: estimate.plannedRuns,
        remainingRuns: estimate.remainingRuns,
        totalEstimatedUsd: estimate.totalEstimatedUsd,
        coverage: estimate.coverage,
      });
    } catch (error) {
      if (error instanceof Error && error.message === LAB_EXPERIMENT_NOT_FOUND) {
        return NextResponse.json({ error: "experiment_not_found" }, { status: 404 });
      }
      throw error;
    }
  },
);
