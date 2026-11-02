import Link from "next/link";
import { AlertCircle, ArrowRight, Coins } from "lucide-react";

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
 * unidade adicionais. O estado indisponível nunca renderiza `0` ou `—`.
 */
export function DashboardCredits({
  state,
  messages,
  locale,
}: DashboardCreditsProps) {
  const value =
    state.state === "available"
      ? new Intl.NumberFormat(locale).format(state.availableBalance)
      : state.state === "zero"
        ? messages.zero
        : null;

  return (
    <section aria-labelledby="credits-title" className="min-w-0">
      <Card className="border-accent-green/30 bg-accent-green/5 p-4 sm:p-6">
        <div className="flex items-center gap-3 sm:flex-col sm:items-start">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-green/15">
              <Coins className="h-5 w-5 text-accent-green" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2
                id="credits-title"
                className="font-heading text-sm font-semibold leading-tight text-text-primary"
              >
                {messages.sectionLabel}
              </h2>
              <p className="mt-0.5 hidden text-xs text-text-secondary font-body sm:block">
                {messages.description}
              </p>
              <Link
                href="/conta"
                aria-label={messages.detailsAria}
                className="mt-1 inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-accent-green hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:ring-offset-2 focus-visible:ring-offset-bg-deep sm:mt-3"
              >
                {messages.detailsLink}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>

          <div className="ml-auto shrink-0 text-right sm:ml-0 sm:mt-3 sm:text-left">
            {state.state === "unavailable" ? (
              <p className="flex items-center justify-end gap-1.5 text-sm font-semibold text-text-secondary font-heading sm:justify-start">
                <AlertCircle
                  className="h-4 w-4 text-accent-amber"
                  aria-hidden="true"
                />
                {messages.unavailable}
              </p>
            ) : (
              <p
                className={`font-heading font-bold leading-none text-text-primary tabular-nums ${
                  state.state === "zero" ? "text-2xl" : "text-3xl"
                }`}
              >
                {value}
              </p>
            )}
          </div>
        </div>
      </Card>
    </section>
  );
}
