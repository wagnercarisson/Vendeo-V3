/**
 * Classificação pura de usuário do Supabase Auth para o fluxo de convite.
 *
 * Regra central: NUNCA tratar qualquer erro como "usuário já existe" e NUNCA
 * mandar uma conta ativa redefinir senha.
 *
 * "Convite pendente" = usuário criado pelo convite (invited_at), ainda sem
 * e-mail confirmado e sem login. Qualquer outro estado é conta ativa.
 */

export type AuthUserLike = {
  id: string;
  email?: string | null;
  invited_at?: string | null;
  email_confirmed_at?: string | null;
  confirmed_at?: string | null;
  last_sign_in_at?: string | null;
};

export type AuthErrorLike = { message?: string; code?: string } | null;

/** Erro específico de e-mail já cadastrado — não inclui outros erros do Supabase. */
export function isAlreadyRegisteredError(error: AuthErrorLike): boolean {
  const message = (error?.message ?? "").toLowerCase();
  const code = (error?.code ?? "").toLowerCase();
  return (
    code === "email_exists" ||
    message.includes("already registered") ||
    message.includes("already been registered") ||
    message.includes("user already exists")
  );
}

export function isPendingInvite(user: AuthUserLike): boolean {
  return (
    Boolean(user.invited_at) &&
    !user.email_confirmed_at &&
    !user.confirmed_at &&
    !user.last_sign_in_at
  );
}

export type InviteUserState = "pending" | "active";

export function classifyInviteUser(user: AuthUserLike): InviteUserState {
  return isPendingInvite(user) ? "pending" : "active";
}
