// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  ModelTargetNotInCatalogError,
  LAB_PRIMARY_CAPABILITY,
} from "../model-target";
import {
  PROMPT_UNDER_TEST,
  buildBaselinePromptSnapshot,
  buildCandidatePromptSnapshot,
} from "../prompt-snapshot";
import {
  LAB_BLIND_ORDERS,
  LAB_EVALUATION_VERDICTS,
  UnsupportedChangedDimensionError,
  parseCreateLabEvaluationInput,
} from "../schemas";
import type { CreateLabExperimentInput, LabModelTarget } from "../schemas";
import {
  EXPERIMENT_TRANSITIONS,
  READINESS_REASONS,
  assertConfigurationEditable,
  assertTransitionAllowed,
  computeExperimentReadiness,
  createExperiment,
  transitionExperiment,
} from "../experiment-service";
import {
  MAX_REPETITIONS,
  MAX_RUNS_PER_EXPERIMENT,
  MAX_SCENARIOS_PER_EXPERIMENT,
} from "@/lib/lab/limits";

/**
 * Suíte de contrato nº 1 (48-1-11, task 11.4) — **domínio de experimentos**.
 *
 * Trava o contrato transversal: 2 variantes (baseline oficial × candidata
 * override), dimensão única `prompt`, alvo/params fixos e idênticos validados em
 * **leitura** no catálogo, snapshots de prompt congelados sem escrever em
 * `prompts/`, máquina de estados, prontidão/limites, congelamento após o primeiro
 * run e nenhuma avaliação automática de qualidade (decisão humana).
 *
 * Client fake em memória com `accessLog` — nenhuma chamada de rede e nenhuma
 * chamada paga.
 */

const ACTOR_ID = "99999999-9999-4999-8999-999999999999";
const SCENARIO_A = "11111111-1111-4111-8111-111111111111";
const SCENARIO_B = "22222222-2222-4222-8222-222222222222";
const SCENARIO_C = "33333333-3333-4333-8333-333333333333";
const SCENARIO_D = "44444444-4444-4444-8444-444444444444";

const ACTIVE_TARGET: LabModelTarget = { provider: "openai", model: "gpt-5.5", protocol: "responses" };

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
  status: string;
}

interface EvaluationRow {
  id: string;
  experiment_id: string;
  verdict: string;
}

interface FakeBuilder {
  select(columns: string): FakeBuilder;
  eq(column: string, value: unknown): FakeBuilder;
  update(values: Record<string, unknown>): FakeBuilder;
  delete(): FakeBuilder;
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
    capability: LAB_PRIMARY_CAPABILITY,
    provider: "openai",
    model: "gpt-5.5",
    protocol: "responses",
    status: "active",
    ...overrides,
  };
}

// ─── Client fake em memória com accessLog ───────────────────────────────────

class FakeLabClient {
  readonly accessLog: string[] = [];
  readonly experiments: ExperimentRow[] = [];
  readonly variants: VariantRow[] = [];
  readonly scenarios: ScenarioRow[] = [];
  readonly runs: RunRow[] = [];
  readonly evaluations: EvaluationRow[] = [];
  readonly deletes: string[] = [];
  readonly catalog: CatalogRow[] = [catalogRow()];
  rpcError: { message: string } | null = null;

  private seq = 0;

  private nextId(prefix: string): string {
    this.seq += 1;
    return `${prefix}-0000-4000-8000-${String(this.seq).padStart(12, "0")}`;
  }

