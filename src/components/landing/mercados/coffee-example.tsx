import { COFFEE_CAMPAIGN } from "./image-sources";

/**
 * Complementary coffee example for `/ofertas-para-mercados`.
 *
 * Only the final campaign is shown: no extra before/after pair and no second
 * publication kit. Text sits left and the image right on desktop, vertically
 * centered; on mobile the text comes first. The image is below the opening, so
 * it loads lazily with explicit 1:1 dimensions and reuses the approved WebP
 * derivatives from the landing.
 */
export function CoffeeExample() {
  return (
    <div className="mt-6 grid items-center gap-6 md:grid-cols-2 md:gap-10">
      <div>
        <h2
          id="cafe-heading"
          className="max-w-3xl text-balance font-heading text-2xl font-bold text-text-primary sm:text-3xl"
        >
          Outra categoria, a mesma identidade.
        </h2>
        <p className="mt-3 text-pretty text-base text-text-secondary">
          A Mercearia Tio João também divulga o café da loja com o mesmo padrão
          de campanha: produto em destaque, preço legível e a marca do
          estabelecimento preservada.
        </p>
      </div>

      <figure className="mx-auto w-full max-w-md md:mx-0 md:max-w-none">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={COFFEE_CAMPAIGN.src}
          srcSet={COFFEE_CAMPAIGN.srcSet}
          sizes={COFFEE_CAMPAIGN.sizes}
          width={COFFEE_CAMPAIGN.width}
          height={COFFEE_CAMPAIGN.height}
          alt="Campanha da Mercearia Tio João para o Café Melitta 500 g Tradicional, com preço promocional em destaque e a marca da loja."
          loading="lazy"
          decoding="async"
          className="h-auto w-full rounded-lg border border-border-light bg-bg-deep object-contain"
        />
      </figure>
    </div>
  );
}
