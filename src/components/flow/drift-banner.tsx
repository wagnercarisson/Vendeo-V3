"use client";

import { Loader2 } from "lucide-react";

interface DriftBannerProps {
  onRealinhar: () => Promise<void>
  onIgnorar: () => Promise<void>
  isLoading: boolean
}

export function DriftBanner({ onRealinhar, onIgnorar, isLoading }: DriftBannerProps) {
  return (
    <div className="bg-bg-surface border border-border rounded-lg p-4 mb-4">
      <p className="text-text-primary text-sm font-body mb-3">
        A direção visual da sua loja pode estar desatualizada. Você alterou dados importantes depois da última análise.
      </p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onRealinhar}
          disabled={isLoading}
          className="px-4 py-2 bg-accent-amber text-white font-heading font-semibold text-sm rounded-lg hover:brightness-110 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Realinhar direção visual
        </button>
        <button
          type="button"
          onClick={onIgnorar}
          disabled={isLoading}
          className="px-4 py-2 border border-border-light text-text-primary font-heading font-semibold text-sm rounded-lg hover:bg-bg-elevated transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Manter direção visual atual
        </button>
      </div>
    </div>
  );
}
