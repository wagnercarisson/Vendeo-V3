import Link from "next/link";
import { AlertCircle, Coins } from "lucide-react";

import { Card } from "@/components/ui/card";
import type { DashboardCreditState } from "@/lib/dashboard/credits";
import type { DashboardMessages } from "@/lib/i18n/dashboard";
import type { SupportedUiLocale } from "@/lib/i18n/locales";

interface DashboardCreditsProps {
  state: DashboardCreditState;
  messages: DashboardMessages["credits"];
  locale: SupportedUiLocale;
}

/**
 * Bloco de créditos do dashboard (F58).
 *
 * Distingue explicitamente `available`, `zero` e `unavailable`. O estado zero
 * renderiza apenas a string completa localizada (`0 créditos`), nunca número e
 * unidade adicionais. O estado indisponível nunca renderiza `0` ou `—`. Não usa
 * `BalanceDisplay` (D-04).
 */
export function DashboardCredits({
  state,
  messages,
  locale,
}: DashboardCreditsProps) {
  return (
    <section aria-labelledby="credits-title" className="min-w-0">
      <Card className="border-accent-green/30 bg-accent-green/5 p-4 sm:p-6">
        <h2
          id="credits-title"
          className="flex items-center gap-2 font-heading text-xs font-semibold uppercase tracking-wider text-text-secondary"
        >
          <Coins className="h-4 w-4 text-accent-green" aria-hidden="true" />
          {messages.sectionLabel}
        </h2>

        {state.state === "unavailable" ? (
          <div className="mt-2 flex items-center gap-2">
            <AlertCircle
              className="h-5 w-5 text-accent-amber"
              aria-hidden="true"
            />
            <p className="text-sm font-semibold font-heading text-text-secondary">
              {messages.unavailable}
            </p>
          </div>
        ) : state.state === "zero" ? (
          <p className="mt-2 font-heading text-2xl font-semibold leading-tight text-text-primary tabular-nums">
            {messages.zero}
          </p>
        ) : (
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-heading text-2xl font-semibold leading-tight text-text-primary tabular-nums">
              {new Intl.NumberFormat(locale).format(state.availableBalance)}
            </span>
            <span className="text-sm text-text-secondary font-body">
              {state.availableBalance === 1
                ? messages.unitSingular
                : messages.unitPlural}
            </span>
          </div>
        )}

        <div className="mt-3">
          <Link
            href="/conta"
            aria-label={messages.detailsAria}
            className="inline-flex min-h-[44px] items-center text-sm font-semibold text-accent-blue hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:ring-offset-2 focus-visible:ring-offset-bg-deep"
          >
            {messages.detailsLink}
          </Link>
        </div>
      </Card>
    </section>
  );
}
