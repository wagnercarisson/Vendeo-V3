"use client";

import { LabTextarea } from "../../_components/lab-textarea";

/**
 * Editor manual do prompt da bancada (F48.2.2, D3).
 *
 * O prompt é **manual**. O branding da loja é apenas exibido/registrado — **não**
 * é concatenado automaticamente ao prompt nem enviado ao modelo. Este componente
 * não faz nenhuma composição: mostra exatamente o texto informado pelo operador.
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
        hint="Prompt manual — o branding não é concatenado automaticamente."
        onChange={(event) => onChange(event.target.value)}
      />
    </section>
  );
}