  from(table: string): FakeBuilder {
    this.accessLog.push(`from:${table}`);
    const accessLog = this.accessLog;
    const fake = this;

    const filters: Array<[string, unknown]> = [];
    let pendingUpdate: Record<string, unknown> | null = null;
    let pendingDelete = false;

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
        case "lab_human_evaluations":
          return this.evaluations as unknown as Array<Record<string, unknown>>;
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
        accessLog.push(`select:${table}:${columns}`);
        return builder;
      },
      eq(column: string, value: unknown) {
        filters.push([column, value]);
        return builder;
      },
      update(values: Record<string, unknown>) {
        accessLog.push(`write:${table}:update`);
        pendingUpdate = values;
        return builder;
      },
      delete() {
        accessLog.push(`write:${table}:delete`);
        pendingDelete = true;
        return builder;
      },
      async maybeSingle() {
        return { data: matching()[0] ?? null, error: null };
      },
      then(
        onfulfilled: (value: { data: unknown[]; error: null }) => unknown,
        onrejected?: (reason: unknown) => unknown,
      ) {
        if (pendingDelete) {
          fake.deletes.push(table);
          const rows = source();
          for (const row of matching()) {
            const index = rows.indexOf(row);
            if (index >= 0) rows.splice(index, 1);
          }
        }
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
    this.accessLog.push(`rpc:${name}`);
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
      scenarioVersionIds.length > MAX_SCENARIOS_PER_EXPERIMENT ||
      repetitions < 1 ||
      repetitions > MAX_REPETITIONS ||
      maxRuns < 1 ||
      maxRuns > MAX_RUNS_PER_EXPERIMENT
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
      primary_capability: LAB_PRIMARY_CAPABILITY,
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

  /** Semeia um experimento completo (variantes + cenários) direto no "banco". */
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
      primary_capability: LAB_PRIMARY_CAPABILITY,
      model_target: { ...ACTIVE_TARGET },
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
    for (const [index, scenarioVersionId] of (options.scenarioVersionIds ?? [SCENARIO_A]).entries()) {
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

function validInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: "Prompt enxuto vs atual",
    objective: "Reduzir redundância sem perder fidelidade",
    hypothesis: "Um prompt mais curto mantém a qualidade da arte",
    changedDimension: "prompt",
    modelTarget: { ...ACTIVE_TARGET },
    params: { size: "1024x1024", quality: "high", skipInputValidation: true },
    repetitions: 1,
    maxRuns: 6,
    scenarioVersionIds: [SCENARIO_A],
    baseline: { promptName: PROMPT_UNDER_TEST },
    candidate: {
      promptName: PROMPT_UNDER_TEST,
      promptContent: "# Diretor de arte (candidata)\n\nInstruções enxutas.",
    },
    ...overrides,
  };
}

function asExperimentInput(input: Record<string, unknown>): CreateLabExperimentInput {
  return input as unknown as CreateLabExperimentInput;
}

// ─── (11.4.1) Criação válida ────────────────────────────────────────────────

describe("createExperiment — criação válida com exatamente 2 variantes", () => {
  it("cria o experimento com 2 variantes, N cenários, autoria e timestamps", async () => {
    const client = new FakeLabClient();

    const { experimentId } = await createExperiment(
      asExperimentInput(validInput({ scenarioVersionIds: [SCENARIO_A, SCENARIO_B, SCENARIO_C] })),
      context(client),
    );

    expect(experimentId).toBeTruthy();
    expect(client.experiments).toHaveLength(1);
    const experiment = client.experiments[0];
    expect(experiment.status).toBe("draft");
    expect(experiment.changed_dimension).toBe("prompt");
    expect(experiment.primary_capability).toBe(LAB_PRIMARY_CAPABILITY);
    expect(experiment.created_by).toBe(ACTOR_ID);
    expect(experiment.created_at).toBeTruthy();
    expect(experiment.updated_at).toBeTruthy();

    expect(client.variants).toHaveLength(2);
    const roles = client.variants.map((variant) => variant.role).sort();
    expect(roles).toEqual(["baseline", "candidate"]);
    expect(client.scenarios).toHaveLength(3);
    expect(client.scenarios.map((scenario) => scenario.position)).toEqual([1, 2, 3]);
  });

  it("baseline é o prompt oficial atual e candidata é o override", async () => {
    const client = new FakeLabClient();

    await createExperiment(asExperimentInput(validInput()), context(client));

    const baseline = client.variants.find((variant) => variant.role === "baseline");
    const candidate = client.variants.find((variant) => variant.role === "candidate");

    expect(baseline?.prompt_snapshot.source).toBe("official");
    expect(baseline?.prompt_snapshot.name).toBe(PROMPT_UNDER_TEST);
    expect(baseline?.prompt_snapshot.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(candidate?.prompt_snapshot.source).toBe("override");
    expect(candidate?.prompt_snapshot.content).toContain("enxutas");
    expect(candidate?.prompt_snapshot.contentHash).not.toBe(
      baseline?.prompt_snapshot.contentHash,
    );
  });
});

// ─── (11.4.2) Dimensão única `prompt` ──────────────────────────────────────

describe("dimensão única — model/configuration são recusados sem escrita", () => {
  for (const dimension of ["model", "configuration"] as const) {
    it(`changedDimension '${dimension}' → UnsupportedChangedDimensionError sem insert`, async () => {
      const client = new FakeLabClient();

      const error = await capture(() =>
        createExperiment(
          asExperimentInput(validInput({ changedDimension: dimension })),
          context(client),
        ),
      );

      expect(error).toBeInstanceOf(UnsupportedChangedDimensionError);
      expect((error as UnsupportedChangedDimensionError).code).toBe(
        "unsupported_changed_dimension",
      );
      expect(client.experiments).toHaveLength(0);
      expect(client.variants).toHaveLength(0);
      expect(client.scenarios).toHaveLength(0);
      expect(client.accessLog.filter((entry) => entry.startsWith("rpc:"))).toEqual([]);
    });
  }

  it("changedDimension 'prompt' é aceito", async () => {
    const client = new FakeLabClient();

    await createExperiment(
      asExperimentInput(validInput({ changedDimension: "prompt" })),
      context(client),
    );

    expect(client.experiments).toHaveLength(1);
  });
});

// ─── (11.4.3) Alvo e params fixos e idênticos ──────────────────────────────

describe("alvo fixo — um único modelo/params no experimento, nenhum por variante", () => {
  it("o alvo e os params vivem no experimento e as variantes não os declaram", async () => {
    const client = new FakeLabClient();

    await createExperiment(asExperimentInput(validInput()), context(client));

    const rpcCall = client.accessLog.find((entry) => entry === "rpc:lab_create_experiment");
    expect(rpcCall).toBe("rpc:lab_create_experiment");

    const experiment = client.experiments[0];
    expect(experiment.model_target).toEqual(ACTIVE_TARGET);
    expect(experiment.params).toMatchObject({
      size: "1024x1024",
      quality: "high",
      skipInputValidation: true,
    });

    for (const variant of client.variants) {
      const keys = Object.keys(variant);
      for (const forbidden of ["model", "model_target", "params", "provider", "protocol"]) {
        expect(keys).not.toContain(forbidden);
      }
      expect(Object.keys(variant.prompt_snapshot).sort()).toEqual([
        "content",
        "contentHash",
        "name",
        "source",
      ]);
    }
  });
});

// ─── (11.4.4) Alvo restrito ao catálogo (somente leitura) ──────────────────

describe("catálogo — alvo precisa ser linha ativa; nenhuma escrita", () => {
  it("alvo ativo (openai/gpt-5.5/responses) é aceito", async () => {
    const client = new FakeLabClient();

    await createExperiment(asExperimentInput(validInput()), context(client));

    expect(client.experiments).toHaveLength(1);
    expect(client.accessLog).toContain("from:ai_model_catalog");
    expect(client.accessLog.filter((entry) => entry.startsWith("write:ai_model_catalog"))).toEqual(
      [],
    );
  });

  it("alvo fora do catálogo → ModelTargetNotInCatalogError sem escrita", async () => {
    const client = new FakeLabClient();

    const error = await capture(() =>
      createExperiment(
        asExperimentInput(
          validInput({ modelTarget: { provider: "openai", model: "gpt-4o", protocol: "responses" } }),
        ),
        context(client),
      ),
    );

    expect(error).toBeInstanceOf(ModelTargetNotInCatalogError);
    expect((error as ModelTargetNotInCatalogError).code).toBe("model_target_not_in_catalog");
    expect(client.experiments).toHaveLength(0);
    expect(client.accessLog.filter((entry) => entry.startsWith("rpc:"))).toEqual([]);
    expect(client.accessLog.filter((entry) => entry.startsWith("write:ai_model_catalog"))).toEqual(
      [],
    );
  });

  it("linha inativa do catálogo não habilita o alvo", async () => {
    const client = new FakeLabClient();
    client.catalog.splice(0, client.catalog.length, catalogRow({ status: "deprecated" }));

    const error = await capture(() =>
      createExperiment(asExperimentInput(validInput()), context(client)),
    );

    expect(error).toBeInstanceOf(ModelTargetNotInCatalogError);
    expect(client.experiments).toHaveLength(0);
  });
});

// ─── (11.4.5) Snapshots de prompt ──────────────────────────────────────────

function readPromptsTree(): Record<string, string> {
  const root = path.resolve(process.cwd(), "prompts");
  const out: Record<string, string> = {};
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else {
        out[path.relative(root, full)] = readFileSync(full, "utf8");
      }
    }
  };
  walk(root);
  return out;
}

