import Link from "next/link";
import { requirePageUser } from "@/lib/auth/require-user";
import { getCurrentStore } from "@/lib/auth/store-ownership";
import { listCampaigns } from "@/lib/campaign/list";
import { CAMPAIGNS_NO_STORE } from "@/lib/onboarding/microcopy";
import { EmptyState } from "@/components/ui/empty-state";
import CampaignListClient from "./client";

const ctaClass =
  "inline-flex items-center rounded-lg bg-accent-green px-6 py-2 text-sm font-semibold text-white font-heading hover:brightness-110 transition-all duration-200";

export default async function CampanhasPage() {
  const user = await requirePageUser();
  const store = await getCurrentStore(user.userId);

  if (!store) {
    return (
      <div>
        <EmptyState
          icon={CAMPAIGNS_NO_STORE.icon}
          title={CAMPAIGNS_NO_STORE.title}
          description={CAMPAIGNS_NO_STORE.description}
          action={
            <Link href={CAMPAIGNS_NO_STORE.ctaHref!} className={ctaClass}>
              {CAMPAIGNS_NO_STORE.ctaLabel}
            </Link>
          }
        />
      </div>
    );
  }

  const campaigns = await listCampaigns(store.id);

  return <CampaignListClient campaigns={campaigns} />;
}
