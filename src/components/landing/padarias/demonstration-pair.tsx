import {
  CAKE_CAMPAIGN_IMAGE,
  SUBMITTED_CAKE_PHOTO,
} from "@/components/landing/padarias/image-sources";

/**
 * Demonstration pair for `/padarias`.
 *
 * Left: the submitted cake photo in a 1:1 box. Right: the approved Dona Maria
 * campaign in a fixed 1:1 box rendered with `contain`, so the "Novidade" badge,
 * brand and product details are never cropped.
 *
 * Loading priority is measured, not assumed: both images stay eager until the
 * browser LCP measurement says otherwise. No image receives high priority while
 * the H1 is the measured LCP.
 *
 * The unique demonstrative notice is rendered by the page after the complete set
 * of examples, not inside this pair.
 */
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
        Da foto do bolo à campanha pronta para publicar.
      </h2>

      <div className="mt-6 grid items-start gap-6 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <figure className="mx-auto w-full max-w-xs sm:mx-0 sm:max-w-none">
          <figcaption className="mb-3 font-heading text-xs font-semibold uppercase tracking-wide text-accent-green">
            Foto enviada ao Vendeo
          </figcaption>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={SUBMITTED_CAKE_PHOTO.src}
            srcSet={SUBMITTED_CAKE_PHOTO.srcSet}
            sizes={SUBMITTED_CAKE_PHOTO.sizes}
            width={SUBMITTED_CAKE_PHOTO.width}
            height={SUBMITTED_CAKE_PHOTO.height}
            alt="Bolo naked fruit com frutas vermelhas sobre um balcão de padaria"
            loading="eager"
            decoding="async"
            className="h-auto w-full rounded-lg border border-border-light bg-bg-deep"
          />
        </figure>

        <div
          aria-hidden="true"
          className="flex items-center justify-center self-center text-text-muted"
        >
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
          <div className="aspect-square w-full overflow-hidden rounded-lg border border-border-light bg-bg-deep">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={CAKE_CAMPAIGN_IMAGE.src}
              srcSet={CAKE_CAMPAIGN_IMAGE.srcSet}
              sizes={CAKE_CAMPAIGN_IMAGE.sizes}
              width={CAKE_CAMPAIGN_IMAGE.width}
              height={CAKE_CAMPAIGN_IMAGE.height}
              alt="Campanha da Panificadora Dona Maria para o Bolo Naked Fruit, com selo Novidade e descrição da massa e do recheio"
              loading="eager"
              decoding="async"
              className="h-full w-full object-contain"
            />
          </div>
        </figure>
      </div>
    </section>
  );
}
