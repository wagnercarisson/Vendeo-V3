import { createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export interface AuthenticatedUser {
  userId: string;
  claims: Record<string, unknown>;
}

export class UnauthorizedError extends Error {
  constructor(message = "Usuário não autenticado") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export async function requireUser(): Promise<AuthenticatedUser> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data?.user?.id) {
    throw new UnauthorizedError();
  }

  return {
    userId: data.user.id,
    claims: data.user.app_metadata ?? {},
  };
}

export async function requirePageUser(): Promise<AuthenticatedUser> {
  try {
    return await requireUser();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      redirect("/login");
    }
    throw error;
  }
}

export async function requireApiUser(): Promise<AuthenticatedUser> {
  return requireUser();
}
