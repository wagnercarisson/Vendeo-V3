// @vitest-environment node
import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { ModelTargetNotInCatalogError } from "../model-target";
import { UnsupportedChangedDimensionError } from "../schemas";
import type { CreateLabExperimentInput, LabModelTarget } from "../schemas";
import {
  EXPERIMENT_TRANSITIONS,
  assertConfigurationEditable,
  assertTransitionAllowed,
  computeExperimentReadiness,
  createExperiment,
  transitionExperiment,
} from "../experiment-service";

/**
 * Serviço de experimentos do laboratório (F48.1, D5/D8/D14).
 *
 * Client fake em memória — **nenhuma** chamada de rede e **nenhuma** chamada
 * paga. Cobre: criação atômica com 2 variantes (baseline `official` × candidata
 * `override`), atomicidade em falha da RPC, rejeição de dimensão não suportada e
 * de alvo fora do catálogo antes de qualquer escrita, prontidão com códigos
 * objetivos, máquina de estados travada e congelamento após o primeiro run.
 */

const ACTOR_ID = "99999999-9999-4999-8999-999999999999";
const SCENARIO_A = "11111111-1111-4111-8111-111111111111";
const SCENARIO_B = "22222222-2222-4222-8222-222222222222";
const SCENARIO_C = "33333333-3333-4333-8333-333333333333";
const SCENARIO_D = "44444444-4444-4444-8444-444444444444";

// ─── Tipos do banco fake ─────────────────────────────────────────────────────

interface CatalogRow {
  id: string;
  capability: string;
  provider: string;
  model: string;
  protocol: string;
  status: string;
}

interface ExperimentRow {
  id: string;
  name: string;
  objective: string;
  hypothesis: string;
  changed_dimension: string;
  primary_capability: string;
  model_target: LabModelTarget;
  params: Record<string, unknown>;
  status: string;
  repetitions: number;
  max_runs: number;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface VariantRow {
  id: string;
  experiment_id: string;
  role: string;
  label: string;
  prompt_snapshot: Record<string, unknown>;
}

interface ScenarioRow {
  id: string;
  experiment_id: string;
  scenario_version_id: string;
  position: number;
}

interface RunRow {
  id: string;
  experiment_id: string;
  variant_id: string;
  scenario_version_id: string;
  repetition_index: number;
}

interface FakeBuilder {
  select(columns: string): FakeBuilder;
  eq(column: string, value: unknown): FakeBuilder;
  update(values: Record<string, unknown>): FakeBuilder;
  maybeSingle(): Promise<{ data: unknown; error: null }>;
  then(
    onfulfilled: (value: { data: unknown[]; error: null }) => unknown,
    onrejected?: (reason: unknown) => unknown,
  ): Promise<unknown>;
}

/** Linha ativa real do catálogo para `campaign_image` (seed F47). */
function catalogRow(overrides: Partial<CatalogRow> = {}): CatalogRow {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    capability: "campaign_image",
    provider: "openai",
    model: "gpt-5.5",
    protocol: "responses",
    status: "active",
    ...overrides,
  };
}

// ─── Client fake em memória ──────────────────────────────────────────────────

class FakeLabClient {
  readonly calls: string[] = [];
  readonly experiments: ExperimentRow[] = [];
  readonly variants: VariantRow[] = [];
  readonly scenarios: ScenarioRow[] = [];
  readonly runs: RunRow[] = [];
  readonly catalog: CatalogRow[] = [catalogRow()];
  rpcError: { message: string } | null = null;

  private seq = 0;

  private nextId(prefix: string): string {
    this.seq += 1;
    return `${prefix}-0000-4000-8000-${String(this.seq).padStart(12, "0")}`;
  }

