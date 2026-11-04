import { BREAD_CAMPAIGN_IMAGE } from "@/components/landing/padarias/image-sources";

/**
 * Complementary bread example for `/padarias`.
 *
 * Only the final campaign is shown: no extra before/after pair and no second
 * publication kit. Text sits left and the image right on desktop, vertically
 * centered; on mobile the text comes first. The image is below the opening, so
 * it loads lazily with explicit 1:1 dimensions.
 */
export function BreadExample() {
  return (
    <div className="mt-6 grid items-center gap-6 md:grid-cols-2 md:gap-10">
      <div>
        <h2
          id="fornada-heading"
          className="font-heading text-2xl font-bold text-text-primary sm:text-3xl"
        >
          Saiu uma fornada? Prepare a divulgação.
        </h2>
        <p className="mt-3 text-base text-text-secondary">
          Mostre os pães que acabaram de sair, destaque os produtos disponíveis
          no dia e convide seus clientes para passar na padaria.
        </p>
      </div>

      <figure className="mx-auto w-full max-w-md md:mx-0 md:max-w-none">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={BREAD_CAMPAIGN_IMAGE.src}
          srcSet={BREAD_CAMPAIGN_IMAGE.srcSet}
          sizes={BREAD_CAMPAIGN_IMAGE.sizes}
          width={BREAD_CAMPAIGN_IMAGE.width}
          height={BREAD_CAMPAIGN_IMAGE.height}
          alt="Campanha da Panificadora Dona Maria para o Pão Francês Fresquinho, com a chamada “Saiu uma nova fornada, corre!”"
          loading="lazy"
          decoding="async"
          className="h-auto w-full rounded-lg border border-border-light bg-bg-deep"
        />
      </figure>
    </div>
  );
}
