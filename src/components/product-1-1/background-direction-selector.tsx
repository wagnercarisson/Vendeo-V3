"use client";

import { useId } from "react";
import { AlertCircle } from "lucide-react";
import {
  PRODUCT_1_1_BACKGROUND_LABELS,
  type ProductOneToOneBackgroundDirection,
} from "@/lib/product-1-1/background-direction";

export interface BackgroundDirectionOption {
  readonly value: ProductOneToOneBackgroundDirection;
  readonly label?: string;
  readonly hint?: string;
}

export interface BackgroundDirectionSelectorProps {
  readonly value: ProductOneToOneBackgroundDirection;
  readonly onChange: (value: ProductOneToOneBackgroundDirection) => void;
  readonly error?: string;
  readonly options?: readonly BackgroundDirectionOption[];
}

const DEFAULT_OPTIONS: readonly BackgroundDirectionOption[] = Object.freeze(
  (Object.keys(PRODUCT_1_1_BACKGROUND_LABELS) as ProductOneToOneBackgroundDirection[]).map(
    (direction) => ({
      value: direction,
      label: PRODUCT_1_1_BACKGROUND_LABELS[direction],
    }),
  ),
);

export function BackgroundDirectionSelector({
  value,
  onChange,
  error,
  options = DEFAULT_OPTIONS,
}: BackgroundDirectionSelectorProps) {
  const id = useId();
  const groupName = `product-1-1-background-${id}`;

  return (
    <section
      data-testid="product-1-1-background-selector"
      aria-labelledby={`${groupName}-heading`}
      className="flex flex-col gap-2"
    >
      <h2
        id={`${groupName}-heading`}
        className="text-sm font-semibold text-text-primary font-heading"
      >
        Direção de fundo
      </h2>
      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">Selecione a direção de fundo</legend>
        <div className="flex flex-wrap gap-4">
          {options.map((option) => {
            const optionId = `${groupName}-${option.value}`;

            return (
              <label
                key={option.value}
                htmlFor={optionId}
                className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm text-text-primary font-body"
              >
                <input
                  type="radio"
                  id={optionId}
                  name={groupName}
                  value={option.value}
                  checked={value === option.value}
                  onChange={() => onChange(option.value)}
                  className="h-4 w-4 accent-accent-blue"
                />
                <span>
                  {option.label ?? PRODUCT_1_1_BACKGROUND_LABELS[option.value]}
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
      </fieldset>
      {error && (
        <p
          role="alert"
          className="flex items-center gap-1 text-xs text-accent-red font-body"
        >
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}
    </section>
  );
}
