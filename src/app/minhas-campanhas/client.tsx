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
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      {campaigns.map((campaign) => (
        <CampaignCard key={campaign.id} campaign={campaign} />
      ))}
    </div>
  );
}

function CampaignCard({ campaign }: { campaign: CampaignListItem }) {
  const formattedDate = formatDate(campaign.createdAt);

  return (
    <div className="flex gap-4 rounded-lg border p-4 shadow-sm">
      <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-md">
        {campaign.thumbnailUrl ? (
          <img
            src={campaign.thumbnailUrl}
            alt={campaign.productName}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-gray-100" />
        )}
      </div>
      <div className="flex flex-1 flex-col justify-center gap-1">
        <h3 className="text-lg font-semibold">{campaign.productName}</h3>
        <span className="text-sm text-gray-500">{formattedDate}</span>
        <span
          className={`text-sm font-medium ${
            campaign.status === "ready" ? "text-green-600" : "text-red-600"
          }`}
        >
          {campaign.status === "ready" ? "Pronta" : "Erro"}
        </span>
      </div>
      <div className="flex flex-col items-end justify-center gap-2">
        <Link
          href={`/campanha/${campaign.id}`}
          className="rounded bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700"
        >
          Abrir
        </Link>
        {campaign.status === "ready" && (
          <Link
            href={`/api/campaign/${campaign.id}/download`}
            className="rounded bg-gray-100 px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-200"
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
    <div className="flex flex-col items-center justify-center gap-4 py-20">
      <h2 className="text-2xl font-bold text-gray-800">Nenhuma campanha encontrada</h2>
      <p className="text-gray-500">Suas campanhas aparecerão aqui depois de geradas.</p>
      <Link
        href="/"
        className="rounded bg-blue-600 px-6 py-2 text-white hover:bg-blue-700"
      >
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