  from(table: string): FakeBuilder {
    const calls = this.calls;
    calls.push(`from:${table}`);

    const filters: Array<[string, unknown]> = [];
    let pendingUpdate: Record<string, unknown> | null = null;

    const source = (): Array<Record<string, unknown>> => {
      switch (table) {
        case "lab_experiments":
          return this.experiments as unknown as Array<Record<string, unknown>>;
        case "lab_experiment_variants":
          return this.variants as unknown as Array<Record<string, unknown>>;
        case "lab_experiment_scenarios":
          return this.scenarios as unknown as Array<Record<string, unknown>>;
        case "lab_runs":
          return this.runs as unknown as Array<Record<string, unknown>>;
        case "ai_model_catalog":
          return this.catalog as unknown as Array<Record<string, unknown>>;
        default:
          return [];
      }
    };

    const matching = (): Array<Record<string, unknown>> =>
      source().filter((row) => filters.every(([column, value]) => row[column] === value));

    const builder: FakeBuilder = {
      select(columns: string) {
        calls.push(`select:${columns}`);
        return builder;
      },
      eq(column: string, value: unknown) {
        calls.push(`eq:${column}`);
        filters.push([column, value]);
        return builder;
      },
      update(values: Record<string, unknown>) {
        calls.push("update");
        pendingUpdate = values;
        return builder;
      },
      async maybeSingle() {
        calls.push("maybeSingle");
        return { data: matching()[0] ?? null, error: null };
      },
      then(
        onfulfilled: (value: { data: unknown[]; error: null }) => unknown,
        onrejected?: (reason: unknown) => unknown,
      ) {
        if (pendingUpdate) {
          const values = pendingUpdate;
          for (const row of matching()) Object.assign(row, values);
        }
        return Promise.resolve({ data: matching(), error: null }).then(onfulfilled, onrejected);
      },
    };

    return builder;
  }

  /**
   * Espelha a RPC `lab_create_experiment`: valida tudo primeiro e só então grava
   * experimento + 2 variantes + N cenários (atomicidade — falha não deixa nada).
   */
  async rpc(name: string, params: Record<string, unknown>) {
    this.calls.push(`rpc:${name}`);
    if (name !== "lab_create_experiment") {
      return { data: null, error: { message: `unexpected_rpc:${name}` } };
    }
    if (this.rpcError) {
      return { data: null, error: this.rpcError };
    }

    const scenarioVersionIds = (params.p_scenario_version_ids ?? []) as string[];
    const repetitions = params.p_repetitions as number;
    const maxRuns = params.p_max_runs as number;
    if (
      scenarioVersionIds.length < 1 ||
      scenarioVersionIds.length > 3 ||
      repetitions < 1 ||
      repetitions > 3 ||
      maxRuns < 1 ||
      maxRuns > 12
    ) {
      return { data: null, error: { message: "invalid_experiment_input" } };
    }

    const experimentId = this.nextId("exp");
    const now = new Date().toISOString();
    this.experiments.push({
      id: experimentId,
      name: params.p_name as string,
      objective: params.p_objective as string,
      hypothesis: params.p_hypothesis as string,
      changed_dimension: "prompt",
      primary_capability: "campaign_image",
      model_target: params.p_model_target as LabModelTarget,
      params: params.p_params as Record<string, unknown>,
      status: "draft",
      repetitions,
      max_runs: maxRuns,
      notes: (params.p_notes as string | null) ?? null,
      created_by: params.p_actor_id as string,
      created_at: now,
      updated_at: now,
    });
    this.variants.push({
      id: this.nextId("var"),
      experiment_id: experimentId,
      role: "baseline",
      label: "Baseline",
      prompt_snapshot: params.p_baseline_prompt as Record<string, unknown>,
    });
    this.variants.push({
      id: this.nextId("var"),
      experiment_id: experimentId,
      role: "candidate",
      label: "Candidata",
      prompt_snapshot: params.p_candidate_prompt as Record<string, unknown>,
    });
    scenarioVersionIds.forEach((scenarioVersionId, index) => {
      this.scenarios.push({
        id: this.nextId("scn"),
        experiment_id: experimentId,
        scenario_version_id: scenarioVersionId,
        position: index + 1,
      });
    });

    return { data: { experiment_id: experimentId }, error: null };
  }

  /** Semeia um experimento completo (com variantes e cenários) direto no "banco". */
  seedExperiment(
    overrides: Partial<ExperimentRow> = {},
    options: { variantRoles?: string[]; scenarioVersionIds?: string[] } = {},
  ): string {
    const id = this.nextId("exp");
    const now = new Date().toISOString();
    this.experiments.push({
      id,
      name: "Experimento semeado",
      objective: "Objetivo",
      hypothesis: "Hipótese",
      changed_dimension: "prompt",
      primary_capability: "campaign_image",
      model_target: { provider: "openai", model: "gpt-5.5", protocol: "responses" },
      params: { size: "1024x1024", quality: "high", skipInputValidation: true },
      status: "draft",
      repetitions: 1,
      max_runs: 6,
      notes: null,
      created_by: ACTOR_ID,
      created_at: now,
      updated_at: now,
      ...overrides,
    });

    for (const role of options.variantRoles ?? ["baseline", "candidate"]) {
      this.variants.push({
        id: this.nextId("var"),
        experiment_id: id,
        role,
        label: role,
        prompt_snapshot: {},
      });
    }
    for (const [index, scenarioVersionId] of (
      options.scenarioVersionIds ?? [SCENARIO_A]
    ).entries()) {
      this.scenarios.push({
        id: this.nextId("scn"),
        experiment_id: id,
        scenario_version_id: scenarioVersionId,
        position: index + 1,
      });
    }

    return id;
  }
}

