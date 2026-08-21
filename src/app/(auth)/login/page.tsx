import Link from "next/link";
import { sanitizeRedirectPath } from "@/lib/auth/redirect";
import { getLaunchConfig } from "@/lib/launch-config/config";
import { isCaptchaEnabled } from "@/lib/feature-flags/feature-flag-service";
import { GoogleButton } from "@/components/auth/google-button";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string | string[] }>;
}) {
  const params = await searchParams;
  const redirectParam = typeof params.redirect === "string" ? params.redirect : "";
  const safeRedirect = sanitizeRedirectPath(redirectParam);
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