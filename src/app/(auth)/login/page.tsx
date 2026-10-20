import Link from "next/link";
import { sanitizeRedirectPath } from "@/lib/auth/redirect";
import { getLaunchConfig } from "@/lib/launch-config/config";
import { isCaptchaEnabled } from "@/lib/feature-flags/feature-flag-service";
import { GoogleButton } from "@/components/auth/google-button";
import { LoginForm } from "./login-form";

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL ?? "suporte@vendeo.tech";

const ERROR_MESSAGES: Record<string, string> = {
  invite_failed:
    "Seu convite é inválido, expirou ou já foi usado. Solicite um novo convite ao suporte.",
  confirmation_failed:
    "Não foi possível confirmar seu e-mail. O link pode ter expirado — tente entrar ou solicitar um novo acesso.",
  recovery_failed:
    "O link de recuperação de senha é inválido ou expirou. Solicite um novo link.",
  oauth_failed:
    "Não foi possível concluir o login com Google. Tente novamente.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string | string[]; error?: string | string[] }>;
}) {
  const params = await searchParams;
  const redirectParam = typeof params.redirect === "string" ? params.redirect : "";
  const safeRedirect = sanitizeRedirectPath(redirectParam);
  const errorParam = typeof params.error === "string" ? params.error : "";
  const errorMessage = ERROR_MESSAGES[errorParam] ?? null;
  const { publicSignupEnabled } = await getLaunchConfig();
  const captchaEnabled = await isCaptchaEnabled();

  return (
    <div className="w-full max-w-md">
      <h1 className="font-heading text-3xl font-bold text-slate-50 text-center">
        Entrar na sua conta
      </h1>
      <p className="mt-2 text-center text-sm text-slate-400">
        Acesse para gerar suas campanhas.
      </p>

      {errorMessage && (
        <div
          role="alert"
          className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
        >
          <p>{errorMessage}</p>
          {errorParam === "invite_failed" && (
            <p className="mt-1">
              <a href={`mailto:${SUPPORT_EMAIL}?subject=Novo%20convite%20de%20acesso%20Vendeo`} className="underline">
                {SUPPORT_EMAIL}
              </a>
            </p>
          )}
        </div>
      )}

      <div className="mt-8">
        {/* D15: Google SEMPRE visível no login, independente da flag */}
        <GoogleButton variant="outline" fullWidth />
      </div>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-slate-700" />
        <span className="text-xs text-slate-400">ou</span>
        <div className="h-px flex-1 bg-slate-700" />
      </div>

      <LoginForm redirect={safeRedirect} captchaEnabled={captchaEnabled} />

      <div className="mt-6 text-center">
        {publicSignupEnabled ? (
          <p className="text-sm text-slate-400">
            Ainda não tem uma conta?{" "}
            <Link href="/signup" className="text-blue-400 hover:text-blue-300 hover:underline">
              Criar uma conta
            </Link>
          </p>
        ) : (
          <p className="text-sm text-slate-400">
            Ainda não tem acesso?{" "}
            <Link href="/" className="text-blue-400 hover:text-blue-300 hover:underline">
              Solicitar acesso free
            </Link>
          </p>
        )}
        <p className="mt-2 text-sm text-slate-400">
          Esqueceu sua senha?{" "}
          <Link href="/forgot-password" className="text-blue-400 hover:text-blue-300 hover:underline">
            Recuperar senha
          </Link>
        </p>
      </div>
    </div>
  );
}