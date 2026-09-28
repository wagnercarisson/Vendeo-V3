import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin/require-admin";
import { apiHandler } from "@/lib/auth/api-handler";
import { listBenchTestStores } from "@/lib/lab/bench/domain/store-manifest";
import {
  LabEnvironmentError,
  assertLabEnvironment,
  labEnvironmentDeniedBody,
} from "@/lib/lab/environment-guard";
import { supabaseAdmin } from "@/lib/supabase/server";

// F48.2.2 (D4/D11/T-48-2-2-31): superfície administrativa da bancada.
// Ordem obrigatória em TODA rota: admin → guarda de ambiente → acesso a
// `lab_bench_*`/storage/provider. A listagem lê **apenas** o manifesto local e a
// tabela `stores` do Supabase local (somente leitura); nenhuma loja fora do
// manifesto é listada e nenhum storage/provider é tocado.

export const GET = apiHandler(async () => {
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

  try {
    const stores = await listBenchTestStores({ client: supabaseAdmin });
    return NextResponse.json({ stores });
  } catch {
    return NextResponse.json(
      { error: "Falha ao ler as lojas de teste" },
      { status: 503 },
    );
  }
});
