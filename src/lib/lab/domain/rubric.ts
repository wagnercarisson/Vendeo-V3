import { z } from "zod";

/**
 * Rubrica humana estruturada do Diretor (F48.2.1, D7).
 *
 * Módulo **puro** — sem `server-only`, sem I/O e sem `process.env`. Importável
 * pelo formulário de cliente e pelos testes.
 *
 * A rubrica cobre **nove** critérios; cada critério recebe um estado
 * (`adequate`/`minor_defect`/`critical_defect`/`not_applicable`) e observação
 * opcional. Nenhuma função de agregação numérica é exportada aqui: a decisão de
 * qualidade é integralmente humana (D7). A avaliação é a fonte de qualidade —
 * nenhuma pontuação automática de beleza, composição, apelo comercial,
 * profissionalismo ou "publicável" é calculada em nenhum caminho.
 */

// ─── Critérios (nove, em ordem canônica) ─────────────────────────────────────

/**
 * Chaves canônicas dos nove critérios, em inglês e na ordem de exibição.
 * `identity_fidelity` inclui explicitamente a fidelidade do logo.
 */
export const RUBRIC_CRITERIA = [
  "data_fidelity",
  "product_fidelity",
  "identity_fidelity",
  "legibility",
  "visual_hierarchy",
  "commercial_intent_coherence",
  "no_invented_information",
  "professional_appearance",
  "publish_confidence",
] as const;

export type RubricCriterion = (typeof RUBRIC_CRITERIA)[number];

/** Rótulos PT-BR dos nove critérios (para a UI). Sem emoji. */
export const RUBRIC_CRITERION_LABELS: Record<RubricCriterion, string> = {
  data_fidelity: "Fidelidade dos dados",
  product_fidelity: "Fidelidade do produto",
  identity_fidelity: "Fidelidade da identidade (incluindo logo)",
  legibility: "Legibilidade",
  visual_hierarchy: "Hierarquia visual",
  commercial_intent_coherence: "Coerência com a intenção comercial",
  no_invented_information: "Ausência de informação inventada",
  professional_appearance: "Aparência profissional",
  publish_confidence: "Confiança para publicação",
};

// ─── Estados (quatro) ────────────────────────────────────────────────────────

/** Estados possíveis de um critério da rubrica. */
export const RUBRIC_STATES = [
  "adequate",
  "minor_defect",
  "critical_defect",
  "not_applicable",
] as const;

export type RubricState = (typeof RUBRIC_STATES)[number];

/** Rótulos PT-BR dos quatro estados (para a UI). Sem emoji. */
export const RUBRIC_STATE_LABELS: Record<RubricState, string> = {
  adequate: "Adequado",
  minor_defect: "Defeito menor",
  critical_defect: "Defeito crítico",
  not_applicable: "Não aplicável",
};

// ─── Schema tipado dos nove critérios ────────────────────────────────────────

/** Estado + observação opcional de **um** critério. */
export const RubricCriterionStateSchema = z
  .object({
    state: z.enum(RUBRIC_STATES),
    observation: z.string().max(2000).optional(),
  })
  .strict();

export type RubricCriterionState = z.infer<typeof RubricCriterionStateSchema>;

/**
 * Rubrica completa: os **nove** critérios são obrigatórios; a observação por
 * critério é opcional. `.strict()` impede chaves desconhecidas.
 */
export const LabRubricSchema = z
  .object({
    data_fidelity: RubricCriterionStateSchema,
    product_fidelity: RubricCriterionStateSchema,
    identity_fidelity: RubricCriterionStateSchema,
    legibility: RubricCriterionStateSchema,
    visual_hierarchy: RubricCriterionStateSchema,
    commercial_intent_coherence: RubricCriterionStateSchema,
    no_invented_information: RubricCriterionStateSchema,
    professional_appearance: RubricCriterionStateSchema,
    publish_confidence: RubricCriterionStateSchema,
  })
  .strict();

export type LabRubric = z.infer<typeof LabRubricSchema>;

// ─── Validadores puros (sem agregação numérica) ──────────────────────────────

/**
 * `true` somente quando os nove critérios estão presentes e cada um traz um
 * estado válido. Não calcula nenhum valor numérico.
 */
export function isRubricComplete(
  rubric: Partial<LabRubric> | null | undefined,
): rubric is LabRubric {
  if (!rubric) return false;
  return RUBRIC_CRITERIA.every((criterion) => {
    const entry = rubric[criterion];
    if (!entry) return false;
    return (RUBRIC_STATES as readonly string[]).includes(entry.state);
  });
}

/** `true` quando ao menos um critério está em `critical_defect`. */
export function rubricHasCriticalDefect(rubric: LabRubric): boolean {
  return RUBRIC_CRITERIA.some((criterion) => rubric[criterion].state === "critical_defect");
}
