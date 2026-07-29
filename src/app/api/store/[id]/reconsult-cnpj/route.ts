import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireAuthorizedStore, StoreNotFoundError } from "@/lib/auth/store-ownership";
import { UnauthorizedError } from "@/lib/auth/require-user";
import { apiHandler } from "@/lib/auth/api-handler";
import { requireSameOrigin } from "@/lib/auth/csrf";
import { CnpjVerificationService, createSupabaseLookupCache } from "@/lib/cnpj/verification-service";
import { BrasilApiProvider } from "@/lib/cnpj/lookup-providers/brasil-api";
import { CnpjaProvider } from "@/lib/cnpj/lookup-providers/cnpja";
import { getPreFillFromCnpj } from "@/lib/billing/cnpj-address-mapper";
import type { CnpjLookupData } from "@/lib/cnpj/lookup-providers/types";

export const POST = apiHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  requireSameOrigin(request);

  try {
    const { id: storeId } = await params;
    const store = await requireAuthorizedStore(storeId);

    if (!store.store.cnpj_normalized) {
      return NextResponse.json(
        { error: "Loja não possui CNPJ cadastrado para reconsulta" },
        { status: 400 }
      );
    }

    const cnpjNormalized = store.store.cnpj_normalized;

    const lookupService = new CnpjVerificationService(
      new BrasilApiProvider(),
      new CnpjaProvider(),
      createSupabaseLookupCache(supabaseAdmin as never)
    );

    const lookupResult = await lookupService.resolve(cnpjNormalized);

    if (lookupResult.status === "unavailable") {
      return NextResponse.json(
        {
          error: "Não foi possível consultar os dados do CNPJ agora. Tente novamente mais tarde.",
          lookupStatus: "unavailable",
        },
        { status: 503 }
      );
    }

    if (lookupResult.status === "not_found") {
      return NextResponse.json(
        {
          error: "CNPJ não encontrado na Receita Federal.",
          lookupStatus: "not_found",
        },
        { status: 404 }
      );
    }

    const data: CnpjLookupData = lookupResult.data;
    const nomeFantasiaFinal = (data.nome_fantasia && data.nome_fantasia.trim()) || data.razao_social;

    const { error: storeUpdateError } = await supabaseAdmin
      .from("stores")
      .update({
        razao_social: data.razao_social,
        nome_fantasia: nomeFantasiaFinal,
        cnpj_official_data: data as unknown as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      })
      .eq("id", storeId);

    if (storeUpdateError) {
      return NextResponse.json({ error: storeUpdateError.message }, { status: 500 });
    }

    const billingPrefill = getPreFillFromCnpj(data);

    const upsertData: Record<string, unknown> = {
      store_id: storeId,
      ...billingPrefill,
      billing_data_source: "brasilapi",
      billing_data_last_prefilled_from: "brasilapi",
    };

    const { error: billingError } = await supabaseAdmin
      .from("store_billing_info")
      .upsert(upsertData)
      .select()
      .single();

    if (billingError && billingError.code !== "PGRST116") {
      return NextResponse.json({ error: billingError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      razao_social: data.razao_social,
      nome_fantasia: nomeFantasiaFinal,
      billing: billingPrefill,
    });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof StoreNotFoundError) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }
    throw err;
  }
});
