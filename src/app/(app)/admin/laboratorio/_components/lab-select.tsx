"use client";

import { AlertCircle } from "lucide-react";
import { useId, type ReactNode, type SelectHTMLAttributes } from "react";

/**
 * Select nativo do laboratório (F48.1, D12/DV-5).
 *
 * Primitivo **local** — `src/components/ui/` permanece intocado nesta fase. Usa o
 * elemento `<select>` semântico (teclado e leitor de tela nativos) com rótulo
 * associado, `aria-invalid`/`aria-describedby` para o erro e alvo de toque de
 * 44px, seguindo os tokens do `openspec/design-system/MASTER.md`.
 */

interface LabSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}

export function LabSelect({
  label,
  hint,
  error,
  id,
  className = "",
  children,
  ...select
}: LabSelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const errorId = `${selectId}-error`;
  const hintId = `${selectId}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={selectId}
        className="text-xs font-medium uppercase tracking-wider text-text-secondary font-heading"
      >
        {label}
      </label>
      <select
        id={selectId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={`min-h-[44px] w-full rounded-lg border bg-bg-deep px-3 py-2 text-sm text-text-primary outline-none transition-colors duration-200 focus:border-accent-blue focus:ring-2 focus:ring-accent-blue/30 disabled:cursor-not-allowed disabled:opacity-50 ${
          error ? "border-accent-red" : "border-border-light"
        } ${className}`}
        {...select}
      >
        {children}
      </select>
      {hint && !error && (
        <p id={hintId} className="text-xs text-text-muted font-body">
          {hint}
        </p>
      )}
      {error && (
        <p
          id={errorId}
          role="alert"
          className="flex items-center gap-1 text-xs text-accent-red font-body"
        >
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
