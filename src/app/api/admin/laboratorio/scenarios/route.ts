import { NextResponse } from "next/server";

import * as adminGuard from "@/lib/admin/require-admin";
import { apiHandler } from "@/lib/auth/api-handler";
import { listScenarioVersions } from "@/lib/lab/api/experiment-queries";
import * as labEnvironment from "@/lib/lab/environment-guard";
import { supabaseAdmin } from "@/lib/supabase/server";

// F48.1 (D11/D2/T-48-1-58/59): superfície administrativa do laboratório.
// Ordem obrigatória em TODA rota: admin → guarda de ambiente → acesso a
// `lab_*`/storage/provider. Nenhuma leitura do laboratório acontece quando o
// ambiente está bloqueado (o serviço de leitura não é chamado).

export const GET = apiHandler(async () => {
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

  try {
    const scenarios = await listScenarioVersions(supabaseAdmin);
    return NextResponse.json({ scenarios });
  } catch {
    return NextResponse.json({ error: "Falha ao ler os cenários" }, { status: 503 });
  }
});
