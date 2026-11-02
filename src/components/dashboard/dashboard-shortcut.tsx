import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Card } from "@/components/ui/card";
import type { DashboardMessages } from "@/lib/i18n/dashboard";

interface DashboardShortcutProps {
  messages: DashboardMessages["shortcut"];
}

/**
 * Atalho fixo para criar campanha (F58).
 *
 * Não há lógica de recomendação: o convite é sempre o mesmo e não depende de
 * histórico, saldo, status de campanha ou qualquer outro sinal do lojista.
 */
export function DashboardShortcut({ messages }: DashboardShortcutProps) {
  return (
    <section aria-labelledby="shortcut-title" className="min-w-0">
      <Card className="border-border-light bg-bg-surface p-4 sm:p-5">
        <h2
          id="shortcut-title"
          className="font-heading text-base font-semibold leading-tight text-text-primary"
        >
          {messages.title}
        </h2>
        <Link
          href="/campanhas/nova"
          className="mt-2 inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-accent-green transition-colors duration-200 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:ring-offset-2 focus-visible:ring-offset-bg-deep"
        >
          {messages.cta}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </Card>
    </section>
  );
}
