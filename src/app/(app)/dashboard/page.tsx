import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { BalanceDisplay } from "@/components/credit/balance-display";
import { getCurrentStore } from "@/lib/auth/store-ownership";
import { requirePageUser } from "@/lib/auth/require-user";
import { CreditService } from "@/lib/credit/credit-service";
import { createServerClient } from "@/lib/supabase/server";
import {
  countCampaigns,
  countReadyCampaigns,
  getRecentCampaigns,
} from "@/lib/campaign/metrics";
import type { RecentCampaignItem } from "@/lib/campaign/metrics";
import {
  DASHBOARD_NO_CAMPAIGNS,
  DASHBOARD_NO_STORE,
} from "@/lib/onboarding/microcopy";
import { getUserOnboardingState } from "@/lib/onboarding/state";
import { CnpjUpdateBanner } from "@/components/legacy/cnpj-update-banner";

function getGreeting(storeName: string | null): string {
  const hour = new Date().getHours();

  const period =
    hour >= 6 && hour < 12
      ? "Bom dia"
      : hour >= 12 && hour < 18
        ? "Boa tarde"
        : "Boa noite";

  if (!storeName) return "Bem-vindo ao Vendeo";

  return `${period}, ${storeName}`;
}

  const ctaClass =
  "inline-flex min-h-[44px] items-center rounded-lg bg-accent-green px-6 py-2 text-sm font-semibold text-white font-heading hover:brightness-110 transition-all duration-200";

