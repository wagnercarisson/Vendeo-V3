import type { Metadata } from "next";
import Link from "next/link";
import { AccessCtaGroup } from "@/components/landing/campanhas/access-cta-group";
import { CampanhasHeader } from "@/components/landing/campanhas/campanhas-header";
import { DemonstrationCase } from "@/components/landing/campanhas/demonstration-case";
import {
  BED_CAMPAIGN,
  BED_PHOTO,
  RATION_CAMPAIGN,
  RATION_PHOTO,
} from "@/components/landing/campanhas/image-sources";
import { PublicationKit } from "@/components/landing/campanhas/publication-kit";
import { OfferCard } from "@/components/landing/offer-card";
import { getLaunchConfig } from "@/lib/launch-config/config";
import { isIndexableEnvironment } from "@/lib/seo/environment";
import {
  CAMPANHAS_PARA_SUA_LOJA_CANONICAL_PATH,
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
 * Página pública `/campanhas-para-sua-loja`.
 *
 * Conteúdo estático aprovado: foto da ração → campanha 1:1, foto da cama →
 * campanha 9:16, frase de identidade, kit da cama em HTML, bloco de rotina e um
 * único card de oferta. Nenhuma geração, provider, crédito ou dado de campanha é
 * acessado. O pet shop é apenas o exemplo visual; o Vendeo é o aplicativo.
 *
 * Indexação: `index, follow` e canonical absoluto somente sob produção confirmada
 * + origem canônica validada. Fora disso, `noindex` explícito e canonical omitido.
 * O sitemap segue o mesmo contrato em `src/app/sitemap.ts`.
 */

const TITLE = "Crie campanhas para sua loja sem complicação | Vendeo";
const DESCRIPTION =
  "Com o Vendeo, a foto de um produto e poucas informações viram arte e texto com a identidade da sua loja. Sem precisar saber design.";

/** Destino estável da prévia de acesso da abertura (card único no encerramento). */
const CAMPANHAS_OFFER_ANCHOR = "campanhas-oferta";

/** Aviso demonstrativo único, exibido após o kit. */
const DEMO_NOTICE =
  "As lojas e campanhas apresentadas são exemplos demonstrativos e não representam lojas reais nem ofertas comerciais válidas";

const IDENTITY_LINE =
  "Produtos diferentes. Formatos diferentes. A mesma identidade da sua loja.";

const indexable = isIndexableEnvironment();
const { origin } = resolveCanonicalOrigin();
const canonical =
  indexable && origin !== null
    ? `${origin}${CAMPANHAS_PARA_SUA_LOJA_CANONICAL_PATH}`
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
    url: CAMPANHAS_PARA_SUA_LOJA_CANONICAL_PATH,
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

const ROUTINE_ITEMS = [
  {
    title: "A foto pode ser a do celular.",
    description: "Você não precisa de estúdio nem de uma sessão de fotos.",
  },
  {
    title: "Poucas informações bastam.",
    description:
      "Produto, oferta e o que destacar. A configuração inicial da loja fica guardada.",
  },
  {
    title: "Arte e texto preparados pelo Vendeo.",
    description:
      "Você informa o que quer divulgar, e o aplicativo compõe a campanha com a identidade da sua loja.",
  },
  {
    title: "Você revisa antes de publicar.",
    description:
      "Baixe a campanha, confira o texto e publique quando quiser. A publicação é sua.",
  },
] as const;

export default async function CampanhasParaSuaLojaPage() {
  const { publicSignupEnabled } = await getLaunchConfig();

  return (
    <div className="flex min-h-screen flex-col bg-bg-surface font-body text-text-primary">
      <CampanhasHeader />

      <main className="flex flex-1 flex-col">
        {/* Abertura */}
        <section
          aria-labelledby="campanhas-heading"
          className="mx-auto w-full max-w-5xl px-6 pt-12 pb-8 sm:pt-16 sm:pb-12"
        >
          <div className="max-w-3xl">
            <h1
              id="campanhas-heading"
              className="font-heading text-3xl font-bold leading-tight text-text-primary sm:text-5xl"
            >
              Sua loja não precisa de mais uma tarefa. Precisa de uma campanha
              pronta.
            </h1>
            <p className="mt-5 text-base text-text-secondary sm:text-lg">
              O Vendeo é o aplicativo que transforma a foto de um produto e poucas
              informações em uma campanha com arte, texto e a identidade da sua
              loja. Depois de configurar sua loja, envie a foto e conte o que quer
              divulgar. Em poucos minutos, receba uma campanha para revisar,
              baixar e publicar.
            </p>
            <p className="mt-4 text-base font-medium text-text-primary">
              Sem precisar saber design ou aprender um editor complicado.
            </p>
            <div className="mt-8">
              <AccessCtaGroup
                publicSignupEnabled={publicSignupEnabled}
                anchorHref={`#${CAMPANHAS_OFFER_ANCHOR}`}
              />
            </div>
          </div>
        </section>

        <DemonstrationCase
          id="racao"
          heading="Uma foto do produto. Uma campanha quadrada."
          description="Com a foto da ração, o nome do produto e as informações da oferta, o Vendeo criou uma campanha com a marca do Pet Shop Bicho Fofo."
          format="1:1"
          photo={RATION_PHOTO}
          campaign={RATION_CAMPAIGN}
          photoAlt="Embalagem de ração Confiance Premium Adults 15 kg sobre uma mesa de madeira"
          campaignAlt="Campanha quadrada do Pet Shop Bicho Fofo para a ração Confiance, com o produto em destaque e o nome da loja"
          loading="eager"
        />

        <DemonstrationCase
          id="cama"
          heading="Outro produto. Outro formato. A mesma identidade."
          description="Agora a cama, para uma publicação vertical. Outro produto, apresentado em 9:16, com a identidade da mesma loja."
          format="9:16"
          photo={BED_PHOTO}
          campaign={BED_CAMPAIGN}
          photoAlt="Cama pet bege com estampas de patinhas sobre uma mesa em uma loja de produtos para animais"
          campaignAlt="Campanha vertical do Pet Shop Bicho Fofo para a Cama Pet Comfort, com o produto em destaque e o selo Top de Linha"
          loading="lazy"
          layout="vertical"
          quote={IDENTITY_LINE}
        />

        {/* Kit de publicação + aviso único */}
        <section
          aria-labelledby="kit-heading"
          className="mx-auto w-full max-w-5xl px-6 py-8 sm:py-12"
        >
          <div className="max-w-2xl">
            <PublicationKit />
            <p className="mt-8 max-w-3xl text-xs text-text-secondary">
              {DEMO_NOTICE}
            </p>
          </div>
        </section>

        {/* Rotina */}
        <section
          aria-labelledby="rotina-heading"
          className="mx-auto w-full max-w-5xl px-6 py-8 sm:py-12"
        >
          <h2
            id="rotina-heading"
            className="max-w-3xl font-heading text-2xl font-bold text-text-primary sm:text-3xl"
          >
            Feita para a rotina de quem atende, repõe e ainda divulga.
          </h2>
          <p className="mt-4 max-w-3xl text-base text-text-secondary">
            Quem toca uma loja pequena acumula funções. O Vendeo encurta o caminho
            entre o produto que está na vitrine e a publicação que precisa sair.
          </p>

          <ul className="mt-6 grid max-w-4xl gap-6 md:grid-cols-2">
            {ROUTINE_ITEMS.map((item) => (
              <li key={item.title} className="border-t border-border pt-4">
                <h3 className="font-heading text-base font-semibold text-text-primary">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm text-text-secondary">
                  {item.description}
                </p>
              </li>
            ))}
          </ul>
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
              Sua próxima campanha pode ser mais simples com o Vendeo.
            </h2>
            <p className="mt-4 text-base text-text-secondary">
              Uma foto, poucas informações e a identidade da sua loja. Em poucos
              minutos, você recebe a arte e o texto para revisar e publicar.
            </p>
            <div className="mt-8">
              <OfferCard
                id={CAMPANHAS_OFFER_ANCHOR}
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
