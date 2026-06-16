"use client";

import { useState, useEffect } from "react";
import { AlertCircle, CheckCircle2, Loader2, X, Clock, AlertTriangle } from "lucide-react";
import type { LogoHistoryItem, DriftStatus } from "@/lib/brand-assets/types";

interface LogoRestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  storeId: string;
  onRestoreComplete: () => void;
}

function DriftBadge({ driftStatus }: { driftStatus: DriftStatus }) {
  if (driftStatus === 'drift') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-heading font-medium px-1.5 py-0.5 rounded-full text-accent-amber bg-accent-amber/10">
        <AlertTriangle className="w-3 h-3" />
        Desatualizado
      </span>
    );
  }
  if (driftStatus === 'none') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-heading font-medium px-1.5 py-0.5 rounded-full text-accent-green bg-accent-green/10">
        <CheckCircle2 className="w-3 h-3" />
        Sincronizado
      </span>
    );
  }
  return null;
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export function LogoRestoreModal({ isOpen, onClose, storeId, onRestoreComplete }: LogoRestoreModalProps) {
  const [history, setHistory] = useState<LogoHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !storeId) return;
    setLoading(true);
    setError(null);
    setRestoreError(null);
    fetch(`/api/store/${storeId}/logo/history`)
      .then(res => {
        if (!res.ok) throw new Error("Erro ao carregar histórico");
        return res.json();
      })
      .then(data => {
        const items = Array.isArray(data?.logos) ? data.logos as LogoHistoryItem[] : [];
        setHistory(items);
      })
      .catch(err => setError(err instanceof Error ? err.message : "Erro ao carregar histórico"))
      .finally(() => setLoading(false));
  }, [isOpen, storeId]);

  const handleRestore = async (assetId: string) => {
    setRestoringId(assetId);
    setRestoreError(null);
    try {
      const res = await fetch(`/api/store/${storeId}/logo/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asset_id: assetId }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: "Erro ao restaurar logotipo" }));
        throw new Error(errData.error || "Erro ao restaurar logotipo");
      }
      onRestoreComplete();
    } catch (err) {
      setRestoreError(err instanceof Error ? err.message : "Erro ao restaurar logotipo");
    } finally {
      setRestoringId(null);
    }
  };

  if (!isOpen) return null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onPointerDown={(e) => e.preventDefault()}
    >
      <div
        className="bg-bg-surface border border-border rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 pb-4 border-b border-border-light">
          <div>
            <h2 className="text-lg font-heading font-bold text-text-primary">
              Logotipos anteriores
            </h2>
            <p className="text-text-muted text-xs font-body mt-0.5">
              Selecione um logotipo para restaurar
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-bg-elevated text-text-muted hover:text-text-primary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
            </div>
          )}

          {error && (
            <div className="flex items-start gap-3 bg-accent-red/10 border border-accent-red/20 rounded-lg px-4 py-3">
              <AlertCircle className="w-5 h-5 text-accent-red shrink-0 mt-0.5" />
              <p className="text-accent-red text-sm font-body">{error}</p>
            </div>
          )}

          {!loading && !error && history.length === 0 && (
            <div className="text-center py-12">
              <Clock className="w-8 h-8 mx-auto mb-3 text-text-muted" />
              <p className="text-text-secondary text-sm font-body">Nenhum logotipo anterior encontrado.</p>
            </div>
          )}

          {!loading && !error && history.length > 0 && (
            <div className="space-y-3">
              {history.map((item) => {
                const storagePath = item.asset?.storage_path;
                const imageUrl = storagePath && supabaseUrl
                  ? `${supabaseUrl}/storage/v1/object/public/store-brand-assets/${storagePath}`
                  : null;
                const isRestoring = restoringId === item.asset.id;

                return (
                  <button
                    key={item.asset.id}
                    type="button"
                    onClick={() => handleRestore(item.asset.id)}
                    disabled={!!restoringId}
                    className="w-full text-left flex items-center gap-4 p-4 bg-bg-elevated border border-border rounded-xl hover:border-accent-blue/50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group"
                  >
                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-bg-surface border border-border-light shrink-0">
                      {imageUrl ? (
                        <img src={imageUrl} alt={`Versão ${item.version}`} className="w-full h-full object-contain" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-text-muted text-xs font-body">
                          Sem imagem
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-text-primary font-heading font-semibold text-sm">
                          Versão {item.version}
                        </p>
                        <DriftBadge driftStatus={item.drift_status} />
                      </div>
                      <p className="text-text-muted text-xs font-body mt-0.5">
                        {formatDate(item.created_at)}
                      </p>
                      {item.visual_style && (
                        <p className="text-text-muted text-xs font-body mt-0.5 truncate">
                          {item.visual_style}
                        </p>
                      )}
                    </div>
                    {isRestoring ? (
                      <Loader2 className="w-5 h-5 animate-spin text-accent-blue shrink-0" />
                    ) : (
                      <span className="text-accent-blue hover:text-accent-blue/80 text-xs font-body font-medium shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        Restaurar
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {restoreError && (
            <div className="mt-4 flex items-start gap-3 bg-accent-red/10 border border-accent-red/20 rounded-lg px-4 py-3">
              <AlertCircle className="w-5 h-5 text-accent-red shrink-0 mt-0.5" />
              <p className="text-accent-red text-sm font-body">{restoreError}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
