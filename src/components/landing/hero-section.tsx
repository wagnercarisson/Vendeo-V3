import { AcquisitionCta } from "./acquisition-cta";
import { CampaignImage } from "./campaign-image";

/**
 * Hero block (block 1 of the landing).
 *
 * Server component: the single flag value `publicSignupEnabled` is read once in
 * `page.tsx` and passed down. The acquisition CTA is provided by the shared
 * primitive `AcquisitionCta` (dark text on green, D-19); no CTA markup is
 * hand-rolled here. The 1:1 protagonist campaign is rendered AFTER the
 * copy/CTA in DOM order so on mobile the message + CTA never sit below an
 * oversized image (copy → CTA → image); on desktop it is a two-column layout.
 */

const HEADLINE = "O que seu negócio quer divulgar vira uma campanha pronta para publicar.";
const SUBHEADLINE =
  "Você informa o básico. O Vendeo prepara a campanha completa — com arte e texto — pronta para publicar.";

interface HeroSectionProps {
  publicSignupEnabled: boolean;
}

export function HeroSection({ publicSignupEnabled }: HeroSectionProps) {
  return (
    <section
      aria-labelledby="hero-heading"
      data-public-signup-enabled={String(publicSignupEnabled)}
      className="mx-auto w-full max-w-5xl px-6 pt-16 pb-12 sm:pt-24"
    >
      <div className="grid items-center gap-10 sm:grid-cols-2">
        <div className="text-center sm:text-left">
          {!publicSignupEnabled ? (
            <p className="inline-block rounded-full border border-border-light bg-bg-surface px-4 py-1.5 text-xs font-medium text-accent-amber">
              Beta fechado — acesso liberado por convite. Solicite seu acesso free.
            </p>
          ) : null}
          <h1
            id="hero-heading"
            className="mt-5 font-heading text-3xl font-bold leading-tight text-text-primary sm:text-5xl"
          >
            {HEADLINE}
          </h1>
          <p className="mt-5 max-w-xl text-base text-text-secondary sm:text-lg">
            {SUBHEADLINE}
          </p>
          <p className="mt-4 max-w-xl text-base text-text-secondary">
            Você define como quer apresentar.{" "}
            <span className="text-accent-green">O Vendeo prepara a campanha.</span>
          </p>
          <div className="mt-8">
            <AcquisitionCta publicSignupEnabled={publicSignupEnabled} />
          </div>
        </div>
        <div className="mx-auto w-full max-w-sm sm:mx-0 sm:max-w-none">
          <CampaignImage
            src="/landing/hero-oferta-cafe.webp"
            alt="Campanha de oferta de café da Mercearia Tio João"
            contain
          />
        </div>
      </div>
    </section>
  );
}
