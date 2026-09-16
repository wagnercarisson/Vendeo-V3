import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { estimateLabCampaignImageCost } from "@/lib/ai/lab-cost-estimate";
import type { CostResolution } from "@/lib/ai-cost/types";
import { deriveCostCoverage } from "@/lib/lab/domain/cost-coverage";
import type { LabCostCoverage } from "@/lib/lab/domain/cost-coverage";

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

export interface LabExperimentPlanEstimate {
  /** Estimativa de **uma** geração (leitura pura, sem `usage`). */
  perRun: CostResolution | null;
  perRunCoverage: LabCostCoverage;
  /** `repetitions × cenários vinculados` — o plano completo do experimento. */
  plannedRuns: number;
  /** `max_runs − runs existentes`, nunca negativo. */
  remainingRuns: number;
  /** `perRun.estimatedCostUsd × plannedRuns`, ou `null` quando desconhecido. */
  totalEstimatedUsd: number | null;
  /** Cobertura agregada do plano (`complete|partial|missing`). */
  coverage: LabCostCoverage;
}

interface ExperimentEstimateRow {
  model_target: { provider: "openai" | "gemini"; model: string };
  repetitions: number;
  max_runs: number;
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
    .select("model_target, repetitions, max_runs")
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

  const plannedRuns = row.repetitions * scenarioCount;
  const remainingRuns = Math.max(0, row.max_runs - usedRuns);

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
  };
}
