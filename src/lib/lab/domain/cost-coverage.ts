import type { CostResolution } from "@/lib/ai-cost/types";

/**
 * Cobertura de custo do Laboratório de IA (F48.1, D8/DV-1).
 *
 * O tipo real `CostResolution` **não** possui valor unitário de imagem nem um
 * flag booleano de parcialidade. A cobertura é, portanto, **derivada aqui** — no
 * domínio do laboratório — a partir dos campos que realmente existem, sem
 * alterar `src/lib/ai-cost/**`.
 *
 * - `missing`: não há valor estimado ou a fonte declara indisponibilidade.
 * - `partial`: o valor existe, mas a estimativa é sabidamente parcial/incompleta
 *   (ajuste manual sem origem, fallback estático, nota de estimativa presente ou
 *   tabela de pricing sem os dois componentes da fórmula).
 * - `complete`: valor com origem confiável e fórmula íntegra.
 */

export type LabCostCoverage = "complete" | "partial" | "missing";

export function deriveCostCoverage(cost: CostResolution): LabCostCoverage {
  if (cost.estimatedCostUsd === null || cost.costSource === "not_available") {
    return "missing";
  }

  const hasEstimationNote =
    cost.costEstimationNote !== undefined && cost.costEstimationNote.trim() !== "";

  if (
    cost.costSource === "manual_unknown" ||
    cost.costSource === "fallback_static" ||
    hasEstimationNote ||
    (cost.costSource === "pricing_table" &&
      (cost.textComponentUsd === undefined || cost.imageToolComponentUsd === undefined))
  ) {
    return "partial";
  }

  return "complete";
}
