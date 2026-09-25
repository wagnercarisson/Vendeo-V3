import type { LabRubric } from "@/lib/lab/domain/rubric";

/**
 * Fixture canônica da rubrica completa (F48.2.1, plano 04 Task 1).
 *
 * Arquivo de teste **sem** sufixo `.test` — não é coletado como suíte pelo
 * vitest. É o único ponto de verdade da rubrica válida de nove critérios;
 * os demais builders de avaliação válidos (testes deste plano e do plano 05)
 * importam `VALID_RUBRIC`/`buildValidRubric` em vez de duplicar os nove
 * critérios.
 *
 * Os quatro estados são exercitados: `adequate` (canônico), `minor_defect`,
 * `critical_defect` e `not_applicable`.
 */

const CANONICAL_RUBRIC: LabRubric = {
  data_fidelity: { state: "adequate" },
  product_fidelity: { state: "adequate" },
  identity_fidelity: { state: "critical_defect" },
  legibility: { state: "adequate" },
  visual_hierarchy: { state: "minor_defect" },
  commercial_intent_coherence: { state: "adequate" },
  no_invented_information: { state: "adequate" },
  professional_appearance: { state: "not_applicable" },
  publish_confidence: { state: "adequate" },
};

/** Rubrica canônica completa (nove critérios). */
export const VALID_RUBRIC: LabRubric = CANONICAL_RUBRIC;

/**
 * Clona a rubrica canônica aplicando overrides por critério. Devolve sempre um
 * objeto novo (nunca compartilha referências com `VALID_RUBRIC`).
 */
export function buildValidRubric(overrides: Partial<LabRubric> = {}): LabRubric {
  return {
    data_fidelity: { ...CANONICAL_RUBRIC.data_fidelity, ...overrides.data_fidelity },
    product_fidelity: { ...CANONICAL_RUBRIC.product_fidelity, ...overrides.product_fidelity },
    identity_fidelity: { ...CANONICAL_RUBRIC.identity_fidelity, ...overrides.identity_fidelity },
    legibility: { ...CANONICAL_RUBRIC.legibility, ...overrides.legibility },
    visual_hierarchy: { ...CANONICAL_RUBRIC.visual_hierarchy, ...overrides.visual_hierarchy },
    commercial_intent_coherence: {
      ...CANONICAL_RUBRIC.commercial_intent_coherence,
      ...overrides.commercial_intent_coherence,
    },
    no_invented_information: {
      ...CANONICAL_RUBRIC.no_invented_information,
      ...overrides.no_invented_information,
    },
    professional_appearance: {
      ...CANONICAL_RUBRIC.professional_appearance,
      ...overrides.professional_appearance,
    },
    publish_confidence: {
      ...CANONICAL_RUBRIC.publish_confidence,
      ...overrides.publish_confidence,
    },
  };
}
