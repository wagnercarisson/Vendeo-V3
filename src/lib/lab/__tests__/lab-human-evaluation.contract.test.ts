// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockTransitionExperiment } = vi.hoisted(() => ({
  mockTransitionExperiment: vi.fn(),
}));

vi.mock("@/lib/lab/domain/experiment-service", () => ({
  transitionExperiment: (...args: unknown[]) => mockTransitionExperiment(...args),
}));

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
import { InvalidComparisonRunsError, createEvaluation } from "@/lib/lab/api/evaluation-service";
import { createFakeSupabaseClient } from "@/lib/lab/api/__tests__/fake-supabase-client";
import type { FakeRow } from "@/lib/lab/api/__tests__/fake-supabase-client";
import type { LabEvaluationRequest } from "@/lib/admin/schemas";

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

// ─── Serviço: persistência append-only com runs validados (D7) ───────────────

const EXPERIMENT_ID = "55555555-5555-4555-8555-555555555555";
const SCENARIO_VERSION = "22222222-2222-4222-8222-222222222222";
const OTHER_SCENARIO_VERSION = "33333333-3333-4333-8333-333333333333";
const BASELINE_VARIANT = "77777777-7777-4777-8777-777777777777";
const CANDIDATE_VARIANT = "88888888-8888-4888-8888-888888888888";
const BASELINE_RUN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CANDIDATE_RUN = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const EVALUATOR_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function runRow(overrides: Partial<FakeRow> = {}): FakeRow {
  return {
    id: BASELINE_RUN,
    experiment_id: EXPERIMENT_ID,
    variant_id: BASELINE_VARIANT,
    scenario_version_id: SCENARIO_VERSION,
    status: "succeeded",
    ...overrides,
  };
}

function tables(overrides: {
  runs?: FakeRow[];
  variants?: FakeRow[];
  experimentStatus?: string;
  evaluations?: FakeRow[];
} = {}): Record<string, FakeRow[]> {
  return {
    lab_runs: overrides.runs ?? [
      runRow(),
      runRow({ id: CANDIDATE_RUN, variant_id: CANDIDATE_VARIANT }),
    ],
    lab_experiment_variants: overrides.variants ?? [
      { id: BASELINE_VARIANT, role: "baseline" },
      { id: CANDIDATE_VARIANT, role: "candidate" },
    ],
    lab_experiments: [{ id: EXPERIMENT_ID, status: overrides.experimentStatus ?? "running" }],
    lab_human_evaluations: overrides.evaluations ?? [],
  };
}

function input(overrides: Record<string, unknown> = {}): LabEvaluationRequest {
  return {
    scenarioVersionId: SCENARIO_VERSION,
    baselineRunId: BASELINE_RUN,
    candidateRunId: CANDIDATE_RUN,
    verdict: "candidate",
    blindOrder: "candidate_left",
    observation: "Candidata com preço mais legível",
    rubric: VALID_RUBRIC,
    ...overrides,
  } as unknown as LabEvaluationRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockTransitionExperiment.mockResolvedValue({ status: "evaluated" });
});

describe("createEvaluation — rubrica e runs comparados (D7)", () => {
  it("registra a rubrica dos nove critérios no insert", async () => {
    const fake = createFakeSupabaseClient({ tables: tables() });

    const result = await createEvaluation({
      client: fake.client,
      experimentId: EXPERIMENT_ID,
      evaluatorId: EVALUATOR_ID,
      input: input(),
    });

    expect(result.evaluationId).toBeTruthy();
    expect(fake.insertCalls).toHaveLength(1);
    expect(fake.insertCalls[0].table).toBe("lab_human_evaluations");
    expect(fake.insertCalls[0].payload).toMatchObject({
      experiment_id: EXPERIMENT_ID,
      baseline_run_id: BASELINE_RUN,
      candidate_run_id: CANDIDATE_RUN,
      blind_order: "candidate_left",
      verdict: "candidate",
      rubric: VALID_RUBRIC,
    });
  });

  it("recusa rubrica incompleta antes de qualquer insert", async () => {
    const fake = createFakeSupabaseClient({ tables: tables() });
    const incomplete = { ...VALID_RUBRIC } as Record<string, unknown>;
    delete incomplete.legibility;

    await expect(
      createEvaluation({
        client: fake.client,
        experimentId: EXPERIMENT_ID,
        evaluatorId: EVALUATOR_ID,
        input: input({ rubric: incomplete }),
      }),
    ).rejects.toThrow();

    expect(fake.insertCalls).toEqual([]);
  });

  it("grava blind_order null sem modo cego e o valor quando há", async () => {
    const withoutBlind = createFakeSupabaseClient({ tables: tables() });
    await createEvaluation({
      client: withoutBlind.client,
      experimentId: EXPERIMENT_ID,
      evaluatorId: EVALUATOR_ID,
      input: input({ blindOrder: undefined }),
    });
    expect(withoutBlind.insertCalls[0].payload).toMatchObject({ blind_order: null });

    const withBlind = createFakeSupabaseClient({ tables: tables() });
    await createEvaluation({
      client: withBlind.client,
      experimentId: EXPERIMENT_ID,
      evaluatorId: EVALUATOR_ID,
      input: input({ blindOrder: "baseline_left" }),
    });
    expect(withBlind.insertCalls[0].payload).toMatchObject({ blind_order: "baseline_left" });
  });

  it("recusa runs de cenários diferentes com invalid_comparison_runs", async () => {
    const fake = createFakeSupabaseClient({
      tables: tables({
        runs: [
          runRow(),
          runRow({ id: CANDIDATE_RUN, variant_id: CANDIDATE_VARIANT, scenario_version_id: OTHER_SCENARIO_VERSION }),
        ],
      }),
    });

    await expect(
      createEvaluation({
        client: fake.client,
        experimentId: EXPERIMENT_ID,
        evaluatorId: EVALUATOR_ID,
        input: input(),
      }),
    ).rejects.toMatchObject({ code: "invalid_comparison_runs" });
    expect(fake.insertCalls).toEqual([]);
  });

  it("recusa runs não terminais com runs_not_terminal", async () => {
    const fake = createFakeSupabaseClient({
      tables: tables({
        runs: [runRow({ status: "running" }), runRow({ id: CANDIDATE_RUN, variant_id: CANDIDATE_VARIANT })],
      }),
    });

    await expect(
      createEvaluation({
        client: fake.client,
        experimentId: EXPERIMENT_ID,
        evaluatorId: EVALUATOR_ID,
        input: input(),
      }),
    ).rejects.toBeInstanceOf(InvalidComparisonRunsError);
    expect(fake.insertCalls).toEqual([]);
  });
});

