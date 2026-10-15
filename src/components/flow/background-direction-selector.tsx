"use client";

import type { ProductOneToOneBackgroundDirection } from "@/lib/product-1-1/background-direction";

/**
 * F56.2b1b (B1B-D1 / UI-SPEC Surface 1): seletor EXCLUSIVO do novo fluxo
 * Produto 1:1 (`Direção de fundo`). Espelha verbatim o styling do
 * `IntentSelector` legado (radio rows) e usa as labels humanas da UI-SPEC
 * (enums internos permanecem internos). Só é montado sob elegibilidade
 * server-side — em `off` o formulário legado segue intacto.
 */
const BACKGROUND_DIRECTION_OPTIONS: ReadonlyArray<{
  readonly value: ProductOneToOneBackgroundDirection;
  readonly label: string;
}> = [
  { value: "studio", label: "Estúdio" },
  { value: "ambient", label: "Ambientado" },
  { value: "original", label: "Original" },
];

interface BackgroundDirectionSelectorProps {
  /**
   * F56.2b2b (P1): valor PODE estar AUSENTE (`undefined`/`null`) quando a fonte
   * não foi resolvida — nesse caso NENHUMA opção aparece marcada (nunca `studio`
   * silencioso). O usuário precisa escolher explicitamente.
   */
  value?: ProductOneToOneBackgroundDirection | null;
  onChange: (direction: ProductOneToOneBackgroundDirection) => void;
  disabled?: boolean;
  /** F56.2b2b (P1): erro de campo exibido sob o seletor (escolha obrigatória). */
  error?: string | null;
}

export function BackgroundDirectionSelector({
  value,
  onChange,
  disabled = false,
  error = null,
}: BackgroundDirectionSelectorProps) {
  return (
    <fieldset className="space-y-2" data-testid="flow-background-direction-selector">
      <legend className="block text-text-muted text-xs font-heading font-medium uppercase tracking-wider mb-2">
        Direção de fundo
      </legend>
      <div className="space-y-2">
        {BACKGROUND_DIRECTION_OPTIONS.map((option) => (
          <label
            key={option.value}
            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
              value === option.value
                ? "border-accent-green bg-accent-green/5"
                : "border-border-light hover:border-text-muted"
            }`}
          >
            <input
              type="radio"
              name="backgroundDirection"
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              disabled={disabled}
              aria-invalid={error ? true : undefined}
              className="h-4 w-4 accent-accent-green"
            />
            <span className="text-text-primary text-sm font-body flex-1">
              {option.label}
            </span>
          </label>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-accent-red text-xs font-body">
          {error}
        </p>
      )}
    </fieldset>
  );
}
