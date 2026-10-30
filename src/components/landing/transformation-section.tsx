import { ArrowDown, ArrowRight } from "lucide-react";
import { AcquisitionCta } from "./acquisition-cta";
import { CampaignImage } from "./campaign-image";
import { buildLandingSrcSet } from "./landing-image-srcset";

/**
 * Transformation block (block 2 of the landing).
 *
 * Proves simplicity with an information→campaign comparison: the ENTRY is a
 * compact text summary (product / description / price / selected badge) PLUS a
 * small thumbnail of the photo the user provided (a plain proportional <img>
 * inside the card — NOT a large square panel, modal, zoom or extra animation);
 * a decorative arrow (right on desktop, down on mobile) points to the RESULT,
 * a single complete 1:1 `CampaignImage` rendered with `contain` (never
 * cropped). Entry↔result correspondence is preserved. The block closes with
 * the shared acquisition CTA (same flag value passed from `page.tsx`). This
 * block absorbs the old process section, so no separate process heading exists
 * here. Server component receiving only `publicSignupEnabled`.
 */

const ENTRY_SUMMARY = [
  { label: "Produto", value: "Ração Confiance 15 kg Premium" },
  { label: "Descrição", value: "Alimento completo para cães adultos" },
  { label: "Preço", value: "R$ 114,90" },
  { label: "Selo selecionado", value: "Lançamento" },
];

const STEPS = [
  {
    number: 1,
    title: "Você informa o básico",
    description: "Produto, oferta, preço e alguns detalhes da campanha.",
  },
  {
    number: 2,
    title: "O Vendeo prepara a campanha",
    description: "O Vendeo cria a arte e o texto a partir dessas informações.",
  },
  {
    number: 3,
    title: "Você confere",
    description: "Revisa a campanha e decide antes de publicar.",
  },
  {
    number: 4,
    title: "Basta baixar para publicar",
    description: "Sua campanha está pronta para as redes sociais.",
  },
];

export function TransformationSection({
  publicSignupEnabled,
}: {
  publicSignupEnabled: boolean;
}) {
  return (
    <section
      aria-labelledby="transformacao-heading"
      className="mx-auto w-full max-w-5xl px-6 py-8 sm:py-12"
    >
      <h2
        id="transformacao-heading"
        className="font-heading text-2xl font-bold text-text-primary sm:text-3xl"
      >
        Da informação à campanha, sem complicação
      </h2>

      <div className="mt-6 grid items-center gap-6 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        {/* ENTRY — compact text summary + provided-photo thumbnail */}
        <div className="rounded-xl border border-border bg-bg-deep p-5">
          <span className="font-heading text-xs font-semibold uppercase tracking-wide text-accent-green">
            Entrada
          </span>
          <dl className="mt-3 space-y-2">
            {ENTRY_SUMMARY.map((item) => (
              <div
                key={item.label}
                className="flex items-baseline justify-between gap-4"
              >
                <dt className="shrink-0 text-sm text-text-secondary">
                  {item.label}
                </dt>
                <dd className="min-w-0 break-words text-right text-sm font-medium text-text-primary">
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>
          <figure className="mt-4">
            <img
              src="/landing/transformacao-produto-racao.webp"
              alt="Foto da ração Confiance Premium de 15 kg enviada para criar a campanha"
              width={112}
              height={103}
              loading="lazy"
              className="h-auto w-[112px] rounded-lg border border-border-light"
            />
            <figcaption className="mt-2 text-xs text-text-secondary">
              Foto enviada
            </figcaption>
          </figure>
        </div>

        {/* Decorative process arrow: down on mobile, right on desktop */}
        <div
          aria-hidden="true"
          className="flex items-center justify-center text-text-muted"
        >
          <ArrowDown className="h-6 w-6 sm:hidden" />
          <ArrowRight className="hidden h-6 w-6 sm:block" />
        </div>

        {/* RESULT — complete 1:1 campaign, never cropped */}
        <div className="mx-auto w-full max-w-xs sm:mx-0 sm:max-w-none">
          {/* Result column measures ~452px on desktop; min(320px, 100vw-48px) on mobile. */}
          <CampaignImage
            src="/landing/transformacao-petshop.webp"
            alt="Campanha da Pet Shop Bicho Fofo para ração Confiance Premium de 15 kg por R$ 114,90"
            contain
            loading="lazy"
            srcSet={buildLandingSrcSet("/landing/transformacao-petshop.webp")}
            sizes="(min-width: 1024px) 452px, (min-width: 640px) calc(50vw - 60px), min(320px, calc(100vw - 48px))"
          />
        </div>
      </div>

      {/* Compact steps (no separate cards) — absorbs the old process section */}
      <ol className="mt-8">
        {STEPS.map((step) => (
          <li
            key={step.number}
            className="border-b border-border py-2.5 last:border-b-0"
          >
            <div className="flex items-baseline gap-2">
              <span className="font-heading text-sm font-semibold text-accent-green">
                {step.number}
              </span>
              <h3 className="font-heading text-base font-semibold text-text-primary">
                {step.title}
              </h3>
            </div>
            <p className="mt-1 text-sm text-text-secondary">
              {step.description}
            </p>
          </li>
        ))}
      </ol>

      {/* Shared acquisition CTA (same flag value as hero/offer/identity) — centered */}
      <div className="mt-8">
        <AcquisitionCta
          publicSignupEnabled={publicSignupEnabled}
          align="center"
        />
      </div>
    </section>
  );
}
