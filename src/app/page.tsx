import type { Metadata } from "next";
import Link from "next/link";
import { AccessRequestForm } from "@/components/landing/access-request-form";

export const metadata: Metadata = {
  title: "Vendeo — Campanhas profissionais para sua loja",
  description:
    "O Vendeo transforma a oferta da sua loja em campanhas profissionais para redes sociais. Acesso liberado por convite em beta fechado — solicite seu acesso free.",
};

export default function Home() {
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

      {/* Hero */}
      <section className="mx-auto w-full max-w-5xl flex-1 px-6 pt-16 pb-12 text-center sm:pt-24">
        <h1 className="mx-auto max-w-2xl font-heading text-3xl font-bold leading-tight sm:text-5xl">
          Campanhas profissionais para{" "}
          <span className="text-accent-green">lojas físicas</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base text-text-secondary sm:text-lg">
          Informe sua oferta e receba uma peça visual pronta para publicar — sem
          precisar de design, copywriting ou marketing.
        </p>
        <p className="mx-auto mt-3 max-w-md rounded-full border border-border-light bg-bg-surface px-4 py-1.5 text-xs font-medium text-accent-amber">
          Beta fechado — acesso liberado por convite. Solicite seu acesso free.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href="#acesso"
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-accent-green px-6 py-3 font-heading text-base font-semibold text-white transition-all hover:brightness-110 focus:ring-2 focus:ring-accent-green focus:outline-none"
          >
            Solicitar acesso free
          </a>
          <Link
            href="/login"
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-border text-sm font-medium text-text-secondary transition-colors hover:border-border-light hover:text-text-primary focus:ring-2 focus:ring-accent-blue focus:outline-none"
          >
            Entrar
          </Link>
        </div>
      </section>

      {/* Form section */}
      <section id="acesso" className="mx-auto w-full max-w-5xl px-6 pb-20">
        <div className="mx-auto max-w-md rounded-2xl border border-border bg-bg-surface p-8">
          <h2 className="text-center font-heading text-xl font-semibold">
            Solicite seu acesso free
          </h2>
          <p className="mt-2 text-center text-sm text-text-secondary">
            Deixe seu email e conte um pouco sobre sua loja. A liberação é por
            convite — avisaremos quando seu acesso estiver pronto.
          </p>
          <div className="mt-6">
            <AccessRequestForm />
          </div>
        </div>
      </section>

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
            <Link href="/login" className="transition-colors hover:text-text-primary">
              Entrar
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
