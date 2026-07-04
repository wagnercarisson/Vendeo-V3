import "server-only";
import { createClient } from "@supabase/supabase-js";
import { createServerClient as createSupabaseServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!supabaseUrl) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
}

const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!supabaseAnonKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseServiceKey) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
}

export async function createServerClient() {
  const cookieStore = await cookies();

  return createSupabaseServerClient(supabaseUrl!, supabaseAnonKey!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(
        cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[],
      ) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Component cannot write cookies; middleware handles renewal.
        }
      },
    },
  });
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