describe("createEvaluation — histórico append-only e reinício por par (D7)", () => {
  const OTHER_BASELINE_RUN = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  const OTHER_CANDIDATE_RUN = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

  it("reavaliação cria novo registro e preserva o anterior", async () => {
    const fake = createFakeSupabaseClient({ tables: tables() });

    const first = await createEvaluation({
      client: fake.client,
      experimentId: EXPERIMENT_ID,
      evaluatorId: EVALUATOR_ID,
      input: input({ verdict: "baseline" }),
    });
    const second = await createEvaluation({
      client: fake.client,
      experimentId: EXPERIMENT_ID,
      evaluatorId: EVALUATOR_ID,
      input: input({ verdict: "candidate" }),
    });

    expect(second.evaluationId).not.toBe(first.evaluationId);
    expect(fake.insertCalls).toHaveLength(2);
    expect(fake.tables.lab_human_evaluations).toHaveLength(2);
    // O primeiro registro permanece intacto (append-only).
    expect(fake.tables.lab_human_evaluations[0]).toMatchObject({ verdict: "baseline" });
  });

  it("nunca executa update/delete em lab_human_evaluations (append-only)", async () => {
    const fake = createFakeSupabaseClient({ tables: tables() });

    await createEvaluation({
      client: fake.client,
      experimentId: EXPERIMENT_ID,
      evaluatorId: EVALUATOR_ID,
      input: input(),
    });

    expect(fake.updateCalls).toEqual([]);
    expect(fake.deleteCalls).toEqual([]);
  });

  it("reinício por par: cada avaliação persiste apenas os runs do par enviado", async () => {
    const fake = createFakeSupabaseClient({
      tables: tables({
        runs: [
          runRow(),
          runRow({ id: CANDIDATE_RUN, variant_id: CANDIDATE_VARIANT }),
          runRow({ id: OTHER_BASELINE_RUN, scenario_version_id: OTHER_SCENARIO_VERSION }),
          runRow({
            id: OTHER_CANDIDATE_RUN,
            variant_id: CANDIDATE_VARIANT,
            scenario_version_id: OTHER_SCENARIO_VERSION,
          }),
        ],
      }),
    });

    await createEvaluation({
      client: fake.client,
      experimentId: EXPERIMENT_ID,
      evaluatorId: EVALUATOR_ID,
      input: input(),
    });
    await createEvaluation({
      client: fake.client,
      experimentId: EXPERIMENT_ID,
      evaluatorId: EVALUATOR_ID,
      input: input({
        scenarioVersionId: OTHER_SCENARIO_VERSION,
        baselineRunId: OTHER_BASELINE_RUN,
        candidateRunId: OTHER_CANDIDATE_RUN,
      }),
    });

    expect(fake.insertCalls[0].payload).toMatchObject({
      scenario_version_id: SCENARIO_VERSION,
      baseline_run_id: BASELINE_RUN,
      candidate_run_id: CANDIDATE_RUN,
    });
    expect(fake.insertCalls[1].payload).toMatchObject({
      scenario_version_id: OTHER_SCENARIO_VERSION,
      baseline_run_id: OTHER_BASELINE_RUN,
      candidate_run_id: OTHER_CANDIDATE_RUN,
    });
  });

  it("não produz nenhuma métrica de qualidade automática", async () => {
    const fake = createFakeSupabaseClient({ tables: tables() });

    const result = await createEvaluation({
      client: fake.client,
      experimentId: EXPERIMENT_ID,
      evaluatorId: EVALUATOR_ID,
      input: input(),
    });

    expect(Object.keys(result).sort()).toEqual(["createdAt", "evaluationId"]);
    const payload = fake.insertCalls[0].payload as Record<string, unknown>;
    expect(payload).not.toHaveProperty("rating");
    expect(payload).not.toHaveProperty("quality");
  });
});
