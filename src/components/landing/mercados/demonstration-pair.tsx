import { BEEF_CAMPAIGN, BEEF_PHOTO } from "./image-sources";

/**
 * Demonstration pair for `/ofertas-para-mercados`.
 *
 * Desktop/tablet: a single centered grid with a maximum of 360 px for the input
 * photo and 480 px for the campaign, giving more weight to the result. The photo
 * is vertically centered against the taller campaign, and its label sits just
 * above the image (absolutely positioned only on desktop/tablet). The campaign
 * label stays at the top of its column. The decorative arrow is centered only
 * between the images. Neither image is cropped or distorted.
 *
 * Mobile: the five grid children are reordered to photo label → photo → arrow →
 * campaign label → campaign, with `max-w-[420px]` images.
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
        className="max-w-4xl text-balance font-heading text-2xl font-bold text-text-primary sm:text-3xl"
      >
        Da foto do produto à campanha pronta para divulgar.
      </h2>

      <div className="mt-6 grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-[minmax(0,3fr)_auto_minmax(0,4fr)] md:items-start md:justify-center lg:grid-cols-[minmax(0,360px)_auto_minmax(0,480px)]">
        <p
          id="mercados-campanha-label"
          className="order-3 min-h-8 font-heading text-xs font-semibold uppercase tracking-wide text-accent-green md:order-none md:col-start-3 md:row-start-1"
        >
          Campanha criada com o Vendeo
        </p>

        <figure
          aria-labelledby="mercados-foto-label"
          className="order-1 mx-auto w-full max-w-[420px] md:order-none md:col-start-1 md:row-start-2 md:mx-0 md:max-w-[360px] md:justify-self-center md:self-center"
        >
          <div className="relative w-full">
            <p
              id="mercados-foto-label"
              className="mb-3 min-h-8 font-heading text-xs font-semibold uppercase tracking-wide text-accent-green md:absolute md:bottom-full md:left-0 md:mb-3 md:min-h-0"
            >
              Foto do produto
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={BEEF_PHOTO.src}
              srcSet={BEEF_PHOTO.srcSet}
              sizes={BEEF_PHOTO.sizes}
              width={BEEF_PHOTO.width}
              height={BEEF_PHOTO.height}
              alt="Coxão mole bovino sobre a bancada de um açougue, com peça inteira e fatia à mostra."
              loading="eager"
              decoding="async"
              className="h-auto w-full rounded-lg border border-border-light bg-bg-deep object-contain"
            />
          </div>
        </figure>

        <div
          aria-hidden="true"
          className="order-2 flex items-center justify-center self-center py-2 text-text-muted md:order-none md:col-start-2 md:row-start-2 md:py-0"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-6 w-6 md:hidden"
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
            className="hidden h-6 w-6 md:block"
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

        <figure
          aria-labelledby="mercados-campanha-label"
          className="order-4 mx-auto w-full max-w-[420px] md:order-none md:col-start-3 md:row-start-2 md:mx-0 md:max-w-[480px] md:justify-self-center md:self-start"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={BEEF_CAMPAIGN.src}
            srcSet={BEEF_CAMPAIGN.srcSet}
            sizes={BEEF_CAMPAIGN.sizes}
            width={BEEF_CAMPAIGN.width}
            height={BEEF_CAMPAIGN.height}
            alt="Campanha da Mercearia Tio João para o Coxão Mole Bovino, com preço anterior riscado, R$ 39,90/kg em destaque, selo Oferta e validade de 10 a 13 de novembro de 2026."
            loading="eager"
            decoding="async"
            className="h-auto w-full rounded-lg border border-border-light bg-bg-deep object-contain"
          />
        </figure>
      </div>
    </section>
  );
}
