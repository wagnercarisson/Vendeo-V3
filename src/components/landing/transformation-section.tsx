import { CampaignImage } from "./campaign-image";

/**
 * Transformation block (block 2 of the landing).
 *
 * Proves simplicity with a 2-panel before/after: the ENTRY is a compact text
 * summary (product / price / details) — never a square image or a
 * `CampaignImage` — and the RESULT is a single, complete 1:1 `CampaignImage`
 * (rendered with `contain`, so the campaign is never cropped). Entry↔result
 * correspondence is preserved. This block absorbs the old process section, so
 * no separate process heading exists here. Server component (no props).
 */

const ENTRY_SUMMARY = [
  { label: "Produto", value: "Nome do produto" },
  { label: "Preço", value: "Preço da oferta" },
  { label: "Detalhes", value: "Informações da sua loja" },
];

const STEPS = [
  {
    number: 1,
    title: "Você informa o básico",
    description: "Produto, oferta, preço e alguns detalhes da sua loja.",
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

export function TransformationSection() {
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
        {/* ENTRY — compact text summary, not an image */}
        <div className="rounded-xl border border-border bg-bg-surface p-5">
          <span className="font-heading text-xs font-semibold uppercase tracking-wide text-accent-green">
            Entrada
          </span>
          <dl className="mt-3 space-y-2">
            {ENTRY_SUMMARY.map((item) => (
              <div
                key={item.label}
                className="flex items-baseline justify-between gap-4"
              >
                <dt className="text-sm text-text-muted">{item.label}</dt>
                <dd className="text-sm font-medium text-text-primary">
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Process arrow */}
        <div
          aria-hidden="true"
          className="hidden text-center font-heading text-2xl text-text-muted sm:block"
        >
          →
        </div>

        {/* RESULT — complete 1:1 campaign, never cropped */}
        <div className="mx-auto w-full max-w-xs sm:mx-0 sm:max-w-none">
          <CampaignImage
            alt="Campanha completa gerada a partir das informações informadas"
            contain
          />
        </div>
      </div>

      {/* Compact steps (no separate cards) — absorbs the old process section */}
      <ol className="mt-8 grid gap-4 sm:grid-cols-2">
        {STEPS.map((step) => (
          <li key={step.number} className="flex gap-3">
            <span className="font-heading text-sm font-semibold text-accent-green">
              {step.number}
            </span>
            <div>
              <h3 className="font-heading text-base font-semibold text-text-primary">
                {step.title}
              </h3>
              <p className="mt-1 text-sm text-text-secondary">
                {step.description}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
