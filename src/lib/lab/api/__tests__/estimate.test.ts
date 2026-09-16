import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const { mockResolveAiCost } = vi.hoisted(() => ({ mockResolveAiCost: vi.fn() }));

vi.mock("@/lib/ai-cost/cost-estimator", () => ({
  resolveAiCost: mockResolveAiCost,
}));

import { estimateExperimentPlan, LAB_EXPERIMENT_NOT_FOUND } from "../estimate";
import type { CostResolution } from "@/lib/ai-cost/types";

/**
 * F48.1 (D11/D14) — estimativa do plano do experimento.
 *
 * Client fake em memória: nenhuma chamada de rede e nenhuma chamada paga.
 */

type Row = Record<string, unknown>;

const EXPERIMENT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const EXPERIMENT: Row = {
  id: EXPERIMENT_ID,
  model_target: { provider: "openai", model: "gpt-5.5", protocol: "responses" },
  repetitions: 2,
  max_runs: 6,
};

/** Fake do client Supabase com o subconjunto usado pela estimativa. */
function createFakeClient(tables: Record<string, Row[]>): SupabaseClient {
  return {
    from(table: string) {
      const rows = tables[table] ?? [];
      const filters: Array<[string, unknown]> = [];
      const matched = (): Row[] =>
        rows.filter((row) => filters.every(([column, value]) => row[column] === value));

      const builder = {
        select: () => builder,
        eq(column: string, value: unknown) {
          filters.push([column, value]);
          return builder;
        },
        async maybeSingle() {
          return { data: matched()[0] ?? null, error: null };
        },
        then(
          resolve: (value: unknown) => unknown,
          reject?: (reason: unknown) => unknown,
        ) {
          const data = matched();
          return Promise.resolve({ data, count: data.length, error: null }).then(resolve, reject);
        },
      };

      return builder;
    },
  } as unknown as SupabaseClient;
}

function tablesFor(params: {
  experiment?: Row | null;
  usedRuns?: number;
  scenarioCount?: number;
}): Record<string, Row[]> {
  return {
    lab_experiments: params.experiment ? [params.experiment] : [],
    lab_runs: Array.from({ length: params.usedRuns ?? 0 }, (_, index) => ({
      id: `run-${index}`,
      experiment_id: EXPERIMENT_ID,
    })),
    lab_experiment_scenarios: Array.from({ length: params.scenarioCount ?? 0 }, (_, index) => ({
      id: `scenario-${index}`,
      experiment_id: EXPERIMENT_ID,
    })),
  };
}

const COMPLETE_COST: CostResolution = {
  estimatedCostUsd: 0.05,
  costSource: "pricing_table",
  pricingVersion: "11111111-1111-4111-8111-111111111111",
  textComponentUsd: 0.02,
  imageToolComponentUsd: 0.03,
};

const PARTIAL_COST: CostResolution = {
  estimatedCostUsd: 0.05,
  costSource: "pricing_table",
  costEstimationNote: "provisional_image_tool_unit_cost_without_text_usage",
};

const MISSING_COST: CostResolution = {
  estimatedCostUsd: null,
  costSource: "not_available",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockResolveAiCost.mockResolvedValue(COMPLETE_COST);
});

describe("estimateExperimentPlan — plano por componente com cobertura", () => {
  it("3 cenários × 2 repetições ⇒ plannedRuns 6 e remainingRuns = max_runs − usados", async () => {
    const client = createFakeClient(
      tablesFor({ experiment: EXPERIMENT, usedRuns: 1, scenarioCount: 3 }),
    );

    const estimate = await estimateExperimentPlan({ client, experimentId: EXPERIMENT_ID });

    expect(estimate.plannedRuns).toBe(6);
    expect(estimate.remainingRuns).toBe(5);
  });

  it("cobertura complete com pricing_table e os dois componentes presentes", async () => {
    const client = createFakeClient(
      tablesFor({ experiment: EXPERIMENT, usedRuns: 0, scenarioCount: 3 }),
    );

    const estimate = await estimateExperimentPlan({ client, experimentId: EXPERIMENT_ID });

    expect(estimate.perRunCoverage).toBe("complete");
    expect(estimate.coverage).toBe("complete");
    expect(estimate.totalEstimatedUsd).toBeCloseTo(0.3, 6);
  });

  it("cobertura partial com nota de estimativa — não bloqueia e projeta o total", async () => {
    mockResolveAiCost.mockResolvedValue(PARTIAL_COST);
    const client = createFakeClient(
      tablesFor({ experiment: EXPERIMENT, usedRuns: 2, scenarioCount: 3 }),
    );

    const estimate = await estimateExperimentPlan({ client, experimentId: EXPERIMENT_ID });

    expect(estimate.perRunCoverage).toBe("partial");
    expect(estimate.coverage).toBe("partial");
    expect(estimate.totalEstimatedUsd).toBeCloseTo(0.3, 6);
    expect(estimate.remainingRuns).toBe(4);
  });

  it("cobertura missing ⇒ estimatedCostUsd null e totalEstimatedUsd null, sem lançar", async () => {
    mockResolveAiCost.mockResolvedValue(MISSING_COST);
    const client = createFakeClient(
      tablesFor({ experiment: EXPERIMENT, usedRuns: 0, scenarioCount: 3 }),
    );

    await expect(
      estimateExperimentPlan({ client, experimentId: EXPERIMENT_ID }),
    ).resolves.toMatchObject({
      perRunCoverage: "missing",
      coverage: "missing",
      totalEstimatedUsd: null,
    });
  });

  it("remainingRuns nunca fica negativo mesmo com runs acima do teto", async () => {
    const client = createFakeClient(
      tablesFor({ experiment: EXPERIMENT, usedRuns: 9, scenarioCount: 3 }),
    );

    const estimate = await estimateExperimentPlan({ client, experimentId: EXPERIMENT_ID });

    expect(estimate.remainingRuns).toBe(0);
  });

  it("experimento inexistente ⇒ experiment_not_found", async () => {
    const client = createFakeClient(tablesFor({ experiment: null, scenarioCount: 0 }));

    await expect(
      estimateExperimentPlan({ client, experimentId: EXPERIMENT_ID }),
    ).rejects.toThrow(LAB_EXPERIMENT_NOT_FOUND);
  });
});
