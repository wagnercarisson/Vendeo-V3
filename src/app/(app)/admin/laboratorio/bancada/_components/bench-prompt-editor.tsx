"use client";

import { LabTextarea } from "../../_components/lab-textarea";

/**
 * Editor do **prompt-base** manual da bancada (F48.2.3, D17/D19).
 *
 * O prompt-base é a instrução manual do operador; o compositor determinístico o
 * preserva **integralmente** no bloco `[INSTRUÇÕES DO PROMPT-BASE]` do prompt
 * compilado — sem filtragem/reescrita lexical. O editor do **prompt compilado**
 * (compor/editar/aprovar) é o `BenchPreflightPanel`.
 */

interface BenchPromptEditorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function BenchPromptEditor({
  value,
  onChange,
  disabled = false,
}: BenchPromptEditorProps) {
  return (
    <section
      data-testid="bench-prompt-editor"
      className="rounded-xl border border-border bg-bg-surface p-5"
      aria-labelledby="bench-prompt-title"
    >
      <h2
        id="bench-prompt-title"
        className="mb-4 font-heading text-lg font-semibold text-text-primary"
      >
        Prompt
      </h2>
      <LabTextarea
        label="Prompt"
        value={value}
        disabled={disabled}
        rows={6}
        hint="Prompt-base manual — o compositor o preserva integralmente no bloco [INSTRUÇÕES DO PROMPT-BASE]."
        onChange={(event) => onChange(event.target.value)}
      />
    </section>
  );
}
