"use client";

import { AlertCircle } from "lucide-react";

interface DirectionPendingBannerProps {
  message: string;
  onRealign: () => void;
  isRealinhando: boolean;
  error: boolean;
}

/**
 * Quick 261025-svt: aviso persistente de direção visual pendente.
 * Sem opção de ignorar — a campanha permanece bloqueada até a recuperação.
 * Quick 261025-v14: o código público (DVAP01/DVRE01) aparece apenas dentro da
 * mensagem canônica — nunca UUID/referência interna em linha separada.
 */
export function DirectionPendingBanner({
  message,
  onRealign,
  isRealinhando,
  error,
}: DirectionPendingBannerProps) {
  return (
    <div
      role="alert"
      className="mb-4 flex items-start gap-3 bg-amber-900/20 border border-amber-700/30 rounded-lg px-4 py-3"
    >
      <AlertCircle className="w-5 h-5 text-accent-amber shrink-0 mt-0.5" />
      <div className="flex-1 space-y-2">
        <p className="text-accent-amber text-sm font-heading font-semibold">
          {error ? "Não foi possível verificar a direção visual" : "Direção visual pendente"}
        </p>
        <p className="text-text-muted text-xs font-body">{message}</p>
        <button
          type="button"
          onClick={onRealign}
          disabled={isRealinhando}
          aria-disabled={isRealinhando}
          className="min-h-[44px] px-4 py-2 bg-accent-amber text-white font-heading font-semibold text-sm rounded-lg hover:brightness-110 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Realinhar direção visual
        </button>
      </div>
    </div>
  );
}