function asClient(fake: FakeLabClient): SupabaseClient {
  return fake as unknown as SupabaseClient;
}

function context(fake: FakeLabClient) {
  return { actorId: ACTOR_ID, client: asClient(fake) };
}

async function capture(fn: () => Promise<unknown>): Promise<unknown> {
  try {
    await fn();
    return null;
  } catch (caught) {
    return caught;
  }
}

// ─── Entrada válida ──────────────────────────────────────────────────────────

function validInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: "Prompt enxuto vs atual",
    objective: "Reduzir redundância sem perder fidelidade",
    hypothesis: "Um prompt mais curto mantém a qualidade da arte",
    changedDimension: "prompt",
    modelTarget: { provider: "openai", model: "gpt-5.5", protocol: "responses" },
    params: { size: "1024x1024", quality: "high", skipInputValidation: true },
    repetitions: 1,
    scenarioVersionIds: [SCENARIO_A],
    baseline: { promptName: "campaign-image-director-offer" },
    candidate: {
      promptName: "campaign-image-director-offer",
      promptContent: "# Diretor de arte (candidata)\n\nInstruções enxutas.",
    },
    ...overrides,
  };
}

function asExperimentInput(input: Record<string, unknown>): CreateLabExperimentInput {
  return input as unknown as CreateLabExperimentInput;
}

// ─── Criação ─────────────────────────────────────────────────────────────────

