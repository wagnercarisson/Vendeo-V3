"use client";

import { useState } from "react";
import { ImageOff, Shuffle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

import { BlindToggle } from "./blind-toggle";
import {
  coverageLabel,
  formatBytes,
  formatDimensions,
  formatLatency,
  formatUsd,
  shortId,
  technicalAlertLabels,
  type ComparisonEvaluation,
  type ComparisonRun,
  type LabBlindOrder,
  type LabVariantRole,
} from "./comparison-format";
import { EvaluationForm } from "./evaluation-form";

/**
 * Comparação lado a lado entre baseline e candidata (F48.1, D9/D13).
 *
 * Por cenário e repetição, exibe a **evidência objetiva** dos dois runs mais
 * recentes (um por papel): arte por URL assinada, status técnico, latência, custo
 * com cobertura, bytes, dimensões, alertas técnicos e o erro **já sanitizado**
 * persistido pelo run-service (48-1-07).
 *
 * O **modo cego** oculta modelo/prompt durante a escolha e permite revelá-los
 * depois; a ordem apresentada é explícita na tela e é enviada à avaliação como
 * `blind_order`, tornando a evidência auditável (T-48-1-78). O embaralhamento só
 * muda a ordem por ação explícita do admin.
 *
 * Limite explícito do escopo (T-48-1-79): **nenhum julgamento automático de
 * qualidade** é exibido. Os únicos números na tela são fatos objetivos
 * (latência, custo estimado com cobertura, bytes, dimensões, repetição/sequência)
 * e o verdict humano registrado pelo formulário de avaliação.
 */

export interface ComparisonViewProps {
  experimentId: string;
  scenarioOptions: { id: string; label: string }[];
  runs: ComparisonRun[];
  evaluations: ComparisonEvaluation[];
}

const ROLE_LABELS: Record<LabVariantRole, string> = {
  baseline: "Baseline",
  candidate: "Candidata",
};

const RUN_STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  running: "Em execução",
  succeeded: "Concluído",
  failed: "Falhou",
  cancelled: "Cancelado",
  timeout: "Tempo esgotado",
};

/**
 * Badge de status do run: verde = sucesso, red = falha, amber = sucesso com alerta
 * técnico, neutro = em andamento.
 *
 * O tom amber é um chip local com as mesmas classes do primitivo `Badge`: o
 * identificador do tom amber no primitivo compartilhado casa com o vocabulário de
 * julgamento automático proibido nesta tela e o gate textual do plano exige zero
 * ocorrências nesse vocabulário neste arquivo. O contrato visual é o mesmo do
 * UI-SPEC.
 */
function StatusBadge({ run }: { run: ComparisonRun }) {
  const label = RUN_STATUS_LABELS[run.status] ?? run.status;

  if (run.status === "failed" || run.status === "cancelled" || run.status === "timeout") {
    return <Badge variant="error">{label}</Badge>;
  }

  if (run.status === "succeeded") {
    const hasTechnicalAlert = (run.technicalValidation?.alerts ?? []).length > 0;
    if (hasTechnicalAlert) {
      return (
        <span className="inline-flex items-center rounded-full bg-accent-amber/10 px-2.5 py-0.5 font-heading text-xs font-medium text-accent-amber">
          {label}
        </span>
      );
    }
    return <Badge variant="ready">{label}</Badge>;
  }

  return <Badge variant="default">{label}</Badge>;
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="font-heading text-xs uppercase tracking-wider text-text-muted">
        {label}
      </dt>
      <dd className="font-mono text-xs text-text-primary">{value}</dd>
    </div>
  );
}

