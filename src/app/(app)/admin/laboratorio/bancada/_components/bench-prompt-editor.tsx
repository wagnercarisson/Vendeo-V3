"use client";

import { RotateCcw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { LabTextarea } from "../../_components/lab-textarea";

/**
 * Editor do **prompt-base** manual da bancada (F48.2.3, D17/D19; F48.2.4, D6/D16).
 *
 * O prompt-base é a instrução manual do operador; o compositor determinístico o
 * preserva **integralmente** no bloco `[INSTRUÇÕES DO PROMPT-BASE]` do prompt
 * compilado — sem filtragem/reescrita lexical. O editor do **prompt compilado**
 * (compor/editar/aprovar) é o `BenchPreflightPanel`.
 *
 * A F48.2.4 **semeia** este editor com o **prompt-base padrão** resolvido
 * server-side (props iniciais) — o operador vê/edita o padrão **antes** de
 * compor. Editar é ação normal; **repor o padrão é explícito** (botão opcional),
 * nunca automático: o compositor jamais substitui a edição do operador pelo
 * padrão.
 */

interface BenchPromptEditorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  /** Versão do prompt-base padrão (evidência) — exibida quando presente. */
  promptBaseVersion?: string;
  /** Reposição explícita ao padrão (opcional). */
  onResetToDefault?: () => void;
}

export function BenchPromptEditor({
  value,
  onChange,
  disabled = false,
  promptBaseVersion,
  onResetToDefault,
}: BenchPromptEditorProps) {
  return (
    <section
      data-testid="bench-prompt-editor"
      className="rounded-xl border border-border bg-bg-surface p-5"
      aria-labelledby="bench-prompt-title"
    >
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2
          id="bench-prompt-title"
          className="font-heading text-lg font-semibold text-text-primary"
        >
          Prompt
        </h2>
        {promptBaseVersion ? (
          <Badge variant="default">Prompt-base padrão · {promptBaseVersion}</Badge>
        ) : null}
      </div>
      <LabTextarea
        label="Prompt"
        value={value}
        disabled={disabled}
        rows={6}
        hint="Prompt-base manual — o compositor o preserva integralmente no bloco [INSTRUÇÕES DO PROMPT-BASE]."
        onChange={(event) => onChange(event.target.value)}
      />
      {onResetToDefault ? (
        <div className="mt-3">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            data-testid="bench-reset-prompt-base"
            onClick={onResetToDefault}
            disabled={disabled}
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Restaurar prompt-base padrão
          </Button>
        </div>
      ) : null}
    </section>
  );
}
