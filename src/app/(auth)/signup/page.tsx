import Link from "next/link";
import { getLaunchConfig } from "@/lib/launch-config/config";
import { GoogleButton } from "@/components/auth/google-button";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata = {
  title: "Criar conta — Vendeo",
  description:
    "Crie sua conta gratuita no Vendeo e gere campanhas profissionais para sua loja.",
};

export default async function SignupPage() {
  // Leitura server-side da flag (D5): flag off → "Beta fechado" verbatim;
  // flag on → formulário + Google (renderização condicional D2/D4).
  const { publicSignupEnabled } = await getLaunchConfig();

  if (!publicSignupEnabled) {
    return (
      <div
        className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center"
        data-public-signup-enabled="false"
      >
        <div className="max-w-md">
          <h1 className="font-heading text-3xl font-bold">Beta fechado</h1>
          <p className="mt-4 text-text-secondary">
            O Vendeo está em beta fechado. Para participar, solicite seu acesso
            free — a liberação é por convite.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3">
            <Link
              href="/"
              className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-accent-green px-6 py-3 font-heading font-semibold text-white transition-all hover:brightness-110 focus:ring-2 focus:ring-accent-green focus:outline-none"
            >
              Solicitar acesso free
            </Link>
            <Link
              href="/login"
              className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-border px-6 py-3 text-sm font-medium text-text-secondary transition-colors hover:border-border-light hover:text-text-primary"
            >
              Já tenho acesso — Entrar
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-[70vh] flex-col items-center justify-center px-6"
      data-public-signup-enabled="true"
    >
      <div className="w-full max-w-md">
        <h1 className="font-heading text-3xl font-bold text-slate-50 text-center">
          Criar sua conta
        </h1>
        <p className="mt-2 text-center text-sm text-slate-400">
          Crie sua conta gratuita e gere campanhas profissionais para sua loja.
        </p>

        <div className="mt-8">
          <GoogleButton variant="outline" fullWidth />
        </div>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-700" />
          <span className="text-xs text-slate-400">ou</span>
          <div className="h-px flex-1 bg-slate-700" />
        </div>

        <SignupForm />

        <p className="mt-4 text-center text-sm text-slate-400">
          Já tenho uma conta —{" "}
          <Link href="/login" className="text-blue-400 hover:text-blue-300 hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
