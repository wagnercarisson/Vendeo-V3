import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/auth/api-handler";
import { requireSameOrigin } from "@/lib/auth/csrf";
import { supabaseAdmin } from "@/lib/supabase/server";

const AccessRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  name: z.string().trim().max(100).optional(),
  store_name: z.string().trim().max(100).optional(),
  segment: z.string().trim().max(50).optional(),
  whatsapp: z.string().trim().max(20).optional(),
});

// POST público (sem requireUser) — visitantes da landing solicitam acesso free.
// Anti-enumeração: novo e duplicado retornam exatamente o mesmo { ok: true } 200.
export const POST = apiHandler(async (request: NextRequest) => {
  requireSameOrigin(request);

  const body = await request.json().catch(() => null);
  const parsed = AccessRequestSchema.safeParse(body);
  if (!parsed.success) {
    // 400 genérico — sem detalhar o campo (anti-enumeração de esquema)
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const { email, name, store_name, segment, whatsapp } = parsed.data;

  // Anti-duplicidade: email com solicitação pending/approved não gera segundo registro
  const { data: existing } = await supabaseAdmin
    .from("access_requests")
    .select("id")
    .eq("email", email)
    .in("status", ["pending", "approved"])
    .maybeSingle();

  if (existing) {
    // Resposta idêntica ao sucesso — não revela a existência do email
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const { error } = await supabaseAdmin.from("access_requests").insert({
    email,
    name: name || null,
    store_name: store_name || null,
    segment: segment || null,
    whatsapp: whatsapp || null,
    source: "landing",
  });

  if (error) {
    console.error("access-request insert error:", error);
    return NextResponse.json(
      { error: "Erro ao registrar solicitação" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true }, { status: 200 });
});
