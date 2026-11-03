import { CampaignImage } from "@/components/landing/campaign-image";
import {
  CAMPAIGN_IMAGE,
  SUBMITTED_PHOTO_IMAGE,
} from "@/components/landing/floriculturas/image-sources";

/**
 * Demonstration pair for `/floriculturas` (block 2).
 *
 * Left: the submitted photo in its original proportion (plain <img> with explicit
 * intrinsic dimensions — no crop, no layout shift). Right: the approved campaign
 * in a fixed 1:1 box rendered with `contain` so nothing is cropped, including the
 * "Destaque da Semana" badge baked into the approved art.
 *
 * Loading priority was measured, not assumed: the browser's LCP element is the H1
 * in both desktop (1440×900) and mobile (390×844), so no image receives high
 * priority. Both stay in the first viewport area and use `eager` to avoid a late
 * paint when scrolling; none uses `lazy`.
 *
 * The approved demonstrative notice appears here exactly once.
 */

export const DEMO_NOTICE =
  "As lojas e campanhas apresentadas são exemplos demonstrativos e não representam lojas reais nem ofertas comerciais válidas";

export function DemonstrationPair() {
  return (
    <section
      aria-labelledby="demonstracao-heading"
      className="mx-auto w-full max-w-5xl px-6 py-8 sm:py-12"
    >
      <h2
        id="demonstracao-heading"
        className="max-w-2xl font-heading text-2xl font-bold text-text-primary sm:text-3xl"
      >
        Da foto no balcão à campanha pronta para publicar.
      </h2>

      <div className="mt-6 grid items-center gap-6 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <figure className="mx-auto w-full max-w-xs sm:mx-0 sm:max-w-none">
          <figcaption className="mb-3 font-heading text-xs font-semibold uppercase tracking-wide text-accent-green">
            Foto enviada ao Vendeo
          </figcaption>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={SUBMITTED_PHOTO_IMAGE.src}
            srcSet={SUBMITTED_PHOTO_IMAGE.srcSet}
            sizes={SUBMITTED_PHOTO_IMAGE.sizes}
            width={SUBMITTED_PHOTO_IMAGE.width}
            height={SUBMITTED_PHOTO_IMAGE.height}
            alt="Orquídea roxa sobre um balcão de floricultura"
            loading="eager"
            decoding="async"
            className="h-auto w-full rounded-lg border border-border-light bg-bg-deep"
          />
        </figure>

        <div aria-hidden="true" className="flex items-center justify-center text-text-muted">
          <svg
            viewBox="0 0 24 24"
            className="h-6 w-6 sm:hidden"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 5v14" />
            <path d="m19 12-7 7-7-7" />
          </svg>
          <svg
            viewBox="0 0 24 24"
            className="hidden h-6 w-6 sm:block"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </div>

        <figure className="mx-auto w-full max-w-xs sm:mx-0 sm:max-w-none">
          <figcaption className="mb-3 font-heading text-xs font-semibold uppercase tracking-wide text-accent-green">
            Campanha criada com o Vendeo
          </figcaption>
          <CampaignImage
            src={CAMPAIGN_IMAGE.src}
            srcSet={CAMPAIGN_IMAGE.srcSet}
            sizes={CAMPAIGN_IMAGE.sizes}
            alt="Campanha da floricultura Donna Flor com a orquídea roxa"
            contain
            loading="eager"
          />
        </figure>
      </div>

      <p className="mt-6 max-w-3xl text-xs text-text-secondary">{DEMO_NOTICE}</p>
    </section>
  );
}
