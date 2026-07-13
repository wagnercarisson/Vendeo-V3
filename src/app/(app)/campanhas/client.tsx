"use client";

import Link from "next/link";
import type { CampaignListItem } from "@/lib/campaign/list";
import { EmptyState } from "@/components/ui/empty-state";
import { CAMPAIGNS_NO_CAMPAIGNS } from "@/lib/onboarding/microcopy";

interface Props {
  campaigns: CampaignListItem[];
}

export default function CampaignListClient({ campaigns }: Props) {
  if (campaigns.length === 0) {
    return (
      <EmptyState
        icon={CAMPAIGNS_NO_CAMPAIGNS.icon}
        title={CAMPAIGNS_NO_CAMPAIGNS.title}
        description={CAMPAIGNS_NO_CAMPAIGNS.description}
        action={
          <Link
            href={CAMPAIGNS_NO_CAMPAIGNS.ctaHref!}
            className="inline-flex items-center rounded-lg bg-accent-green px-6 py-2 text-sm font-semibold text-white font-heading hover:brightness-110 transition-all duration-200"
          >
            {CAMPAIGNS_NO_CAMPAIGNS.ctaLabel}
          </Link>
        }
      />
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {campaigns.map((campaign) => (
        <CampaignCard key={campaign.id} campaign={campaign} />
      ))}
    </div>
  );
}

function CampaignCard({ campaign }: { campaign: CampaignListItem }) {
  const formattedDate = formatDate(campaign.createdAt);

  return (
    <div className="flex gap-4 rounded-xl border border-border bg-bg-surface p-4">
      <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-lg">
        {campaign.thumbnailUrl ? (
          <img
            src={campaign.thumbnailUrl}
            alt={campaign.productName}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-bg-elevated" />
        )}
      </div>
      <div className="flex flex-1 flex-col justify-center gap-1">
        <h3 className="text-lg font-semibold text-text-primary font-heading">
          {campaign.productName}
        </h3>
        <span className="text-sm text-text-muted font-body">
          {formattedDate}
        </span>
        <span
          className={`text-sm font-medium font-heading ${
            campaign.status === "ready" ? "text-accent-green" : "text-accent-red"
          }`}
        >
          {campaign.status === "ready" ? "Pronta" : "Erro"}
        </span>
      </div>
      <div className="flex flex-col items-end justify-center gap-2">
        <Link
          href={`/campanhas/${campaign.id}`}
          className="rounded-lg bg-accent-green px-4 py-1.5 text-sm font-semibold text-white font-heading hover:brightness-110 transition-all duration-200"
        >
          Abrir
        </Link>
        {campaign.status === "ready" && (
          <Link
            href={`/api/campaign/${campaign.id}/download`}
            className="rounded-lg border border-border px-4 py-1.5 text-sm text-text-secondary font-body hover:bg-bg-elevated transition-all duration-200"
          >
            Baixar
          </Link>
        )}
      </div>
    </div>
  );
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}
