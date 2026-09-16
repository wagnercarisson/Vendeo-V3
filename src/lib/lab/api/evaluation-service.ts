import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { LabEvaluationRequest } from "@/lib/admin/schemas";
import { transitionExperiment } from "@/lib/lab/domain/experiment-service";
import { parseCreateLabEvaluationInput } from "@/lib/lab/domain/schemas";

/**
 * Registro da avaliação humana do Laboratório de IA (F48.1, D13/D14).
 *
 * Garantias:
 *  - os dois runs comparados precisam existir, pertencer ao **mesmo experimento**
 *    e à **mesma versão de cenário**, estar em estado **terminal** e apontar para
 *    as variantes `baseline`/`candidate` corretas — qualquer divergência recusa o
 *    registro e **nada** é persistido;
 *  - o módulo é **append-only**: nunca executa update nem remoção em
 *    `lab_human_evaluations` (reforçado por trigger de banco);
 *  - o experimento em `running` transita para `evaluated` (avaliar não encerra
 *    execuções: um novo run reservado devolve o experimento a `running`); uma
 *    falha dessa transição **não** desfaz a avaliação já gravada.
 */

export type InvalidComparisonRunsCode = "invalid_comparison_runs" | "runs_not_terminal";

/** Recusa determinística da avaliação (a rota mapeia para 400). */
export class InvalidComparisonRunsError extends Error {
  readonly code: InvalidComparisonRunsCode;

  constructor(code: InvalidComparisonRunsCode) {
    super(code);
    this.name = "InvalidComparisonRunsError";
    this.code = code;
  }
}

type Row = Record<string, unknown>;

const TERMINAL_RUN_STATUSES = ["succeeded", "failed", "cancelled", "timeout"] as const;

function asRows(data: unknown): Row[] {
  return Array.isArray(data) ? (data as Row[]) : [];
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * Registra uma avaliação humana validada.
 *
 * Passos: valida a forma (schema de domínio) → lê os dois runs → valida
 * experimento/cenário/estado terminal → valida os papéis das variantes →
 * insere a avaliação → (se o experimento estiver `running`) transita para
 * `evaluated`.
 */
export async function createEvaluation(params: {
  client: SupabaseClient;
  experimentId: string;
  evaluatorId: string;
  input: LabEvaluationRequest;
}): Promise<{ evaluationId: string; createdAt: string }> {
  const input = parseCreateLabEvaluationInput(params.input);

  const { data: runs, error: runsError } = await params.client
    .from("lab_runs")
    .select("id, experiment_id, variant_id, scenario_version_id, status")
    .in("id", [input.baselineRunId, input.candidateRunId]);

  if (runsError) {
    throw new Error(`lab_runs_read_failed:${runsError.message}`);
  }

  const runRows = asRows(runs);
  const baselineRun = runRows.find((run) => text(run.id) === input.baselineRunId);
  const candidateRun = runRows.find((run) => text(run.id) === input.candidateRunId);

  if (!baselineRun || !candidateRun) {
    throw new InvalidComparisonRunsError("invalid_comparison_runs");
  }

  const sameExperiment =
    text(baselineRun.experiment_id) === params.experimentId &&
    text(candidateRun.experiment_id) === params.experimentId;
  const sameScenarioVersion =
    text(baselineRun.scenario_version_id) === input.scenarioVersionId &&
    text(candidateRun.scenario_version_id) === input.scenarioVersionId &&
    text(baselineRun.scenario_version_id) === text(candidateRun.scenario_version_id);

  if (!sameExperiment || !sameScenarioVersion) {
    throw new InvalidComparisonRunsError("invalid_comparison_runs");
  }

  const terminalStatuses: readonly string[] = TERMINAL_RUN_STATUSES;
  if (
    !terminalStatuses.includes(text(baselineRun.status)) ||
    !terminalStatuses.includes(text(candidateRun.status))
  ) {
    throw new InvalidComparisonRunsError("runs_not_terminal");
  }

  const { data: variants, error: variantsError } = await params.client
    .from("lab_experiment_variants")
    .select("id, role")
    .in("id", [text(baselineRun.variant_id), text(candidateRun.variant_id)]);

  if (variantsError) {
    throw new Error(`lab_experiment_variants_read_failed:${variantsError.message}`);
  }

  const variantRows = asRows(variants);
  const baselineVariant = variantRows.find((variant) => text(variant.id) === text(baselineRun.variant_id));
  const candidateVariant = variantRows.find((variant) => text(variant.id) === text(candidateRun.variant_id));

  if (baselineVariant?.role !== "baseline" || candidateVariant?.role !== "candidate") {
    throw new InvalidComparisonRunsError("invalid_comparison_runs");
  }

  const { data: inserted, error: insertError } = await params.client
    .from("lab_human_evaluations")
    .insert({
      experiment_id: params.experimentId,
      scenario_version_id: input.scenarioVersionId,
      baseline_run_id: input.baselineRunId,
      candidate_run_id: input.candidateRunId,
      blind_order: input.blindOrder ?? null,
      verdict: input.verdict,
      observation: input.observation ?? null,
      evaluator_id: params.evaluatorId,
    })
    .select("id, created_at")
    .single();

  if (insertError || !inserted) {
    throw new Error(
      `lab_evaluation_insert_failed:${insertError?.message ?? "missing_evaluation_id"}`,
    );
  }

  const insertedRow = inserted as unknown as Row;

  const { data: experiment } = await params.client
    .from("lab_experiments")
    .select("status")
    .eq("id", params.experimentId)
    .maybeSingle();

  if (experiment && (experiment as Row).status === "running") {
    try {
      await transitionExperiment(params.experimentId, "evaluated", {
        actorId: params.evaluatorId,
        client: params.client,
      });
    } catch {
      // A avaliação é append-only: uma falha de transição não a desfaz.
    }
  }

  return {
    evaluationId: text(insertedRow.id),
    createdAt: text(insertedRow.created_at),
  };
}
