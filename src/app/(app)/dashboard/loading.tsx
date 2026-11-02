import { CardSkeleton } from "@/components/ui/loading-skeleton";
import { requirePageUser } from "@/lib/auth/require-user";
import { getDashboardMessages } from "@/lib/i18n/dashboard";
import { getUiRenderContext } from "@/lib/i18n/server";

/**
 * Esqueleto do dashboard na ordem final (F58): cabeçalho → créditos →
 * campanhas → novidades, com os mesmos placements do desktop.
 *
 * O idioma é resolvido server-first, reutilizando `getUiRenderContext`
 * (`cache()` por requisição). Erros desconhecidos propagam ao error boundary,
 * como na página; não há provider de cliente nem segundo resolvedor.
 */
export default async function DashboardLoading() {
  const user = await requirePageUser();
  const ui = await getUiRenderContext(user.userId);

  const locale = ui.ok ? ui.locale : "pt-BR";
  const messages = getDashboardMessages(locale);
  const lang = locale === "es-419" ? "es-419" : undefined;

  return (
    <div
      lang={lang}
      role="status"
      aria-label={messages.loading.statusLabel}
      className="w-full min-w-0"
    >
      <div
        aria-hidden="true"
        className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between lg:mb-8"
      >
        <div className="h-8 w-56 animate-pulse rounded bg-bg-elevated" />
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <div className="h-11 w-32 animate-pulse rounded-lg bg-bg-elevated" />
          <div className="h-11 w-32 animate-pulse rounded-lg bg-bg-elevated" />
        </div>
      </div>

      <div
        aria-hidden="true"
        className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8"
      >
        <div className="min-w-0 lg:col-start-3 lg:row-start-1">
          <div className="h-32 animate-pulse rounded-xl bg-bg-surface" />
        </div>

        <div className="min-w-0 lg:col-span-2 lg:col-start-1 lg:row-start-1 lg:row-span-2">
          <div className="mb-4 h-6 w-48 animate-pulse rounded bg-bg-elevated" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        </div>

        <div className="min-w-0 lg:col-start-3 lg:row-start-2">
          <div className="h-40 animate-pulse rounded-xl bg-bg-surface" />
        </div>
      </div>
    </div>
  );
}
