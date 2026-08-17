import { createServerClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// D16: allowlist estrita — "/" e "/onboarding" NUNCA válidos; externo bloqueado
const VALID_NEXT = ["/loja", "/dashboard"] as const;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") || "";

  const safeNext = (VALID_NEXT as readonly string[]).includes(rawNext)
    ? rawNext
    : "/loja";

  if (!code) {
    // Erro genérico anti-enumeração (T-42-07)
    return NextResponse.redirect(new URL("/login?error=oauth_failed", request.url), { status: 302 });
  }

  const supabase = await createServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    // T-42-07: code inválido/expirado — nunca distinguir o motivo
    return NextResponse.redirect(new URL("/login?error=oauth_failed", request.url), { status: 302 });
  }

  // Sucesso → rota protegida /loja (default) → PrivacyGate
  return NextResponse.redirect(new URL(safeNext, request.url), { status: 302 });
}