import type { Metadata } from "next";
import Link from "next/link";
import { AccessRequestSection } from "@/components/landing/access-request-section";
import { NovidadesLink } from "@/components/landing/novidades-link";
import { getAllEntries } from "@/lib/changelog/get-changelog";
import { getLaunchConfig } from "@/lib/launch-config/config";

export const metadata: Metadata = {
  title: "Vendeo — Campanhas profissionais para sua loja",
  description:
    "O Vendeo transforma a oferta da sua loja em campanhas profissionais para redes sociais. Acesso liberado por convite em beta fechado — solicite seu acesso free.",
};

export default async function Home() {
  const entries = await getAllEntries();
  const recentEntries = entries.slice(0, 5);
  const { publicSignupEnabled } = await getLaunchConfig();

  return (
    <div className="flex min-h-screen flex-col bg-bg-deep font-body text-text-primary">
      {/* Header */}
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
        <span className="font-heading text-xl font-bold tracking-tight">
          Vendeo
        </span>
        <Link
          href="/login"
          className="rounded-lg border border-border-light px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:border-accent-green hover:text-text-primary"
        >
          Entrar
        </Link>
      </header>

      {/* Hero + form (estado de envio gerenciado no client) */}
      <AccessRequestSection
        entries={recentEntries}
        publicSignupEnabled={publicSignupEnabled}
      />

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-text-muted sm:flex-row">
          <span className="font-heading font-semibold text-text-secondary">
            Vendeo
          </span>
          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            <Link href="/termos" className="transition-colors hover:text-text-primary">
              Termos
            </Link>
            <Link href="/privacidade" className="transition-colors hover:text-text-primary">
              Privacidade
            </Link>
            <Link href="/uso-aceitavel" className="transition-colors hover:text-text-primary">
              Uso Aceitável
            </Link>
            <NovidadesLink variant="footer" entries={recentEntries} />
            <Link href="/login" className="transition-colors hover:text-text-primary">
              Entrar
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
