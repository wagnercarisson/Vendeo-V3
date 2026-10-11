import type { Metadata } from "next";
import Link from "next/link";
import { AccessRequestSection } from "@/components/landing/access-request-section";
import { HeroSection } from "@/components/landing/hero-section";
import { TransformationSection } from "@/components/landing/transformation-section";
import { VariationsSection } from "@/components/landing/variations-section";
import { IdentityControlSection } from "@/components/landing/identity-control-section";
import { ApproachSection } from "@/components/landing/approach-section";
import { OfferSection } from "@/components/landing/offer-section";
import { FaqFinalCtaSection } from "@/components/landing/faq-final-cta-section";
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
    <div className="flex min-h-screen flex-col bg-bg-surface font-body text-text-primary">
      {/* Header */}
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
        <img
          src="/landing/vendeo-logo-dark.webp"
          alt="Vendeo"
          width={384}
          height={82}
          className="h-9 w-auto sm:h-11"
        />
        <Link
          href="/login"
          className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-border-light px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:border-accent-green hover:text-text-primary focus:ring-2 focus:ring-accent-blue focus:outline-none"
        >
          Entrar
        </Link>
      </header>

      {/* Fixed block order: hero → transformação → apresentação → identidade →
          abordagens → oferta → FAQ/CTA final */}
      <main className="flex flex-1 flex-col">
        <HeroSection publicSignupEnabled={publicSignupEnabled} />
        <TransformationSection publicSignupEnabled={publicSignupEnabled} />
        <VariationsSection />
        <IdentityControlSection publicSignupEnabled={publicSignupEnabled} />
        <ApproachSection />
        <OfferSection publicSignupEnabled={publicSignupEnabled} />
        <FaqFinalCtaSection />

        {/* Form section — flag off only (retorna null com a flag ligada) */}
        <AccessRequestSection publicSignupEnabled={publicSignupEnabled} />
      </main>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-text-secondary sm:flex-row">
          <img
            src="/landing/vendeo-logo-dark.webp"
            alt="Vendeo"
            width={384}
            height={82}
            loading="lazy"
            className="h-6 w-auto shrink-0 self-center"
          />
          <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            <Link
              href="/termos"
              className="inline-flex min-h-[44px] items-center rounded px-2 transition-colors hover:text-text-primary focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:outline-none"
            >
              Termos de Uso
            </Link>
            <Link
              href="/privacidade"
              className="inline-flex min-h-[44px] items-center rounded px-2 transition-colors hover:text-text-primary focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:outline-none"
            >
              Política de Privacidade
            </Link>
            <Link
              href="/uso-aceitavel"
              className="inline-flex min-h-[44px] items-center rounded px-2 transition-colors hover:text-text-primary focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:outline-none"
            >
              Uso Aceitável
            </Link>
            <NovidadesLink variant="footer" entries={recentEntries} />
            <Link
              href={`mailto:${process.env.SUPPORT_EMAIL ?? "suporte@vendeo.tech"}`}
              className="inline-flex min-h-[44px] items-center rounded px-2 transition-colors hover:text-text-primary focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:outline-none"
            >
              Contato
            </Link>
            <Link
              href="/login"
              className="inline-flex min-h-[44px] items-center rounded px-2 transition-colors hover:text-text-primary focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:outline-none"
            >
              Entrar
            </Link>
          </nav>
        </div>
        <div className="mx-auto w-full max-w-5xl px-6 pb-8">
          <p className="mx-auto max-w-3xl text-center text-xs text-text-secondary">
            As lojas e campanhas apresentadas são exemplos demonstrativos e não
            representam lojas reais nem ofertas comerciais válidas. As marcas de
            produtos pertencem aos respectivos titulares. O Vendeo não possui
            vínculo, parceria, patrocínio ou endosso das marcas ou dos
            fabricantes utilizados para ilustrar as campanhas.
          </p>
        </div>
      </footer>
    </div>
  );
}
