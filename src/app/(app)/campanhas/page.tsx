import Link from "next/link";
import { redirect } from "next/navigation";
import { Store } from "lucide-react";
import { requirePageUser } from "@/lib/auth/require-user";
import { getCurrentStore } from "@/lib/auth/store-ownership";
import { listCampaigns } from "@/lib/campaign/list";
import { parseCampaignListSearchParams } from "@/lib/campaign/search-params";
import { getCampaignListMessages } from "@/lib/i18n/campaign-list";
import type { SupportedUiLocale } from "@/lib/i18n/locales";
import { getUiRenderContext } from "@/lib/i18n/server";
import { EmptyState } from "@/components/ui/empty-state";
import CampaignListClient from "./client";

const ctaClass =
  "inline-flex items-center rounded-lg bg-accent-green px-6 py-2 text-sm font-semibold text-white font-heading hover:brightness-110 transition-all duration-200";

export default async function CampanhasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePageUser();
  const [store, ui] = await Promise.all([
    getCurrentStore(user.userId),
    getUiRenderContext(user.userId),
  ]);

  const locale: SupportedUiLocale = ui.ok ? ui.locale : "pt-BR";
  const messages = getCampaignListMessages(locale);
  const lang = locale === "es-419" ? "es-419" : undefined;

  if (!store) {
    return (
      <div lang={lang}>
        <EmptyState
          icon={Store}
          title={messages.noStore.title}
          description={messages.noStore.body}
          action={
            <Link href="/loja" className={ctaClass}>
              {messages.noStore.cta}
            </Link>
          }
        />
      </div>
    );
  }

  const params = await searchParams;
  const validated = parseCampaignListSearchParams(params);
  const result = await listCampaigns(store.id, {
    page: validated.page,
    pageSize: 10,
    search: validated.q,
    status: validated.status,
    dateFrom: validated.dateFrom,
    dateTo: validated.dateTo,
    sortBy: validated.sortBy,
    sortOrder: validated.sortOrder,
  });

  if (result.items.length === 0 && result.page > 1) {
    const sp = new URLSearchParams();
    for (const [key, val] of Object.entries(params)) {
      if (typeof val === "string") sp.set(key, val);
    }
    sp.set("page", "1");
    redirect(`/campanhas?${sp.toString()}`);
  }

  return (
    <div lang={lang}>
      <CampaignListClient
        items={result.items}
        total={result.total}
        page={result.page}
        totalPages={result.totalPages}
        searchParams={params}
        messages={messages}
        locale={locale}
      />
    </div>
  );
}
