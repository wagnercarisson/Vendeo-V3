import { CampaignImage } from "./campaign-image";

/**
 * Communication-approach block (block 5 of the landing).
 *
 * Proves different ways of communicating the same product with exactly three
 * 1:1 campaigns — Oferta, Destaque and Exclusivo — keeping the same scenario
 * and store identity and varying only the necessary information. Lower
 * editorial weight (short title, support, three examples): no extra
 * explanatory cards, no extra CTA and no process repetition.
 *
 * Desktop: three columns. Mobile: the same native horizontal strip used by the
 * presentation block (`overflow-x: auto` + `[scroll-snap-type:x_mandatory]`,
 * keyboard-focusable with a visible focus ring, overflow confined to the
 * strip). Only approved capabilities are communicated.
 */

const APPROACHES = [
  { label: "Oferta", alt: "Exemplo de campanha para oferta" },
  { label: "Destaque", alt: "Exemplo de campanha para destaque" },
  { label: "Exclusivo", alt: "Exemplo de campanha para exclusivo" },
];

export function ApproachSection() {
  return (
    <section
      aria-labelledby="abordagens-divulgacao-heading"
      className="mx-auto w-full max-w-5xl px-6 py-8 sm:py-12"
    >
      <h2
        id="abordagens-divulgacao-heading"
        className="font-heading text-2xl font-bold text-text-primary sm:text-3xl"
      >
        Uma campanha para cada jeito de divulgar.
      </h2>
      <p className="mt-3 max-w-xl text-base text-text-secondary">
        Mostre uma oferta, valorize um produto ou apresente algo especial.
      </p>

      <ul
        tabIndex={0}
        aria-label="Abordagens de divulgação: oferta, destaque e exclusivo"
        className="mt-6 flex gap-4 overflow-x-auto rounded-lg pb-2 focus-visible:ring-2 focus-visible:ring-accent-green focus:outline-none [scroll-snap-type:x_mandatory] sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0"
      >
        {APPROACHES.map((item) => (
          <li
            key={item.label}
            className="min-w-[78%] [scroll-snap-align:start] sm:min-w-0"
          >
            <CampaignImage alt={item.alt} />
            <h3 className="mt-3 font-heading text-base font-semibold text-text-primary">
              {item.label}
            </h3>
          </li>
        ))}
      </ul>
    </section>
  );
}
