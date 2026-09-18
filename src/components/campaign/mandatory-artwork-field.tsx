"use client";

import { useId } from "react";
import { FieldHint } from "@/components/ui/field-hint";
import {
  MANDATORY_ARTWORK_HINT,
  MANDATORY_ARTWORK_LABEL,
  MANDATORY_ARTWORK_PLACEHOLDER,
} from "@/lib/campaign/field-guidance";

interface MandatoryArtworkFieldProps {
  value: string;
  onChange: (value: string) => void;
}

export function MandatoryArtworkField({ value, onChange }: MandatoryArtworkFieldProps) {
  // O id do próprio campo permanece estático (`mandatoryArtworkText`) para
  // preservar `htmlFor`/`getByLabelText`; apenas o id de ajuda deriva de `useId`
  // (padrão canônico F49 — precedente `lab-textarea.tsx`).
  const helpBase = useId();
  const hintId = `${helpBase}-hint`;

  return (
    <div>
      <label
        htmlFor="mandatoryArtworkText"
        className="block text-text-muted text-xs font-heading font-medium uppercase tracking-wider mb-2"
      >
        {MANDATORY_ARTWORK_LABEL}{" "}
        <span className="font-normal normal-case tracking-normal text-text-disabled">
          (opcional)
        </span>
      </label>
      <textarea
        id="mandatoryArtworkText"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={MANDATORY_ARTWORK_PLACEHOLDER}
        maxLength={200}
        rows={3}
        aria-describedby={hintId}
        className="min-h-[44px] w-full bg-bg-surface border border-border-light rounded-lg px-3.5 py-2.5 text-text-primary text-sm font-body placeholder:text-text-muted transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent-blue/20 resize-none hover:border-text-muted"
      />
      <FieldHint id={hintId}>{MANDATORY_ARTWORK_HINT}</FieldHint>
    </div>
  );
}
