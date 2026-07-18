import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/require-admin";
import { supabaseAdmin } from "@/lib/supabase/server";
import { CreateStoreSchema } from "@/lib/admin/schemas";
import { apiHandler } from "@/lib/auth/api-handler";
import { ZodError } from "zod";

export const POST = apiHandler(async (request: Request) => {
  const admin = await requireAdmin();

  let body;
  try {
    body = CreateStoreSchema.parse(await request.json());
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Dados inválidos", details: err.errors },
        { status: 400 },
      );
    }
    throw err;
  }

  const { data, error } = await supabaseAdmin.rpc("admin_create_store_for_user", {
    p_admin_id: admin.userId,
    p_user_id: body.userId,
    p_name: body.storeName,
    p_segment: body.segment,
  });

  if (error) {
    const msg = error.message?.toLowerCase() ?? "";
    if (msg.includes("usuario_ja_possui_loja") || msg.includes("já possui uma loja")) {
      return NextResponse.json(
        { error: "Usuário já possui uma loja" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
});
