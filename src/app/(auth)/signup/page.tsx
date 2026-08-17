import Link from "next/link";
import { getLaunchConfig } from "@/lib/launch-config/config";

export const metadata = {
  title: "Beta fechado — Vendeo",
  description:
    "O Vendeo está em beta fechado. Solicite seu acesso free para participar.",
};

export default async function SignupPage() {
  // Leitura server-side da flag (D5): a exposição do formulário (flag on) é
  // renderização condicional do plan 42-06; aqui apenas conectamos o valor.
  const { publicSignupEnabled } = await getLaunchConfig();

  return (
    <div
      className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center"
      data-public-signup-enabled={String(publicSignupEnabled)}
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
