import { createServerClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const VALID_NEXT = ["/", "/update-password"] as const;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const rawNext = searchParams.get("next") || "/";
  const safeNext = VALID_NEXT.includes(rawNext as typeof VALID_NEXT[number])
    ? rawNext
    : "/";

  if (!tokenHash || (type !== "signup" && type !== "recovery")) {
    return NextResponse.redirect(new URL("/login?error=confirmation_failed", request.url));
  }

  const supabase = await createServerClient();
  const { error } = await supabase.auth.verifyOtp({
    type,
    token_hash: tokenHash,
  });

  if (error) {
    const errorParam = type === "recovery" ? "recovery_failed" : "confirmation_failed";
    return NextResponse.redirect(new URL(`/login?error=${errorParam}`, request.url));
  }

  const redirectTo = type === "recovery" ? safeNext : "/";
  return NextResponse.redirect(new URL(redirectTo, request.url));
}
