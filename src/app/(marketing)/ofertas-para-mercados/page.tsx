import type { Metadata } from "next";
import { AccessCtaGroup } from "@/components/landing/mercados/access-cta-group";
import { CoffeeExample } from "@/components/landing/mercados/coffee-example";
import { DemonstrationPair } from "@/components/landing/mercados/demonstration-pair";
import { MercadosHeader } from "@/components/landing/mercados/mercados-header";
import { PublicationKit } from "@/components/landing/mercados/publication-kit";
import { OfferCard } from "@/components/landing/offer-card";
import { PublicFooter } from "@/components/landing/public-footer";
import { getLaunchConfig } from "@/lib/launch-config/config";
import { isIndexableEnvironment } from "@/lib/seo/environment";
import {
  INDEX_ROBOTS,
  NOINDEX_ROBOTS,
  OFERTAS_PARA_MERCADOS_CANONICAL_PATH,
} from "@/lib/seo/indexation-policy";
import {
  SHARE_IMAGE_ALT,
  SHARE_IMAGE_HEIGHT,
  SHARE_IMAGE_PATH,
  SHARE_IMAGE_WIDTH,
} from "@/lib/seo/home-metadata";
import { resolveCanonicalOrigin } from "@/lib/seo/origin";

/**
 * Página pública demonstrativa `/ofertas-para-mercados`.
 *
 * Conteúdo estático aprovado: foto horizontal do coxão mole no açougue, campanha
 * quadrada da fictícia Mercearia Tio João, explicação consolidada, kit de
 * publicação em HTML e exemplo complementar do café Melitta da mesma marca.
 * Nenhuma geração, provider, crédito ou dado de campanha é acessado.
 *
 * Indexação: `index, follow` e canonical absoluto somente sob produção confirmada
 * + origem canônica validada. Fora disso, `noindex` explícito e canonical omitido.
 * O sitemap segue o mesmo contrato em `src/app/sitemap.ts`.
 */

const TITLE = "Crie artes de ofertas para mercados e mercearias | Vendeo";
const DESCRIPTION =
  "Crie artes e textos para divulgar as ofertas do seu mercado, mercearia ou minimercado nas redes sociais. Com a identidade do seu estabelecimento.";

/** Destino estável da prévia de acesso da abertura (card único no encerramento). */
const OFERTAS_MERCADOS_OFFER_ANCHOR = "ofertas-mercados-oferta";

/** Aviso demonstrativo único, exibido após o conjunto de exemplos. */
const DEMO_NOTICE =
  "As lojas e campanhas apresentadas são exemplos demonstrativos e não representam lojas reais nem ofertas comerciais válidas. As marcas de produtos pertencem aos respectivos titulares. O Vendeo não possui vínculo, parceria, patrocínio ou endosso das marcas ou dos fabricantes utilizados para ilustrar as campanhas.";

const indexable = isIndexableEnvironment();
const { origin } = resolveCanonicalOrigin();
const canonical =
  indexable && origin !== null
    ? `${origin}${OFERTAS_PARA_MERCADOS_CANONICAL_PATH}`
    : undefined;

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
    url: OFERTAS_PARA_MERCADOS_CANONICAL_PATH,
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

export default async function OfertasParaMercadosPage() {
  const { publicSignupEnabled } = await getLaunchConfig();

  return (
    <div className="flex min-h-screen flex-col bg-bg-surface font-body text-text-primary">
      <MercadosHeader />

      <main className="flex flex-1 flex-col">
        {/* Abertura */}
        <section
          aria-labelledby="ofertas-mercados-heading"
          className="mx-auto w-full max-w-5xl px-6 pt-12 pb-8 sm:pt-16 sm:pb-12"
        >
          <div className="max-w-4xl">
            <h1
              id="ofertas-mercados-heading"
              className="text-balance font-heading text-3xl font-bold leading-tight text-text-primary sm:text-5xl"
            >
              Sua oferta merece chamar atenção. Sem complicar sua rotina.
            </h1>
            <p className="mt-5 text-pretty text-base text-text-secondary sm:text-lg">
              O Vendeo é o aplicativo que cria artes e textos para divulgar as
              ofertas do seu mercado, mercearia ou minimercado nas redes sociais.
              Envie a foto do produto, informe o preço e o que quer destacar, e
              receba uma campanha com a identidade do seu estabelecimento — sem
              precisar saber design.
            </p>
            <div className="mt-8">
              <AccessCtaGroup
                publicSignupEnabled={publicSignupEnabled}
                anchorHref={`#${OFERTAS_MERCADOS_OFFER_ANCHOR}`}
              />
            </div>
          </div>
        </section>

        <DemonstrationPair />

        {/* Explicação consolidada + kit de publicação */}
        <section
          aria-labelledby="explicacao-heading"
          className="mx-auto w-full max-w-5xl px-6 py-8 sm:py-12"
        >
          <div className="max-w-3xl">
            <h2
              id="explicacao-heading"
              className="max-w-3xl text-balance font-heading text-2xl font-bold text-text-primary sm:text-3xl"
            >
              Uma oferta clara, com a identidade da sua loja.
            </h2>
            <p className="mt-4 text-pretty text-base text-text-secondary">
              Você informa o produto, o preço anterior, o preço promocional e o
              período de validade da oferta. O Vendeo organiza essas informações
              em uma campanha com o produto em destaque e a identidade da sua
              loja.
            </p>
            <PublicationKit />
          </div>
        </section>

        {/* Exemplo complementar + aviso único */}
        <section
          aria-labelledby="cafe-heading"
          className="mx-auto w-full max-w-5xl px-6 py-8 sm:py-12"
        >
          <CoffeeExample />
          <p className="mt-8 max-w-3xl text-pretty text-xs text-text-secondary">
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
              className="text-balance font-heading text-2xl font-bold text-text-primary sm:text-3xl"
            >
              Como ficaria uma campanha com a oferta da sua loja?
            </h2>
            <p className="mt-4 text-pretty text-base text-text-secondary">
              Sua oferta, sua marca, uma campanha pronta para revisar e publicar.
            </p>
            <div className="mt-8">
              <OfferCard
                id={OFERTAS_MERCADOS_OFFER_ANCHOR}
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

      <PublicFooter currentPath="/ofertas-para-mercados" context="marketing" />
    </div>
  );
}
