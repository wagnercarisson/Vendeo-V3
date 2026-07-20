"use client";

import { useLayoutEffect } from "react";
import type { Store } from "@/lib/store";
import { StoreIdentityBlock } from "./store-identity-block";
import { CampaignInputForm } from "./campaign-input-form";
import { ErrorState } from "@/components/ui/error-state";
import { AlertTriangle } from "lucide-react";
import type { StoreIdentitySnapshot } from "@/components/campaign/types";

interface CampaignPageClientProps {
  store: Store;
  balance: number | null;
  supportEmail?: string;
  generationPaused?: boolean;
}

export function CampaignPageClient({ store, balance, supportEmail, generationPaused }: CampaignPageClientProps) {
  useLayoutEffect(() => {
    try {
      sessionStorage.removeItem("campaign_draft");
      sessionStorage.removeItem("campaign_draft_image");
      sessionStorage.removeItem("campaign_preview");
    } catch { /* ignore */ }
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {generationPaused && (
        <div role="alert" className="mb-6 w-full rounded-lg bg-accent-amber/10 border border-accent-amber/30 px-4 py-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-accent-amber shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-accent-amber text-sm">Geração temporariamente indisponível</p>
              <p className="text-accent-amber/80 text-xs mt-1">
                Estamos fazendo algumas melhorias. Volte em breve ou entre em contato.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mb-6">
        <StoreIdentityBlock
          store={store as { name: string; segment: string; brand_color: string; id: string }}
          identity={null}
        />
      </div>

      <h1 className="text-2xl font-heading font-bold text-text-primary mb-1">
        Dados da Campanha
      </h1>
      <p className="text-text-secondary text-sm font-body mb-8">
        Informe os dados do produto e da oferta
      </p>

      <CampaignInputForm storeId={store.id} balance={balance} supportEmail={supportEmail} />
    </div>
  );
}
