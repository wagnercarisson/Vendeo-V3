"use client";

import Link from "next/link";
import type { CampaignListItem } from "@/lib/campaign/list";

interface Props {
  campaigns: CampaignListItem[];
}

export default function MyCampaignsClient({ campaigns }: Props) {
  if (campaigns.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="campaign-list">
      {campaigns.map((campaign) => (
        <CampaignCard key={campaign.id} campaign={campaign} />
      ))}
    </div>
  );
}

function CampaignCard({ campaign }: { campaign: CampaignListItem }) {
  const formattedDate = formatDate(campaign.createdAt);

  return (
    <div className="campaign-card">
      <div className="campaign-card__thumbnail">
        {campaign.thumbnailUrl ? (
          <img
            src={campaign.thumbnailUrl}
            alt={campaign.productName}
            className="campaign-card__image"
          />
        ) : (
          <div className="campaign-card__placeholder" />
        )}
      </div>
      <div className="campaign-card__info">
        <h3 className="campaign-card__name">{campaign.productName}</h3>
        <span className="campaign-card__date">{formattedDate}</span>
        <span
          className={`campaign-card__status campaign-card__status--${campaign.status}`}
        >
          {campaign.status === "ready" ? "Pronta" : "Erro"}
        </span>
      </div>
      <div className="campaign-card__actions">
        <Link href={`/campanha/${campaign.id}`} className="campaign-card__link">
          Abrir
        </Link>
        {campaign.status === "ready" && (
          <Link
            href={`/api/campaign/${campaign.id}/download`}
            className="campaign-card__link campaign-card__link--download"
          >
            Baixar
          </Link>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="empty-state">
      <h2>Nenhuma campanha encontrada</h2>
      <p>Suas campanhas aparecerão aqui depois de geradas.</p>
      <Link href="/" className="empty-state__cta">
        Criar Primeira Campanha
      </Link>
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
