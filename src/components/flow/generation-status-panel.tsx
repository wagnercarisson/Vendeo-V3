"use client";

import type { ReactNode } from "react";

export interface GenerationStatusPanelAction {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

interface GenerationStatusPanelProps {
  message: string;
  action?: GenerationStatusPanelAction;
  tone?: "neutral" | "warning";
  busy?: boolean;
  children?: ReactNode;
}

/**
 * F60.7 C2/C6 — um único painel de mensagem principal por situação.
 *
 * Evita repetir o mesmo assunto em spinner + card + alerta. A região é um
 * `status` vivo educado; falhas definitivas continuam usando a superfície de
 * erro própria.
 */
export function GenerationStatusPanel({
  message,
  action,
  tone = "neutral",
  busy = false,
  children,
}: GenerationStatusPanelProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy={busy || undefined}
      data-testid="generation-status-panel"
      className={`mx-auto mb-4 max-w-md rounded-lg border p-3 text-sm ${
        tone === "warning"
          ? "border-amber-500/40 bg-amber-500/10 text-amber-900"
          : "border-border-light bg-bg-surface text-text-primary"
      }`}
    >
      <p className="font-body">{message}</p>
      {children}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          disabled={action.disabled}
          className="mt-2 inline-flex min-h-[44px] items-center justify-center rounded-lg border border-border px-3 py-2 text-sm font-semibold text-accent-blue transition-colors hover:bg-bg-elevated disabled:cursor-not-allowed disabled:opacity-50"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
