import { KALANDIVA_IMAGE } from "@/components/landing/floriculturas/image-sources";

/**
 * Complementary offer example for `/floriculturas`.
 *
 * Static, approved content: the Flor Kalandiva campaign (Donna Flor) shows a
 * product with price and stock condition. Text sits beside the image on desktop,
 * vertically centered with left-aligned lines; on mobile it comes first. The art
 * is rendered whole — plain `<img>` with intrinsic 1:1 dimensions, no crop, no
 * overlay.
 *
 * It is below the opening, so it loads lazily. The campaign of the first
 * demonstration pair keeps its eager loading.
 */
export function OfferExample() {
  return (
    <div className="mt-8 grid items-center gap-6 md:grid-cols-2 md:gap-10">
      <div>
        <h3 className="font-heading text-xl font-semibold text-text-primary sm:text-2xl">
          Uma oferta da sua floricultura, pronta para divulgar.
        </h3>
        <p className="mt-3 text-base text-text-secondary">
          Quando tiver uma oferta sazonal, transforme a foto do produto, o preço
          e as condições em uma campanha para suas redes sociais. Destaque o
          produto, informe o preço e apresente as condições da oferta com a
          identidade da sua loja.
        </p>
      </div>

      <figure className="mx-auto w-full max-w-md md:mx-0 md:max-w-none">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={KALANDIVA_IMAGE.src}
          srcSet={KALANDIVA_IMAGE.srcSet}
          sizes={KALANDIVA_IMAGE.sizes}
          width={KALANDIVA_IMAGE.width}
          height={KALANDIVA_IMAGE.height}
          alt="Campanha da floricultura Donna Flor com a Flor Kalandiva em pote, com preço e condição de estoque"
          loading="lazy"
          decoding="async"
          className="h-auto w-full rounded-lg border border-border-light bg-bg-deep"
        />
      </figure>
    </div>
  );
}
