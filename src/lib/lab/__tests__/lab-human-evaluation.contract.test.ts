// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  LabRubricSchema,
  RUBRIC_CRITERIA,
  RUBRIC_CRITERION_LABELS,
  RUBRIC_STATE_LABELS,
  RUBRIC_STATES,
  isRubricComplete,
  rubricHasCriticalDefect,
} from "@/lib/lab/domain/rubric";
import { CreateLabEvaluationInputSchema } from "@/lib/lab/domain/schemas";
import { VALID_RUBRIC, buildValidRubric } from "@/lib/lab/domain/__tests__/rubric-fixture";

/**
 * Contrato nº 3 (48-2-1-04) — **avaliação humana estruturada** (D7).
 *
 * Prova a rubrica de nove critérios (estado + observação opcional), a ausência
 * de qualquer agregação numérica e a persistência append-only com os runs
 * comparados validados. Fake client em memória — nenhuma chamada de rede e
 * nenhuma chamada paga. A decisão de qualidade é humana.
 */

describe("rubrica — módulo puro (D7)", () => {
  it("tem exatamente nove critérios, incluindo a fidelidade da identidade", () => {
    expect(RUBRIC_CRITERIA).toHaveLength(9);
    expect(new Set(RUBRIC_CRITERIA).size).toBe(9);
    expect(RUBRIC_CRITERIA).toContain("identity_fidelity");
  });

  it("tem os quatro estados previstos", () => {
    expect([...RUBRIC_STATES]).toEqual([
      "adequate",
      "minor_defect",
      "critical_defect",
      "not_applicable",
    ]);
  });

  it("rotula os nove critérios e os quatro estados em pt-BR", () => {
    for (const criterion of RUBRIC_CRITERIA) {
      expect(RUBRIC_CRITERION_LABELS[criterion]).toBeTruthy();
    }
    for (const state of RUBRIC_STATES) {
      expect(RUBRIC_STATE_LABELS[state]).toBeTruthy();
    }
  });

  it("aceita a rubrica completa e a observação opcional por critério", () => {
    expect(LabRubricSchema.safeParse(VALID_RUBRIC).success).toBe(true);

    const withObservation = buildValidRubric({
      legibility: { state: "minor_defect", observation: "Preço pouco contrastado." },
    });
    const parsed = LabRubricSchema.safeParse(withObservation);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.legibility.observation).toBe("Preço pouco contrastado.");
    }
  });

  it("recusa rubrica com critério faltante", () => {
    const incomplete = { ...VALID_RUBRIC } as Record<string, unknown>;
    delete incomplete.legibility;
    expect(LabRubricSchema.safeParse(incomplete).success).toBe(false);
  });

  it("recusa estado inválido em qualquer critério", () => {
    const result = LabRubricSchema.safeParse({
      ...VALID_RUBRIC,
      legibility: { state: "great" },
    });
    expect(result.success).toBe(false);
  });

  it("não exporta nenhuma função de agregação", async () => {
    const module = await import("@/lib/lab/domain/rubric");
    expect(Object.keys(module).sort()).toEqual(
      [
        "LabRubricSchema",
        "RUBRIC_CRITERIA",
        "RUBRIC_CRITERION_LABELS",
        "RUBRIC_STATES",
        "RUBRIC_STATE_LABELS",
        "RubricCriterionStateSchema",
        "isRubricComplete",
        "rubricHasCriticalDefect",
      ].sort(),
    );
  });

  it("isRubricComplete exige os nove critérios e rubricHasCriticalDefect sinaliza defeito crítico", () => {
    expect(isRubricComplete(VALID_RUBRIC)).toBe(true);
    expect(isRubricComplete({ data_fidelity: { state: "adequate" } })).toBe(false);
    expect(isRubricComplete(null)).toBe(false);

    expect(rubricHasCriticalDefect(VALID_RUBRIC)).toBe(true);
    expect(
      rubricHasCriticalDefect(buildValidRubric({ identity_fidelity: { state: "adequate" } })),
    ).toBe(false);
  });
});

describe("CreateLabEvaluationInputSchema — rubrica obrigatória (D7)", () => {
  const base = {
    scenarioVersionId: "11111111-1111-4111-8111-111111111111",
    baselineRunId: "22222222-2222-4222-8222-222222222222",
    candidateRunId: "33333333-3333-4333-8333-333333333333",
    verdict: "tie" as const,
  };

  it("aceita a avaliação com a rubrica dos nove critérios", () => {
    expect(CreateLabEvaluationInputSchema.safeParse({ ...base, rubric: VALID_RUBRIC }).success).toBe(
      true,
    );
  });

  it("recusa a avaliação sem rubrica", () => {
    expect(CreateLabEvaluationInputSchema.safeParse(base).success).toBe(false);
  });
});