export default async function DashboardPage() {
  const user = await requirePageUser();
  const state = await getUserOnboardingState(user.userId);

  switch (state) {
    case "no_store":
      return (
        <div>
          <PageHeader title="Dashboard" />
          <EmptyState
            icon={DASHBOARD_NO_STORE.icon}
            title={DASHBOARD_NO_STORE.title}
            description={DASHBOARD_NO_STORE.description}
            action={
              <Link href={DASHBOARD_NO_STORE.ctaHref!} className={ctaClass}>
                {DASHBOARD_NO_STORE.ctaLabel}
              </Link>
            }
          />
        </div>
      );
    case "has_store_no_campaigns": {
      const storeNoCamp = await getCurrentStore(user.userId);
      let noCampBalance: number | null = null;
      if (storeNoCamp) {
        const sc = await createServerClient();
        const cs = new CreditService(sc);
        try {
          noCampBalance = await cs.getBalance(storeNoCamp.id);
        } catch {
          noCampBalance = null;
        }
      }

      return (
        <div>
          <PageHeader title="Dashboard" />
          <CnpjUpdateBanner storeId={storeNoCamp.id} hasCnpj={!!(storeNoCamp as unknown as Record<string, unknown>).cnpj_normalized} />
          <div className="mb-4">
            <BalanceDisplay
              balance={noCampBalance ?? 0}
              hasStore={true}
              variant="badge"
            />
          </div>
          <EmptyState
            icon={DASHBOARD_NO_CAMPAIGNS.icon}
            title={DASHBOARD_NO_CAMPAIGNS.title}
            description={DASHBOARD_NO_CAMPAIGNS.description}
            action={
              <Link
                href={DASHBOARD_NO_CAMPAIGNS.ctaHref!}
                className={ctaClass}
              >
                {DASHBOARD_NO_CAMPAIGNS.ctaLabel}
              </Link>
            }
          />
        </div>
      );
    }
    case "has_store_with_campaigns": {
      const store = await getCurrentStore(user.userId);

      if (!store) {
        return (
          <div>
            <PageHeader title="Dashboard" />
            <EmptyState
              icon={DASHBOARD_NO_STORE.icon}
              title={DASHBOARD_NO_STORE.title}
              description={DASHBOARD_NO_STORE.description}
              action={
                <Link href={DASHBOARD_NO_STORE.ctaHref!} className={ctaClass}>
                  {DASHBOARD_NO_STORE.ctaLabel}
                </Link>
              }
            />
          </div>
        );
      }

      const supabase = await createServerClient();
      const creditService = new CreditService(supabase);
      let creditBalance: number | null = null;
      try {
        creditBalance = await creditService.getBalance(store.id);
      } catch {
        creditBalance = null;
      }

      const [total, ready, recentCampaigns] = await Promise.all([
        countCampaigns(store.id),
        countReadyCampaigns(store.id),
        getRecentCampaigns(store.id, 5),
      ]);

      const rate = total > 0 ? Math.round((ready / total) * 100) : 0;

      return (
        <div>
          <PageHeader title="Dashboard" />
          <CnpjUpdateBanner storeId={store.id} hasCnpj={!!(store as unknown as Record<string, unknown>).cnpj_normalized} />
          <h2 className="text-lg font-medium text-text-primary mb-6">
            {getGreeting(store.name)}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card className="p-4">
              <p className="text-sm font-medium text-text-secondary">
                Total de Campanhas
              </p>
              <p className="text-3xl font-bold text-text-primary mt-1">
                {total}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-sm font-medium text-text-secondary">
                Campanhas Prontas
              </p>
              <p className="text-3xl font-bold text-text-primary mt-1">
                {ready}
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-sm font-medium text-text-secondary">
                Taxa de Sucesso
              </p>
              <p className="text-3xl font-bold text-text-primary mt-1">
                {rate}%
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-sm font-medium text-text-secondary">
                Créditos
              </p>
              {creditBalance !== null ? (
                <div className="mt-1">
                  <BalanceDisplay
                    balance={creditBalance}
                    hasStore={true}
                    variant="badge"
                  />
                </div>
              ) : (
                <p className="text-3xl font-bold text-text-primary mt-1">
                  —
                </p>
              )}
            </Card>
          </div>

          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-4">
              Campanhas Recentes
            </h2>
            <Card className="p-0">
              <ul className="divide-y divide-border">
                {recentCampaigns.map((campaign: RecentCampaignItem) => (
                  <li
                    key={campaign.id}
                    className="flex items-center justify-between px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-text-primary">
                        {campaign.productName}
                      </span>
                      <span className="text-sm text-text-muted">
                        {new Date(campaign.createdAt).toLocaleDateString(
                          "pt-BR",
                          { day: "2-digit", month: "2-digit" },
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          campaign.status === "ready" ? "ready" : "error"
                        }
                      >
                        {campaign.status === "ready" ? "Pronto" : "Erro"}
                      </Badge>
                      <Link
                        href={`/campanhas/${campaign.id}`}
                        className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs font-heading font-semibold text-text-primary bg-transparent hover:bg-bg-elevated transition-all duration-200 focus:ring-2 focus:ring-accent-blue focus:outline-none"
                      >
                        Abrir
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
            <div className="mt-2 text-right">
              <Link
                href="/campanhas"
                className="text-sm font-medium text-accent-green hover:underline"
              >
                Ver todas as campanhas →
              </Link>
            </div>
          </section>

          <Card className="mt-6 p-4">
            <h3 className="text-base font-semibold text-text-primary mb-2">
              Próximo passo
            </h3>
            <p className="text-text-secondary mb-4">
              {recentCampaigns.length > 0
                ? `Revise sua última campanha: ${recentCampaigns[0].productName}`
                : "Criar nova campanha"}
            </p>
            <div className="flex gap-3">
              {recentCampaigns.length > 0 && (
                <Link
                  href={`/campanhas/${recentCampaigns[0].id}`}
                  className={ctaClass}
                >
                  Abrir campanha
                </Link>
              )}
              <Link
                href="/campanhas/nova"
                className="text-sm font-medium text-accent-green hover:underline self-center"
              >
                Nova campanha →
              </Link>
            </div>
          </Card>

          <div className="mt-8 border-t border-border pt-4">
            <Link
              href="/loja"
              className="text-sm text-text-muted hover:text-text-secondary"
            >
              Configurar loja
            </Link>
          </div>
        </div>
      );
    }
  }
}
