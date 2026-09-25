import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { estimateLabCampaignImageCost } from "@/lib/ai/lab-cost-estimate";
import type { CostResolution } from "@/lib/ai-cost/types";
import { deriveCostCoverage } from "@/lib/lab/domain/cost-coverage";
import type { LabCostCoverage } from "@/lib/lab/domain/cost-coverage";
import { remainingUsd } from "@/lib/lab/domain/program-service";

/**
 * Estimativa do plano do experimento do Laboratório de IA (F48.1, D11/D14).
 *
 * Estima o custo de **uma** geração (`campaign_image`) via `resolveAiCost` em
 * modo leitura e projeta o plano completo (`repetitions × cenários`). O client
 * Supabase entra por parâmetro — os testes usam fakes em memória, sem rede.
 *
 * Regras financeiras (D14):
 *  - **Nunca** bloqueia por pricing incompleto: cobertura `partial`/`missing` é
 *    sinalizada no payload e a execução continua confirmável com a ressalva.
 *  - `totalEstimatedUsd` é `null` quando a estimativa por run é desconhecida —
 *    a UI exibe faixa/aviso em vez de um valor exato inventado.
 */

/** Código determinístico do experimento inexistente (a rota mapeia para 404). */
export const LAB_EXPERIMENT_NOT_FOUND = "experiment_not_found";

/**
 * Margem explícita do teto de orçamento (F48.2.1, D9). O teto autorizado no
 * Checkpoint 2 é `estimativa_total × (1 + LAB_BUDGET_MARGIN_RATIO)`. Fonte única
 * consumida pelo `budget-panel` e pelo roteiro de UAT — nunca redefinida.
 */
export const LAB_BUDGET_MARGIN_RATIO = 0.2;

/**
 * Teto de orçamento em USD a autorizar: `totalEstimatedUsd × (1 + margem)`.
 * `null` quando a estimativa total é desconhecida (pricing indisponível) — o
 * chamador exibe aviso em vez de inventar um teto.
 */
export function computeBudgetCeilingUsd(
  totalEstimatedUsd: number | null,
): number | null {
  if (totalEstimatedUsd === null) return null;
  return Number((totalEstimatedUsd * (1 + LAB_BUDGET_MARGIN_RATIO)).toFixed(6));
}

export interface LabExperimentPlanEstimate {
  /** Estimativa de **uma** geração (leitura pura, sem `usage`). */
  perRun: CostResolution | null;
  perRunCoverage: LabCostCoverage;
  /** `cenários × duas variantes × repetições` — o plano completo (D9). */
  plannedRuns: number;
  /** `max_runs − runs existentes`, nunca negativo. */
  remainingRuns: number;
  /** `perRun.estimatedCostUsd × plannedRuns`, ou `null` quando desconhecido. */
  totalEstimatedUsd: number | null;
  /** Cobertura agregada do plano (`complete|partial|missing`). */
  coverage: LabCostCoverage;
  /**
   * Saldo restante do programa vinculado
   * (`budget_usd - budget_consumed_usd - budget_reserved_usd`); `null` quando o
   * experimento não tem programa ou o orçamento ainda não foi autorizado.
   */
  programRemainingUsd: number | null;
}

interface ExperimentEstimateRow {
  model_target: { provider: "openai" | "gemini"; model: string };
  repetitions: number;
  max_runs: number;
  program_id: string | null;
}

interface ProgramEstimateRow {
  budget_usd: number | null;
  budget_reserved_usd: number;
  budget_consumed_usd: number;
}

async function countRows(
  client: SupabaseClient,
  table: "lab_runs" | "lab_experiment_scenarios",
  experimentId: string,
): Promise<number> {
  const { count, error } = await client
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("experiment_id", experimentId);

  if (error) {
    throw new Error(`lab_${table}_count_failed:${error.message}`);
  }

  return count ?? 0;
}

/**
 * Estima o plano do experimento por componente, com cobertura explícita.
 *
 * Experimento ausente ⇒ `Error("experiment_not_found")` (a rota converte em 404).
 * Qualquer outra falha é de leitura e propaga como erro interno.
 */
export async function estimateExperimentPlan(params: {
  client: SupabaseClient;
  experimentId: string;
}): Promise<LabExperimentPlanEstimate> {
  const { data: experiment, error: experimentError } = await params.client
    .from("lab_experiments")
    .select("model_target, repetitions, max_runs, program_id")
    .eq("id", params.experimentId)
    .maybeSingle();

  if (experimentError) {
    throw new Error(`lab_experiment_read_failed:${experimentError.message}`);
  }

  if (!experiment) {
    throw new Error(LAB_EXPERIMENT_NOT_FOUND);
  }

  const row = experiment as unknown as ExperimentEstimateRow;

  const [usedRuns, scenarioCount] = await Promise.all([
    countRows(params.client, "lab_runs", params.experimentId),
    countRows(params.client, "lab_experiment_scenarios", params.experimentId),
  ]);

  // D9: cenários × duas variantes (baseline/candidata) × repetições.
  const plannedRuns = scenarioCount * 2 * row.repetitions;
  const remainingRuns = Math.max(0, row.max_runs - usedRuns);

  let programRemainingUsd: number | null = null;
  if (row.program_id) {
    const { data: program, error: programError } = await params.client
      .from("lab_prompt_programs")
      .select("budget_usd, budget_reserved_usd, budget_consumed_usd")
      .eq("id", row.program_id)
      .maybeSingle();

    if (programError) {
      throw new Error(`lab_program_read_failed:${programError.message}`);
    }

    if (program) {
      programRemainingUsd = remainingUsd(program as unknown as ProgramEstimateRow);
    }
  }

  const perRun = await estimateLabCampaignImageCost({
    provider: row.model_target.provider,
    model: row.model_target.model,
  });

  const perRunCoverage = deriveCostCoverage(perRun);

  const coverage: LabCostCoverage =
    perRunCoverage === "missing"
      ? "missing"
      : perRunCoverage === "partial"
        ? "partial"
        : "complete";

  const totalEstimatedUsd =
    perRun.estimatedCostUsd === null
      ? null
      : Number((perRun.estimatedCostUsd * plannedRuns).toFixed(6));

  return {
    perRun,
    perRunCoverage,
    plannedRuns,
    remainingRuns,
    totalEstimatedUsd,
    coverage,
    programRemainingUsd,
  };
}
