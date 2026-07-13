import Link from "next/link";

import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { requirePageUser } from "@/lib/auth/require-user";
import { getUserOnboardingState } from "@/lib/onboarding/state";
import {
  DASHBOARD_NO_STORE,
  DASHBOARD_NO_CAMPAIGNS,
  DASHBOARD_PLACEHOLDER,
} from "@/lib/onboarding/microcopy";

const ctaClass =
  "inline-flex items-center rounded-lg bg-accent-green px-6 py-2 text-sm font-semibold text-white font-heading hover:brightness-110 transition-all duration-200";

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
    case "has_store_no_campaigns":
      return (
        <div>
          <PageHeader title="Dashboard" />
          <EmptyState
            icon={DASHBOARD_NO_CAMPAIGNS.icon}
            title={DASHBOARD_NO_CAMPAIGNS.title}
            description={DASHBOARD_NO_CAMPAIGNS.description}
            action={
              <Link href={DASHBOARD_NO_CAMPAIGNS.ctaHref!} className={ctaClass}>
                {DASHBOARD_NO_CAMPAIGNS.ctaLabel}
              </Link>
            }
          />
        </div>
      );
    case "has_store_with_campaigns":
      return (
        <div>
          <PageHeader title="Dashboard" />
          <EmptyState
            icon={DASHBOARD_PLACEHOLDER.icon}
            title={DASHBOARD_PLACEHOLDER.title}
            description={DASHBOARD_PLACEHOLDER.description}
          />
        </div>
      );
  }
}
