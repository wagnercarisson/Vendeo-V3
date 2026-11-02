import Link from "next/link";
import { Store } from "lucide-react";

import { DashboardCampaigns } from "@/components/dashboard/dashboard-campaigns";
import { DashboardCredits } from "@/components/dashboard/dashboard-credits";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardNews } from "@/components/dashboard/dashboard-news";
import { DashboardShortcut } from "@/components/dashboard/dashboard-shortcut";
import { ReadinessCheckBanner } from "@/components/readiness/readiness-check-banner";
import { EmptyState } from "@/components/ui/empty-state";
import { VerificationBanners } from "@/components/verification/verification-banners";
import { requirePageUser } from "@/lib/auth/require-user";
import { getCurrentStore } from "@/lib/auth/store-ownership";
import { buildAnnouncementExcerpt } from "@/lib/changelog/excerpt";
import { getLatestAnnouncement } from "@/lib/changelog/get-changelog";
import { formatDashboardDate } from "@/lib/dashboard/format";
import { resolveDashboardGreeting } from "@/lib/dashboard/greeting";
import { loadCampaignSection, loadCreditSection } from "@/lib/dashboard/sections";
import { getDashboardMessages } from "@/lib/i18n/dashboard";
import { getUiRenderContext } from "@/lib/i18n/server";
import { formatMessage } from "@/lib/i18n/translate";
import { getStoreMarketSettings } from "@/lib/market-preferences/store-market-settings-service";

/**
 * Dashboard operacional (F58).
 *
 * Composição server-first: saudação no fuso da loja, saldo, até 3 campanhas
 * `ready` e o anúncio compacto. Cada seção falha isoladamente; sem loja não há
 * consulta de créditos, campanhas, fuso ou anúncio. O idioma é resolvido
 * server-side e `lang` é escopado por bloco — o documento base permanece pt-BR.
 */

const CTA_CLASS =
  "inline-flex min-h-[44px] items-center rounded-lg bg-accent-green px-6 py-2 text-sm font-semibold text-white font-heading transition-colors duration-200 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:ring-offset-2 focus-visible:ring-offset-bg-deep";

export default async function DashboardPage() {
  const user = await requirePageUser();

  const [store, ui] = await Promise.all([
    getCurrentStore(user.userId),
    getUiRenderContext(user.userId),
  ]);

  const locale = ui.ok ? ui.locale : "pt-BR";
  const messages = getDashboardMessages(locale);
  const lang = locale === "es-419" ? "es-419" : undefined;

  if (!store) {
    return (
      <div lang={lang} className="w-full min-w-0">
        <DashboardHeader
          greeting={messages.greeting.welcome}
          storeName={null}
          nameSeparator={messages.greeting.nameSeparator}
          messages={messages.header}
        />
        <EmptyState
          icon={Store}
          title={messages.noStore.title}
          description={messages.noStore.body}
          action={
            <Link href="/loja" className={CTA_CLASS}>
              {messages.noStore.cta}
            </Link>
          }
        />
      </div>
    );
  }

  const [campaignResult, creditResult, marketResult, announcementResult] =
    await Promise.allSettled([
      loadCampaignSection(store.id),
      loadCreditSection(store.id),
      getStoreMarketSettings(user.userId),
      getLatestAnnouncement().catch(() => null),
    ]);

  const campaign =
    campaignResult.status === "fulfilled"
      ? campaignResult.value
      : ({ ok: false } as const);
  const credit =
    creditResult.status === "fulfilled"
      ? creditResult.value
      : ({ ok: false } as const);
  const timeZone =
    marketResult.status === "fulfilled" ? marketResult.value.timeZone : null;
  const entry =
    announcementResult.status === "fulfilled" ? announcementResult.value : null;

  const greeting = resolveDashboardGreeting({
    storeName: store.name,
    timeZone,
    locale,
    now: new Date(),
    messages: messages.greeting,
  });

  const items = campaign.ok ? campaign.data.items : [];

  const dateLabels: Record<string, string> = {};
  const openAriaLabels: Record<string, string> = {};
  for (const item of items) {
    const date = formatDashboardDate(item.createdAt, locale, timeZone);
    dateLabels[item.id] = date;
    openAriaLabels[item.id] = formatMessage(messages.campaigns.cardAria, {
      product: item.productName,
      date,
    });
  }

  const excerpt = entry ? buildAnnouncementExcerpt(entry.body) : null;

  return (
    <div lang={lang} className="w-full min-w-0">
      <DashboardHeader
        greeting={messages.greeting[greeting.period]}
        storeName={greeting.storeName}
        nameSeparator={messages.greeting.nameSeparator}
        messages={messages.header}
      />

      <VerificationBanners
        verificationStatus={store.verification_status}
        messages={{
          review: messages.banners.review,
          approved: messages.banners.approved,
          dismiss: messages.banners.approvedDismiss,
        }}
      />

      <ReadinessCheckBanner
        storeId={store.id}
        messages={{
          title: messages.banners.readinessTitle,
          cta: messages.banners.readinessCta,
          cadastroFiscal: messages.banners.readinessCadastroFiscal,
          brandProfile: messages.banners.readinessBrandProfile,
        }}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
        <div className="contents lg:col-start-3 lg:row-start-1 lg:flex lg:flex-col lg:gap-6">
          <div className="order-1 min-w-0 lg:order-none">
            <DashboardCredits
              state={credit.ok ? credit.data : { state: "unavailable" }}
              messages={messages.credits}
              locale={locale}
            />
          </div>

          {entry ? (
            <div className="order-3 min-w-0 lg:order-none">
              <DashboardNews
                entry={entry}
                excerpt={excerpt}
                labels={messages.news}
              />
            </div>
          ) : null}
        </div>

        <div className="order-2 min-w-0 lg:order-none lg:col-span-2 lg:col-start-1 lg:row-start-1">
          <DashboardCampaigns
            count={campaign.ok ? campaign.data.count : 0}
            items={items}
            messages={messages.campaigns}
            failure={!campaign.ok}
            dateLabels={dateLabels}
            openAriaLabels={openAriaLabels}
          />
        </div>
      </div>

      <DashboardShortcut messages={messages.shortcut} />
    </div>
  );
}
