import Link from "next/link";
import { AlertTriangle, ArrowRight, Info, Megaphone } from "lucide-react";

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
  "inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-accent-green hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:ring-offset-2 focus-visible:ring-offset-bg-deep";

const CTA_CLASS =
  "inline-flex min-h-[44px] items-center rounded-lg bg-accent-green px-6 py-2 text-sm font-semibold text-white font-heading transition-colors duration-200 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:ring-offset-2 focus-visible:ring-offset-bg-deep";

/**
 * Painel único de campanhas recentes do dashboard (F58).
 *
 * Somente campanhas `ready` chegam aqui (filtro na origem). A contagem
 * secundária representa apenas campanhas disponíveis. Falha de consulta não
 * exibe contagem; zero representa sucesso sem campanhas.
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
    <Card className="min-w-0 p-4 sm:p-6">
      <section aria-labelledby="campaigns-title" className="min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2
              id="campaigns-title"
              className="font-heading text-xl font-semibold leading-tight text-text-primary sm:text-2xl"
            >
              {messages.sectionLabel}
            </h2>
            {!failure && (
              <p className="mt-1 text-sm text-text-secondary font-body">
                {countLabel}
              </p>
            )}
          </div>
          <Link href="/campanhas" className={LINK_CLASS}>
            {messages.viewAll}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        {failure ? (
          <div role="status" className="mt-4">
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
              </div>
            </div>
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
            <div className="mt-2 divide-y divide-border">
              {items.map((item) => (
                <AvailableCampaignCard
                  key={item.id}
                  id={item.id}
                  productName={item.productName}
                  dateLabel={dateLabels[item.id] ?? item.createdAt}
                  formatLabel={
                    item.format === "1:1"
                      ? messages.format.square
                      : item.format === "9:16"
                        ? messages.format.vertical
                        : null
                  }
                  thumbnailUrl={item.thumbnailUrl}
                  openAria={openAriaLabels[item.id] ?? item.productName}
                  openLabel={messages.open}
                />
              ))}
            </div>
            <div className="mt-2 flex gap-2 border-t border-border pt-4">
              <Info
                className="mt-0.5 h-4 w-4 shrink-0 text-text-muted"
                aria-hidden="true"
              />
              <p className="text-sm leading-normal text-text-secondary font-body">
                {messages.orientation}
              </p>
            </div>
          </>
        )}
      </section>
    </Card>
  );
}
