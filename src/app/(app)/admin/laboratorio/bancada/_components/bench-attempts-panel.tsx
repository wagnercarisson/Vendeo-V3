"use client";

import { AlertCircle, Loader2, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/**
 * Painel de **tentativas anteriores** da bancada (F48.2.4, D12/D13/D16).
 *
 * Lista enxuta das tentativas da **linhagem explícita** (`attempt_of_run_id`, raiz
 * + descendentes), ordenada por criação, com resultado/status e a versão do
 * prompt-base usada. Oferece a ação **"Nova tentativa"**, que cria um novo run
 * reaproveitando as entradas (as imagens locais são copiadas server-side para o
 * prefixo do novo run, sem reupload manual).
 *
 * Componente **presentacional** — a criação da tentativa é delegada ao contêiner
 * (`BenchWorkbench`). Desktop-only.
 */

export interface BenchAttemptView {
  id: string;
  status: string;
  attemptOfRunId: string | null;
  createdAt: string | null;
  finishedAt: string | null;
  promptBaseVersion: string | null;
}

interface BenchAttemptsPanelProps {
  attempts: BenchAttemptView[];
  loading?: boolean;
  error?: string | null;
  /** Habilita "Nova tentativa" (existe um run terminal de origem). */
  canStartAttempt?: boolean;
  starting?: boolean;
  onNewAttempt?: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  pending: "Na fila",
  running: "Gerando…",
  succeeded: "Concluída",
  failed: "Falhou",
  cancelled: "Cancelada",
  timeout: "Expirou",
};

function badgeVariant(status: string): "ready" | "error" | "generating" | "default" {
  if (status === "succeeded") return "ready";
  if (status === "failed" || status === "timeout" || status === "cancelled") return "error";
  if (status === "running" || status === "pending") return "generating";
  return "default";
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR");
}

export function BenchAttemptsPanel({
  attempts,
  loading = false,
  error = null,
  canStartAttempt = false,
  starting = false,
  onNewAttempt,
}: BenchAttemptsPanelProps) {
  return (
    <div data-testid="bench-attempts-panel">
      <Card className="space-y-4 p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-heading text-lg font-semibold text-text-primary">
            Tentativas anteriores
          </h2>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            data-testid="bench-new-attempt-button"
            onClick={onNewAttempt}
            disabled={!canStartAttempt || starting}
            loading={starting}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Nova tentativa
          </Button>
        </div>

        {loading && (
          <p className="flex items-center gap-2 text-sm text-text-secondary font-body">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Carregando as tentativas…
          </p>
        )}

        {error && !loading && (
          <p
            role="alert"
            className="flex items-center gap-1 text-sm text-accent-red font-body"
          >
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}

        {!loading && attempts.length === 0 && (
          <p className="text-sm text-text-secondary font-body">
            Nenhuma tentativa anterior
          </p>
        )}

        {!loading && attempts.length > 0 && (
          <ul className="space-y-2">
            {attempts.map((attempt) => (
              <li
                key={attempt.id}
                data-testid={`bench-attempt-${attempt.id}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-bg-deep/40 px-3 py-2"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="break-words font-mono text-xs text-text-primary">
                    {attempt.id}
                  </span>
                  <span className="font-mono text-xs text-text-muted">
                    {formatDate(attempt.createdAt)}
                    {attempt.promptBaseVersion
                      ? ` · prompt-base ${attempt.promptBaseVersion}`
                      : ""}
                  </span>
                </div>
                <Badge variant={badgeVariant(attempt.status)}>
                  {STATUS_LABELS[attempt.status] ?? attempt.status}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
