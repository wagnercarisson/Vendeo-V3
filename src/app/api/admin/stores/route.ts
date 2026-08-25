import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/require-admin";
import { apiHandler } from "@/lib/auth/api-handler";

export const POST = apiHandler(async () => {
  await requireAdmin();

  return NextResponse.json(
    {
      error: "Criacao de loja de producao via admin foi desativada. Use o onboarding do usuario ou crie uma store de teste.",
      code: "admin_store_creation_disabled",
    },
    { status: 410 },
  );
});