describe("snapshots de prompt — baseline oficial × candidata override", () => {
  it("baseline é byte a byte o arquivo oficial e tem hash coerente", () => {
    const official = readFileSync(
      path.resolve(process.cwd(), `prompts/${PROMPT_UNDER_TEST}.md`),
      "utf8",
    );

    const baseline = buildBaselinePromptSnapshot();

    expect(baseline.source).toBe("official");
    expect(baseline.name).toBe(PROMPT_UNDER_TEST);
    expect(baseline.content).toBe(official);
    expect(baseline.contentHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("candidata é o override, com hash diferente do baseline", () => {
    const baseline = buildBaselinePromptSnapshot();
    const candidate = buildCandidatePromptSnapshot({
      promptName: PROMPT_UNDER_TEST,
      promptContent: "# Diretor de arte (candidata)\n\nInstruções enxutas.",
    });

    expect(candidate.source).toBe("override");
    expect(candidate.content).toContain("enxutas");
    expect(candidate.contentHash).not.toBe(baseline.contentHash);
  });

  it("nenhum arquivo em prompts/ é escrito ao montar as variantes", () => {
    const before = readPromptsTree();

    buildBaselinePromptSnapshot();
    buildCandidatePromptSnapshot({
      promptName: PROMPT_UNDER_TEST,
      promptContent: "# Diretor de arte (candidata)\n\nInstruções enxutas.",
    });

    const after = readPromptsTree();

    expect(Object.keys(after).sort()).toEqual(Object.keys(before).sort());
    for (const file of Object.keys(before)) {
      expect(after[file]).toBe(before[file]);
    }
  });
});

// ─── (11.4.6) Máquina de estados ───────────────────────────────────────────

describe("transições — máquina de estados travada", () => {
  it("permite as transições previstas e recusa as proibidas", () => {
    expect(EXPERIMENT_TRANSITIONS.draft).toContain("ready");
    expect(EXPERIMENT_TRANSITIONS.ready).toContain("running");
    expect(EXPERIMENT_TRANSITIONS.running).toContain("evaluated");
    expect(EXPERIMENT_TRANSITIONS.evaluated).toContain("running");
    expect(EXPERIMENT_TRANSITIONS.ready).toContain("archived");
    expect(EXPERIMENT_TRANSITIONS.running).toContain("archived");
    expect(EXPERIMENT_TRANSITIONS.evaluated).toContain("archived");
    expect(EXPERIMENT_TRANSITIONS.archived).toEqual([]);
  });

  it("draft → running lança e qualquer transição a partir de archived lança", () => {
    expect(() => assertTransitionAllowed("draft", "running")).toThrow(
      "invalid_transition:draft->running",
    );
    expect(() => assertTransitionAllowed("archived", "running")).toThrow(
      "invalid_transition:archived->running",
    );
    expect(() => assertTransitionAllowed("archived", "evaluated")).toThrow(
      "invalid_transition:archived->evaluated",
    );
  });

  it("transitionExperiment recusa alvo inválido sem persistir mudança de status", async () => {
    const client = new FakeLabClient();
    const experimentId = client.seedExperiment({ status: "draft" });

    const error = await capture(() =>
      transitionExperiment(experimentId, "running", context(client)),
    );

    expect(String((error as Error).message)).toContain("invalid_transition:draft->running");
    expect(client.experiments[0].status).toBe("draft");
    expect(client.accessLog.filter((entry) => entry.startsWith("write:lab_experiments"))).toEqual(
      [],
    );
  });

  it("evaluated → running é permitido e preserva as avaliações", async () => {
    const client = new FakeLabClient();
    const experimentId = client.seedExperiment({ status: "evaluated" });
    client.evaluations.push({ id: "eval-1", experiment_id: experimentId, verdict: "candidate" });

    const result = await transitionExperiment(experimentId, "running", context(client));

    expect(result.status).toBe("running");
    expect(client.experiments[0].status).toBe("running");
    expect(client.evaluations).toHaveLength(1);
    expect(client.deletes).not.toContain("lab_human_evaluations");
  });
});

// ─── (11.4.7) Prontidão e limites ──────────────────────────────────────────

describe("prontidão e limites — códigos objetivos e tetos aplicados", () => {
  it("é pronto com 2 variantes, ≥1 cenário, limites válidos e alvo ativo", async () => {
    const client = new FakeLabClient();
    const experimentId = client.seedExperiment();

    const readiness = await computeExperimentReadiness(experimentId, asClient(client));

    expect(readiness).toEqual({ ready: true, reasons: [] });
  });

  const notReadyCases: Array<{
    label: string;
    overrides?: Partial<ExperimentRow>;
    options?: { variantRoles?: string[]; scenarioVersionIds?: string[] };
    reason: string;
  }> = [
    {
      label: "1 variante",
      options: { variantRoles: ["baseline"] },
      reason: "missing_variants",
    },
    { label: "0 cenários", options: { scenarioVersionIds: [] }, reason: "missing_scenarios" },
    {
      label: "4 cenários",
      options: { scenarioVersionIds: [SCENARIO_A, SCENARIO_B, SCENARIO_C, SCENARIO_D] },
      reason: "too_many_scenarios",
    },
    { label: `repetitions ${MAX_REPETITIONS + 1}`, overrides: { repetitions: MAX_REPETITIONS + 1 }, reason: "invalid_repetitions" },
    { label: `max_runs ${MAX_RUNS_PER_EXPERIMENT + 1}`, overrides: { max_runs: MAX_RUNS_PER_EXPERIMENT + 1 }, reason: "invalid_max_runs" },
    {
      label: "alvo fora do catálogo",
      overrides: { model_target: { provider: "openai", model: "gpt-4o", protocol: "responses" } },
      reason: "model_target_not_in_catalog",
    },
  ];

  for (const { label, overrides, options, reason } of notReadyCases) {
    it(`${label} → ready: false com '${reason}'`, async () => {
      const client = new FakeLabClient();
      const experimentId = client.seedExperiment(overrides, options);

      const readiness = await computeExperimentReadiness(experimentId, asClient(client));

      expect(readiness.ready).toBe(false);
      expect(readiness.reasons).toContain(reason);
      expect(READINESS_REASONS).toContain(reason);
    });
  }

  it("criação com 4 cenários é rejeitada por MAX_SCENARIOS_PER_EXPERIMENT", async () => {
    const client = new FakeLabClient();

    const error = await capture(() =>
      createExperiment(
        asExperimentInput(
          validInput({ scenarioVersionIds: [SCENARIO_A, SCENARIO_B, SCENARIO_C, SCENARIO_D] }),
        ),
        context(client),
      ),
    );

    expect(error).toBeInstanceOf(Error);
    expect(client.experiments).toHaveLength(0);
    expect(client.accessLog.filter((entry) => entry.startsWith("rpc:"))).toEqual([]);
  });

  it("maxRuns acima de MAX_RUNS_PER_EXPERIMENT é rejeitado", async () => {
    const client = new FakeLabClient();

    const error = await capture(() =>
      createExperiment(
        asExperimentInput(validInput({ maxRuns: MAX_RUNS_PER_EXPERIMENT + 1 })),
        context(client),
      ),
    );

    expect(error).toBeInstanceOf(Error);
    expect(client.experiments).toHaveLength(0);
    expect(client.accessLog.filter((entry) => entry.startsWith("rpc:"))).toEqual([]);
  });
});

// ─── (11.4.8) Congelamento após o primeiro run ─────────────────────────────

describe("congelamento — editável sem runs, congelado a partir do primeiro run", () => {
  for (const status of ["draft", "ready"] as const) {
    it(`permite edição em '${status}' sem runs`, async () => {
      const client = new FakeLabClient();
      const experimentId = client.seedExperiment({ status });

      await expect(
        assertConfigurationEditable(experimentId, asClient(client)),
      ).resolves.toBeUndefined();
    });
  }

  it("lança experiment_frozen com o primeiro run existente", async () => {
    const client = new FakeLabClient();
    const experimentId = client.seedExperiment({ status: "running" });
    client.runs.push({ id: "run-1", experiment_id: experimentId, status: "running" });

    await expect(assertConfigurationEditable(experimentId, asClient(client))).rejects.toThrow(
      "experiment_frozen",
    );
  });
});

// ─── (11.4.9) Nenhum run automático ────────────────────────────────────────

describe("nenhum run automático — criação e transição não disparam execução", () => {
  it("após createExperiment + transitionExperiment('ready') não há run algum", async () => {
    const client = new FakeLabClient();
    const runCounter = { runs: 0 };

    const { experimentId } = await createExperiment(asExperimentInput(validInput()), context(client));
    await transitionExperiment(experimentId, "ready", context(client));

    expect(client.experiments[0].status).toBe("ready");
    expect(client.runs).toHaveLength(0);
    expect(client.accessLog).not.toContain("from:lab_runs");
    expect(runCounter.runs).toBe(0);
  });
});

// ─── (11.4.10) Avaliação humana (sem avaliação automática) ─────────────────

describe("avaliação — verdict/ordem cega válidos e nenhuma avaliação automática", () => {
  const base = {
    scenarioVersionId: SCENARIO_A,
    baselineRunId: SCENARIO_B,
    candidateRunId: SCENARIO_C,
  };

  it("aceita todos os verdicts e ordens cegas previstos", () => {
    for (const verdict of LAB_EVALUATION_VERDICTS) {
      expect(parseCreateLabEvaluationInput({ ...base, verdict }).verdict).toBe(verdict);
    }
    for (const blindOrder of LAB_BLIND_ORDERS) {
      expect(parseCreateLabEvaluationInput({ ...base, verdict: "tie", blindOrder }).blindOrder).toBe(
        blindOrder,
      );
    }
  });

  it("rejeita baselineRunId === candidateRunId", () => {
    expect(() =>
      parseCreateLabEvaluationInput({ ...base, candidateRunId: base.baselineRunId, verdict: "tie" }),
    ).toThrow();
  });

  it("rejeita verdict/ordem fora do enum", () => {
    expect(() => parseCreateLabEvaluationInput({ ...base, verdict: "great" })).toThrow();
    expect(() =>
      parseCreateLabEvaluationInput({ ...base, verdict: "tie", blindOrder: "shuffled" }),
    ).toThrow();
  });

  it("o schema do domínio não possui campo de avaliação automática", () => {
    const source = readFileSync(
      path.resolve(process.cwd(), "src/lib/lab/domain/schemas.ts"),
      "utf8",
    );

    expect(source).not.toMatch(/score|rating|nota|publicável/i);
  });
});
