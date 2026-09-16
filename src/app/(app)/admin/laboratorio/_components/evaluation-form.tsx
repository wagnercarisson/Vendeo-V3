"use client";

import { useRouter } from "next/navigation";
import { AlertCircle, Check, ClipboardCheck } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";

import {
  formatDateTime,
  shortId,
  verdictLabel,
  type ComparisonEvaluation,
  type LabBlindOrder,
  type LabEvaluationVerdict,
} from "./comparison-format";

/**
 * Registro da avaliação humana da comparação (F48.1, D13/T-48-1-77).
 *
 * O formulário registra o **verdict humano** (`baseline|candidate|tie|none`),
 * observação livre e a ordem cega apresentada, sempre com os **runs efetivamente
 * comparados** (`baseline_run_id`/`candidate_run_id`) — a rota/serviço (48-1-08)
 * valida o par e o banco é append-only (trigger anti-UPDATE/DELETE).
 *
 * Reavaliar **nunca** atualiza nem remove: um novo `POST` cria um registro e a
 * avaliação anterior permanece no histórico. A tela exibe a avaliação mais recente
 * e o histórico anterior em `<details>`.
 *
 * Limite explícito do escopo: nenhum julgamento automático de qualidade é
 * calculado ou exibido — a decisão é integralmente humana.
 */

export interface EvaluationFormProps {
  experimentId: string;
  scenarioVersionId: string;
  baselineRunId: string;
  candidateRunId: string;
  blindOrder: LabBlindOrder;
  latestEvaluation: ComparisonEvaluation | null;
  history: ComparisonEvaluation[];
}

const VERDICT_OPTIONS: LabEvaluationVerdict[] = ["baseline", "candidate", "tie", "none"];

const BLIND_ORDER_LABELS: Record<LabBlindOrder, string> = {
  baseline_left: "Baseline à esquerda",
  candidate_left: "Candidata à esquerda",
};

const API_ERROR_MESSAGES: Record<string, string> = {
  invalid_comparison_runs:
    "Os runs comparados não formam um par válido: precisam ser do mesmo experimento e da mesma versão de cenário, com os papéis baseline e candidata",
  runs_not_terminal:
    "Um dos runs comparados ainda não terminou — aguarde a conclusão e registre a avaliação de novo",
  invalid_payload: "Os dados enviados são inválidos. Revise a seleção e tente novamente",
  environment_blocked: "O laboratório está bloqueado neste ambiente",
};

function describeApiError(code: unknown, status: number): string {
  if (typeof code === "string" && API_ERROR_MESSAGES[code]) {
    return API_ERROR_MESSAGES[code];
  }
  return `Não foi possível registrar a avaliação (erro ${status}). Tente novamente`;
}

