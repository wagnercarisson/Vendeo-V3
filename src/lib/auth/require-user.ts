import { createServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { JwtPayload } from "@/types/auth";

export interface AuthenticatedUser {
  userId: string;
  claims: JwtPayload;
}

export class UnauthorizedError extends Error {
  constructor(message = "Usuário não autenticado") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export async function requireUser(): Promise<AuthenticatedUser> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.getClaims();

  const claims = data?.claims as JwtPayload | undefined;

  if (error || !claims?.sub) {
    throw new UnauthorizedError();
  }

  return {
    userId: claims.sub,
    claims,
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
