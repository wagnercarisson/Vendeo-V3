"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, AlertCircle, Loader2, ImageIcon } from "lucide-react";
import { CampaignRenderer } from "@/components/campaign/campaign-renderer";
import { CampaignAdjustmentsPanel } from "@/components/campaign/campaign-adjustments-panel";
import type { PreviewPayload, CampaignAdjustments } from "@/components/campaign/types";
import type { CampaignSpec } from "@/lib/campaign-intelligence/schema";

type PageState = "loading" | "empty" | "error" | "ready";

export default function PreviewPage() {
  const router = useRouter();
  const [pageState, setPageState] = useState<PageState>("loading");
  const [payload, setPayload] = useState<PreviewPayload | null>(null);
  const [spec, setSpec] = useState<CampaignSpec | null>(null);
  const [adjustments, setAdjustments] = useState<CampaignAdjustments>({});
  const [productImageError, setProductImageError] = useState(false);
  const [showGeneratedImage, setShowGeneratedImage] = useState(false);
  const [generatedImageError, setGeneratedImageError] = useState(false);
  const [showLegacyView, setShowLegacyView] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("campaign_preview");
      if (!raw) {
        setPageState("empty");
        return;
      }
      const parsed = JSON.parse(raw) as PreviewPayload;
      if (!parsed.campaignSpec || !parsed.storeIdentity) {
        setPageState("error");
        return;
      }
      setPayload(parsed);
      setSpec(parsed.campaignSpec);
      setPageState("ready");

      if (parsed.productImageUrl) {
        const img = new Image();
        img.onload = () => setProductImageError(false);
        img.onerror = () => setProductImageError(true);
        img.src = parsed.productImageUrl;
      }

      if (parsed.generatedImageDataUrl) {
        setShowGeneratedImage(true);
        const img = new Image();
        img.onload = () => setGeneratedImageError(false);
        img.onerror = () => setGeneratedImageError(true);
        img.src = parsed.generatedImageDataUrl;
      }
    } catch {
      setPageState("error");
    }
  }, []);

  const mergedSpec: CampaignSpec | null = useMemo(() => {
    if (!spec) return null;
    return {
      ...spec,
      commercial_copy: {
        ...spec.commercial_copy,
        title: adjustments.title ?? spec.commercial_copy.title,
        hook: adjustments.hook ?? spec.commercial_copy.hook,
        cta: adjustments.cta ?? spec.commercial_copy.cta,
      },
      offer: {
        ...spec.offer,
        discounted_price_display:
          adjustments.discountedPriceDisplay ?? spec.offer.discounted_price_display,
        badge_text: adjustments.badgeText ?? spec.offer.badge_text,
      },
    };
  }, [spec, adjustments]);

  const handleAdjustmentChange = useCallback(
    (key: string, value: string) => {
      setAdjustments((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const handleUndo = useCallback((key: string) => {
    setAdjustments((prev) => {
      const next = { ...prev };
      delete next[key as keyof CampaignAdjustments];
      return next;
    });
  }, []);

  const handleBack = useCallback(() => {
    sessionStorage.removeItem("campaign_preview");
    router.push("/");
  }, [router]);

  const handleRetry = useCallback(() => {
    setPageState("loading");
    setProductImageError(false);
    try {
      const raw = sessionStorage.getItem("campaign_preview");
      if (!raw) {
        setPageState("empty");
        return;
      }
      const parsed = JSON.parse(raw) as PreviewPayload;
      if (!parsed.campaignSpec || !parsed.storeIdentity) {
        setPageState("error");
        return;
      }
      setPayload(parsed);
      setSpec(parsed.campaignSpec);
      setPageState("ready");

      if (parsed.productImageUrl) {
        const img = new Image();
        img.onload = () => setProductImageError(false);
        img.onerror = () => setProductImageError(true);
        img.src = parsed.productImageUrl;
      }
    } catch {
      setPageState("error");
    }
  }, []);

  const handleToggleLegacy = useCallback(() => {
    setShowLegacyView((prev) => !prev);
  }, []);

  if (pageState === "loading") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-accent-green" />
        <p className="text-text-secondary text-sm font-body">
          Carregando prévia...
        </p>
      </div>
    );
  }

  if (pageState === "empty") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 max-w-md mx-auto text-center">
        <ImageIcon className="w-12 h-12 text-text-muted" />
        <h2 className="text-text-primary font-heading font-bold text-xl">
          Nenhuma campanha encontrada
        </h2>
        <p className="text-text-secondary text-sm font-body">
          Você ainda não gerou nenhuma campanha. Crie uma nova para visualizar.
        </p>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="px-6 py-2.5 bg-accent-green text-white font-heading font-semibold text-sm rounded-lg hover:brightness-110 transition-all duration-200"
        >
          Criar Nova Campanha
        </button>
      </div>
    );
  }

  if (pageState === "error") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 max-w-md mx-auto text-center">
        <AlertCircle className="w-12 h-12 text-accent-red" />
        <h2 className="text-text-primary font-heading font-bold text-xl">
          Algo deu errado
        </h2>
        <p className="text-text-secondary text-sm font-body">
          Não foi possível carregar a prévia da campanha.
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleRetry}
            className="px-6 py-2.5 bg-accent-green text-white font-heading font-semibold text-sm rounded-lg hover:brightness-110 transition-all duration-200"
          >
            Tentar Novamente
          </button>
          <button
            type="button"
            onClick={handleBack}
            className="px-6 py-2.5 border border-border-light text-text-primary font-heading font-semibold text-sm rounded-lg hover:bg-bg-elevated transition-all duration-200"
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 bg-white border-b border-gray-200 z-10">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-3">
          <button
            type="button"
            onClick={handleBack}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>
          <h1 className="text-base font-heading font-semibold text-gray-900">
            Pré-visualização da Campanha
          </h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {showGeneratedImage && !showLegacyView ? (
          <div className="flex flex-col md:flex-row gap-6 items-start">
            <div className="w-full md:w-[55%] lg:w-[60%] flex-shrink-0 sticky top-20">
              {generatedImageError ? (
                <div className="aspect-square bg-gray-100 rounded-xl flex items-center justify-center">
                  <div className="text-center">
                    <AlertCircle className="w-8 h-8 text-accent-red mx-auto mb-2" />
                    <p className="text-sm text-text-secondary font-body">
                      Erro ao carregar imagem gerada
                    </p>
                  </div>
                </div>
              ) : payload?.generatedImageDataUrl ? (
                <img
                  src={payload.generatedImageDataUrl}
                  alt="Campanha gerada por IA"
                  className="w-full rounded-xl shadow-lg"
                />
              ) : null}
            </div>
            <div className="w-full md:w-[45%] lg:w-[40%] space-y-4">
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-heading font-semibold text-gray-900 mb-3">
                  Imagem gerada por IA
                </h3>
                <p className="text-xs text-text-secondary font-body mb-4">
                  Esta imagem foi gerada automaticamente por inteligência artificial.
                  A imagem é plana e não permite edição de texto diretamente.
                </p>
                <button
                  type="button"
                  onClick={handleToggleLegacy}
                  className="w-full px-4 py-2 border border-border-light text-text-primary font-heading font-semibold text-sm rounded-lg hover:bg-bg-elevated transition-all duration-200"
                >
                  Ver visualização CSS (legado)
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col md:flex-row gap-6 items-start">
            <div className="w-full md:w-[55%] lg:w-[60%] flex-shrink-0 sticky top-20">
              {showGeneratedImage && showLegacyView && (
                <div className="mb-3">
                  <button
                    type="button"
                    onClick={handleToggleLegacy}
                    className="text-xs text-accent-green font-heading font-semibold hover:underline"
                  >
                    Voltar para imagem gerada por IA
                  </button>
                </div>
              )}
              <CampaignRenderer
                spec={mergedSpec!}
                storeIdentity={payload!.storeIdentity}
                productImageUrl={productImageError ? null : payload!.productImageUrl}
              />
            </div>
            <div className="w-full md:w-[45%] lg:w-[40%]">
              <CampaignAdjustmentsPanel
                originalSpec={payload!.campaignSpec}
                adjustments={adjustments}
                onAdjustmentChange={handleAdjustmentChange}
                onUndo={handleUndo}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
