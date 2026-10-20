/**
 * Classificação pura de usuário do Supabase Auth para o fluxo de convite.
 *
 * Regra central: NUNCA tratar qualquer erro como "usuário já existe" e NUNCA
 * mandar uma conta ativa redefinir senha.
 *
 * "Cadastro de convite pendente" = usuário criado pelo convite (invited_at)
 * que ainda NÃO registrou a definição de senha (`password_set_at` nulo).
 * Aceitar o convite (confirmar e-mail / abrir sessão) NÃO conclui o cadastro:
 * se a pessoa fechar a página antes de definir a senha, o reenvio deve
 * retomar o cadastro. Conta ativa = senha já definida ou conta não criada
 * pelo convite.
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

export function isPendingInvite(
  user: AuthUserLike,
  passwordSetAt?: string | null,
): boolean {
  // Conta não criada pelo convite (ex.: Google/signup) é conta ativa.
  if (!user.invited_at) return false;
  // Definição de senha concluída e registrada → conta ativa.
  if (passwordSetAt) return false;
  // Convite aceito sem senha definida continua sendo cadastro incompleto.
  return true;
}

export type InviteUserState = "pending" | "active";

export function classifyInviteUser(
  user: AuthUserLike,
  passwordSetAt?: string | null,
): InviteUserState {
  return isPendingInvite(user, passwordSetAt) ? "pending" : "active";
}
