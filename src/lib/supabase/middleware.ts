import { createServerClient as createSupabaseServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { JwtPayload } from "@/types/auth";

export async function updateSession(
  request: NextRequest,
): Promise<{ response: NextResponse; claims: JwtPayload | null }> {
  let supabaseResponse = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");

  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseAnonKey) throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");

  const supabase = createSupabaseServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const claims: JwtPayload | null = user
    ? {
        sub: user.id,
        email: user.email ?? undefined,
        aud: user.aud ?? undefined,
        role: user.role ?? undefined,
      }
    : null;

  return { response: supabaseResponse, claims };
}
