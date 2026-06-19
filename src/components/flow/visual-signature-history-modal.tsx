"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, X, AlertCircle, CheckCircle2, RotateCcw } from "lucide-react";

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
  onRestore: () => void;
}

export function VisualSignatureHistoryModal({
  isOpen,
  onClose,
  storeId,
  onRestore,
}: VisualSignatureHistoryModalProps) {
  const [signatures, setSignatures] = useState<HistorySignature[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    setError(null);
    setRestoreError(null);

    fetch(`/api/store/${storeId}/visual-signature`)
      .then(res => res.json())
      .then(data => {
        setSignatures(data?.signatures ?? []);
        setLoading(false);
      })
      .catch(() => {
        setError("Erro ao carregar assinaturas anteriores");
        setLoading(false);
      });
  }, [isOpen, storeId]);

  const handleRestore = useCallback(async (signatureId: string) => {
    setRestoringId(signatureId);
    setRestoreError(null);

    try {
      const res = await fetch(`/api/store/${storeId}/visual-signature/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signature_id: signatureId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setRestoreError(data.error || "Erro ao restaurar assinatura");
        setRestoringId(null);
        return;
      }

      if (data.success === false && data.drift) {
        if (data.drift.reason === "critical_drift") {
          setRestoreError("Os dados da loja mudaram desde esta assinatura. Gere uma nova versão.");
        } else if (data.drift.reason === "missing_metadata") {
          setRestoreError("Assinatura antiga não pode ser restaurada. Gere uma nova versão.");
        } else {
          setRestoreError("Não foi possível restaurar esta assinatura.");
        }
        setRestoringId(null);
        return;
      }

      onRestore();
      onClose();
    } catch {
      setRestoreError("Erro de conexão. Tente novamente.");
      setRestoringId(null);
    }
  }, [storeId, onRestore, onClose]);

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

  const getRestoreTooltip = (eligibility: HistorySignature["restore_eligibility"]): string | null => {
    if (eligibility.can_restore) return null;
    if (eligibility.reason === "critical_drift") {
      return "Os dados da loja mudaram desde esta assinatura. Gere uma nova versão.";
    }
    if (eligibility.reason === "missing_metadata") {
      return "Assinatura antiga não pode ser restaurada. Gere uma nova versão.";
    }
    return "Não é possível restaurar esta assinatura.";
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

        {restoreError && (
          <div className="flex items-center gap-2 px-4 py-3 bg-accent-amber/10 rounded-lg mb-4">
            <AlertCircle className="w-4 h-4 text-accent-amber shrink-0" />
            <p className="text-accent-amber text-sm font-body">{restoreError}</p>
          </div>
        )}

        {!loading && !error && signatures.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <p className="text-text-muted text-sm font-body">Nenhuma assinatura anterior encontrada</p>
          </div>
        )}

        {!loading && signatures.length > 0 && (
          <div className="space-y-4">
            {signatures.map((sig) => (
              <div
                key={sig.id}
                className="flex gap-4 p-4 bg-bg-elevated rounded-xl border border-border-light"
              >
                <div className="w-16 h-16 rounded-lg overflow-hidden bg-bg-surface border border-border-light shrink-0">
                  <img src={sig.assetUrl} alt={`Assinatura ${sig.attempt}`} className="w-full h-full object-contain" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-text-primary font-heading font-semibold text-sm">
                      Versão {sig.attempt}
                    </span>
                    <span className={`text-[10px] font-heading font-medium px-1.5 py-0.5 rounded-full ${
                      sig.status === "active"
                        ? "text-accent-green bg-accent-green/10"
                        : "text-text-muted bg-bg-surface"
                    }`}>
                      {sig.status === "active" ? "Ativa" : sig.status === "archived" ? "Arquivada" : sig.status}
                    </span>
                  </div>
                  <p className="text-text-muted text-xs font-body mt-0.5">
                    {formatDate(sig.created_at)}
                  </p>
                  {sig.art_direction?.visual_direction && (
                    <p className="text-text-muted text-xs font-body mt-1 truncate">
                      {sig.art_direction.visual_direction}
                    </p>
                  )}
                  {sig.status !== "active" && (
                    <div className="mt-2">
                      {sig.restore_eligibility.can_restore ? (
                        <button
                          type="button"
                          onClick={() => handleRestore(sig.id)}
                          disabled={restoringId === sig.id}
                          className="px-3 py-1.5 bg-accent-green text-white font-heading font-semibold text-xs rounded-lg hover:brightness-110 transition-all duration-200 flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {restoringId === sig.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <RotateCcw className="w-3 h-3" />
                          )}
                          Restaurar
                        </button>
                      ) : (
                        <span
                          className="text-text-muted text-xs font-body cursor-help"
                          title={getRestoreTooltip(sig.restore_eligibility) ?? ""}
                        >
                          Restauro indisponível
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6">
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
