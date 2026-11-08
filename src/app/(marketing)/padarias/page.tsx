import type { Metadata } from "next";
import { AccessCtaGroup } from "@/components/landing/padarias/access-cta-group";
import { BreadExample } from "@/components/landing/padarias/bread-example";
import { DemonstrationPair } from "@/components/landing/padarias/demonstration-pair";
import { PadariasHeader } from "@/components/landing/padarias/padarias-header";
import { PublicationKit } from "@/components/landing/padarias/publication-kit";
import { OfferCard } from "@/components/landing/offer-card";
import { PublicFooter } from "@/components/landing/public-footer";
import { getLaunchConfig } from "@/lib/launch-config/config";
import { isIndexableEnvironment } from "@/lib/seo/environment";
import {
  PADARIAS_CANONICAL_PATH,
  INDEX_ROBOTS,
  NOINDEX_ROBOTS,
} from "@/lib/seo/indexation-policy";
import {
  SHARE_IMAGE_ALT,
  SHARE_IMAGE_HEIGHT,
  SHARE_IMAGE_PATH,
  SHARE_IMAGE_WIDTH,
} from "@/lib/seo/home-metadata";
import { resolveCanonicalOrigin } from "@/lib/seo/origin";

/**
 * Página pública demonstrativa `/padarias`.
 *
 * Conteúdo estático aprovado: foto do Bolo Naked Fruit, campanha da Panificadora
 * Dona Maria, kit de publicação em HTML e exemplo complementar do Pão Francês
 * Fresquinho. Nenhuma geração, provider, crédito ou dado de campanha é acessado.
 *
 * Indexação: `index, follow` e canonical absoluto somente sob produção confirmada
 * + origem canônica validada. Fora disso, `noindex` explícito e canonical omitido.
 * O sitemap segue o mesmo contrato em `src/app/sitemap.ts`.
 */

const TITLE = "Crie posts e campanhas para padarias com IA | Vendeo";
const DESCRIPTION =
  "Transforme fotos e informações dos produtos da sua padaria em artes e textos prontos para divulgar nas redes sociais. Sem precisar saber design.";

/** Destino estável da prévia de acesso da abertura (card único no encerramento). */
const PADARIAS_OFFER_ANCHOR = "padarias-oferta";

/** Aviso demonstrativo único, exibido após o conjunto de exemplos. */
const DEMO_NOTICE =
  "As lojas e campanhas apresentadas são exemplos demonstrativos e não representam lojas reais nem ofertas comerciais válidas";

const indexable = isIndexableEnvironment();
const { origin } = resolveCanonicalOrigin();
const canonical =
  indexable && origin !== null ? `${origin}${PADARIAS_CANONICAL_PATH}` : undefined;

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
    url: PADARIAS_CANONICAL_PATH,
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

const SITUATIONS = [
  {
    title: "Novidades da vitrine.",
    description:
      "Apresente um bolo, um doce ou um produto novo que chegou para vender no balcão.",
  },
  {
    title: "Fornadas do dia.",
    description:
      "Mostre os pães que acabaram de sair e convide o cliente a passar na padaria.",
  },
  {
    title: "Bolos e encomendas.",
    description:
      "Divulgue as opções de bolo e as informações que o cliente precisa para fazer a encomenda.",
  },
] as const;

export default async function PadariasPage() {
  const { publicSignupEnabled } = await getLaunchConfig();

  return (
    <div className="flex min-h-screen flex-col bg-bg-surface font-body text-text-primary">
      <PadariasHeader />

      <main className="flex flex-1 flex-col">
        {/* Abertura */}
        <section
          aria-labelledby="padarias-heading"
          className="mx-auto w-full max-w-5xl px-6 pt-12 pb-8 sm:pt-16 sm:pb-12"
        >
          <div className="max-w-2xl">
            <h1
              id="padarias-heading"
              className="font-heading text-3xl font-bold leading-tight text-text-primary sm:text-5xl"
            >
              Transforme os produtos da sua padaria em campanhas prontas para
              divulgar.
            </h1>
            <p className="mt-5 text-base text-text-secondary sm:text-lg">
              O Vendeo é o aplicativo que cria artes e textos para divulgar os
              produtos da sua padaria nas redes sociais. Envie uma foto, conte o
              que quer destacar e receba uma campanha com a identidade da sua
              loja — sem precisar saber design.
            </p>
            <div className="mt-8">
              <AccessCtaGroup
                publicSignupEnabled={publicSignupEnabled}
                anchorHref={`#${PADARIAS_OFFER_ANCHOR}`}
              />
            </div>
          </div>
        </section>

        <DemonstrationPair />

        {/* Explicação + kit de publicação */}
        <section
          aria-labelledby="kit-heading"
          className="mx-auto w-full max-w-5xl px-6 py-8 sm:py-12"
        >
          <div className="max-w-2xl">
            <p className="text-base text-text-secondary">
              Uma foto do bolo, o nome da Panificadora Dona Maria e as
              informações que você quer destacar. O Vendeo reúne esses elementos
              em uma campanha com a marca da loja, o produto em destaque e uma
              mensagem pronta para acompanhar a publicação.
            </p>
            <PublicationKit />
          </div>
        </section>

        {/* Situações comerciais */}
        <section
          aria-labelledby="situacoes-heading"
          className="mx-auto w-full max-w-5xl px-6 py-8 sm:py-12"
        >
          <h2
            id="situacoes-heading"
            className="max-w-2xl font-heading text-2xl font-bold text-text-primary sm:text-3xl"
          >
            Crie posts para sua padaria sem começar do zero.
          </h2>
          <p className="mt-4 max-w-2xl text-base text-text-secondary">
            A rotina da padaria rende assunto todos os dias. O Vendeo ajuda a
            transformar o que já acontece na loja em uma campanha pronta para
            divulgar.
          </p>

          <ul className="mt-6 grid max-w-4xl gap-6 md:grid-cols-3">
            {SITUATIONS.map((situation) => (
              <li
                key={situation.title}
                className="border-t border-border pt-4"
              >
                <h3 className="font-heading text-base font-semibold text-text-primary">
                  {situation.title}
                </h3>
                <p className="mt-2 text-sm text-text-secondary">
                  {situation.description}
                </p>
              </li>
            ))}
          </ul>
        </section>

        {/* Exemplo complementar + aviso único */}
        <section
          aria-labelledby="fornada-heading"
          className="mx-auto w-full max-w-5xl px-6 py-8 sm:py-12"
        >
          <BreadExample />
          <p className="mt-8 max-w-3xl text-xs text-text-secondary">
            {DEMO_NOTICE}
          </p>
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
              Como ficaria uma campanha com os produtos da sua padaria?
            </h2>
            <p className="mt-4 text-base text-text-secondary">
              Sua padaria, sua marca, uma campanha pronta para divulgar.
            </p>
            <div className="mt-8">
              <OfferCard
                id={PADARIAS_OFFER_ANCHOR}
                variant="compact"
                publicSignupEnabled={publicSignupEnabled}
                align="center"
              >
                <AccessCtaGroup
                  publicSignupEnabled={publicSignupEnabled}
                  align="center"
                />
              </OfferCard>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter currentPath="/padarias" context="marketing" />
    </div>
  );
}
