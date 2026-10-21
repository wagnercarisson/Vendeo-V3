/**
 * FAQ block (block 7 of the landing).
 *
 * Server component (no props): the acquisition CTA moved to the end of the
 * transformation block and to the identity block (both consume the single
 * `publicSignupEnabled` value from `page.tsx`). This block renders ONLY the FAQ
 * — the legal links live in the page FOOTER (single source, no duplication).
 * No acquisition CTA here. No emojis, no internal terms.
 */

const FAQ = [
  {
    question: "Para quem o Vendeo foi desenvolvido?",
    answer:
      "Para lojistas que querem divulgar produtos e ofertas nas redes sociais com campanhas profissionais.",
  },
  {
    question: "Preciso saber design ou marketing?",
    answer:
      "Não. Você informa o básico, e o Vendeo entrega a campanha completa — com arte e texto — para você conferir, baixar e publicar.",
  },
  {
    question: "Preciso fornecer informações pessoais?",
    answer:
      "Sim. Solicitamos informações para seu acesso e contato, além de dados da sua loja para personalizar as campanhas com a identidade do seu negócio. Você pode consultar os detalhes na Política de Privacidade.",
  },
  {
    question: "Preciso informar cartão de crédito?",
    answer: "Não. O teste gratuito não exige cartão de crédito.",
  },
];

export function FaqFinalCtaSection() {
  return (
    <section
      aria-labelledby="perguntas-frequentes-heading"
      className="mx-auto w-full max-w-5xl px-6 py-8 sm:py-12"
    >
      <h2
        id="perguntas-frequentes-heading"
        className="font-heading text-2xl font-bold text-text-primary sm:text-3xl"
      >
        Perguntas frequentes
      </h2>

      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {FAQ.map((item) => (
          <li
            key={item.question}
            className="rounded-xl border border-border bg-bg-deep"
          >
            <details>
              <summary className="min-h-[44px] cursor-pointer rounded-xl px-5 py-3 focus-visible:ring-2 focus-visible:ring-accent-green focus-visible:outline-none">
                <h3 className="inline font-heading text-base font-semibold text-text-primary">
                  {item.question}
                </h3>
              </summary>
              <p className="px-5 pb-4 text-sm text-text-secondary">
                {item.answer}
              </p>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}
