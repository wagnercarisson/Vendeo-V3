import { createServerClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const VALID_NEXT = ["/", "/update-password"] as const;
const INVITE_TYPES = ["invite", "magiclink"] as const;

function loginError(request: NextRequest, code: string): NextResponse {
  return NextResponse.redirect(new URL(`/login?error=${code}`, request.url), { status: 302 });
}

// GET — confirmação de signup/recovery (fluxo existente).
// Links de convite NÃO são consumidos por GET: um verificador automático de
// e-mail não pode invalidar o convite. O GET apenas encaminha para /convite,
// onde o consumo acontece no clique humano (POST).
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  if (INVITE_TYPES.includes(type as (typeof INVITE_TYPES)[number])) {
    if (!tokenHash) return loginError(request, "invite_failed");

    const acceptUrl = new URL("/convite", request.url);
    acceptUrl.searchParams.set("token_hash", tokenHash);
    acceptUrl.searchParams.set("type", type!);
    return NextResponse.redirect(acceptUrl, { status: 302 });
  }

  const rawNext = searchParams.get("next") || "/";
  const safeNext = VALID_NEXT.includes(rawNext as typeof VALID_NEXT[number])
    ? rawNext
    : "/";

  if (!tokenHash || (type !== "signup" && type !== "recovery")) {
    return loginError(request, "confirmation_failed");
  }

  const supabase = await createServerClient();
  const { error } = await supabase.auth.verifyOtp({
    type,
    token_hash: tokenHash,
  });

  if (error) {
    const errorParam = type === "recovery" ? "recovery_failed" : "confirmation_failed";
    return loginError(request, errorParam);
  }

  const redirectTo = type === "recovery" ? safeNext : "/";
  return NextResponse.redirect(new URL(redirectTo, request.url), { status: 302 });
}

// POST — consumo do convite somente após ação explícita na página /convite.
export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  const tokenHash = String(form?.get("token_hash") ?? "");
  const type = String(form?.get("type") ?? "");

  if (
    !tokenHash ||
    !INVITE_TYPES.includes(type as (typeof INVITE_TYPES)[number])
  ) {
    return loginError(request, "invite_failed");
  }

  const supabase = await createServerClient();
  const { error } = await supabase.auth.verifyOtp({
    type: type as "invite" | "magiclink",
    token_hash: tokenHash,
  });

  if (error) {
    return loginError(request, "invite_failed");
  }

  return NextResponse.redirect(new URL("/update-password", request.url), { status: 302 });
}
