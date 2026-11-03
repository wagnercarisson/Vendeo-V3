import type { Metadata } from "next";
import Link from "next/link";
import { AcquisitionCta } from "@/components/landing/acquisition-cta";
import { DemonstrationPair } from "@/components/landing/floriculturas/demonstration-pair";
import { FloriculturasHeader } from "@/components/landing/floriculturas/floriculturas-header";
import { getLaunchConfig } from "@/lib/launch-config/config";
import { isIndexableEnvironment } from "@/lib/seo/environment";
import {
  FLORICULTURAS_CANONICAL_PATH,
  INDEX_ROBOTS,
  NOINDEX_ROBOTS,
} from "@/lib/seo/indexation-policy";
import { resolveCanonicalOrigin } from "@/lib/seo/origin";

/**
 * Página pública demonstrativa `/floriculturas`.
 *
 * Conteúdo estático aprovado: foto sintética da orquídea roxa no balcão e campanha
 * da floricultura fictícia Donna Flor. Nenhuma geração, provider, crédito ou dado
 * de campanha é acessado.
 *
 * Indexação: `index, follow` e canonical absoluto somente sob produção confirmada
 * + origem canônica validada. Fora disso, `noindex` explícito e canonical omitido
 * (nunca herdar canonical de produção em preview/local). O sitemap segue o mesmo
 * contrato em `src/app/sitemap.ts`.
 */

const TITLE = "Campanhas para floriculturas: crie artes com IA | Vendeo";
const DESCRIPTION =
  "Transforme fotos de flores e arranjos em campanhas para divulgar sua floricultura nas redes sociais. Arte e texto com sua marca, sem precisar saber design.";
const SHARE_IMAGE_PATH = "/seo/vendeo-og-1200x630.png";
const SHARE_IMAGE_WIDTH = 1200;
const SHARE_IMAGE_HEIGHT = 630;
const SHARE_IMAGE_ALT = "Vendeo — crie campanhas para redes sociais com IA";

const indexable = isIndexableEnvironment();
const { origin } = resolveCanonicalOrigin();
const canonical =
  indexable && origin !== null ? `${origin}${FLORICULTURAS_CANONICAL_PATH}` : undefined;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  ...(canonical ? { alternates: { canonical } } : {}),
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Vendeo",
    title: TITLE,
    description: DESCRIPTION,
    url: FLORICULTURAS_CANONICAL_PATH,
    images: [
      {
        url: SHARE_IMAGE_PATH,
        width: SHARE_IMAGE_WIDTH,
        height: SHARE_IMAGE_HEIGHT,
        alt: SHARE_IMAGE_ALT,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: [SHARE_IMAGE_PATH],
  },
  robots: indexable ? INDEX_ROBOTS : NOINDEX_ROBOTS,
};

const STEPS = [
  {
    number: 1,
    title: "Envie a foto do produto.",
    description: "Escolha a flor ou o arranjo que quer divulgar.",
  },
  {
    number: 2,
    title: "Conte o que deseja destacar.",
    description:
      "Informe características, ocasião e preço, quando fizer parte da divulgação.",
  },
  {
    number: 3,
    title: "Gere sua campanha.",
    description: "Receba a arte e o texto com a identidade da sua loja.",
  },
  {
    number: 4,
    title: "Revise, baixe e publique.",
    description:
      "Confira os detalhes e leve a campanha para suas redes sociais.",
  },
];

