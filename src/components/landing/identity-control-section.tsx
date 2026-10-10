import { AcquisitionCta } from "./acquisition-cta";
import { CampaignImage } from "./campaign-image";

/**
 * Identity and control block (block 4 of the landing).
 *
 * Compact block proving brand coherence and user control, supported by a single
 * 1:1 example only — no fabricated testimonials, commercial results or identity
 * proofs. Server component (no props): it does not read the flag.
 */

const BRAND_LINE =
  "Sua marca, suas cores e o estilo da sua loja presentes na campanha.";

export function IdentityControlSection({
  publicSignupEnabled,
}: {
  publicSignupEnabled: boolean;
}) {
  return (
    <section
      aria-labelledby="identidade-controle-heading"
      className="mx-auto w-full max-w-5xl px-6 py-8 sm:py-12"
    >
      <h2
        id="identidade-controle-heading"
        className="font-heading text-2xl font-bold text-text-primary sm:text-3xl"
      >
        Fica com a cara da sua loja — e você decide
      </h2>

      <div className="mt-6 grid items-center gap-6 sm:grid-cols-2">
        <div className="mx-auto w-full max-w-xs sm:mx-0 sm:max-w-none">
          <CampaignImage
            src="/landing/identidade-floricultura.webp"
            alt="Campanha de buquê de rosas da Floricultura Dona Flor"
            contain
            loading="lazy"
          />
        </div>
        <div>
          <p className="text-base text-text-secondary">{BRAND_LINE}</p>
          <p className="mt-3 text-sm text-text-secondary">
            Você confere cada campanha e decide o que publicar.
          </p>
          <div className="mt-6">
            <AcquisitionCta
              publicSignupEnabled={publicSignupEnabled}
              align="start"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
