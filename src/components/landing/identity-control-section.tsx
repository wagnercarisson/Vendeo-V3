import { CampaignImage } from "./campaign-image";

/**
 * Identity and control block (block 4 of the landing).
 *
 * Compact block proving brand coherence and user control, supported by a single
 * 1:1 example only — no fabricated testimonials, commercial results or identity
 * proofs. Preserves the approved distinction line with the single green
 * emphasis span on the "O Vendeo prepara a campanha." half only. Server
 * component (no props): it does not read the flag.
 */

const DISTINCTION = "Você define como quer apresentar. O Vendeo prepara a campanha.";
const DISTINCTION_EMPHASIS = "O Vendeo prepara a campanha.";
const DISTINCTION_LEAD = DISTINCTION.replace(DISTINCTION_EMPHASIS, "");

export function IdentityControlSection() {
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
          <CampaignImage alt="Exemplo de campanha que preserva a identidade da loja" />
        </div>
        <div>
          <p className="text-base text-text-secondary">
            {DISTINCTION_LEAD}
            <span className="text-accent-green">{DISTINCTION_EMPHASIS}</span>
          </p>
          <p className="mt-3 text-sm text-text-secondary">
            Você confere cada campanha e decide o que publicar.
          </p>
        </div>
      </div>
    </section>
  );
}
