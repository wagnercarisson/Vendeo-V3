import { NextRequest, NextResponse } from "next/server";
import { requireApiUser, UnauthorizedError } from "@/lib/auth/require-user";
import { apiHandler } from "@/lib/auth/api-handler";
import { validateCnpj } from "@/lib/cnpj/validate";
import { CnpjVerificationService, createSupabaseLookupCache } from "@/lib/cnpj/verification-service";
import { BrasilApiProvider } from "@/lib/cnpj/lookup-providers/brasil-api";
import { CnpjaProvider } from "@/lib/cnpj/lookup-providers/cnpja";
import { supabaseAdmin } from "@/lib/supabase/server";

function createVerificationService(): CnpjVerificationService {
  const primary = new BrasilApiProvider();
  const fallback = new CnpjaProvider();
  const cache = createSupabaseLookupCache(supabaseAdmin as never);
  return new CnpjVerificationService(primary, fallback, cache);
}

export const GET = apiHandler(async (request: NextRequest) => {
  try {
    await requireApiUser();

    const cnpj = request.nextUrl.searchParams.get("cnpj");
    if (!cnpj) {
      return NextResponse.json({ error: "CNPJ é obrigatório" }, { status: 400 });
    }

    const validation = validateCnpj(cnpj);
    if (validation instanceof Error) {
      return NextResponse.json({ error: "CNPJ inválido" }, { status: 400 });
    }

    const { normalized } = validation;
    const service = createVerificationService();
    const result = await service.resolve(normalized);

    if (result.status === "resolved") {
      return NextResponse.json({
        status: "resolved",
        data: result.data,
        message: "Dados carregados da Receita Federal.",
      });
    }

    if (result.status === "not_found") {
      return NextResponse.json({
        status: "not_found",
        message: "CNPJ não encontrado na Receita Federal.",
      });
    }

    return NextResponse.json({
      status: "unavailable",
      message: "Não foi possível consultar os dados deste CNPJ agora. A loja será criada sem créditos iniciais. Você pode tentar novamente em 'Dados da Loja'.",
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw error;
  }
});
