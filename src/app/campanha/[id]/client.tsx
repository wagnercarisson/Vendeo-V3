"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { CampaignPageProps } from "@/lib/campaign/display";

export default function CampaignPageClient(props: CampaignPageProps) {
  const router = useRouter();

  useEffect(() => {
    if (props.displayStatus !== "generating") return;

    const interval = setInterval(() => {
      router.refresh();
    }, 5000);

    return () => clearInterval(interval);
  }, [props.displayStatus, router]);

  if (props.displayStatus === "generating") {
    return <GeneratingView />;
  }

  if (props.displayStatus === "stale") {
    return <StaleView onNewCampaign={() => router.push("/")} />;
  }

  if (props.displayStatus === "error") {
    return <ErrorView onNewCampaign={() => router.push("/")} />;
  }

  return <ReadyView {...props} />;
}

function ReadyView(props: CampaignPageProps) {
  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      {props.imageUrl && (
        <img
          src={props.imageUrl}
          alt={props.productName || "Campanha"}
          className="w-full rounded-lg shadow-md"
        />
      )}
      <h1 className="text-2xl font-bold">{props.productName}</h1>
      <p className="text-sm text-gray-500">
        Criada em {new Date(props.createdAt).toLocaleDateString("pt-BR")}
      </p>
      {props.caption && <p className="text-lg">{props.caption}</p>}
      {props.hashtags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {props.hashtags.map((tag) => (
            <span key={tag} className="rounded bg-blue-100 px-2 py-1 text-sm text-blue-700">
              {tag}
            </span>
          ))}
        </div>
      )}
      {props.ctaPost && (
        <p className="font-semibold text-green-700">{props.ctaPost}</p>
      )}
      <a
        href={props.downloadUrl}
        className="inline-block rounded bg-blue-600 px-6 py-2 text-white hover:bg-blue-700"
      >
        Baixar Original
      </a>
    </div>
  );
}

function GeneratingView() {
  return (
    <div className="flex flex-col items-center justify-center space-y-4 p-12">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
      <p className="text-lg text-gray-600">Sua campanha está sendo gerada...</p>
    </div>
  );
}

function StaleView({ onNewCampaign }: { onNewCampaign: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center space-y-4 p-12">
      <p className="text-lg text-yellow-700">Geração interrompida. Tente novamente.</p>
      <button
        onClick={onNewCampaign}
        className="rounded bg-blue-600 px-6 py-2 text-white hover:bg-blue-700"
      >
        Criar Nova Campanha
      </button>
    </div>
  );
}

function ErrorView({ onNewCampaign }: { onNewCampaign: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center space-y-4 p-12">
      <p className="text-lg text-red-700">Não foi possível gerar sua campanha.</p>
      <button
        onClick={onNewCampaign}
        className="rounded bg-blue-600 px-6 py-2 text-white hover:bg-blue-700"
      >
        Criar Nova Campanha
      </button>
    </div>
  );
}
