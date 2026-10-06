import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin/require-admin";
import { apiHandler } from "@/lib/auth/api-handler";
import { supabaseAdmin } from "@/lib/supabase/server";
import { isSupportReference } from "@/lib/ai/image-generation-support-reference";
import { SupabaseImageGenerationDiagnosisRepository } from "@/lib/ai/image-generation-diagnosis-repository";

/**
 * Correlação interna referência → diagnóstico (F56.1, D-19/D-26).
 *
 * Handler GET **admin** e **read-only**: recebe a referência de atendimento
 * opaca (UUID v4) por query string, consulta o repositório **durável** e devolve
 * o diagnóstico interno. NÃO depende de estado em memória — a recuperação é
 * sempre pela tabela `image_generation_failure_diagnoses` (D-26), de modo que o
 * suporte localiza a causa em QUALQUER requisição/instância.
 *
 * Segurança (T-56.1-23): `requireAdmin` antes de qualquer leitura; referência
 * malformada → 400; referência inexistente → 404. Nenhuma escrita, nenhuma
 * chamada de provider e nenhuma exposição pública do diagnóstico.
 */
export const GET = apiHandler(async (request: Request) => {
  await requireAdmin();

  const { searchParams } = new URL(request.url);
  const reference = (searchParams.get("reference") ?? "").trim();

  if (!isSupportReference(reference)) {
    return NextResponse.json(
      {
        error: "Dados inválidos",
        details: "A referência deve ser um UUID v4.",
      },
      { status: 400 },
    );
  }

  // Sempre um novo repositório a partir do client server-only: nenhum cache em
  // memória pode sustentar a correlação de suporte (D-26).
  const repository = new SupabaseImageGenerationDiagnosisRepository(supabaseAdmin);
  const diagnosis = await repository.findByReference(reference);

  if (!diagnosis) {
    return NextResponse.json(
      { error: "Diagnóstico não encontrado para a referência informada" },
      { status: 404 },
    );
  }

  return NextResponse.json({ diagnosis });
});
