import { AcquisitionCta } from "./acquisition-cta";

/**
 * Independent free-trial offer block (block 6 of the landing).
 *
 * Pure server component: the only input is the `publicSignupEnabled` value read
 * once server-side and forwarded to the shared `AcquisitionCta`. This block does
 * not read env/flags, does not call any remote service and does not activate
 * anything.
 *
 * The short approved main message is the block's prominent text. The credit
 * mechanics live ONLY in the secondary disclosure below, never in the main
 * message. No emojis and no technical notice; only the approved communication.
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
      <div className="rounded-2xl border border-border bg-bg-surface p-6 sm:p-8">
        <h2
          id="oferta-heading"
          className="font-heading text-2xl font-bold text-text-primary sm:text-3xl"
        >
          Teste gratuitamente, sem cartão de crédito
        </h2>

        <p className="mt-3 max-w-xl font-heading text-lg font-semibold text-text-secondary sm:text-xl">
          Experimente o Vendeo em sua loja: 28 dias gratuitos e até 20 créditos.
        </p>

        <div className="mt-6">
          <AcquisitionCta publicSignupEnabled={publicSignupEnabled} />
        </div>

        <details
          data-offer-mechanics
          className="mt-6 rounded-lg border border-border bg-bg-deep/40 p-4 text-sm text-text-secondary"
        >
          <summary className="flex min-h-[44px] cursor-pointer items-center rounded font-medium text-text-secondary focus-visible:ring-2 focus-visible:ring-accent-green focus-visible:outline-none">
            Como funcionam os créditos do teste gratuito
          </summary>
          <div className="mt-3 space-y-2">
            <p>
              O período de 28 dias começa após concluir o cadastro e a
              configuração inicial da sua loja.
            </p>
            <p>
              Você recebe 5 créditos iniciais e mais 5 nos dias 7, 14 e 21, até o
              máximo de 20 créditos concedidos no período.
            </p>
            <p>
              Os créditos acumulam, inclusive as parcelas liberadas durante sua
              ausência, e os créditos gratuitos restantes vencem ao final do
              período.
            </p>
            <p>
              No beta fechado, solicitar acesso não inicia o período da oferta.
            </p>
          </div>
        </details>
      </div>
    </section>
  );
}
