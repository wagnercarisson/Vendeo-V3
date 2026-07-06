"use client";

import type { Store } from "@/lib/store";
import { StoreIdentityBlock } from "./store-identity-block";
import { CampaignInputForm } from "./campaign-input-form";
import type { StoreIdentitySnapshot } from "@/components/campaign/types";

export function CampaignPageClient({ store }: { store: Store }) {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
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

      <CampaignInputForm storeId={store.id} />
    </div>
  );
}
