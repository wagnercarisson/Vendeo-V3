"use client";

import { useLayoutEffect, useState } from "react";
import type { Store } from "@/lib/store";
import { StoreIdentityBlock } from "./store-identity-block";
import { CampaignInputForm } from "./campaign-input-form";
import { ErrorState } from "@/components/ui/error-state";
import { AlertTriangle } from "lucide-react";
import type { StoreIdentitySnapshot } from "@/components/campaign/types";
import type { CampaignFormRestore } from "@/lib/campaign/display";
import { DRAFT_KEY, IMAGE_DRAFT_KEY } from "@/hooks/use-input-preservation";

const PREVIEW_KEY = "campaign_preview";

interface CampaignPageClientProps {
  store: Store;
  balance: number | null;
  supportEmail?: string;
  generationPaused?: boolean;
  identity?: StoreIdentitySnapshot | null;
  /**
   * F56.2b1b (B1B-D1): elegibilidade do novo fluxo Produto 1:1 decidida
   * server-side. O cliente apenas repassa o booleano ao formulário — nunca
   * declara elegibilidade. Ausente ⇒ `false` (fail-closed).
   */
  eligible?: boolean;
  /**
   * F56.2b2b (C4 / B2B-D9): snapshot ESTRUTURAL do formulário restaurado,
   * resolvido SERVER-SIDE com ownership em `/campanhas/nova` (elo 1 da cadeia).
   * Repassado ao `CampaignInputForm` (elo 2). SEM import `product-1-1` (G-NA).
   */
  restoredForm?: CampaignFormRestore | null;
}

export function CampaignPageClient({ store, balance, supportEmail, generationPaused, identity, eligible = false, restoredForm = null }: CampaignPageClientProps) {
  const [isReviewActive, setIsReviewActive] = useState(false);
  // F56.2b2b (C4 / B2B-D9) — mount-clear SOMENTE das chaves LEGADAS GLOBAIS
  // (`campaign_draft`/`campaign_draft_image`/`campaign_preview`). Os rascunhos
  // ESCOPADOS de QUALQUER campanha (`campaign_draft:*`/`campaign_draft_image:*`)
  // são PRESERVADOS: IGNORAR um rascunho alheio NÃO significa apagá-lo. A seleção
  // do rascunho CORRETO é feita pelo escopo da campanha em `useCampaignForm`.
  useLayoutEffect(() => {
    try {
      sessionStorage.removeItem(DRAFT_KEY);
      sessionStorage.removeItem(IMAGE_DRAFT_KEY);
      sessionStorage.removeItem(PREVIEW_KEY);
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

      {!isReviewActive && (
        <div className="mb-6">
          <StoreIdentityBlock
            store={store as { name: string; segment: string; brand_color: string; id: string }}
            identity={identity ?? null}
          />
        </div>
      )}

      <h1 className="text-2xl font-heading font-bold text-text-primary mb-1">
        Dados da Campanha
      </h1>
      <p className="text-text-secondary text-sm font-body mb-8">
        Informe os dados do produto e da oferta
      </p>

      <CampaignInputForm storeId={store.id} balance={balance} supportEmail={supportEmail} store={store as { name: string; segment: string; brand_color: string; id: string }} identity={identity} eligible={eligible} restoredForm={restoredForm} onReviewModeChange={setIsReviewActive} />
    </div>
  );
}
