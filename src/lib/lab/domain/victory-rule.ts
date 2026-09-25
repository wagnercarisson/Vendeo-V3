import { LAB_EVALUATION_VERDICTS } from "./schemas";

/**
 * Regra de vitória determinística do ciclo de otimização do Diretor
 * (F48.2.1, D8).
 *
 * Módulo **puro** — sem `server-only`, sem I/O e sem `process.env`. Importável
 * por testes, pela API administrativa e pelo documento do ciclo. A entrada é
 * **sempre** o verdict humano (`baseline`/`candidate`/`tie`/`none`) e, no
 * desempate, o tamanho do prompt. Nenhuma nota agregada de qualidade é
 * calculada aqui (D7/D8): a decisão é determinística sobre os verdicts.
 *
 * Regras:
 *  - **Por cenário:** a **moda** das repetições. Sem maioria estrita, o item é
 *    `inconclusive` e não conta como vitória.
 *  - **Crítico:** qualquer repetição `none` torna o item crítico
 *    (`isScenarioCritical`).
 *  - **Recomendação:** a candidata é recomendada sse **todos** os cenários
 *    terminam em `candidate` ou `tie`, com **ao menos um** `candidate` e
 *    **nenhum** `baseline`/`none`/`inconclusive`.
 *  - **Empate de qualidade:** vence a variante mais simples e curta
 *    (`pickSimplerVariant`), com `sizeDelta` e justificativa registrados.
 */

export type LabEvaluationVerdict = (typeof LAB_EVALUATION_VERDICTS)[number];

/** Resultados possíveis de um cenário após agregar as repetições. */
export const SCENARIO_OUTCOMES = [
  "baseline",
  "candidate",
  "tie",
  "none",
  "inconclusive",
] as const;

export type ScenarioOutcome = (typeof SCENARIO_OUTCOMES)[number];

/** Resultado do experimento completo (conjunto de cenários obrigatórios). */
export type ExperimentOutcome = "recommended" | "not_recommended" | "inconclusive";

/**
 * Um item é **crítico** quando qualquer repetição termina em `none` — nenhuma
 * variante foi considerada adequada. O item crítico permanece registrado e
 * impede a recomendação.
 */
export function isScenarioCritical(verdicts: readonly LabEvaluationVerdict[]): boolean {
  return verdicts.includes("none");
}

/**
 * Agrega as repetições de um cenário pela **moda**.
 *
 * Sem maioria estrita (mais da metade das repetições no mesmo verdict), o
 * resultado é `inconclusive` — que não conta como vitória. A lista vazia é
 * `inconclusive`.
 */
export function computeScenarioOutcome(
  verdicts: readonly LabEvaluationVerdict[],
): ScenarioOutcome {
  if (verdicts.length === 0) return "inconclusive";

  const counts = new Map<LabEvaluationVerdict, number>();
  for (const verdict of verdicts) {
    counts.set(verdict, (counts.get(verdict) ?? 0) + 1);
  }

  let mode: LabEvaluationVerdict | null = null;
  let highest = 0;
  for (const verdict of LAB_EVALUATION_VERDICTS) {
    const count = counts.get(verdict) ?? 0;
    if (count > highest) {
      highest = count;
      mode = verdict;
    }
  }

  if (mode === null) return "inconclusive";

  const hasStrictMajority = highest * 2 > verdicts.length;
  if (!hasStrictMajority) return "inconclusive";

  return mode;
}

/**
 * Agrega os cenários do experimento.
 *
 * - `recommended` sse todos terminam em `candidate` ou `tie`, com ao menos um
 *   `candidate` e nenhum `baseline`/`none`/`inconclusive`.
 * - `inconclusive` quando **nenhum** cenário tem maioria e **não** há
 *   regressão (`baseline`/`none`).
 * - `not_recommended` em qualquer outro caso (inclui regressão e "nenhuma
 *   adequada").
 */
export function computeExperimentOutcome(
  scenarioOutcomes: readonly ScenarioOutcome[],
): ExperimentOutcome {
  const hasRegression = scenarioOutcomes.some(
    (outcome) => outcome === "baseline" || outcome === "none",
  );
  const allCandidateOrTie = scenarioOutcomes.every(
    (outcome) => outcome === "candidate" || outcome === "tie",
  );
  const hasCandidate = scenarioOutcomes.some((outcome) => outcome === "candidate");

  if (allCandidateOrTie && hasCandidate) return "recommended";

  const allInconclusive = scenarioOutcomes.every((outcome) => outcome === "inconclusive");
  if (allInconclusive && !hasRegression) return "inconclusive";

  return "not_recommended";
}

export interface PickSimplerVariantInput {
  /** Tamanho do prompt baseline em bytes. */
  baselineSize: number;
  /** Tamanho do prompt candidata em bytes. */
  candidateSize: number;
  /** `true` quando a qualidade avaliada é equivalente (verdict `tie`). */
  qualityEqual: boolean;
}

export interface PickSimplerVariantResult {
  /** Vencedor do desempate; `null` quando não há empate de qualidade a desempatar. */
  winner: "baseline" | "candidate" | null;
  /** `candidateSize - baselineSize` (negativo ⇒ candidata mais curta). */
  sizeDelta: number;
  /** Justificativa auditável do desempate. */
  justification: string;
}

/**
 * Desempate determinístico por simplicidade (D6/D8).
 *
 * Só se aplica quando a qualidade é equivalente; nesse caso vence a variante
 * mais simples e curta. Tamanhos iguais mantêm o baseline (não há ganho de
 * simplicidade). Quando a qualidade difere, devolve `winner: null` — o vencedor
 * de qualidade decide e a simplicidade não é aplicada.
 */
export function pickSimplerVariant(
  input: PickSimplerVariantInput,
): PickSimplerVariantResult {
  const sizeDelta = input.candidateSize - input.baselineSize;

  if (!input.qualityEqual) {
    return {
      winner: null,
      sizeDelta,
      justification:
        "Qualidade difere entre as variantes: o vencedor de qualidade decide; a simplicidade só desempata empates.",
    };
  }

  if (sizeDelta < 0) {
    return {
      winner: "candidate",
      sizeDelta,
      justification: `Empate de qualidade: a candidata é ${Math.abs(sizeDelta)} bytes mais curta.`,
    };
  }

  if (sizeDelta > 0) {
    return {
      winner: "baseline",
      sizeDelta,
      justification: `Empate de qualidade: o baseline é ${sizeDelta} bytes mais curto.`,
    };
  }

  return {
    winner: "baseline",
    sizeDelta: 0,
    justification:
      "Empate de qualidade e de tamanho: mantém o baseline (sem ganho de simplicidade).",
  };
}
