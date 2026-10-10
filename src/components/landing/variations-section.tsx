import { CampaignImage } from "./campaign-image";
import { RevealOnView } from "./reveal-on-view";

/**
 * Product presentation block (block 3 of the landing).
 *
 * Proves VISUAL flexibility with exactly three 1:1 campaigns of the same
 * product — Estúdio, Ambientado and Fundo original — keeping the same
 * commercial approach and equivalent information, so the only difference shown
 * is the presentation. Desktop: three columns. Mobile: a native horizontal
 * strip (`overflow-x: auto` + `[scroll-snap-type:x_mandatory]`, one legible
 * tile + part of the next) that is keyboard-focusable with a visible focus
 * ring; the overflow stays confined to the strip, there is no auto-advance and
 * no capture of vertical scroll. Only approved capabilities are communicated.
 */

const PRESENTATIONS = [
  {
    label: "Estúdio",
    src: "/landing/apresentacao-estudio.webp",
    alt: "Campanha de produto apresentada em estúdio",
  },
  {
    label: "Ambientado",
    src: "/landing/apresentacao-ambientado.webp",
    alt: "Campanha de produto apresentada ambientada em cenário de loja",
  },
  {
    label: "Fundo original",
    src: "/landing/apresentacao-fundo-original.webp",
    alt: "Campanha de produto mantendo o fundo original",
  },
];

export function VariationsSection() {
  return (
    <section
      aria-labelledby="apresentacao-produto-heading"
      className="mx-auto w-full max-w-5xl px-6 py-8 sm:py-12"
    >
      <h2
        id="apresentacao-produto-heading"
        className="font-heading text-2xl font-bold text-text-primary sm:text-3xl"
      >
        Escolha como apresentar seu produto.
      </h2>
      <p className="mt-3 max-w-xl text-base text-text-secondary">
        Estúdio, ambientado ou mantendo o fundo original.
      </p>
      <p className="mt-3 max-w-xl text-base text-text-secondary">
        Você escolhe o cenário. O Vendeo apresenta seu produto com a identidade
        da sua loja.
      </p>

      <RevealOnView>
        <ul
          tabIndex={0}
          aria-label="Formas de apresentar o produto: estúdio, ambientado e fundo original"
          className="mt-6 flex gap-4 overflow-x-auto rounded-lg pb-2 focus-visible:ring-2 focus-visible:ring-accent-green focus:outline-none [scroll-snap-type:x_mandatory] sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0"
        >
          {PRESENTATIONS.map((item) => (
            <li
              key={item.label}
              className="min-w-[78%] [scroll-snap-align:start] sm:min-w-0"
            >
              <CampaignImage src={item.src} alt={item.alt} contain />
              <h3 className="mt-3 font-heading text-base font-semibold text-text-primary">
                {item.label}
              </h3>
            </li>
          ))}
        </ul>
      </RevealOnView>
    </section>
  );
}
