import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin/require-admin";
import { apiHandler } from "@/lib/auth/api-handler";
import { listScenarioVersions } from "@/lib/lab/api/experiment-queries";
import {
  LabEnvironmentError,
  assertLabEnvironment,
  labEnvironmentDeniedBody,
} from "@/lib/lab/environment-guard";
import { supabaseAdmin } from "@/lib/supabase/server";

// F48.1 (D11/D2/T-48-1-58/59): superfície administrativa do laboratório.
// Ordem obrigatória em TODA rota: `requireAdmin()` → `assertLabEnvironment()` →
// acesso a `lab_*`/storage/provider. Nenhuma leitura do laboratório acontece
// quando o ambiente está bloqueado (o serviço de leitura não é chamado).

export const GET = apiHandler(async () => {
  await requireAdmin();

  try {
    assertLabEnvironment();
  } catch (error) {
    if (error instanceof LabEnvironmentError) {
      return NextResponse.json(labEnvironmentDeniedBody(error.reason), { status: 403 });
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
