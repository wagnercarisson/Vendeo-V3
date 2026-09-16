import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockTransitionExperiment } = vi.hoisted(() => ({
  mockTransitionExperiment: vi.fn(),
}));

vi.mock("@/lib/lab/domain/experiment-service", () => ({
  transitionExperiment: (...args: unknown[]) => mockTransitionExperiment(...args),
}));

import { InvalidComparisonRunsError, createEvaluation } from "../evaluation-service";
import { createFakeSupabaseClient } from "./fake-supabase-client";
import type { FakeRow } from "./fake-supabase-client";
import type { LabEvaluationRequest } from "@/lib/admin/schemas";

/**
 * F48.1 (D13/D14) — registro validado da avaliação humana (append-only).
 * Client fake em memória: nenhuma chamada de rede.
 */

const EXPERIMENT_ID = "55555555-5555-4555-8555-555555555555";
const OTHER_EXPERIMENT_ID = "99999999-9999-4999-8999-999999999999";
const SCENARIO_VERSION = "22222222-2222-4222-8222-222222222222";
const OTHER_SCENARIO_VERSION = "33333333-3333-4333-8333-333333333333";
const BASELINE_VARIANT = "77777777-7777-4777-8777-777777777777";
const CANDIDATE_VARIANT = "88888888-8888-4888-8888-888888888888";
const BASELINE_RUN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CANDIDATE_RUN = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const EVALUATOR_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const INPUT: LabEvaluationRequest = {
  scenarioVersionId: SCENARIO_VERSION,
  baselineRunId: BASELINE_RUN,
  candidateRunId: CANDIDATE_RUN,
  verdict: "candidate",
  blindOrder: "candidate_left",
  observation: "Candidata com preço mais legível",
};

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
} = {}): Record<string, FakeRow[]> {
  return {
    lab_runs: overrides.runs ?? [
      runRow(),
      runRow({
        id: CANDIDATE_RUN,
        variant_id: CANDIDATE_VARIANT,
      }),
    ],
    lab_experiment_variants: overrides.variants ?? [
      { id: BASELINE_VARIANT, role: "baseline" },
      { id: CANDIDATE_VARIANT, role: "candidate" },
    ],
    lab_experiments: [{ id: EXPERIMENT_ID, status: overrides.experimentStatus ?? "running" }],
    lab_human_evaluations: [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockTransitionExperiment.mockResolvedValue({ status: "evaluated" });
});

describe("createEvaluation — avaliação append-only validada", () => {
  it("persiste a avaliação com avaliador, runs comparados e ordem cega", async () => {
    const fake = createFakeSupabaseClient({ tables: tables() });

    const result = await createEvaluation({
      client: fake.client,
      experimentId: EXPERIMENT_ID,
      evaluatorId: EVALUATOR_ID,
      input: INPUT,
    });

    expect(result.evaluationId).toBeTruthy();
    expect(result.createdAt).toBeTruthy();
    expect(fake.insertCalls).toHaveLength(1);
    expect(fake.insertCalls[0].table).toBe("lab_human_evaluations");
    expect(fake.insertCalls[0].payload).toMatchObject({
      experiment_id: EXPERIMENT_ID,
      scenario_version_id: SCENARIO_VERSION,
      baseline_run_id: BASELINE_RUN,
      candidate_run_id: CANDIDATE_RUN,
      blind_order: "candidate_left",
      verdict: "candidate",
      observation: "Candidata com preço mais legível",
      evaluator_id: EVALUATOR_ID,
    });
  });

  it("recusa runs de experimentos diferentes sem persistir nada", async () => {
    const fake = createFakeSupabaseClient({
      tables: tables({
        runs: [
          runRow(),
          runRow({ id: CANDIDATE_RUN, variant_id: CANDIDATE_VARIANT, experiment_id: OTHER_EXPERIMENT_ID }),
        ],
      }),
    });

    await expect(
      createEvaluation({
        client: fake.client,
        experimentId: EXPERIMENT_ID,
        evaluatorId: EVALUATOR_ID,
        input: INPUT,
      }),
    ).rejects.toBeInstanceOf(InvalidComparisonRunsError);

    expect(fake.insertCalls).toEqual([]);
  });

  it("recusa runs de versões de cenário diferentes", async () => {
    const fake = createFakeSupabaseClient({
      tables: tables({
        runs: [
          runRow(),
          runRow({
            id: CANDIDATE_RUN,
            variant_id: CANDIDATE_VARIANT,
            scenario_version_id: OTHER_SCENARIO_VERSION,
          }),
        ],
      }),
    });

    await expect(
      createEvaluation({
        client: fake.client,
        experimentId: EXPERIMENT_ID,
        evaluatorId: EVALUATOR_ID,
        input: INPUT,
      }),
    ).rejects.toMatchObject({ code: "invalid_comparison_runs" });
  });

  it("recusa papéis trocados (baseline apontando para a variante candidata)", async () => {
    const fake = createFakeSupabaseClient({
      tables: tables({
        runs: [
          runRow({ variant_id: CANDIDATE_VARIANT }),
          runRow({ id: CANDIDATE_RUN, variant_id: BASELINE_VARIANT }),
        ],
      }),
    });

    await expect(
      createEvaluation({
        client: fake.client,
        experimentId: EXPERIMENT_ID,
        evaluatorId: EVALUATOR_ID,
        input: INPUT,
      }),
    ).rejects.toMatchObject({ code: "invalid_comparison_runs" });
    expect(fake.insertCalls).toEqual([]);
  });

  it("recusa run ainda não terminal com runs_not_terminal", async () => {
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
        input: INPUT,
      }),
    ).rejects.toMatchObject({ code: "runs_not_terminal" });
    expect(fake.insertCalls).toEqual([]);
  });

  it("recusa run inexistente sem persistir", async () => {
    const fake = createFakeSupabaseClient({ tables: tables({ runs: [runRow()] }) });

    await expect(
      createEvaluation({
        client: fake.client,
        experimentId: EXPERIMENT_ID,
        evaluatorId: EVALUATOR_ID,
        input: INPUT,
      }),
    ).rejects.toMatchObject({ code: "invalid_comparison_runs" });
    expect(fake.insertCalls).toEqual([]);
  });

  it("rejeita baseline e candidata iguais pelo schema (run_ids_must_differ)", async () => {
    const fake = createFakeSupabaseClient({ tables: tables() });

    await expect(
      createEvaluation({
        client: fake.client,
        experimentId: EXPERIMENT_ID,
        evaluatorId: EVALUATOR_ID,
        input: { ...INPUT, candidateRunId: BASELINE_RUN },
      }),
    ).rejects.toThrow(/run_ids_must_differ/);
    expect(fake.insertCalls).toEqual([]);
  });

  it("transita o experimento running para evaluated", async () => {
    const fake = createFakeSupabaseClient({ tables: tables({ experimentStatus: "running" }) });

    await createEvaluation({
      client: fake.client,
      experimentId: EXPERIMENT_ID,
      evaluatorId: EVALUATOR_ID,
      input: INPUT,
    });

    expect(mockTransitionExperiment).toHaveBeenCalledWith(EXPERIMENT_ID, "evaluated", {
      actorId: EVALUATOR_ID,
      client: fake.client,
    });
  });

  it("não transita quando o experimento já está em evaluated", async () => {
    const fake = createFakeSupabaseClient({ tables: tables({ experimentStatus: "evaluated" }) });

    await createEvaluation({
      client: fake.client,
      experimentId: EXPERIMENT_ID,
      evaluatorId: EVALUATOR_ID,
      input: INPUT,
    });

    expect(mockTransitionExperiment).not.toHaveBeenCalled();
  });

  it("falha de transição não desfaz a avaliação persistida", async () => {
    mockTransitionExperiment.mockRejectedValue(new Error("invalid_transition"));
    const fake = createFakeSupabaseClient({ tables: tables({ experimentStatus: "running" }) });

    const result = await createEvaluation({
      client: fake.client,
      experimentId: EXPERIMENT_ID,
      evaluatorId: EVALUATOR_ID,
      input: INPUT,
    });

    expect(result.evaluationId).toBeTruthy();
    expect(fake.insertCalls).toHaveLength(1);
  });

  it("nunca executa update/delete em lab_human_evaluations (append-only)", async () => {
    const fake = createFakeSupabaseClient({ tables: tables() });

    await createEvaluation({
      client: fake.client,
      experimentId: EXPERIMENT_ID,
      evaluatorId: EVALUATOR_ID,
      input: INPUT,
    });

    expect(fake.updateCalls).toEqual([]);
    expect(fake.deleteCalls).toEqual([]);
  });
});