export default async function FloriculturasPage() {
  const { publicSignupEnabled } = await getLaunchConfig();

  return (
    <div className="flex min-h-screen flex-col bg-bg-surface font-body text-text-primary">
      <FloriculturasHeader />

      <main className="flex flex-1 flex-col">
        {/* Abertura */}
        <section
          aria-labelledby="floriculturas-heading"
          className="mx-auto w-full max-w-5xl px-6 pt-12 pb-8 sm:pt-16 sm:pb-12"
        >
          <div className="max-w-2xl">
            <h1
              id="floriculturas-heading"
              className="font-heading text-3xl font-bold leading-tight text-text-primary sm:text-5xl"
            >
              A beleza das suas flores merece uma divulgação de qualidade.
            </h1>
            <p className="mt-5 text-base text-text-secondary sm:text-lg">
              Transforme fotos dos seus produtos em campanhas profissionais para
              divulgar sua floricultura. O Vendeo prepara a arte e o texto com a
              identidade da sua loja — sem você precisar saber design.
            </p>
            <div className="mt-8">
              <AcquisitionCta
                publicSignupEnabled={publicSignupEnabled}
                accessHref="/#acesso"
              />
            </div>
            <Link
              href="/"
              className="mt-4 inline-flex min-h-[44px] items-center rounded text-sm font-medium text-accent-blue underline-offset-4 transition-colors hover:text-text-primary hover:underline focus:ring-2 focus:ring-accent-blue focus:outline-none"
            >
              Conheça o Vendeo
            </Link>
          </div>
        </section>

        <DemonstrationPair />

        {/* Explicação + texto gerado */}
        <section className="mx-auto w-full max-w-5xl px-6 py-8 sm:py-12">
          <div className="grid items-start gap-6 sm:grid-cols-2">
            <p className="text-base text-text-secondary">
              Uma foto da orquídea, o nome da floricultura e as informações que você
              quer destacar. O Vendeo combina esses elementos em uma campanha com sua
              marca, apresentação do produto e mensagem para acompanhar a divulgação.
            </p>

            <aside className="rounded-xl border border-border bg-bg-deep p-5">
              <h2 className="font-heading text-lg font-semibold text-text-primary">
                Além da arte, o texto para acompanhar sua publicação.
              </h2>
              <dl className="mt-4 space-y-4">
                <div>
                  <dt className="font-heading text-xs font-semibold uppercase tracking-wide text-text-muted">
                    Título
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-text-primary">
                    Orquídea Phalaenopsis: beleza em cada cor
                  </dd>
                </div>
                <div>
                  <dt className="font-heading text-xs font-semibold uppercase tracking-wide text-text-muted">
                    Legenda
                  </dt>
                  <dd className="mt-1 text-sm text-text-secondary">
                    Em destaque na Floricultura Donna Flor, a Orquídea Phalaenopsis
                    encanta com sua beleza natural. São várias cores para escolher e
                    se encantar — um gesto delicado que transforma qualquer ambiente.
                  </dd>
                </div>
                <div>
                  <dt className="font-heading text-xs font-semibold uppercase tracking-wide text-text-muted">
                    Hashtags
                  </dt>
                  <dd className="mt-1 text-sm text-text-secondary">
                    #OrquídeaPhalaenopsis #Orquídeas #FloresEmDestaque
                    #FloriculturaDonnaFlor
                  </dd>
                </div>
                <div>
                  <dt className="font-heading text-xs font-semibold uppercase tracking-wide text-text-muted">
                    Chamada final
                  </dt>
                  <dd className="mt-1 text-sm text-text-primary">
                    Venha conhecer na loja!
                  </dd>
                </div>
              </dl>
            </aside>
          </div>
        </section>

        {/* Segundo bloco */}
        <section
          aria-labelledby="posts-heading"
          className="mx-auto w-full max-w-5xl px-6 py-8 sm:py-12"
        >
          <h2
            id="posts-heading"
            className="max-w-2xl font-heading text-2xl font-bold text-text-primary sm:text-3xl"
          >
            Crie posts para sua floricultura sem começar do zero.
          </h2>
          <p className="mt-4 max-w-2xl text-base text-text-secondary">
            Um arranjo para presentear, as flores que chegaram à loja ou o destaque
            da semana. Use as fotos dos seus produtos para criar campanhas e manter
            sua floricultura presente nas redes sociais.
          </p>
        </section>

        {/* Funcionamento */}
        <section
          aria-labelledby="funcionamento-heading"
          className="mx-auto w-full max-w-5xl px-6 py-8 sm:py-12"
        >
          <h2
            id="funcionamento-heading"
            className="max-w-2xl font-heading text-2xl font-bold text-text-primary sm:text-3xl"
          >
            Você conhece seus produtos. O Vendeo ajuda a apresentá-los.
          </h2>
          <ol className="mt-6 max-w-2xl">
            {STEPS.map((step) => (
              <li
                key={step.number}
                className="border-b border-border py-3 last:border-b-0"
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
        </section>

        {/* Encerramento */}
        <section
          aria-labelledby="chamada-heading"
          className="mx-auto w-full max-w-5xl px-6 py-10 sm:py-16"
        >
          <div className="mx-auto max-w-2xl text-center">
            <h2
              id="chamada-heading"
              className="font-heading text-2xl font-bold text-text-primary sm:text-3xl"
            >
              Como ficaria uma campanha com os produtos da sua floricultura?
            </h2>
            <p className="mt-4 text-base text-text-secondary">
              Comece com uma foto e as informações do que você quer divulgar.
            </p>
            <div className="mt-8">
              <AcquisitionCta
                publicSignupEnabled={publicSignupEnabled}
                accessHref="/#acesso"
                align="center"
              />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-text-secondary sm:flex-row">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/landing/vendeo-logo-dark.webp"
            alt="Vendeo"
            width={384}
            height={82}
            loading="lazy"
            className="h-6 w-auto shrink-0 self-center"
          />
          <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            <Link
              href="/"
              className="inline-flex min-h-[44px] items-center rounded px-2 transition-colors hover:text-text-primary focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:outline-none"
            >
              Voltar ao Vendeo
            </Link>
            <Link
              href="/termos"
              className="inline-flex min-h-[44px] items-center rounded px-2 transition-colors hover:text-text-primary focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:outline-none"
            >
              Termos de Uso
            </Link>
            <Link
              href="/privacidade"
              className="inline-flex min-h-[44px] items-center rounded px-2 transition-colors hover:text-text-primary focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:outline-none"
            >
              Política de Privacidade
            </Link>
            <Link
              href="/uso-aceitavel"
              className="inline-flex min-h-[44px] items-center rounded px-2 transition-colors hover:text-text-primary focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:outline-none"
            >
              Uso Aceitável
            </Link>
            <Link
              href="/login"
              className="inline-flex min-h-[44px] items-center rounded px-2 transition-colors hover:text-text-primary focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:outline-none"
            >
              Entrar
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
