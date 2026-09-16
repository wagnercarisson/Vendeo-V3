"use client";

import { AlertCircle } from "lucide-react";

/**
 * Grupo de radios nativo do laboratório (F48.1, D12/DV-5).
 *
 * Primitivo **local** — `src/components/ui/` permanece intocado nesta fase. Usa
 * `<fieldset>`/`<legend>` + `<input type="radio">` com `<label htmlFor>`: a
 * navegação por teclado e o agrupamento por nome são nativos do navegador.
 */

export interface LabRadioOption {
  value: string;
  label: string;
  hint?: string;
}

interface LabRadioGroupProps {
  name: string;
  legend: string;
  options: LabRadioOption[];
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export function LabRadioGroup({
  name,
  legend,
  options,
  value,
  onChange,
  error,
}: LabRadioGroupProps) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-xs font-medium uppercase tracking-wider text-text-secondary font-heading">
        {legend}
      </legend>
      <div className="flex flex-wrap gap-4">
        {options.map((option) => {
          const optionId = `${name}-${option.value}`;
          return (
            <label
              key={option.value}
              htmlFor={optionId}
              className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm text-text-primary font-body"
            >
              <input
                type="radio"
                id={optionId}
                name={name}
                value={option.value}
                checked={value === option.value}
                onChange={() => onChange(option.value)}
                className="h-4 w-4 accent-accent-blue"
              />
              <span>
                {option.label}
                {option.hint && (
                  <span className="ml-1 text-xs text-text-muted">
                    {option.hint}
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </div>
      {error && (
        <p
          role="alert"
          className="flex items-center gap-1 text-xs text-accent-red font-body"
        >
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </fieldset>
  );
}
