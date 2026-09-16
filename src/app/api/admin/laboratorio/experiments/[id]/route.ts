import { NextResponse } from "next/server";

import * as adminGuard from "@/lib/admin/require-admin";
import { apiHandler } from "@/lib/auth/api-handler";
import { getExperimentDetail } from "@/lib/lab/api/experiment-queries";
import * as labEnvironment from "@/lib/lab/environment-guard";
import { supabaseAdmin } from "@/lib/supabase/server";

// F48.1 (D11/D2): detalhe do experimento — variantes, cenários vinculados, runs,
// avaliações e budget restante. Leitura pura: o único efeito é a reconciliação
// preguiçosa de runs órfãos, feita dentro da camada de leitura.

export const GET = apiHandler(
  async (_request: Request, { params }: { params: Promise<{ id: string }> }) => {
    await adminGuard.requireAdmin();

    try {
      labEnvironment.assertLabEnvironment();
    } catch (error) {
      if (error instanceof labEnvironment.LabEnvironmentError) {
        return NextResponse.json(labEnvironment.labEnvironmentDeniedBody(error.reason), {
          status: 403,
        });
      }
      throw error;
    }

    const { id } = await params;
    const detail = await getExperimentDetail(supabaseAdmin, id);

    if (!detail) {
      return NextResponse.json({ error: "experiment_not_found" }, { status: 404 });
    }

    return NextResponse.json(detail);
  },
);
