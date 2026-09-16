"use client";

import { AlertCircle } from "lucide-react";
import { useId, type TextareaHTMLAttributes } from "react";

/**
 * Textarea nativo do laboratório (F48.1, D12/DV-5).
 *
 * Primitivo **local** — `src/components/ui/` permanece intocado nesta fase. Usa
 * `<textarea>` semântico com rótulo associado, `aria-invalid`/`aria-describedby`
 * para o erro e `min-h` de alvo de toque, seguindo os tokens do
 * `openspec/design-system/MASTER.md`.
 */

interface LabTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: string;
  error?: string;
}

export function LabTextarea({
  label,
  hint,
  error,
  id,
  className = "",
  ...textarea
}: LabTextareaProps) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;
  const errorId = `${textareaId}-error`;
  const hintId = `${textareaId}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={textareaId}
        className="text-xs font-medium uppercase tracking-wider text-text-secondary font-heading"
      >
        {label}
      </label>
      <textarea
        id={textareaId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={`min-h-[88px] w-full rounded-lg border bg-bg-deep px-3 py-2 text-sm text-text-primary placeholder:text-text-muted outline-none transition-colors duration-200 focus:border-accent-blue focus:ring-2 focus:ring-accent-blue/30 disabled:cursor-not-allowed disabled:opacity-50 ${
          error ? "border-accent-red" : "border-border-light"
        } ${className}`}
        {...textarea}
      />
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
