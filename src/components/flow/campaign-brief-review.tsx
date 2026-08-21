"use client";

import { useMemo, useEffect } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Coins,
  Loader2,
  Sparkles,
} from "lucide-react";
import type { CampaignFormFields, PreparedCampaignImage } from "./use-campaign-form";
import { buildValidityDisplayText, buildMandatoryArtworkText, inferIntent } from "./use-campaign-form";
import { formatCurrencyBRL } from "@/lib/formatters";
import { StoreIdentityBlock } from "./store-identity-block";
import { useOperationCosts } from "@/hooks/use-operation-costs";
import type { StoreIdentitySnapshot } from "@/components/campaign/types";
import { CreditCta } from "@/components/credit/credit-cta";

const INTENT_LABELS: Record<string, string> = {
  offer: "Oferta",
  spotlight: "Destaque",
  exclusive: "Exclusivo",
};

interface CampaignBriefReviewProps {
  fields: CampaignFormFields;
  preparedImages: PreparedCampaignImage[] | null;
  preparing: boolean;
  error: string | null;
  store?: { name: string; segment: string; brand_color: string; id: string };
  identity?: StoreIdentitySnapshot | null;
  balance?: number | null;
  supportEmail?: string;
  onBack: () => void;
  onConfirm: () => Promise<void>;
}

