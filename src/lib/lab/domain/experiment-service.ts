import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  MAX_REPETITIONS,
  MAX_RUNS_PER_EXPERIMENT,
  MAX_SCENARIOS_PER_EXPERIMENT,
} from "@/lib/lab/limits";

import { ModelTargetNotInCatalogError, validateModelTargetAgainstCatalog } from "./model-target";
import { buildBaselinePromptSnapshot, buildCandidatePromptSnapshot } from "./prompt-snapshot";
import { parseCreateLabExperimentInput } from "./schemas";
import type { CreateLabExperimentInput, LabModelTarget } from "./schemas";

/**
 * Domínio de experimentos do Laboratório de IA (F48.1, D5/D8/D14).
 *
 * Um experimento é uma comparação **prompt-only**: alvo de modelo e parâmetros
 * fixos e idênticos para as duas variantes, e exatamente duas variantes —
 * baseline (prompt oficial atual, origem `official`) e candidata (override,
 * origem `override`).
 *
 * Garantias de implementação:
 *  - A criação é **atômica** numa única chamada da RPC `lab_create_experiment`
 *    (experimento + 2 variantes + N cenários na mesma transação). Nenhum insert
 *    PostgREST separado: uma falha no meio não deixa registro parcial.
 *  - Nenhum run é criado nem disparado aqui — todo run exige ação humana
 *    explícita (reserva atômica no 48-1-07/48-1-08).
 *  - O client entra por parâmetro em todas as funções, o que permite os fakes em
 *    memória dos testes (nenhuma chamada de rede nem chamada paga).
 *  - A configuração é editável enquanto não existe run; a partir do primeiro run
 *    ela congela (`experiment_frozen`) e alterar exige um novo experimento.
 */

// ─── Máquina de estados (LOCKED) ─────────────────────────────────────────────

export type ExperimentStatus = "draft" | "ready" | "running" | "evaluated" | "archived";

/**
 * Transições aceitas. `draft → running` é proibido (prontidão é obrigatória) e
 * `archived` é terminal. `evaluated → running` existe porque avaliar **não**
 * encerra as execuções: um novo run reservado devolve o experimento a `running`.
 *
 * A transição para `archived` é válida na máquina de estados, mas **não** é
 * exposta pela API/UI da F48.1 (arquivamento fica para a F48.2).
 */
export const EXPERIMENT_TRANSITIONS: Record<ExperimentStatus, ExperimentStatus[]> = {
  draft: ["ready"],
  ready: ["running", "archived"],
  running: ["evaluated", "archived"],
  evaluated: ["running", "archived"],
  archived: [],
};

/** Códigos objetivos de prontidão (usados em `experiment_not_ready:<reasons>`). */
export const READINESS_REASONS = [
  "missing_variants",
  "missing_scenarios",
  "too_many_scenarios",
  "invalid_repetitions",
  "invalid_max_runs",
  "unsupported_dimension",
  "model_target_not_in_catalog",
] as const;

export type ReadinessReason = (typeof READINESS_REASONS)[number];

export interface LabExperimentContext {
  actorId: string;
  client: SupabaseClient;
}

/** Recusa uma transição fora da máquina de estados. */
export function assertTransitionAllowed(from: ExperimentStatus, to: ExperimentStatus): void {
  const allowed = EXPERIMENT_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new Error(`invalid_transition:${from}->${to}`);
  }
}

// ─── Leitura auxiliar ────────────────────────────────────────────────────────

interface ExperimentConfigRow {
  status: ExperimentStatus;
  changed_dimension: string;
  repetitions: number;
  max_runs: number;
  model_target: LabModelTarget;
}

async function readExperimentConfig(
  experimentId: string,
  client: SupabaseClient,
): Promise<ExperimentConfigRow> {
  const { data, error } = await client
    .from("lab_experiments")
    .select("status, changed_dimension, repetitions, max_runs, model_target")
    .eq("id", experimentId)
    .maybeSingle();

  if (error) {
    throw new Error(`lab_experiment_read_failed:${error.message}`);
  }
  if (!data) {
    throw new Error(`experiment_not_found:${experimentId}`);
  }

  return data as unknown as ExperimentConfigRow;
}

// ─── Prontidão ───────────────────────────────────────────────────────────────

/**
 * Avalia se o experimento pode transitar para `ready`: exatamente 2 variantes
 * (`baseline` + `candidate`), entre 1 e 3 cenários, repetições e teto dentro da
 * faixa travada, dimensão `prompt` e alvo ativo no catálogo.
 *
 * Devolve códigos objetivos em `reasons` — nunca lança por configuração
 * incompleta (só por falha de leitura ou experimento inexistente).
 */
