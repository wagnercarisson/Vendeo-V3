"use client";

import { AlertCircle, CheckCircle2, PenLine, RotateCcw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LabTextarea } from "../../../_components/lab-textarea";

/**
 * Editor e aprovação do prompt de expansão (quick 261107-qvo). Não usa
 * compositor comercial, políticas de formato ou versões de compositor.
 */

export type BenchExpandPromptStatus =
  | "idle"
  | "edited"
  | "approved"
  | "invalidated";

interface BenchExpandPromptPanelProps {
  value: string;
  promptVersion: string;
  status: BenchExpandPromptStatus;
  onChange: (value: string) => void;
  onApprove: () => void;
  onReset: () => void;
  disabled?: boolean;
}

const STATUS_LABELS: Record<BenchExpandPromptStatus, string> = {
  idle: "Prompt não aprovado",
  edited: "Prompt editado — aprove para liberar a estimativa",
  approved: "Prompt aprovado",
  invalidated: "Aprovação invalidada — revise e aprove novamente",
};

export function BenchExpandPromptPanel({
  value,
  promptVersion,
  status,
  onChange,
  onApprove,
  onReset,
  disabled = false,
}: BenchExpandPromptPanelProps) {
  return (
    <section
      data-testid="bench-expand-prompt-panel"
      className="space-y-4 rounded-xl border border-border bg-bg-surface p-5"
      aria-labelledby="bench-expand-prompt-title"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id="bench-expand-prompt-title"
          className="font-heading text-lg font-semibold text-text-primary"
        >
          Prompt de expansão
        </h2>
        <Badge variant="default">Versão · {promptVersion}</Badge>
      </div>

      <LabTextarea
        label="Prompt de expansão (editável)"
        value={value}
        rows={10}
        disabled={disabled}
        hint="O texto aprovado é enviado integralmente, sem instruções comerciais adicionais."
        onChange={(event) => onChange(event.target.value)}
      />

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          data-testid="bench-expand-approve-button"
          onClick={onApprove}
          disabled={disabled || status === "approved" || value.trim().length === 0}
        >
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          Aprovar prompt de expansão
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          data-testid="bench-expand-reset-prompt"
          onClick={onReset}
          disabled={disabled}
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Restaurar prompt inicial
        </Button>
      </div>

      <p
        data-testid="bench-expand-prompt-status"
        className={`flex items-center gap-2 text-sm font-body ${
          status === "approved"
            ? "text-accent-green"
            : status === "invalidated"
              ? "text-accent-amber"
              : "text-text-secondary"
        }`}
      >
        {status === "approved" ? (
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
        ) : status === "invalidated" ? (
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
        ) : (
          <PenLine className="h-4 w-4" aria-hidden="true" />
        )}
        {STATUS_LABELS[status]}
      </p>
    </section>
  );
}