export function CampaignBriefReview({
  fields,
  preparedImages,
  preparing,
  error,
  store,
  identity,
  balance,
  supportEmail,
  onBack,
  onConfirm,
}: CampaignBriefReviewProps) {
  const { costs, status: costStatus } = useOperationCosts();
  const campaignCost = costs?.campaign_generation;
  const costUnavailable = costStatus !== "loaded";
  const costDisabled = costStatus === "loaded" && campaignCost !== undefined && !campaignCost.enabled;
  const insufficientBalance =
    balance !== undefined &&
    balance !== null &&
    campaignCost !== undefined &&
    balance < campaignCost.costCredits;
  const confirmDisabled =
    preparing ||
    !preparedImages ||
    preparedImages.length === 0 ||
    costUnavailable ||
    costDisabled ||
    insufficientBalance ||
    balance === null;

  const intent = inferIntent(fields.originalPriceCents, fields.discountedPriceCents);
  const validity = fields.campaignIntent === "offer" ? buildValidityDisplayText(fields) : undefined;
  const mandatoryArtworkText = buildMandatoryArtworkText(
    fields.showIllustrativeNotice,
    fields.mandatoryArtworkTextFree,
  );
  const primaryImage = preparedImages?.find((img) => img.role === "primary") ?? preparedImages?.[0];
  const referenceImages = preparedImages?.filter((img) => img.role !== "primary") ?? [];

  // F43 (D7): ao entrar na revisão, garante o scroll no topo — o clique em
  // "Revisar e gerar" ocorre no fundo do form; sem isto, o usuário cairia no
  // meio/fundo da revisão e perderia o título + seção Produto.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const costLabel = useMemo(() => {
    if (costStatus === "loading") return "Verificando custo...";
    if (costStatus === "unavailable") return "Serviço indisponível no momento";
    if (campaignCost && !campaignCost.enabled) return "Operação desativada";
    if (campaignCost) return `Vai consumir ${campaignCost.costCredits} crédito(s)`;
    return "Custo: …";
  }, [costStatus, campaignCost]);

  if (preparing) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex items-center justify-center gap-2 text-text-muted text-sm font-body min-h-[320px]"
      >
        <Loader2 className="w-5 h-5 animate-spin" />
        Preparando imagens...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-text-primary text-lg font-heading font-semibold">
          Revise os dados da campanha antes de gerar
        </h2>
        <button
          type="button"
          onClick={onBack}
          aria-label="Voltar e editar"
          className="inline-flex items-center gap-1.5 min-h-[44px] px-3 py-2 text-sm text-text-muted hover:text-text-primary transition-colors font-body"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar e editar
        </button>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-lg bg-red-900/20 border border-red-700/30 px-4 py-3">
          <AlertCircle className="w-5 h-5 text-accent-red shrink-0 mt-0.5" />
          <p className="text-accent-red text-sm font-body">{error}</p>
        </div>
      )}

      {store && (
        <StoreIdentityBlock store={store} identity={identity ?? null} />
      )}

      <p className="text-xs text-text-muted font-body">
        Revise textos, preços e imagens antes de publicar: a IA pode cometer erros.
      </p>

      <section aria-label="Produto" className="bg-bg-surface border border-border rounded-xl p-4">
        <h3 className="text-text-muted text-xs font-heading font-medium uppercase tracking-wider mb-3">
          Produto
        </h3>
        <p className="text-text-primary text-base font-heading font-semibold">{fields.productName}</p>
        {fields.description && (
          <p className="text-text-secondary text-sm font-body mt-1">{fields.description}</p>
        )}
      </section>

      <section aria-label="Oferta" className="bg-bg-surface border border-border rounded-xl p-4">
        <h3 className="text-text-muted text-xs font-heading font-medium uppercase tracking-wider mb-3">
          Oferta
        </h3>
        <dl className="space-y-2">
          <div className="flex items-center gap-2">
            <dt className="text-text-muted text-sm font-body w-28 shrink-0">Tipo</dt>
            <dd className="text-text-primary text-sm font-body">{INTENT_LABELS[intent] ?? intent}</dd>
          </div>
          {fields.badge && (
            <div className="flex items-center gap-2">
              <dt className="text-text-muted text-sm font-body w-28 shrink-0">Selo</dt>
              <dd className="text-text-primary text-sm font-body">{fields.badge}</dd>
            </div>
          )}
          {fields.originalPriceCents > 0 && (
            <div className="flex items-center gap-2">
              <dt className="text-text-muted text-sm font-body w-28 shrink-0">Preço original</dt>
              <dd className="text-text-secondary text-sm font-body line-through">
                {formatCurrencyBRL(fields.originalPriceCents)}
              </dd>
            </div>
          )}
          {fields.discountedPriceCents !== undefined && fields.discountedPriceCents > 0 && (
            <div className="flex items-center gap-2">
              <dt className="text-text-muted text-sm font-body w-28 shrink-0">Preço final</dt>
              <dd className="text-text-primary text-sm font-body font-semibold">
                {formatCurrencyBRL(fields.discountedPriceCents)}
              </dd>
            </div>
          )}
          {validity && (
            <div className="flex items-center gap-2">
              <dt className="text-text-muted text-sm font-body w-28 shrink-0">Validade</dt>
              <dd className="text-text-primary text-sm font-body">{validity}</dd>
            </div>
          )}
        </dl>
      </section>

      <section aria-label="Imagens" className="bg-bg-surface border border-border rounded-xl p-4">
        <h3 className="text-text-muted text-xs font-heading font-medium uppercase tracking-wider mb-3">
          Imagens
        </h3>
        {preparedImages && preparedImages.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {primaryImage && (
              <div className="aspect-square rounded-lg overflow-hidden bg-bg-elevated border border-border-light">
                <img
                  src={primaryImage.dataUrl}
                  alt={`Imagem principal de ${fields.productName}`}
                  className="w-full h-full object-contain"
                />
                <p className="text-center text-[11px] text-accent-green font-heading font-medium py-1">
                  Principal
                </p>
              </div>
            )}
            {referenceImages.map((img) => (
              <div
                key={img.id}
                className="aspect-square rounded-lg overflow-hidden bg-bg-elevated border border-border-light"
              >
                <img
                  src={img.dataUrl}
                  alt={`Imagem de referência de ${fields.productName}`}
                  className="w-full h-full object-contain"
                />
                <p className="text-center text-[11px] text-text-muted font-heading font-medium py-1">
                  Referência
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-text-muted text-sm font-body">Nenhuma imagem utilizável.</p>
        )}
      </section>

      <section aria-label="Avisos" className="bg-bg-surface border border-border rounded-xl p-4">
        <h3 className="text-text-muted text-xs font-heading font-medium uppercase tracking-wider mb-3">
          Avisos
        </h3>
        <div className="flex items-start gap-2">
          <span
            aria-hidden="true"
            className={`mt-0.5 h-4 w-4 rounded border flex items-center justify-center shrink-0 ${
              fields.showIllustrativeNotice
                ? "bg-accent-green border-accent-green text-white"
                : "border-border-light bg-bg-surface"
            }`}
          >
            {fields.showIllustrativeNotice && <Check className="w-3 h-3" />}
          </span>
          <p className="text-text-primary text-sm font-body">
            {mandatoryArtworkText ?? "Sem avisos adicionais."}
          </p>
        </div>
      </section>

      <section aria-label="Custo" className="bg-bg-surface border border-border rounded-xl p-4 space-y-3">
        <h3 className="text-text-muted text-xs font-heading font-medium uppercase tracking-wider">
          Custo
        </h3>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-body">
          <span className="text-text-primary">{costLabel}</span>
          <span className="text-text-muted">·</span>
          <span className="flex items-center gap-1.5">
            <Coins className="h-4 w-4 text-accent-green" />
            Saldo: {balance !== null && balance !== undefined ? <strong>{balance}</strong> : "indisponível"}
          </span>
        </div>
        {balance === 0 && <CreditCta variant="zero" supportEmail={supportEmail} />}
        {balance === null && (
          <p className="text-text-muted text-xs font-body">
            Não foi possível confirmar seu saldo. Tente novamente.
          </p>
        )}
      </section>

      <div className="pt-2 space-y-3">
        <button
          type="button"
          onClick={onConfirm}
          disabled={confirmDisabled}
          aria-label="Confirmar e gerar campanha"
          title={
            costUnavailable
              ? "Serviço indisponível no momento. Tente novamente em alguns instantes."
              : costDisabled
                ? "Operação desativada no momento."
                : insufficientBalance
                  ? "Você precisa de créditos para gerar uma campanha"
                  : undefined
          }
          className="min-h-[44px] w-full sm:w-auto px-8 py-2.5 bg-accent-green text-white font-heading font-semibold text-sm rounded-lg hover:brightness-110 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {preparing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Preparando imagens...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Confirmar e gerar campanha
            </>
          )}
        </button>
        <button
          type="button"
          onClick={onBack}
          className="min-h-[44px] px-4 py-2.5 bg-bg-surface text-text-primary text-sm font-body rounded-lg border border-border-light hover:border-text-muted transition-colors"
        >
          Voltar e editar
        </button>
      </div>
    </div>
  );
}