export async function computeExperimentReadiness(
  experimentId: string,
  client: SupabaseClient,
): Promise<{ ready: boolean; reasons: ReadinessReason[] }> {
  const reasons: ReadinessReason[] = [];

  const experiment = await readExperimentConfig(experimentId, client);

  const { data: variants, error: variantsError } = await client
    .from("lab_experiment_variants")
    .select("role")
    .eq("experiment_id", experimentId);

  if (variantsError) {
    throw new Error(`lab_variants_read_failed:${variantsError.message}`);
  }

  const roles = new Set(
    ((variants ?? []) as Array<{ role: string }>).map((variant) => variant.role),
  );
  if (roles.size !== 2 || !roles.has("baseline") || !roles.has("candidate")) {
    reasons.push("missing_variants");
  }

  const { data: scenarios, error: scenariosError } = await client
    .from("lab_experiment_scenarios")
    .select("id")
    .eq("experiment_id", experimentId);

  if (scenariosError) {
    throw new Error(`lab_scenarios_read_failed:${scenariosError.message}`);
  }

  const scenarioCount = (scenarios ?? []).length;
  if (scenarioCount === 0) reasons.push("missing_scenarios");
  if (scenarioCount > MAX_SCENARIOS_PER_EXPERIMENT) reasons.push("too_many_scenarios");

  if (experiment.repetitions < 1 || experiment.repetitions > MAX_REPETITIONS) {
    reasons.push("invalid_repetitions");
  }
  if (experiment.max_runs < 1 || experiment.max_runs > MAX_RUNS_PER_EXPERIMENT) {
    reasons.push("invalid_max_runs");
  }
  if (experiment.changed_dimension !== "prompt") {
    reasons.push("unsupported_dimension");
  }

  try {
    await validateModelTargetAgainstCatalog(experiment.model_target, client);
  } catch (error) {
    if (error instanceof ModelTargetNotInCatalogError) {
      reasons.push("model_target_not_in_catalog");
    } else {
      throw error;
    }
  }

  return { ready: reasons.length === 0, reasons };
}

// ─── Criação ─────────────────────────────────────────────────────────────────

/**
 * Cria o experimento com exatamente 2 variantes e N cenários, de forma atômica.
 *
 * Ordem: valida a entrada (rejeitando `model`/`configuration` **antes** de
 * qualquer escrita), valida o alvo contra o catálogo ativo e delega a gravação à
 * RPC `lab_create_experiment` — uma única transação. Nenhum run é criado.
 */
export async function createExperiment(
  input: CreateLabExperimentInput,
  context: LabExperimentContext,
): Promise<{ experimentId: string }> {
  const parsed = parseCreateLabExperimentInput(input);

  await validateModelTargetAgainstCatalog(parsed.modelTarget, context.client);

  const baselineSnapshot = buildBaselinePromptSnapshot();
  const candidateSnapshot = buildCandidatePromptSnapshot(parsed.candidate);

  const { data, error } = await context.client.rpc("lab_create_experiment", {
    p_name: parsed.name,
    p_objective: parsed.objective,
    p_hypothesis: parsed.hypothesis,
    p_model_target: parsed.modelTarget,
    p_params: parsed.params,
    p_repetitions: parsed.repetitions,
    p_max_runs: parsed.maxRuns,
    p_notes: parsed.notes ?? null,
    p_baseline_prompt: baselineSnapshot,
    p_candidate_prompt: candidateSnapshot,
    p_scenario_version_ids: parsed.scenarioVersionIds,
    p_actor_id: context.actorId,
  });

  if (error) {
    throw new Error(`lab_create_experiment_failed:${error.message}`);
  }

  const experimentId = (data as { experiment_id?: string } | null)?.experiment_id;
  if (!experimentId) {
    throw new Error("lab_create_experiment_failed:missing_experiment_id");
  }

  return { experimentId };
}

// ─── Transições ──────────────────────────────────────────────────────────────

/**
 * Aplica uma transição de estado do experimento.
 *
 * `draft → ready` exige a configuração completa (`computeExperimentReadiness`),
 * senão lança `experiment_not_ready:<reasons>`. `evaluated → running` é a regra
 * que o banco consome na reserva de um novo run (a avaliação não encerra as
 * execuções).
 */
export async function transitionExperiment(
  experimentId: string,
  to: ExperimentStatus,
  context: LabExperimentContext,
): Promise<{ status: ExperimentStatus }> {
  const experiment = await readExperimentConfig(experimentId, context.client);
  const from = experiment.status;

  assertTransitionAllowed(from, to);

  if (from === "draft" && to === "ready") {
    const readiness = await computeExperimentReadiness(experimentId, context.client);
    if (!readiness.ready) {
      throw new Error(`experiment_not_ready:${readiness.reasons.join(",")}`);
    }
  }

  const { error } = await context.client
    .from("lab_experiments")
    .update({ status: to, updated_at: new Date().toISOString() })
    .eq("id", experimentId);

  if (error) {
    throw new Error(`experiment_transition_failed:${error.message}`);
  }

  return { status: to };
}

// ─── Congelamento ────────────────────────────────────────────────────────────

/**
 * Bloqueia edição da configuração depois do primeiro run: existindo ao menos um
 * run, lança `experiment_frozen` (alterar exige um novo experimento). Sem runs, a
 * edição é permitida em `draft`/`ready`.
 *
 * O trigger de banco do 48-1-01 é o reforço estrutural desta mesma regra.
 */
export async function assertConfigurationEditable(
  experimentId: string,
  client: SupabaseClient,
): Promise<void> {
  const { data, error } = await client
    .from("lab_runs")
    .select("id")
    .eq("experiment_id", experimentId);

  if (error) {
    throw new Error(`lab_runs_read_failed:${error.message}`);
  }

  if ((data ?? []).length > 0) {
    throw new Error("experiment_frozen");
  }
}
