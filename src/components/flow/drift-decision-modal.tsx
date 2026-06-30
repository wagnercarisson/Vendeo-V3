"use client";

import { Loader2, AlertCircle } from "lucide-react";

interface DriftDecisionModalProps {
  onRealinhar: () => Promise<void>
  onIgnorar: () => Promise<void>
  onCancel: () => void
  isLoading: boolean
  error: string | null
  onContinueWithoutDismiss?: () => Promise<void>
}

export function DriftDecisionModal({
  onRealinhar,
  onIgnorar,
  onCancel,
  isLoading,
  error,
  onContinueWithoutDismiss,
}: DriftDecisionModalProps) {
  const isErrorState = !!error && !isLoading;

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
          Direção visual desatualizada
        </h2>
        <p className="text-text-secondary text-sm font-body mb-6">
          {isLoading
            ? "Aguarde enquanto o Vendeo realinha a direção visual da sua loja..."
            : "Você alterou dados importantes da loja. Deseja realinhar a direção visual ou manter a atual?"
          }
        </p>

        {isLoading ? (
          <div className="flex items-center justify-center gap-3 py-4">
            <Loader2 className="w-6 h-6 animate-spin text-accent-amber" />
            <span className="text-text-secondary text-sm font-body">Realinhando direção visual...</span>
          </div>
        ) : isErrorState ? (
          /* ── Estado de erro ── */
          <div className="space-y-3">
            <div className="flex items-start gap-3 bg-red-900/20 border border-red-700/30 rounded-lg px-4 py-3">
              <AlertCircle className="w-5 h-5 text-accent-red shrink-0 mt-0.5" />
              <p className="text-accent-red text-sm font-body">{error}</p>
            </div>

            <button
              type="button"
              onClick={onRealinhar}
              className="w-full px-4 py-2.5 bg-accent-amber text-white font-heading font-semibold text-sm rounded-lg hover:brightness-110 transition-all duration-200 flex items-center justify-center gap-2"
            >
              Tentar novamente
            </button>

            {onContinueWithoutDismiss && (
              <button
                type="button"
                onClick={onContinueWithoutDismiss}
                className="w-full px-4 py-2.5 border border-border-light text-text-primary font-heading font-semibold text-sm rounded-lg hover:bg-bg-elevated transition-all duration-200"
              >
                Continuar por agora
              </button>
            )}

            <button
              type="button"
              onClick={onIgnorar}
              className="w-full px-4 py-2.5 border border-border-light text-text-primary font-heading font-semibold text-sm rounded-lg hover:bg-bg-elevated transition-all duration-200"
            >
              Manter e salvar
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
          /* ── Estado normal ── */
          <div className="space-y-3">
            <button
              type="button"
              onClick={onRealinhar}
              className="w-full px-4 py-2.5 bg-accent-amber text-white font-heading font-semibold text-sm rounded-lg hover:brightness-110 transition-all duration-200 flex items-center justify-center gap-2"
            >
              Realinhar
            </button>
            <button
              type="button"
              onClick={onIgnorar}
              className="w-full px-4 py-2.5 border border-border-light text-text-primary font-heading font-semibold text-sm rounded-lg hover:bg-bg-elevated transition-all duration-200"
            >
              Manter e salvar
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
        )}
      </div>
    </div>
  );
}
