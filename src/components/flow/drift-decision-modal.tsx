"use client";

import { Loader2, AlertCircle } from "lucide-react";

interface DriftDecisionModalProps {
  onRealinhar: () => Promise<void>
  onIgnorar: () => Promise<void>
  onCancel: () => void
  isLoading: boolean
  error: string | null
}

export function DriftDecisionModal({ onRealinhar, onIgnorar, onCancel, isLoading, error }: DriftDecisionModalProps) {
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
          Você alterou dados importantes da loja. Deseja realinhar a direção visual ou manter a atual?
        </p>

        <div className="space-y-3">
          <button
            type="button"
            onClick={onRealinhar}
            disabled={isLoading}
            className="w-full px-4 py-2.5 bg-accent-amber text-white font-heading font-semibold text-sm rounded-lg hover:brightness-110 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Realinhar direção visual
          </button>
          <button
            type="button"
            onClick={onIgnorar}
            disabled={isLoading}
            className="w-full px-4 py-2.5 border border-border-light text-text-primary font-heading font-semibold text-sm rounded-lg hover:bg-bg-elevated transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Manter direção visual atual
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="w-full text-text-muted hover:text-text-primary text-xs font-body underline transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancelar
          </button>
        </div>

        {error && (
          <p className="flex items-center gap-1.5 text-accent-red text-xs mt-3">
            <AlertCircle className="w-3.5 h-3.5" />
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
