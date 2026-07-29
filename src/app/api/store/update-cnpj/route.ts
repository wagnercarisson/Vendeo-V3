import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { requireUser, UnauthorizedError } from "@/lib/auth/require-user";
import { getCurrentStore } from "@/lib/auth/store-ownership";
import { apiHandler } from "@/lib/auth/api-handler";
import { hashCnpjRoot } from "@/lib/cnpj/hash";
import { z } from "zod";
import { validateCnpj } from "@/lib/cnpj/validate";

const UpdateCnpjSchema = z.object({
  storeId: z.string().uuid(),
  cnpjNormalized: z.string().length(14),
  razaoSocial: z.string().min(2).max(200),
  nomeFantasia: z.string().max(200).optional(),
});

export const POST = apiHandler(async (request: NextRequest) => {
  try {
    const user = await requireUser();
    const store = await getCurrentStore(user.userId);

    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

    const parsed = UpdateCnpjSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors.map(e => e.message).join("; ") },
        { status: 400 }
      );
    }

    const { storeId, cnpjNormalized, razaoSocial, nomeFantasia } = parsed.data;

    if (storeId !== store.id) {
      return NextResponse.json({ error: "Store mismatch" }, { status: 403 });
    }

    const cnpjResult = validateCnpj(cnpjNormalized);
    if (cnpjResult instanceof Error) {
      return NextResponse.json({ error: "CNPJ inválido" }, { status: 400 });
    }

    const cnpjRootHash = hashCnpjRoot(cnpjNormalized.slice(0, 8));

    const nomeFantasiaFinal = (nomeFantasia && nomeFantasia.trim()) || razaoSocial.trim();

    const { data, error } = await supabaseAdmin.rpc("update_store_cnpj", {
      p_store_id: storeId,
      p_cnpj_normalized: cnpjNormalized,
      p_cnpj_root_hash: cnpjRootHash,
      p_razao_social: razaoSocial.trim(),
      p_nome_fantasia: nomeFantasiaFinal,
    });

    if (error) {
      if (error.message?.includes("store_not_found")) {
        return NextResponse.json({ error: "Loja não encontrada" }, { status: 404 });
      }
      if (error.message?.includes("cnpj_already_set")) {
        return NextResponse.json({ error: "Esta loja já possui CNPJ cadastrado" }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, store: data });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw error;
  }
});
