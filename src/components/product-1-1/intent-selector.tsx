"use client";

import { useId } from "react";
import { AlertCircle } from "lucide-react";
import {
  PRODUCT_1_1_INTENT_LABELS,
  PRODUCT_1_1_INTENT_VALUES,
  type ProductOneToOneIntent,
} from "@/lib/product-1-1/intent-selection";

export interface ProductOneToOneIntentOption {
  readonly value: ProductOneToOneIntent;
  readonly label?: string;
  readonly hint?: string;
}

export interface IntentSelectorProps {
  readonly value: ProductOneToOneIntent;
  readonly onChange: (value: ProductOneToOneIntent) => void;
  readonly error?: string;
  readonly options?: readonly ProductOneToOneIntentOption[];
}

export function IntentSelector({
  value,
  onChange,
  error,
  options,
}: IntentSelectorProps) {
  const id = useId();
  const groupName = `product-1-1-intent-${id}`;
  const resolvedOptions: readonly ProductOneToOneIntentOption[] =
    options ??
    PRODUCT_1_1_INTENT_VALUES.map((intent) => ({
      value: intent,
      label: PRODUCT_1_1_INTENT_LABELS[intent],
    }));

  return (
    <section
      data-testid="product-1-1-intent-selector"
      aria-labelledby={`${groupName}-heading`}
      className="flex flex-col gap-2"
    >
      <h2
        id={`${groupName}-heading`}
        className="text-sm font-semibold text-text-primary font-heading"
      >
        Intenção da campanha
      </h2>
      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">Selecione a intenção da campanha</legend>
        <div className="flex flex-wrap gap-4">
          {resolvedOptions.map((option) => {
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
                  {option.label ?? PRODUCT_1_1_INTENT_LABELS[option.value]}
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
