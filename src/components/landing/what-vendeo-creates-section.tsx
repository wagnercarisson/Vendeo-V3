/**
 * Seção estática "O Vendeo pode criar" da landing pública.
 *
 * Server component (sem estado, sem "use client"): lista curta das
 * capacidades do app para reforçar a funcionalidade real da plataforma.
 * A seção começa com o nome da marca no heading.
 */
const CAPABILITIES = [
  {
    title: "Arte promocional",
    description: "a peça visual pronta para publicar.",
  },
  {
    title: "Texto e chamada",
    description: "copy comercial e headline da oferta.",
  },
  {
    title: "Legenda para redes sociais",
    description: "legenda pronta para acompanhar a arte.",
  },
  {
    title: "CTA",
    description: "chamada para ação para orientar o próximo passo do cliente.",
  },
];

export function WhatVendeoCreatesSection() {
  return (
    <section
      aria-labelledby="vendeo-cria-heading"
      className="mx-auto w-full max-w-5xl px-6 py-12"
    >
      <h2
        id="vendeo-cria-heading"
        className="font-heading text-2xl font-bold text-text-primary sm:text-3xl"
      >
        O Vendeo pode criar
      </h2>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2">
        {CAPABILITIES.map((capability) => (
          <li
            key={capability.title}
            className="rounded-xl border border-border bg-bg-surface p-5"
          >
            <h3 className="font-heading text-base font-semibold text-text-primary">
              {capability.title}
            </h3>
            <p className="mt-1 text-sm text-text-secondary">
              {capability.description}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}