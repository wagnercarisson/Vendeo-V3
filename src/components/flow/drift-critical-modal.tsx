"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import { useState } from "react";

interface DriftCriticalModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  storeId: string;
  identityState: string;
  canGenerateNewSignature: boolean;
  onDismissAndSave: () => Promise<void>;
  onRemoveVs: () => Promise<void>;
  onOpenApproval: () => void;
  onCancel: () => void;
}

export function DriftCriticalModal({
  open,
  onOpenChange: _onOpenChange,
  storeId: _storeId,
  identityState: _identityState,
  canGenerateNewSignature,
  onDismissAndSave,
  onRemoveVs,
  onOpenApproval,
  onCancel,
}: DriftCriticalModalProps) {
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  if (!open) return null;

  const handleDismissAndSave = async () => {
    setIsDismissing(true);
    try {
      await onDismissAndSave();
    } finally {
      setIsDismissing(false);
    }
  };

  const handleRemoveVs = async () => {
    setIsRemoving(true);
    try {
      await onRemoveVs();
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onPointerDown={(e) => e.preventDefault()}
    >
      <div
        className="bg-bg-surface border border-border rounded-xl shadow-2xl w-full max-w-md mx-4 p-6"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-heading font-bold text-text-primary mb-2">
          Assinatura visual desatualizada
        </h2>
        <p className="text-text-secondary text-sm font-body mb-6">
          Dados importantes como nome ou segmento da loja foram alterados desde a
          criação da sua assinatura visual
        </p>

        {canGenerateNewSignature ? (
          /* ── Com crédito ── */
          <div className="space-y-3">
            <button
              type="button"
              onClick={onOpenApproval}
              className="w-full px-4 py-2.5 bg-accent-amber text-white font-heading font-semibold text-sm rounded-lg hover:brightness-110 transition-all duration-200 flex items-center justify-center gap-2"
            >
              Atualizar assinatura visual
            </button>
            <button
              type="button"
              onClick={handleDismissAndSave}
              disabled={isDismissing}
              className="w-full px-4 py-2.5 border border-border-light text-text-primary font-heading font-semibold text-sm rounded-lg hover:bg-bg-elevated transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isDismissing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Manter direção atual
            </button>
            <div className="text-center">
              <button
                type="button"
                onClick={onCancel}
                className="text-text-muted hover:text-text-primary text-xs font-body underline transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          /* ── Sem crédito ── */
          <div className="space-y-3">
            <div className="flex items-start gap-3 bg-amber-900/20 border border-amber-700/30 rounded-lg px-4 py-3">
              <AlertCircle className="w-5 h-5 text-accent-amber shrink-0 mt-0.5" />
              <p className="text-accent-amber text-sm font-body">
                Você já utilizou as 3 gerações disponíveis. Se remover esta
                assinatura, não será possível gerar uma nova até que a compra de
                créditos esteja disponível.
              </p>
            </div>

            {showRemoveConfirm ? (
              <div className="space-y-3 p-4 bg-bg-elevated border border-border rounded-lg">
                <p className="text-text-secondary text-sm font-body">
                  Tem certeza? Esta ação não pode ser desfeita. A loja ficará
                  sem assinatura visual.
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleRemoveVs}
                    disabled={isRemoving}
                    className="flex-1 px-4 py-2.5 bg-accent-red text-white font-heading font-semibold text-sm rounded-lg hover:brightness-110 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isRemoving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Sim, remover
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRemoveConfirm(false)}
                    className="flex-1 px-4 py-2.5 border border-border-light text-text-primary font-heading font-semibold text-sm rounded-lg hover:bg-bg-elevated transition-all duration-200"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleDismissAndSave}
                  disabled={isDismissing}
                  className="w-full px-4 py-2.5 border border-border-light text-text-primary font-heading font-semibold text-sm rounded-lg hover:bg-bg-elevated transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isDismissing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Manter direção atual
                </button>
                <button
                  type="button"
                  onClick={() => setShowRemoveConfirm(true)}
                  className="w-full px-4 py-2.5 border border-accent-red/30 text-accent-red font-heading font-semibold text-sm rounded-lg hover:bg-accent-red/10 transition-all duration-200"
                >
                  Remover mesmo assim
                </button>
                <button
                  type="button"
                  disabled
                  title="Funcionalidade em desenvolvimento"
                  className="w-full px-4 py-2.5 border border-border-light text-text-muted font-heading font-semibold text-sm rounded-lg cursor-not-allowed"
                >
                  Comprar créditos — Em breve
                </button>
              </>
            )}

            {!showRemoveConfirm && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={onCancel}
                  className="text-text-muted hover:text-text-primary text-xs font-body underline transition-colors"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
