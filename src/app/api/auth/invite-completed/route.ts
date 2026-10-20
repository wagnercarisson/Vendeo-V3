import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/auth/api-handler";
import { requireSameOrigin } from "@/lib/auth/csrf";
import { requireApiUser } from "@/lib/auth/require-user";
import { supabaseAdmin } from "@/lib/supabase/server";

// POST /api/auth/invite-completed
// Marca que o usuário autenticado concluiu a definição de senha do convite.
// Só afeta a própria solicitação (invited_user_id = usuário da sessão).
// Um convite apenas "aceito" (e-mail confirmado/sessão) NÃO conclui o cadastro.
export const POST = apiHandler(async (request: NextRequest) => {
  requireSameOrigin(request);

  const user = await requireApiUser();

  const { data, error } = await supabaseAdmin
    .from("access_requests")
    .update({ password_set_at: new Date().toISOString() })
    .eq("invited_user_id", user.userId)
    .eq("status", "approved")
    .is("password_set_at", null)
    .select("id");

  if (error) {
    console.error("access_request password completion error:", error);
    return NextResponse.json(
      { error: "Não foi possível registrar a conclusão do cadastro" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, marked: (data?.length ?? 0) > 0 });
});
