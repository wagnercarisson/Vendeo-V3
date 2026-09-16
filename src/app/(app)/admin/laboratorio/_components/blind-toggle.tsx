"use client";

import { Eye, EyeOff } from "lucide-react";

/**
 * Switch acessível do **modo de escolha cega** (F48.1, D13).
 *
 * Primitivo local da comparação (nenhum arquivo de `src/components/ui/` é criado ou
 * alterado nesta fase). Usa `role="switch"` + `aria-checked` com rótulo acessível
 * próprio, alvo de toque ≥ 44×44px e foco visível em `accent.blue`.
 *
 * O accent verde é reservado ao CTA principal e a este indicador (UI-SPEC): quando
 * o modo cego está ligado, a badge "Modo cego ativo" comunica o estado sem
 * depender apenas de cor.
 */

interface BlindToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
}

export function BlindToggle({ checked, onChange, label = "Modo cego" }: BlindToggleProps) {
  const Icon = checked ? EyeOff : Eye;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className="inline-flex min-h-[44px] min-w-[44px] cursor-pointer items-center gap-2 rounded-lg border border-border-light bg-bg-deep px-3 py-2 font-heading text-sm font-medium text-text-primary transition-colors duration-200 focus:ring-2 focus:ring-accent-blue focus:outline-none"
      >
        <span
          aria-hidden="true"
          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 ${
            checked ? "bg-accent-green" : "bg-bg-elevated"
          }`}
        >
          <span
            aria-hidden="true"
            className={`absolute h-4 w-4 rounded-full bg-text-primary transition-transform duration-200 ${
              checked ? "translate-x-[18px]" : "translate-x-0.5"
            }`}
          />
        </span>
        <Icon className="h-4 w-4 text-text-secondary" aria-hidden="true" />
        {label}
      </button>

      {checked && (
        <span className="inline-flex items-center rounded-full bg-accent-green/10 px-2.5 py-0.5 font-heading text-xs font-medium text-accent-green">
          Modo cego ativo
        </span>
      )}
    </div>
  );
}
