/**
 * Seção estática "Como funciona" da landing pública.
 *
 * Server component (sem estado, sem "use client"): apresenta o fluxo do
 * produto SaaS em 4 passos numerados. Reforça a marca — o passo 3 menciona
 * "O Vendeo cria a campanha".
 */
const STEPS = [
  {
    number: 1,
    title: "Cadastre sua loja",
    description:
      "Crie sua conta e cadastre os dados da sua loja física em poucos minutos.",
  },
  {
    number: 2,
    title: "Informe sua oferta",
    description: "Conte produto, oferta e preço que você quer divulgar.",
  },
  {
    number: 3,
    title: "O Vendeo cria a campanha",
    description:
      "IA comercial define os parâmetros e a renderização programática executa a arte final.",
  },
  {
    number: 4,
    title: "Revise e publique",
    description:
      "Confira o resultado e exporte a peça pronta para suas redes sociais.",
  },
];

export function HowItWorksSection() {
  return (
    <section
      aria-labelledby="como-funciona-heading"
      className="mx-auto w-full max-w-5xl px-6 py-12"
    >
      <h2
        id="como-funciona-heading"
        className="font-heading text-2xl font-bold text-text-primary sm:text-3xl"
      >
        Como funciona
      </h2>
      <ol className="mt-6 grid gap-4 sm:grid-cols-2">
        {STEPS.map((step) => (
          <li
            key={step.number}
            className="rounded-xl border border-border bg-bg-surface p-5"
          >
            <span className="font-heading text-sm font-semibold text-accent-green">
              Passo {step.number}
            </span>
            <h3 className="mt-1 font-heading text-base font-semibold text-text-primary">
              {step.title}
            </h3>
            <p className="mt-1 text-sm text-text-secondary">
              {step.description}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}