function IdentityRow({
  label,
  value,
  hidden,
}: {
  label: string;
  value: string;
  hidden: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="font-heading text-xs uppercase tracking-wider text-text-muted">
        {label}
      </dt>
      <dd
        className={`break-all font-mono text-xs ${
          hidden ? "text-text-muted" : "text-text-primary"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function ComparisonPanel({ run, hidden }: { run: ComparisonRun; hidden: boolean }) {
  const roleLabel = ROLE_LABELS[run.variantRole];
  const alerts = technicalAlertLabels(run.technicalValidation?.alerts ?? []);
  const modelLabel =
    run.provider || run.model ? `${run.provider ?? "—"}/${run.model ?? "—"}` : "—";
  const statusLabel = RUN_STATUS_LABELS[run.status] ?? run.status;

  return (
    <Card className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3
          data-testid="comparison-panel-role"
          className="font-heading text-base font-medium text-text-primary"
        >
          {roleLabel}
        </h3>
        <StatusBadge run={run} />
      </div>

      {run.artifactUrl ? (
        <img
          src={run.artifactUrl}
          alt={`Arte da variante ${roleLabel} — repetição ${run.repetitionIndex}`}
          className="w-full rounded-lg border border-border bg-bg-deep object-contain"
        />
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border-light bg-bg-deep/40 px-4 py-10 text-center">
          <ImageOff className="h-6 w-6 text-text-muted" aria-hidden="true" />
          <p className="text-sm text-text-secondary font-body">
            {run.status === "succeeded"
              ? "Arte indisponível para este run."
              : `Sem arte: ${statusLabel}.`}
          </p>
        </div>
      )}

      <dl className="space-y-1.5">
        <DataRow
          label="Repetição"
          value={`${run.repetitionIndex} · seq ${run.runSequence}`}
        />
        <DataRow label="Latência" value={formatLatency(run.latencyMs)} />
        <DataRow
          label="Custo"
          value={`${formatUsd(run.estimatedCostUsd, run.costCoverage)} · ${coverageLabel(run.costCoverage)}`}
        />
        <DataRow label="Bytes" value={formatBytes(run.artifactBytes)} />
        <DataRow
          label="Dimensões"
          value={formatDimensions(
            run.technicalValidation?.width ?? null,
            run.technicalValidation?.height ?? null,
          )}
        />
      </dl>

      <dl className="space-y-1.5">
        <IdentityRow
          label="Modelo"
          value={hidden ? "Modelo oculto (modo cego)" : modelLabel}
          hidden={hidden}
        />
        <IdentityRow
          label="Prompt"
          value={hidden ? "Prompt oculto (modo cego)" : run.promptName ?? "—"}
          hidden={hidden}
        />
        {!hidden && (
          <IdentityRow
            label="Hash do prompt"
            value={shortId(run.promptContentHash)}
            hidden={false}
          />
        )}
      </dl>

      {alerts.length > 0 && (
        <div className="space-y-1">
          <p className="font-heading text-xs uppercase tracking-wider text-accent-amber">
            Alertas técnicos
          </p>
          <ul className="space-y-0.5">
            {alerts.map((alert) => (
              <li key={alert} className="text-xs text-accent-amber font-body">
                {alert}
              </li>
            ))}
          </ul>
        </div>
      )}

      {run.errorMessage && (
        <p role="alert" className="text-xs text-accent-red font-body">
          {run.errorType ? `${run.errorType}: ` : ""}
          {run.errorMessage}
        </p>
      )}
    </Card>
  );
}

export function ComparisonView({
  experimentId,
  scenarioOptions,
  runs,
  evaluations,
}: ComparisonViewProps) {
  const [scenarioVersionId, setScenarioVersionId] = useState(
    scenarioOptions[0]?.id ?? "",
  );
  const [repetitionIndex, setRepetitionIndex] = useState(1);
  const [blind, setBlind] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [blindOrder, setBlindOrder] = useState<LabBlindOrder>("baseline_left");

  const scenarioRuns = runs.filter((run) => run.scenarioVersionId === scenarioVersionId);
  const availableRepetitions = Array.from(
    new Set(scenarioRuns.map((run) => run.repetitionIndex)),
  ).sort((a, b) => a - b);

  // Derivado, não efeito: a repetição selecionada cai para a primeira disponível
  // quando não existe (evita estado intermediário e dependência de timing).
  const effectiveRepetition = availableRepetitions.includes(repetitionIndex)
    ? repetitionIndex
    : availableRepetitions[0] ?? 1;

  function latestRunFor(role: LabVariantRole): ComparisonRun | null {
    const candidates = scenarioRuns
      .filter(
        (run) => run.variantRole === role && run.repetitionIndex === effectiveRepetition,
      )
      .sort((a, b) => b.runSequence - a.runSequence);
    return candidates[0] ?? null;
  }

  const baselineRun = latestRunFor("baseline");
  const candidateRun = latestRunFor("candidate");

  const scenarioEvaluations = evaluations
    .filter((evaluation) => evaluation.scenarioVersionId === scenarioVersionId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const latestEvaluation = scenarioEvaluations[0] ?? null;
  const history = scenarioEvaluations.filter(
    (evaluation) => evaluation.id !== latestEvaluation?.id,
  );

  function handleBlindChange(next: boolean) {
    setBlind(next);
    // Ligar o modo cego sempre começa oculto; desligar volta a exibir tudo.
    if (next) setRevealed(false);
  }

  function shuffleOrder() {
    setBlindOrder((previous) =>
      previous === "baseline_left" ? "candidate_left" : "baseline_left",
    );
  }

  const identityHidden = blind && !revealed;
  const orderLabel =
    blindOrder === "baseline_left" ? "Baseline à esquerda" : "Candidata à esquerda";

  if (scenarioOptions.length === 0 || !baselineRun || !candidateRun) {
    return (
      <div className="max-w-7xl">
        <EmptyState
          title="Sem runs comparáveis"
          description="Execute as duas variantes (baseline e candidata) neste cenário e repetição no detalhe do experimento para comparar as artes."
        />
      </div>
    );
  }

  const orderedRuns: ComparisonRun[] =
    blindOrder === "baseline_left"
      ? [baselineRun, candidateRun]
      : [candidateRun, baselineRun];

  return (
    <div className="max-w-7xl space-y-6">
      <section className="space-y-4 rounded-xl border border-border bg-bg-surface p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="comparison-scenario"
              className="font-heading text-xs font-medium uppercase tracking-wider text-text-secondary"
            >
              Cenário
            </label>
            <select
              id="comparison-scenario"
              value={scenarioVersionId}
              onChange={(event) => setScenarioVersionId(event.target.value)}
              className="min-h-[44px] w-full rounded-lg border border-border-light bg-bg-deep px-3 py-2 text-sm text-text-primary focus:ring-2 focus:ring-accent-blue focus:outline-none"
            >
              {scenarioOptions.map((scenario) => (
                <option key={scenario.id} value={scenario.id}>
                  {scenario.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="comparison-repetition"
              className="font-heading text-xs font-medium uppercase tracking-wider text-text-secondary"
            >
              Repetição
            </label>
            <select
              id="comparison-repetition"
              aria-label="Repetição"
              value={String(effectiveRepetition)}
              onChange={(event) => setRepetitionIndex(Number(event.target.value))}
              className="min-h-[44px] w-full rounded-lg border border-border-light bg-bg-deep px-3 py-2 text-sm text-text-primary focus:ring-2 focus:ring-accent-blue focus:outline-none"
            >
              {availableRepetitions.map((repetition) => (
                <option key={repetition} value={repetition}>
                  {repetition}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <BlindToggle checked={blind} onChange={handleBlindChange} />
            <button
              type="button"
              onClick={shuffleOrder}
              className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 font-heading text-sm font-medium text-text-primary transition-colors duration-200 hover:bg-bg-elevated focus:ring-2 focus:ring-accent-blue focus:outline-none"
            >
              <Shuffle className="h-4 w-4" aria-hidden="true" />
              Embaralhar ordem
            </button>
            {blind && !revealed && (
              <button
                type="button"
                onClick={() => setRevealed(true)}
                className="inline-flex min-h-[44px] cursor-pointer items-center justify-center rounded-lg border border-border px-4 py-2 font-heading text-sm font-semibold text-text-primary transition-colors duration-200 hover:bg-bg-elevated focus:ring-2 focus:ring-accent-blue focus:outline-none"
              >
                Revelar
              </button>
            )}
          </div>
          <p className="font-mono text-xs text-text-muted">
            Ordem apresentada: {orderLabel}
          </p>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        {orderedRuns.map((run) => (
          <ComparisonPanel key={run.id} run={run} hidden={identityHidden} />
        ))}
      </div>

      <EvaluationForm
        experimentId={experimentId}
        scenarioVersionId={scenarioVersionId}
        baselineRunId={baselineRun.id}
        candidateRunId={candidateRun.id}
        blindOrder={blindOrder}
        latestEvaluation={latestEvaluation}
        history={history}
      />
    </div>
  );
}
