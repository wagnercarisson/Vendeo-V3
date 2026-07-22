"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Loader2, X, AlertCircle, Sparkles } from "lucide-react";

interface HistorySignature {
  id: string;
  assetUrl: string;
  type: string;
  status: string;
  attempt: number;
  created_at: string;
  approved_at: string | null;
  art_direction: {
    visual_direction: string | null;
    content_used: Record<string, boolean> | null;
  } | null;
  restore_eligibility: {
    can_restore: boolean;
    drift_fields: string[];
    requires_regeneration: boolean;
    reason: "ok" | "critical_drift" | "missing_metadata";
  };
}

interface VisualSignatureHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  storeId: string;
  identityState: string | null;
  onApplied?: () => void;
  onGenerateNew?: () => void;
}

function canApply(identityState: string | null): boolean {
  return identityState === "text_only";
}

function getBlockedTooltip(identityState: string | null): string {
  switch (identityState) {
    case "visual_signature": return "Remova a assinatura ativa antes de aplicar outra versão";
    case "logo": return "Remova o logotipo ativo antes de aplicar uma assinatura visual";
    default: return "Aguarde o carregamento da identidade da loja";
  }
}

export function VisualSignatureHistoryModal({
  isOpen,
  onClose,
  storeId,
  identityState,
  onApplied,
  onGenerateNew,
}: VisualSignatureHistoryModalProps) {
  const [rawSignatures, setRawSignatures] = useState<HistorySignature[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiTotal, setApiTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasLoadedSecondBatch, setHasLoadedSecondBatch] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);

  const visibleSignatures = useMemo(
    () => rawSignatures.filter(s => s.restore_eligibility?.reason === "ok"),
    [rawSignatures]
  );

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setApplyError(null);
    setHasLoadedSecondBatch(false);

    async function load() {
      try {
        const res1 = await fetch(`/api/store/${storeId}/visual-signature?limit=6&offset=0`);
        const data1 = await res1.json();
        if (cancelled) return;

        let raw: HistorySignature[] = data1?.signatures ?? [];
        const total = data1?.total ?? 0;

        const visible = raw.filter(s => s.restore_eligibility?.reason === "ok");
        if (visible.length < 6 && raw.length < total && raw.length < 12) {
          const res2 = await fetch(`/api/store/${storeId}/visual-signature?limit=6&offset=6`);
          const data2 = await res2.json();
          if (cancelled) return;
          const raw2: HistorySignature[] = data2?.signatures ?? [];
          raw = [...raw, ...raw2];
          setHasLoadedSecondBatch(true);
        }

        setRawSignatures(raw);
        setApiTotal(total);
        setLoading(false);
      } catch {
        if (!cancelled) {
          setError("Erro ao carregar assinaturas anteriores");
          setLoading(false);
        }
      }
    }

    load();

    return () => { cancelled = true; };
  }, [isOpen, storeId]);

  useEffect(() => {
    if (!isOpen) {
      setRawSignatures([]);
      setLoading(true);
      setError(null);
      setApiTotal(0);
      setLoadingMore(false);
      setHasLoadedSecondBatch(false);
      setApplyingId(null);
      setApplyError(null);
    }
  }, [isOpen]);

  const handleLoadMore = useCallback(async () => {
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/store/${storeId}/visual-signature?limit=6&offset=6`);
      const data = await res.json();
      const newSignatures: HistorySignature[] = data?.signatures ?? [];
      setRawSignatures(prev => [...prev, ...newSignatures]);
      setHasLoadedSecondBatch(true);
    } catch {
      setError("Erro ao carregar mais assinaturas");
    } finally {
      setLoadingMore(false);
    }
  }, [storeId]);

  const handleApply = useCallback(async (signatureId: string) => {
    setApplyingId(signatureId);
    setApplyError(null);

    try {
      const res = await fetch(`/api/store/${storeId}/visual-signature/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signatureId }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.drift?.critical) {
          setApplyError(data.error || "Drift detectado. Crie uma nova versão.");
        } else {
          setApplyError(data.error || "Erro ao aplicar assinatura");
        }
        setApplyingId(null);
        return;
      }

      if (data.success === true) {
        onApplied?.();
        onClose();
      } else {
        setApplyError(data.error || "Erro ao aplicar assinatura");
        setApplyingId(null);
      }
    } catch {
      setApplyError("Erro de conexão. Tente novamente.");
      setApplyingId(null);
    }
  }, [storeId, onApplied, onClose]);

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return { label: "Ativa", className: "bg-accent-green text-white" };
      case "archived":
        return { label: "Arquivada", className: "bg-bg-hover text-text-secondary" };
      case "draft":
        return { label: "Rascunho", className: "bg-accent-amber text-white" };
      default:
        return { label: status, className: "bg-bg-hover text-text-secondary" };
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-bg-surface rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-text-primary font-heading font-bold text-lg">Assinaturas anteriores</h2>
          <button type="button" onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-accent-green" />
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 px-4 py-3 bg-accent-red/10 rounded-lg mb-4">
            <AlertCircle className="w-4 h-4 text-accent-red shrink-0" />
            <p className="text-accent-red text-sm font-body">{error}</p>
          </div>
        )}

        {applyError && (
          <div className="flex items-center gap-2 px-4 py-3 bg-accent-amber/10 rounded-lg mb-4">
            <AlertCircle className="w-4 h-4 text-accent-amber shrink-0" />
            <p className="text-accent-amber text-sm font-body">{applyError}</p>
          </div>
        )}

        {!loading && !error && visibleSignatures.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <p className="text-text-muted text-sm font-body">Nenhuma assinatura anterior</p>
          </div>
        )}

        {!loading && visibleSignatures.length > 0 && (
          <div className="space-y-4">
            <p className="text-xs text-text-muted font-body">
              {visibleSignatures.length === 1
                ? "1 assinatura"
                : `${visibleSignatures.length} de ${Math.min(apiTotal, 12)} assinaturas`}
            </p>

            <div className="grid grid-cols-3 gap-3">
              {visibleSignatures.map((sig) => {
                const badge = getStatusBadge(sig.status);
                const isActive = sig.status === "active";
                const canApplySig = canApply(identityState) && !isActive;

                return (
                  <div key={sig.id} className="space-y-2">
                    <div className="aspect-square rounded-lg overflow-hidden bg-bg-elevated border border-border-light relative">
                      <span className={`absolute top-1.5 left-1.5 px-1.5 py-0.5 text-[10px] font-heading font-semibold rounded ${badge.className} leading-tight`}>
                        {badge.label}
                      </span>
                      <img src={sig.assetUrl} alt={`Versão ${sig.attempt}`} className="w-full h-full object-contain" />
                    </div>
                    <span className="block text-center text-xs text-text-muted font-body">
                      {formatDate(sig.created_at)}
                    </span>
                    {isActive ? (
                      <div className="w-full px-2 py-1.5 bg-accent-green text-white font-heading font-semibold text-xs rounded-lg text-center">
                        Ativa
                      </div>
                    ) : canApplySig ? (
                      <button
                        type="button"
                        onClick={() => handleApply(sig.id)}
                        disabled={applyingId === sig.id}
                        className="w-full px-2 py-1.5 bg-accent-green text-white font-heading font-semibold text-xs rounded-lg hover:brightness-110 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-1"
                      >
                        {applyingId === sig.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          "Aplicar"
                        )}
                      </button>
                    ) : (
                      <span
                        className="block w-full px-2 py-1.5 bg-bg-hover text-text-muted font-heading font-semibold text-xs rounded-lg text-center cursor-not-allowed"
                        title={getBlockedTooltip(identityState)}
                      >
                        Indisponível
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {apiTotal > rawSignatures.length && !hasLoadedSecondBatch && (
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="w-full px-4 py-2.5 border border-border-light text-text-primary font-heading font-semibold text-sm rounded-lg hover:bg-bg-elevated transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loadingMore ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : null}
                Carregar versões anteriores
              </button>
            )}
          </div>
        )}

        <div className="mt-6 space-y-2">
          {onGenerateNew && (
            <button
              type="button"
              onClick={onGenerateNew}
              className="w-full px-4 py-2.5 bg-accent-green text-white font-heading font-semibold text-sm rounded-lg hover:brightness-110 transition-all duration-200 flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Gerar nova assinatura
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="w-full px-4 py-2.5 border border-border-light text-text-primary font-heading font-semibold text-sm rounded-lg hover:bg-bg-elevated transition-all duration-200"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