function EvaluationSummary({
  evaluation,
  label,
}: {
  evaluation: ComparisonEvaluation;
  label: string;
}) {
  return (
    <div data-testid="evaluation-entry" className="space-y-1.5 rounded-lg border border-border bg-bg-deep/40 p-3">
      <p className="font-heading text-xs uppercase tracking-wider text-text-muted">
        {label}
      </p>
      <p
        data-testid="evaluation-verdict"
        className="font-heading text-sm font-medium text-text-primary"
      >
        {verdictLabel(evaluation.verdict)}
      </p>
      {evaluation.observation && (
        <p className="text-sm text-text-secondary font-body">{evaluation.observation}</p>
      )}
      <dl className="space-y-1 pt-1">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="font-heading text-xs uppercase tracking-wider text-text-muted">
            Avaliador
          </dt>
          <dd data-testid="evaluation-evaluator" className="font-mono text-xs text-text-primary">
            {shortId(evaluation.evaluatorId)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="font-heading text-xs uppercase tracking-wider text-text-muted">
            Registrada em
          </dt>
          <dd data-testid="evaluation-created-at" className="font-mono text-xs text-text-primary">
            {formatDateTime(evaluation.createdAt)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="font-heading text-xs uppercase tracking-wider text-text-muted">
            Runs comparados
          </dt>
          <dd data-testid="evaluation-runs" className="font-mono text-xs text-text-primary">
            {shortId(evaluation.baselineRunId)} · {shortId(evaluation.candidateRunId)}
          </dd>
        </div>
        {evaluation.blindOrder && (
          <div className="flex items-baseline justify-between gap-3">
            <dt className="font-heading text-xs uppercase tracking-wider text-text-muted">
              Ordem cega
            </dt>
            <dd className="font-mono text-xs text-text-primary">
              {BLIND_ORDER_LABELS[evaluation.blindOrder]}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}

export function EvaluationForm({
  experimentId,
  scenarioVersionId,
  baselineRunId,
  candidateRunId,
  blindOrder,
  latestEvaluation,
  history,
}: EvaluationFormProps) {
  const router = useRouter();
  const [verdict, setVerdict] = useState<LabEvaluationVerdict | null>(null);
  const [observation, setObservation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!verdict) return;

    setSubmitting(true);
    setSubmitError(null);
    setConfirmation(null);

    try {
      const response = await fetch(
        `/api/admin/laboratorio/experiments/${experimentId}/evaluations`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scenarioVersionId,
            baselineRunId,
            candidateRunId,
            verdict,
            blindOrder,
            observation: observation.trim() || undefined,
          }),
        },
      );

      const data = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        setSubmitError(describeApiError(data.error, response.status));
        setSubmitting(false);
        return;
      }

      setConfirmation("Avaliação registrada.");
      setVerdict(null);
      setObservation("");
      setSubmitting(false);
      router.refresh();
    } catch {
      setSubmitError(
        "Não foi possível registrar a avaliação. Verifique a conexão e tente novamente",
      );
      setSubmitting(false);
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-border bg-bg-surface p-5">
      <h2 className="font-heading text-lg font-semibold text-text-primary">
        Avaliação humana
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <fieldset className="flex flex-col gap-2">
          <legend className="font-heading text-xs font-medium uppercase tracking-wider text-text-secondary">
            Qual versão você escolheria?
          </legend>
          <div className="flex flex-wrap gap-4">
            {VERDICT_OPTIONS.map((option) => {
              const optionId = `lab-verdict-${option}`;
              return (
                <label
                  key={option}
                  htmlFor={optionId}
                  className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm text-text-primary font-body"
                >
                  <input
                    type="radio"
                    id={optionId}
                    name="lab-verdict"
                    value={option}
                    checked={verdict === option}
                    onChange={() => setVerdict(option)}
                    className="h-4 w-4 accent-accent-blue"
                  />
                  <span>{verdictLabel(option)}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="lab-evaluation-observation"
            className="font-heading text-xs font-medium uppercase tracking-wider text-text-secondary"
          >
            Observação
          </label>
          <textarea
            id="lab-evaluation-observation"
            aria-label="Observação"
            value={observation}
            onChange={(event) => setObservation(event.target.value)}
            placeholder="O que motivou a escolha (opcional)"
            className="min-h-[88px] w-full rounded-lg border border-border-light bg-bg-deep px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-blue focus:ring-2 focus:ring-accent-blue/30 focus:outline-none"
          />
        </div>

        <p className="font-mono text-xs text-text-muted" data-testid="evaluation-blind-order">
          Ordem cega apresentada: {BLIND_ORDER_LABELS[blindOrder]}
        </p>

        {submitError && (
          <p
            role="alert"
            className="flex items-center gap-1 text-sm text-accent-red font-body"
          >
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            {submitError}
          </p>
        )}

        {confirmation && (
          <p
            role="status"
            className="flex items-center gap-1 text-sm text-accent-green font-body"
          >
            <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
            {confirmation}
          </p>
        )}

        <div className="flex justify-end">
          <Button type="submit" disabled={!verdict} loading={submitting}>
            <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
            Registrar avaliação
          </Button>
        </div>
      </form>

      {latestEvaluation ? (
        <EvaluationSummary evaluation={latestEvaluation} label="Avaliação mais recente" />
      ) : (
        <p className="text-sm text-text-secondary font-body">
          Nenhuma avaliação registrada para este cenário ainda.
        </p>
      )}

      {history.length > 0 && (
        <details className="rounded-lg border border-border bg-bg-deep/40 p-3">
          <summary className="cursor-pointer font-heading text-xs uppercase tracking-wider text-text-secondary">
            Histórico de avaliações ({history.length})
          </summary>
          <div className="mt-3 space-y-2">
            {history.map((evaluation) => (
              <EvaluationSummary
                key={evaluation.id}
                evaluation={evaluation}
                label="Avaliação anterior"
              />
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
