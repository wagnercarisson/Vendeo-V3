import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/require-admin";
import { supabaseAdmin } from "@/lib/supabase/server";
import { apiHandler } from "@/lib/auth/api-handler";
import { validateCnpj } from "@/lib/cnpj/validate";
import { hashCnpjRoot } from "@/lib/cnpj/hash";

export const POST = apiHandler(async (request: NextRequest) => {
  const admin = await requireAdmin();

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const { userId, name, segment, cnpj, razaoSocial, nomeFantasia, city, state } = body as Record<string, unknown>;

  if (!userId || typeof userId !== "string") {
    return NextResponse.json({ error: "userId é obrigatório" }, { status: 400 });
  }
  if (!name || typeof name !== "string" || name.trim().length < 2) {
    return NextResponse.json({ error: "name é obrigatório" }, { status: 400 });
  }
  if (!segment || typeof segment !== "string") {
    return NextResponse.json({ error: "segment é obrigatório" }, { status: 400 });
  }
  if (!cnpj || typeof cnpj !== "string") {
    return NextResponse.json({ error: "CNPJ é obrigatório" }, { status: 400 });
  }

  const cnpjResult = validateCnpj(cnpj);
  if (cnpjResult instanceof Error) {
    return NextResponse.json({ error: "CNPJ inválido" }, { status: 400 });
  }

  const cnpjRootHash = hashCnpjRoot(cnpjResult.normalized.slice(0, 8));

  const { data, error } = await supabaseAdmin.rpc("admin_create_test_store", {
    p_user_id: userId,
    p_name: name.trim(),
    p_segment: segment,
    p_cnpj_normalized: cnpjResult.normalized,
    p_cnpj_root_hash: cnpjRootHash,
    p_razao_social: typeof razaoSocial === "string" ? razaoSocial : null,
    p_nome_fantasia: typeof nomeFantasia === "string" ? nomeFantasia : null,
    p_city: typeof city === "string" ? city : null,
    p_state: typeof state === "string" ? state : null,
    p_granted_by: admin.userId,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data });
});
