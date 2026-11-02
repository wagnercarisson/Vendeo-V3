import Link from "next/link";
import { AlertTriangle, Megaphone } from "lucide-react";

import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { EligibleCampaignCard } from "@/lib/dashboard/campaigns";
import type { DashboardMessages } from "@/lib/i18n/dashboard";

import { AvailableCampaignCard } from "./available-campaign-card";

interface DashboardCampaignsProps {
  count: number;
  items: EligibleCampaignCard[];
  messages: DashboardMessages["campaigns"];
  failure?: boolean;
  dateLabels: Record<string, string>;
  openAriaLabels: Record<string, string>;
}

const LINK_CLASS =
  "inline-flex min-h-[44px] items-center text-sm font-semibold text-accent-blue hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:ring-offset-2 focus-visible:ring-offset-bg-deep";

const CTA_CLASS =
  "inline-flex min-h-[44px] items-center rounded-lg bg-accent-green px-6 py-2 text-sm font-semibold text-white font-heading transition-colors duration-200 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:ring-offset-2 focus-visible:ring-offset-bg-deep";

/**
 * Seção de campanhas disponíveis do dashboard (F58).
 *
 * Somente campanhas `ready` chegam aqui (filtro na origem). O estado de falha
 * é um painel `role="status"` com acesso a `/campanhas` — nunca uma contagem,
 * frase oculta ou “0 campanhas disponíveis”, pois zero é sucesso sem campanhas.
 */
export function DashboardCampaigns({
  count,
  items,
  messages,
  failure = false,
  dateLabels,
  openAriaLabels,
}: DashboardCampaignsProps) {
  const countLabel = (
    count === 1 ? messages.countSingular : messages.countPlural
  ).replace("{count}", String(count));

  return (
    <section aria-labelledby="campaigns-title" className="min-w-0">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2
          id="campaigns-title"
          className="font-heading text-xl font-semibold leading-tight text-text-primary"
        >
          {messages.sectionLabel}
        </h2>
        {!failure && (
          <>
            <span
              aria-hidden="true"
              className="inline-flex min-w-[32px] shrink-0 items-center justify-center rounded-full bg-bg-elevated px-3 py-1 text-xs font-semibold text-text-secondary font-heading tabular-nums"
            >
              {count}
            </span>
            <p className="sr-only">{countLabel}</p>
          </>
        )}
      </div>

      {failure ? (
        <div role="status">
          <Card className="p-4 sm:p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle
                className="mt-0.5 h-5 w-5 shrink-0 text-accent-red"
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold font-heading text-text-primary">
                  {messages.failureTitle}
                </p>
                <p className="mt-1 text-sm text-text-secondary font-body">
                  {messages.failureBody}
                </p>
                <div className="mt-2">
                  <Link href="/campanhas" className={LINK_CLASS}>
                    {messages.viewAll}
                  </Link>
                </div>
              </div>
            </div>
          </Card>
        </div>
      ) : count === 0 ? (
        <EmptyState
          icon={Megaphone}
          title={messages.emptyTitle}
          description={messages.emptyBody}
          action={
            <Link href="/campanhas/nova" className={CTA_CLASS}>
              {messages.emptyCta}
            </Link>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <AvailableCampaignCard
                key={item.id}
                id={item.id}
                productName={item.productName}
                dateLabel={dateLabels[item.id] ?? item.createdAt}
                thumbnailUrl={item.thumbnailUrl}
                openAria={openAriaLabels[item.id] ?? item.productName}
              />
            ))}
          </div>
          <div className="mt-4">
            <Link href="/campanhas" className={LINK_CLASS}>
              {messages.viewAll}
            </Link>
          </div>
        </>
      )}
    </section>
  );
}
