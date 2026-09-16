import { NextResponse } from "next/server";

import * as adminGuard from "@/lib/admin/require-admin";
import { apiHandler } from "@/lib/auth/api-handler";
import { getRunDetail } from "@/lib/lab/api/experiment-queries";
import * as labEnvironment from "@/lib/lab/environment-guard";
import { supabaseAdmin } from "@/lib/supabase/server";

// F48.1 (D10/D11): detalhe do run com o snapshot congelado e os artefatos do
// bucket privado. As URLs assinadas (TTL 3600s) são geradas server-side; artefatos
// com `removed_at` preenchido já são filtrados pela camada de leitura.

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
    const detail = await getRunDetail(supabaseAdmin, id);

    if (!detail) {
      return NextResponse.json({ error: "run_not_found" }, { status: 404 });
    }

    return NextResponse.json({
      run: detail.run,
      snapshot: detail.snapshot,
      artifacts: detail.artifacts,
    });
  },
);
