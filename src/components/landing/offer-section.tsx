import { AcquisitionCta } from "./acquisition-cta";
import { OfferCard } from "./offer-card";

/**
 * Independent free-trial offer block (block 6 of the landing).
 *
 * Pure server component: the only input is the `publicSignupEnabled` value read
 * once server-side and forwarded to the shared `AcquisitionCta`. This block does
 * not read env/flags, does not call any remote service and does not activate
 * anything.
 *
 * Text and mechanics come from the single public copy source; the shared
 * `OfferCard` renders the complete variant. The compact variant used by
 * `/floriculturas` consumes the same source, so the two pages cannot drift.
 */

interface OfferSectionProps {
  publicSignupEnabled: boolean;
}

export function OfferSection({ publicSignupEnabled }: OfferSectionProps) {
  return (
    <section
      data-offer-block
      aria-labelledby="oferta-heading"
      className="mx-auto w-full max-w-5xl px-6 py-8 sm:py-12"
    >
      <OfferCard
        variant="full"
        publicSignupEnabled={publicSignupEnabled}
        headingId="oferta-heading"
      >
        <AcquisitionCta
          publicSignupEnabled={publicSignupEnabled}
          align="center"
        />
      </OfferCard>
    </section>
  );
}
