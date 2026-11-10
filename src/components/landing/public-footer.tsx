import Link from "next/link";
import { NovidadesLink } from "@/components/landing/novidades-link";
import type { ChangelogEntry } from "@/lib/changelog/types";
import {
  PUBLIC_FOOTER_EXPLORE_LINKS,
  type PublicFooterPath,
} from "@/components/landing/public-footer-nav";

const LINK_CLASS =
  "inline-flex min-h-[44px] items-center rounded px-2 transition-colors hover:text-text-primary focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:outline-none";

const GROUP_LABEL_CLASS =
  "text-center font-heading text-xs font-semibold uppercase tracking-wide text-text-muted sm:text-left";

const GROUP_LINKS_CLASS =
  "mt-1 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 sm:justify-start";

interface PublicFooterProps {
  /** Caminho da página atual. Usado para `aria-current="page"`. */
  currentPath: PublicFooterPath;
  /**
   * `home` preserva contato, novidades e aviso legal demonstrativo.
   * `marketing` preserva o retorno à home. As diferenças são explícitas aqui.
   */
  context: "home" | "marketing";
  /** Entradas do changelog para o modal "Novidades" (somente na home). */
  novidadesEntries?: ChangelogEntry[];
}

/**
 * Rodapé público compartilhado por `/`, `/floriculturas`, `/padarias`,
 * `/ofertas-para-mercados` e `/campanhas-para-sua-loja`.
 *
 * Server Component: todos os links são HTML com `href` real. O único limite
 * cliente é o `NovidadesLink` da home.
 *
 * A lista de navegação não controla sitemap, robots, canonical ou indexação.
 */
export function PublicFooter({
  currentPath,
  context,
  novidadesEntries,
}: PublicFooterProps) {
  const isHome = context === "home";
  const supportEmail = process.env.SUPPORT_EMAIL ?? "suporte@vendeo.tech";

  return (
    <footer className="border-t border-border">
      <div className="mx-auto w-full max-w-5xl px-6 py-8 text-sm text-text-secondary">
        <div className="flex flex-col items-center gap-8 md:flex-row md:items-start md:justify-between">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/landing/vendeo-logo-dark.webp"
            alt="Vendeo"
            width={384}
            height={82}
            loading="lazy"
            className="h-6 w-auto shrink-0 self-center"
          />

          <div className="flex w-full flex-col items-center gap-8 sm:flex-row sm:items-start sm:justify-center md:w-auto md:justify-end md:gap-12">
            <nav
              aria-labelledby="footer-explore-heading"
              className="w-full sm:w-auto"
            >
              <p id="footer-explore-heading" className={GROUP_LABEL_CLASS}>
                Explore o Vendeo
              </p>
              <ul className={GROUP_LINKS_CLASS}>
                {PUBLIC_FOOTER_EXPLORE_LINKS.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={
                        item.href === currentPath ? "page" : undefined
                      }
                      className={LINK_CLASS}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <nav
              aria-labelledby="footer-institutional-heading"
              className="w-full sm:w-auto"
            >
              <p id="footer-institutional-heading" className={GROUP_LABEL_CLASS}>
                Institucional
              </p>
              <ul className={GROUP_LINKS_CLASS}>
                {!isHome ? (
                  <li>
                    <Link href="/" className={LINK_CLASS}>
                      Voltar ao Vendeo
                    </Link>
                  </li>
                ) : null}
                <li>
                  <Link href="/termos" className={LINK_CLASS}>
                    Termos de Uso
                  </Link>
                </li>
                <li>
                  <Link href="/privacidade" className={LINK_CLASS}>
                    Política de Privacidade
                  </Link>
                </li>
                <li>
                  <Link href="/uso-aceitavel" className={LINK_CLASS}>
                    Uso Aceitável
                  </Link>
                </li>
                {isHome ? (
                  <li>
                    <Link href={`mailto:${supportEmail}`} className={LINK_CLASS}>
                      Contato
                    </Link>
                  </li>
                ) : null}
                {isHome && novidadesEntries !== undefined ? (
                  <li>
                    <NovidadesLink
                      variant="footer"
                      entries={novidadesEntries}
                    />
                  </li>
                ) : null}
                <li>
                  <Link href="/login" className={LINK_CLASS}>
                    Entrar
                  </Link>
                </li>
              </ul>
            </nav>
          </div>
        </div>

        {isHome ? (
          <div className="mt-8">
            <p className="mx-auto max-w-3xl text-center text-xs text-text-secondary">
              As lojas e campanhas apresentadas são exemplos demonstrativos e não
              representam lojas reais nem ofertas comerciais válidas. As marcas de
              produtos pertencem aos respectivos titulares. O Vendeo não possui
              vínculo, parceria, patrocínio ou endosso das marcas ou dos
              fabricantes utilizados para ilustrar as campanhas.
            </p>
          </div>
        ) : null}
      </div>
    </footer>
  );
}
