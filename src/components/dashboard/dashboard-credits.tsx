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
 * Desktop: ícone, título/descrição e valor no mesmo conjunto; ação abaixo.
 * Mobile: bloco compacto horizontal, com ação abaixo do título e valor à direita.
 * Distingue `available`, `zero` e `unavailable` sem alterar regras de crédito.
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

  const action = (
    <Link
      href="/conta"
      aria-label={messages.detailsAria}
      className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-accent-green hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:ring-offset-2 focus-visible:ring-offset-bg-deep"
    >
      {messages.detailsLink}
      <ArrowRight className="h-4 w-4" aria-hidden="true" />
    </Link>
  );

  return (
    <section aria-labelledby="credits-title" className="min-w-0">
      <Card className="border-accent-green/30 bg-accent-green/5 p-4 sm:p-6">
        <div className="flex items-center gap-3 sm:items-start">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-green/15">
            <Coins className="h-5 w-5 text-accent-green" aria-hidden="true" />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
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
                <div className="mt-1 sm:hidden">{action}</div>
              </div>

              <div className="ml-auto shrink-0 text-right">
                {state.state === "unavailable" ? (
                  <p className="flex items-center justify-end gap-1.5 text-sm font-semibold text-text-secondary font-heading">
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

            <div className="mt-3 hidden sm:block">{action}</div>
          </div>
        </div>
      </Card>
    </section>
  );
}
