import "server-only";
import { requireApiUser } from "@/lib/auth/require-user";
import { supabaseAdmin } from "@/lib/supabase/server";
import { ForbiddenError } from "@/lib/auth/errors";

export async function requireAdmin(): Promise<{ userId: string }> {
  const { userId } = await requireApiUser();

  const { data } = await supabaseAdmin
    .from("admin_users")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) {
    throw new ForbiddenError("Acesso restrito a administradores");
  }

  return { userId };
}
