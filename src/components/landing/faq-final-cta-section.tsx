import Link from "next/link";
import { AcquisitionCta } from "./acquisition-cta";

/**
 * FAQ + final CTA + legal links block (block 7 of the landing).
 *
 * Server component: the single flag value `publicSignupEnabled` is read once in
 * `page.tsx` and passed down. The final acquisition CTA is provided by the
 * shared `AcquisitionCta` primitive (dark text on green, D-19) — no green CTA
 * markup is hand-rolled here. The legal links reuse the copy used today. No
 * emojis, no internal terms, only approved capabilities.
 */

const FAQ = [
  {
    question: "Como funciona o teste gratuito?",
    answer:
      "Após concluir o cadastro e a configuração inicial da sua loja, começam seus 28 dias de teste. Você recebe 5 créditos iniciais e mais 5 a cada sete dias, até completar 20 créditos concedidos no período. Os créditos não utilizados acumulam, e as liberações continuam mesmo que você não acesse toda semana. Os créditos gratuitos restantes vencem ao final dos 28 dias. Solicitar acesso não inicia esse prazo. Durante o beta fechado, não há venda de créditos.",
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

const LEGAL_LINKS = [
  { href: "/termos", label: "Termos de Uso" },
  { href: "/privacidade", label: "Política de Privacidade" },
  { href: "/uso-aceitavel", label: "Uso Aceitável" },
];

interface FaqFinalCtaSectionProps {
  publicSignupEnabled: boolean;
}

export function FaqFinalCtaSection({
  publicSignupEnabled,
}: FaqFinalCtaSectionProps) {
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

      <ul className="mt-6 grid gap-4 sm:grid-cols-2">
        {FAQ.map((item) => (
          <li
            key={item.question}
            className="rounded-xl border border-border bg-bg-surface p-5"
          >
            <h3 className="font-heading text-base font-semibold text-text-primary">
              {item.question}
            </h3>
            <p className="mt-2 text-sm text-text-secondary">{item.answer}</p>
          </li>
        ))}
      </ul>

      <div className="mt-10 rounded-2xl border border-border bg-bg-surface p-8 text-center">
        <AcquisitionCta publicSignupEnabled={publicSignupEnabled} />
      </div>

      <nav
        aria-label="Links legais"
        className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-text-muted"
      >
        {LEGAL_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="transition-colors hover:text-text-primary"
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </section>
  );
}
