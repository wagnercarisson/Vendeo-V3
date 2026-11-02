import Link from "next/link";

import type { DashboardMessages } from "@/lib/i18n/dashboard";

interface DashboardHeaderProps {
  greeting: string;
  storeName: string | null;
  nameSeparator: string;
  showPrimaryCta: boolean;
  showSecondaryCta: boolean;
  messages: DashboardMessages["header"];
}

const PRIMARY_CTA_CLASS =
  "inline-flex min-h-[44px] items-center rounded-lg bg-accent-green px-4 text-sm font-semibold font-heading text-white transition-colors duration-200 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:ring-offset-2 focus-visible:ring-offset-bg-deep";

const SECONDARY_CTA_CLASS =
  "inline-flex min-h-[44px] items-center rounded-lg border border-border-light px-4 text-sm font-semibold font-heading text-text-primary transition-colors duration-200 hover:bg-bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:ring-offset-2 focus-visible:ring-offset-bg-deep";

/**
 * Cabeçalho compacto do dashboard (F58).
 *
 * Um único `h1` de saudação; o nome da loja é o único elemento com `lang=""`
 * (dado não traduzido). Sem loja, nenhuma ação é renderizada — o CTA único
 * vive no `EmptyState` para evitar duplicação.
 */
export function DashboardHeader({
  greeting,
  storeName,
  nameSeparator,
  showPrimaryCta,
  showSecondaryCta,
  messages,
}: DashboardHeaderProps) {
  const hasActions = showPrimaryCta || showSecondaryCta;

  return (
    <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between lg:mb-8">
      <h1 className="min-w-0 flex-1 break-words font-heading text-2xl font-semibold leading-tight text-text-primary line-clamp-2">
        {greeting}
        {storeName ? (
          <>
            {nameSeparator}
            <span lang="">{storeName}</span>
          </>
        ) : null}
      </h1>
      {hasActions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {showPrimaryCta && (
            <Link href="/campanhas/nova" className={PRIMARY_CTA_CLASS}>
              {messages.primaryCta}
            </Link>
          )}
          {showSecondaryCta && (
            <Link href="/loja" className={SECONDARY_CTA_CLASS}>
              {messages.secondaryCta}
            </Link>
          )}
        </div>
      )}
    </header>
  );
}
