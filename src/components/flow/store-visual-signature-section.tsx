"use client";

import { useState, useEffect, useCallback } from "react";
import { listSignatures } from "@/lib/visual-signature/server-actions";
import { VisualSignatureModal } from "./visual-signature-modal";
import { VisualSignatureApprovalModal } from "./visual-signature-approval-modal";
import { ImageIcon, Loader2, CheckCircle2, Sparkles, AlertCircle } from "lucide-react";
import type { VisualSignatureRecord } from "@/lib/visual-signature/types";
import { resolveStoreIdentity } from "@/lib/actions/store";
import type { Store } from "@/lib/store";

interface StoreVisualSignatureSectionProps {
  store: Pick<Store, "id" | "name" | "segment" | "brand_color" | "logo_url" | "subsegment" | "tone_of_voice" | "positioning" | "short_description" | "slogan" | "identity_state">;
}

export function StoreVisualSignatureSection({ store }: StoreVisualSignatureSectionProps) {
  const [activeSignature, setActiveSignature] = useState<VisualSignatureRecord | null>(null);
  const [hasLogo, setHasLogo] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [localLogoStatus, setLocalLogoStatus] = useState<string | null>(null);
  const [localAttempts, setLocalAttempts] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const identity = await resolveStoreIdentity(store);
      if (identity.logoUrl) {
        setHasLogo(true);
        setActiveSignature(null);
        return;
      }
      setHasLogo(false);
      if (identity.visualSignatureUrl) {
        const signatures = await listSignatures(store.id);
        const active = signatures.find((s) => s.status === "active");
        setActiveSignature(active ?? null);
      } else {
        setActiveSignature(null);
      }

      const storeRes = await fetch(`/api/store/${store.id}`);
      if (storeRes.ok) {
        const storeData = await storeRes.json();
        setLocalLogoStatus(storeData.logo_status ?? null);
        setLocalAttempts(storeData.visual_signature_attempts ?? 0);
      }
    } catch {
      setHasLogo(false);
      setActiveSignature(null);
    } finally {
      setLoading(false);
    }
  }, [store]);

  useEffect(() => {
    load();
  }, [load]);

  const handleModalClose = useCallback(() => {
    setShowModal(false);
    load();
  }, [load]);

  const handleApprovalComplete = useCallback(() => {
    setShowApprovalModal(false);
    load();
  }, [load]);

  const handleShowApproval = useCallback(() => {
    setShowApprovalModal(true);
  }, []);

  if (hasLogo) return null;

  const renderState = () => {
    switch (localLogoStatus) {
      case "generated":
        return activeSignature ? (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl bg-bg-elevated overflow-hidden border border-border-light">
                <img src={activeSignature.asset_url} alt="Assinatura visual ativa" className="w-full h-full object-contain" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-accent-green" />
                  <p className="text-text-primary font-heading font-semibold text-sm">Assinatura ativa</p>
                </div>
                <p className="text-text-muted text-xs font-body mt-0.5">Gerado por IA e aprovado</p>
              </div>
            </div>
            <button type="button" onClick={handleShowApproval}
              className="w-full px-4 py-2.5 border border-border-light text-text-primary font-heading font-semibold text-sm rounded-lg hover:bg-bg-elevated transition-all duration-200 flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Criar / Alterar Assinatura Visual
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <button type="button" onClick={handleShowApproval}
              className="w-full px-4 py-2.5 bg-accent-green text-white font-heading font-semibold text-sm rounded-lg hover:brightness-110 transition-all duration-200 flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Criar Assinatura Visual
            </button>
          </div>
        );

      case "explicit_none":
        return (
          <div className="space-y-4">
            <div className="flex flex-col items-center justify-center py-6 gap-2">
              <ImageIcon className="w-8 h-8 text-text-muted" />
              <p className="text-text-muted text-sm font-body">
                {localAttempts >= 3
                  ? "Continuou sem logo após 3 tentativas"
                  : "Nenhuma assinatura visual"}
              </p>
            </div>
            <button type="button" onClick={handleShowApproval}
              className="w-full px-4 py-2.5 bg-accent-green text-white font-heading font-semibold text-sm rounded-lg hover:brightness-110 transition-all duration-200 flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              {localAttempts >= 3 ? "Reavaliar assinaturas" : "Criar Assinatura Visual"}
            </button>
          </div>
        );

      case "failed":
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 py-4">
              <AlertCircle className="w-5 h-5 text-accent-red shrink-0" />
              <p className="text-accent-red text-sm font-body">Não foi possível criar sua assinatura visual.</p>
            </div>
            <button type="button" onClick={handleShowApproval}
              className="w-full px-4 py-2.5 bg-accent-green text-white font-heading font-semibold text-sm rounded-lg hover:brightness-110 transition-all duration-200 flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Tentar novamente
            </button>
          </div>
        );

      case "exhausted":
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-2 py-4">
              <AlertCircle className="w-5 h-5 text-accent-amber shrink-0" />
              <p className="text-accent-amber text-sm font-body">Limite de 3 versões atingido. Reavalie as assinaturas geradas.</p>
            </div>
            <button type="button" onClick={handleShowApproval}
              className="w-full px-4 py-2.5 bg-accent-green text-white font-heading font-semibold text-sm rounded-lg hover:brightness-110 transition-all duration-200 flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Reavaliar assinaturas
            </button>
          </div>
        );

      default:
        if (activeSignature) {
          return (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl bg-bg-elevated overflow-hidden border border-border-light">
                  <img src={activeSignature.asset_url} alt="Assinatura visual ativa" className="w-full h-full object-contain" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-accent-green" />
                    <p className="text-text-primary font-heading font-semibold text-sm">Assinatura ativa</p>
                  </div>
                  <p className="text-text-muted text-xs font-body mt-0.5">{activeSignature.type === "fallback_typographic" ? "Temporária" : "Gerado por IA"}</p>
                </div>
              </div>
              <button type="button" onClick={handleShowApproval}
                className="w-full px-4 py-2.5 border border-border-light text-text-primary font-heading font-semibold text-sm rounded-lg hover:bg-bg-elevated transition-all duration-200 flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Criar / Alterar Assinatura Visual
              </button>
            </div>
          );
        }

        return (
          <div className="space-y-4">
            <div className="flex flex-col items-center justify-center py-6 gap-2">
              <ImageIcon className="w-8 h-8 text-text-muted" />
              <p className="text-text-muted text-sm font-body">Nenhuma assinatura visual</p>
            </div>
            <button type="button" onClick={handleShowApproval}
              className="w-full px-4 py-2.5 bg-accent-green text-white font-heading font-semibold text-sm rounded-lg hover:brightness-110 transition-all duration-200 flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Criar Assinatura Visual
            </button>
          </div>
        );
    }
  };

  return (
    <div className="bg-bg-surface border border-border rounded-xl p-6">
      <h3 className="text-text-muted text-xs font-heading font-medium uppercase tracking-wider mb-4">
        Identidade Visual
      </h3>

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-text-muted" />
        </div>
      ) : renderState()}

      {showModal && (
        <VisualSignatureModal
          storeId={store.id}
          storeName={store.name}
          segment={store.segment}
          brandColor={store.brand_color ?? ""}
          onClose={handleModalClose}
          onLogoUpload={() => setShowModal(false)}
        />
      )}

      {showApprovalModal && (
        <VisualSignatureApprovalModal
          isOpen={showApprovalModal}
          onClose={() => setShowApprovalModal(false)}
          storeId={store.id}
          storeName={store.name}
          segment={store.segment}
          brandColor={store.brand_color ?? ""}
          tone_of_voice={store.tone_of_voice ?? ""}
          subsegment={store.subsegment ?? ""}
          positioning={store.positioning ?? ""}
          short_description={store.short_description ?? ""}
          slogan={store.slogan ?? ""}
          onComplete={handleApprovalComplete}
        />
      )}
    </div>
  );
}