describe("createExperiment", () => {
  it("cria 1 experimento com exatamente 2 variantes e N cenários, sem nenhum run", async () => {
    const client = new FakeLabClient();

    const { experimentId } = await createExperiment(
      asExperimentInput(
        validInput({ scenarioVersionIds: [SCENARIO_A, SCENARIO_B] }),
      ),
      context(client),
    );

    expect(experimentId).toBeTruthy();
    expect(client.experiments).toHaveLength(1);
    expect(client.experiments[0].status).toBe("draft");
    expect(client.experiments[0].changed_dimension).toBe("prompt");
    expect(client.experiments[0].primary_capability).toBe("campaign_image");
    expect(client.experiments[0].created_by).toBe(ACTOR_ID);

    expect(client.variants).toHaveLength(2);
    const baseline = client.variants.find((variant) => variant.role === "baseline");
    const candidate = client.variants.find((variant) => variant.role === "candidate");
    expect(baseline).toBeDefined();
    expect(candidate).toBeDefined();

    expect(baseline?.prompt_snapshot.source).toBe("official");
    expect(baseline?.prompt_snapshot.name).toBe("campaign-image-director-offer");
    expect(baseline?.prompt_snapshot.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(candidate?.prompt_snapshot.source).toBe("override");
    expect(candidate?.prompt_snapshot.content).toContain("enxutas");

    expect(client.scenarios).toHaveLength(2);
    expect(client.scenarios.map((scenario) => scenario.position)).toEqual([1, 2]);
    expect(client.runs).toHaveLength(0);
  });

  it("grava numa única RPC — nenhum insert PostgREST separado", async () => {
    const client = new FakeLabClient();

    await createExperiment(asExperimentInput(validInput()), context(client));

    expect(client.calls).toEqual([
      "from:ai_model_catalog",
      "select:id",
      "eq:capability",
      "eq:provider",
      "eq:model",
      "eq:protocol",
      "eq:status",
      "maybeSingle",
      "rpc:lab_create_experiment",
    ]);
  });

  it("changedDimension 'model' não escreve nada (erro antes de qualquer escrita)", async () => {
    const client = new FakeLabClient();

    const error = await capture(() =>
      createExperiment(
        asExperimentInput(validInput({ changedDimension: "model" })),
        context(client),
      ),
    );

    expect(error).toBeInstanceOf(UnsupportedChangedDimensionError);
    expect(client.experiments).toHaveLength(0);
    expect(client.variants).toHaveLength(0);
    expect(client.scenarios).toHaveLength(0);
    expect(client.calls).toEqual([]);
  });

  it("alvo fora do catálogo não escreve nada", async () => {
    const client = new FakeLabClient();

    const error = await capture(() =>
      createExperiment(
        asExperimentInput(
          validInput({
            modelTarget: { provider: "openai", model: "gpt-4o", protocol: "responses" },
          }),
        ),
        context(client),
      ),
    );

    expect(error).toBeInstanceOf(ModelTargetNotInCatalogError);
    expect(client.experiments).toHaveLength(0);
    expect(client.variants).toHaveLength(0);
    expect(client.scenarios).toHaveLength(0);
    expect(client.calls).not.toContain("rpc:lab_create_experiment");
  });

  it("falha da RPC é propagada e nenhum registro parcial permanece (atomicidade)", async () => {
    const client = new FakeLabClient();
    client.rpcError = { message: "lab_experiment_frozen" };

    const error = (await capture(() =>
      createExperiment(asExperimentInput(validInput()), context(client)),
    )) as Error;

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain("lab_create_experiment_failed");
    expect(client.experiments).toHaveLength(0);
    expect(client.variants).toHaveLength(0);
    expect(client.scenarios).toHaveLength(0);
  });

  it("não cria nem dispara run", async () => {
    const client = new FakeLabClient();

    await createExperiment(asExperimentInput(validInput()), context(client));

    expect(client.runs).toHaveLength(0);
    expect(client.calls.filter((call) => call.startsWith("from:lab_runs"))).toEqual([]);
  });
});

// ─── Prontidão ───────────────────────────────────────────────────────────────

describe("computeExperimentReadiness", () => {
  it("é pronto com 2 variantes, 1 cenário, limites válidos e alvo ativo", async () => {
    const client = new FakeLabClient();
    const experimentId = client.seedExperiment();

    const readiness = await computeExperimentReadiness(experimentId, asClient(client));

    expect(readiness).toEqual({ ready: true, reasons: [] });
  });

  it("missing_variants com uma única variante", async () => {
    const client = new FakeLabClient();
    const experimentId = client.seedExperiment({}, { variantRoles: ["baseline"] });

    const readiness = await computeExperimentReadiness(experimentId, asClient(client));

    expect(readiness.ready).toBe(false);
    expect(readiness.reasons).toContain("missing_variants");
  });

  it("missing_scenarios com zero cenários", async () => {
    const client = new FakeLabClient();
    const experimentId = client.seedExperiment({}, { scenarioVersionIds: [] });

    const readiness = await computeExperimentReadiness(experimentId, asClient(client));

    expect(readiness.ready).toBe(false);
    expect(readiness.reasons).toContain("missing_scenarios");
  });

  it("too_many_scenarios com 4 cenários", async () => {
    const client = new FakeLabClient();
    const experimentId = client.seedExperiment(
      {},
      { scenarioVersionIds: [SCENARIO_A, SCENARIO_B, SCENARIO_C, SCENARIO_D] },
    );

    const readiness = await computeExperimentReadiness(experimentId, asClient(client));

    expect(readiness.ready).toBe(false);
    expect(readiness.reasons).toContain("too_many_scenarios");
    expect(readiness.reasons).not.toContain("missing_scenarios");
  });

  it("invalid_repetitions com repetitions 4", async () => {
    const client = new FakeLabClient();
    const experimentId = client.seedExperiment({ repetitions: 4 });

    const readiness = await computeExperimentReadiness(experimentId, asClient(client));

    expect(readiness.ready).toBe(false);
    expect(readiness.reasons).toContain("invalid_repetitions");
  });

  it("invalid_max_runs com max_runs 13", async () => {
    const client = new FakeLabClient();
    const experimentId = client.seedExperiment({ max_runs: 13 });

    const readiness = await computeExperimentReadiness(experimentId, asClient(client));

    expect(readiness.ready).toBe(false);
    expect(readiness.reasons).toContain("invalid_max_runs");
  });

  it("unsupported_dimension quando o banco carrega dimensão fora de prompt", async () => {
    const client = new FakeLabClient();
    const experimentId = client.seedExperiment({ changed_dimension: "model" });

    const readiness = await computeExperimentReadiness(experimentId, asClient(client));

    expect(readiness.ready).toBe(false);
    expect(readiness.reasons).toContain("unsupported_dimension");
  });

  it("model_target_not_in_catalog quando o alvo não é linha ativa do catálogo", async () => {
    const client = new FakeLabClient();
    const experimentId = client.seedExperiment({
      model_target: { provider: "openai", model: "gpt-4o", protocol: "responses" },
    });

    const readiness = await computeExperimentReadiness(experimentId, asClient(client));

    expect(readiness.ready).toBe(false);
    expect(readiness.reasons).toContain("model_target_not_in_catalog");
  });
});

// ─── Máquina de estados ──────────────────────────────────────────────────────

describe("EXPERIMENT_TRANSITIONS / assertTransitionAllowed", () => {
  it("draft só transita para ready (nunca direto para running)", () => {
    expect(EXPERIMENT_TRANSITIONS.draft).toEqual(["ready"]);
    expect(() => assertTransitionAllowed("draft", "running")).toThrow(
      "invalid_transition:draft->running",
    );
  });

  it("archived é terminal", () => {
    expect(EXPERIMENT_TRANSITIONS.archived).toEqual([]);
    expect(() => assertTransitionAllowed("archived", "running")).toThrow(
      "invalid_transition:archived->running",
    );
  });

  it("evaluated volta para running (avaliar não encerra as execuções)", () => {
    expect(EXPERIMENT_TRANSITIONS.evaluated).toContain("running");
    expect(() => assertTransitionAllowed("evaluated", "running")).not.toThrow();
  });
});

describe("transitionExperiment", () => {
  it("aceita draft → ready com configuração completa", async () => {
    const client = new FakeLabClient();
    const { experimentId } = await createExperiment(
      asExperimentInput(validInput()),
      context(client),
    );

    const result = await transitionExperiment(experimentId, "ready", context(client));

    expect(result.status).toBe("ready");
    expect(client.experiments[0].status).toBe("ready");
  });

  it("recusa draft → running", async () => {
    const client = new FakeLabClient();
    const { experimentId } = await createExperiment(
      asExperimentInput(validInput()),
      context(client),
    );

    await expect(
      transitionExperiment(experimentId, "running", context(client)),
    ).rejects.toThrow("invalid_transition:draft->running");
    expect(client.experiments[0].status).toBe("draft");
  });

  it("recusa qualquer transição a partir de archived", async () => {
    const client = new FakeLabClient();
    const experimentId = client.seedExperiment({ status: "archived" });

    await expect(
      transitionExperiment(experimentId, "running", context(client)),
    ).rejects.toThrow("invalid_transition:archived->running");
  });

  it("recusa ready → evaluated (avaliar exige running)", async () => {
    const client = new FakeLabClient();
    const experimentId = client.seedExperiment({ status: "ready" });

    await expect(
      transitionExperiment(experimentId, "evaluated", context(client)),
    ).rejects.toThrow("invalid_transition:ready->evaluated");
  });

  it("aceita evaluated → running (novo run após avaliação)", async () => {
    const client = new FakeLabClient();
    const experimentId = client.seedExperiment({ status: "evaluated" });

    const result = await transitionExperiment(experimentId, "running", context(client));

    expect(result.status).toBe("running");
    expect(client.experiments[0].status).toBe("running");
  });

  it("recusa draft → ready sem prontidão com experiment_not_ready:<reasons>", async () => {
    const client = new FakeLabClient();
    const experimentId = client.seedExperiment({}, { variantRoles: ["baseline"] });

    const error = (await capture(() =>
      transitionExperiment(experimentId, "ready", context(client)),
    )) as Error;

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain("experiment_not_ready");
    expect(error.message).toContain("missing_variants");
    expect(client.experiments[0].status).toBe("draft");
  });

  it("propaga experiment_not_found para experimento inexistente", async () => {
    const client = new FakeLabClient();

    await expect(
      transitionExperiment("00000000-0000-4000-8000-000000000000", "ready", context(client)),
    ).rejects.toThrow("experiment_not_found");
  });
});

// ─── Congelamento ────────────────────────────────────────────────────────────

describe("assertConfigurationEditable", () => {
  it("permite edição enquanto não existe run", async () => {
    const client = new FakeLabClient();
    const experimentId = client.seedExperiment();

    await expect(
      assertConfigurationEditable(experimentId, asClient(client)),
    ).resolves.toBeUndefined();
  });

  it("lança experiment_frozen a partir do primeiro run", async () => {
    const client = new FakeLabClient();
    const experimentId = client.seedExperiment();
    client.runs.push({
      id: "run-1",
      experiment_id: experimentId,
      variant_id: "variant-1",
      scenario_version_id: SCENARIO_A,
      repetition_index: 1,
    });

    await expect(
      assertConfigurationEditable(experimentId, asClient(client)),
    ).rejects.toThrow("experiment_frozen");
  });

  it("não é afetado por runs de outro experimento", async () => {
    const client = new FakeLabClient();
    const experimentId = client.seedExperiment();
    const other = client.seedExperiment();
    client.runs.push({
      id: "run-1",
      experiment_id: other,
      variant_id: "variant-1",
      scenario_version_id: SCENARIO_A,
      repetition_index: 1,
    });

    await expect(
      assertConfigurationEditable(experimentId, asClient(client)),
    ).resolves.toBeUndefined();
  });
});
