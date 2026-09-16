import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockReconcileStaleRuns } = vi.hoisted(() => ({
  mockReconcileStaleRuns: vi.fn(),
}));

vi.mock("@/lib/lab/run-service", () => ({
  reconcileStaleRuns: (...args: unknown[]) => mockReconcileStaleRuns(...args),
}));

import {
  getActiveCampaignImageTarget,
  getExperimentDetail,
  getRunDetail,
  listPendingEvaluations,
  listRecentExperiments,
  listScenarioVersions,
} from "../experiment-queries";
import { createFakeSupabaseClient } from "./fake-supabase-client";
import type { FakeRow } from "./fake-supabase-client";

/**
 * F48.1 (D11/D13) — camada de leitura da API do laboratório.
 * Client fake em memória: nenhuma chamada de rede e nenhuma chamada paga.
 */

const SCENARIO_ID = "11111111-1111-4111-8111-111111111111";
const VERSION_V2 = "22222222-2222-4222-8222-222222222222";
const VERSION_V1 = "33333333-3333-4333-8333-333333333333";
const VERSION_OTHER = "44444444-4444-4444-8444-444444444444";
const EXPERIMENT_ID = "55555555-5555-4555-8555-555555555555";
const RUN_ID = "66666666-6666-4666-8666-666666666666";
const BASELINE_VARIANT = "77777777-7777-4777-8777-777777777777";
const CANDIDATE_VARIANT = "88888888-8888-4888-8888-888888888888";

const BASE64_MARKER = "AAAABBBBCCCC";

beforeEach(() => {
  vi.clearAllMocks();
  mockReconcileStaleRuns.mockResolvedValue({ reconciled: 0 });
});

describe("listScenarioVersions", () => {
  function tables(): Record<string, FakeRow[]> {
    return {
      lab_scenarios: [
        { id: SCENARIO_ID, slug: "produto-oferta-preco", name: "Preço" },
        { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", slug: "aaa-cenario", name: "AAA" },
      ],
      lab_scenario_versions: [
        {
          id: VERSION_V2,
          scenario_id: SCENARIO_ID,
          version: 2,
          content_hash: "hash-v2",
          created_at: "2026-09-16T00:00:02Z",
          content: {
            intent: "offer",
            format: "1:1",
            locale: "pt-BR",
            images: [{ path: "images/produto.jpg", dataUrl: `data:image/png;base64,${BASE64_MARKER}` }],
          },
        },
        {
          id: VERSION_V1,
          scenario_id: SCENARIO_ID,
          version: 1,
          content_hash: "hash-v1",
          created_at: "2026-09-16T00:00:01Z",
          content: { intent: "offer", format: "1:1", locale: "pt-BR" },
        },
        {
          id: VERSION_OTHER,
          scenario_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          version: 1,
          content_hash: "hash-aaa",
          created_at: "2026-09-16T00:00:03Z",
          content: { intent: "offer", format: "1:1", locale: "pt-BR" },
        },
      ],
    };
  }

  it("não devolve `content` completo nem base64 de imagens; extrai intent/format/locale", async () => {
    const fake = createFakeSupabaseClient({ tables: tables() });

    const scenarios = await listScenarioVersions(fake.client);

    expect(scenarios).toHaveLength(3);
    const serialized = JSON.stringify(scenarios);
    expect(serialized).not.toContain(BASE64_MARKER);
    expect(serialized).not.toContain("dataUrl");
    for (const scenario of scenarios) {
      expect("content" in scenario).toBe(false);
      expect(scenario.intent).toBe("offer");
      expect(scenario.format).toBe("1:1");
      expect(scenario.locale).toBe("pt-BR");
    }
  });

  it("ordena por slug e, no mesmo slug, por versão decrescente", async () => {
    const fake = createFakeSupabaseClient({ tables: tables() });

    const scenarios = await listScenarioVersions(fake.client);

    expect(scenarios.map((scenario) => `${scenario.slug}#${scenario.version}`)).toEqual([
      "aaa-cenario#1",
      "produto-oferta-preco#2",
      "produto-oferta-preco#1",
    ]);
  });
});

describe("getActiveCampaignImageTarget", () => {
  it("devolve o alvo ativo de campaign_image (somente leitura)", async () => {
    const fake = createFakeSupabaseClient({
      tables: {
        ai_model_catalog: [
          { provider: "openai", model: "gpt-5.5", protocol: "responses", capability: "campaign_image", status: "active" },
          { provider: "openai", model: "gpt-5.5", protocol: "responses", capability: "campaign_image", status: "deprecated" },
        ],
      },
    });

    const target = await getActiveCampaignImageTarget(fake.client);

    expect(target).toEqual({ provider: "openai", model: "gpt-5.5", protocol: "responses" });
    expect(fake.operations.every((operation) => operation.op === "select")).toBe(true);
  });

  it("devolve null quando não há linha ativa", async () => {
    const fake = createFakeSupabaseClient({
      tables: {
        ai_model_catalog: [
          { provider: "openai", model: "gpt-5.5", protocol: "responses", capability: "campaign_image", status: "deprecated" },
        ],
      },
    });

    await expect(getActiveCampaignImageTarget(fake.client)).resolves.toBeNull();
  });
});

describe("listRecentExperiments", () => {
  it("calcula runs usados, restantes e contagem de cenários", async () => {
    const fake = createFakeSupabaseClient({
      tables: {
        lab_experiments: [
          { id: EXPERIMENT_ID, name: "Exp A", status: "running", repetitions: 2, max_runs: 6, updated_at: "2026-09-16T00:00:02Z" },
        ],
        lab_runs: [
          { id: "run-1", experiment_id: EXPERIMENT_ID },
          { id: "run-2", experiment_id: EXPERIMENT_ID },
          { id: "run-3", experiment_id: "outro-experimento" },
        ],
        lab_experiment_scenarios: [
          { id: "link-1", experiment_id: EXPERIMENT_ID },
          { id: "link-2", experiment_id: EXPERIMENT_ID },
          { id: "link-3", experiment_id: EXPERIMENT_ID },
        ],
      },
    });

    const experiments = await listRecentExperiments(fake.client);

    expect(experiments).toHaveLength(1);
    expect(experiments[0]).toMatchObject({
      id: EXPERIMENT_ID,
      runsUsed: 2,
      remainingRuns: 4,
      scenarioCount: 3,
    });
  });

  it("remainingRuns nunca fica negativo", async () => {
    const fake = createFakeSupabaseClient({
      tables: {
        lab_experiments: [
          { id: EXPERIMENT_ID, name: "Exp A", status: "running", repetitions: 1, max_runs: 1, updated_at: "x" },
        ],
        lab_runs: [
          { id: "run-1", experiment_id: EXPERIMENT_ID },
          { id: "run-2", experiment_id: EXPERIMENT_ID },
        ],
        lab_experiment_scenarios: [],
      },
    });

    const experiments = await listRecentExperiments(fake.client);

    expect(experiments[0].remainingRuns).toBe(0);
  });
});

describe("listPendingEvaluations", () => {
  function tables(params: { evaluations: FakeRow[]; runs?: FakeRow[] }): Record<string, FakeRow[]> {
    return {
      lab_experiments: [{ id: EXPERIMENT_ID, name: "Exp A", status: "running" }],
      lab_experiment_scenarios: [
        { id: "link-1", experiment_id: EXPERIMENT_ID, scenario_version_id: VERSION_V2 },
      ],
      lab_experiment_variants: [
        { id: BASELINE_VARIANT, experiment_id: EXPERIMENT_ID, role: "baseline" },
        { id: CANDIDATE_VARIANT, experiment_id: EXPERIMENT_ID, role: "candidate" },
      ],
      lab_runs: params.runs ?? [
        { id: "run-b-old", experiment_id: EXPERIMENT_ID, scenario_version_id: VERSION_V2, variant_id: BASELINE_VARIANT, status: "succeeded", created_at: "2026-09-16T00:00:01Z" },
        { id: "run-b", experiment_id: EXPERIMENT_ID, scenario_version_id: VERSION_V2, variant_id: BASELINE_VARIANT, status: "succeeded", created_at: "2026-09-16T00:00:05Z" },
        { id: "run-c", experiment_id: EXPERIMENT_ID, scenario_version_id: VERSION_V2, variant_id: CANDIDATE_VARIANT, status: "succeeded", created_at: "2026-09-16T00:00:04Z" },
      ],
      lab_human_evaluations: params.evaluations,
      lab_scenario_versions: [{ id: VERSION_V2, scenario_id: SCENARIO_ID, version: 2 }],
      lab_scenarios: [{ id: SCENARIO_ID, slug: "produto-oferta-preco", name: "Preço" }],
    };
  }

  it("devolve a pendência usando o run `succeeded` mais recente de cada variante", async () => {
    const fake = createFakeSupabaseClient({ tables: tables({ evaluations: [] }) });

    const pending = await listPendingEvaluations(fake.client);

    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({
      experimentId: EXPERIMENT_ID,
      scenarioVersionId: VERSION_V2,
      baselineRunId: "run-b",
      candidateRunId: "run-c",
    });
    expect(pending[0].scenarioLabel).toBe("produto-oferta-preco v2");
  });

  it("não devolve pendência quando o par exato já foi avaliado", async () => {
    const fake = createFakeSupabaseClient({
      tables: tables({
        evaluations: [
          {
            id: "eval-1",
            experiment_id: EXPERIMENT_ID,
            scenario_version_id: VERSION_V2,
            baseline_run_id: "run-b",
            candidate_run_id: "run-c",
          },
        ],
      }),
    });

    await expect(listPendingEvaluations(fake.client)).resolves.toEqual([]);
  });
});

describe("getExperimentDetail", () => {
  it("reconcilia runs órfãos antes de ler e devolve budget restante", async () => {
    const fake = createFakeSupabaseClient({
      tables: {
        lab_experiments: [
          {
            id: EXPERIMENT_ID,
            name: "Exp A",
            objective: "obj",
            hypothesis: "hip",
            changed_dimension: "prompt",
            model_target: { provider: "openai", model: "gpt-5.5", protocol: "responses" },
            params: { size: "1024x1024", quality: "high", skipInputValidation: true },
            status: "running",
            repetitions: 2,
            max_runs: 6,
            updated_at: "2026-09-16T00:00:02Z",
          },
        ],
        lab_experiment_variants: [
          { id: BASELINE_VARIANT, role: "baseline", label: "Baseline", prompt_snapshot: { name: "p", content: "c", contentHash: "h", source: "official" } },
          { id: CANDIDATE_VARIANT, role: "candidate", label: "Candidata", prompt_snapshot: { name: "p", content: "c2", contentHash: "h2", source: "override" } },
        ],
        lab_experiment_scenarios: [
          { id: "link-1", experiment_id: EXPERIMENT_ID, scenario_version_id: VERSION_V2, position: 1 },
        ],
        lab_scenario_versions: [
          { id: VERSION_V2, scenario_id: SCENARIO_ID, version: 2, content_hash: "hash-v2" },
        ],
        lab_scenarios: [{ id: SCENARIO_ID, slug: "produto-oferta-preco", name: "Preço" }],
        lab_runs: [
          { id: "run-1", experiment_id: EXPERIMENT_ID, variant_id: BASELINE_VARIANT, scenario_version_id: VERSION_V2, status: "succeeded", created_at: "2026-09-16T00:00:05Z" },
          { id: "run-2", experiment_id: EXPERIMENT_ID, variant_id: CANDIDATE_VARIANT, scenario_version_id: VERSION_V2, status: "succeeded", created_at: "2026-09-16T00:00:04Z" },
        ],
        lab_human_evaluations: [],
      },
    });

    const detail = await getExperimentDetail(fake.client, EXPERIMENT_ID);

    expect(mockReconcileStaleRuns).toHaveBeenCalledTimes(1);
    expect(mockReconcileStaleRuns).toHaveBeenCalledWith({ client: fake.client });
    // A reconciliação (mockada) não produz operações: a primeira operação real é a leitura.
    expect(fake.operations[0]).toEqual({ table: "lab_experiments", op: "select" });

    expect(detail).not.toBeNull();
    expect(detail?.budget).toEqual({ maxRuns: 6, used: 2, remaining: 4 });
    expect(detail?.scenarios[0]).toMatchObject({
      scenarioVersionId: VERSION_V2,
      slug: "produto-oferta-preco",
      version: 2,
    });
  });

  it("devolve null para experimento inexistente", async () => {
    const fake = createFakeSupabaseClient({ tables: { lab_experiments: [] } });

    await expect(getExperimentDetail(fake.client, EXPERIMENT_ID)).resolves.toBeNull();
    expect(mockReconcileStaleRuns).toHaveBeenCalledTimes(1);
  });

  it("falha de leitura das versões de cenário propaga (não devolve 200 incompleto)", async () => {
    const fake = createFakeSupabaseClient({
      tables: {
        lab_experiments: [{ id: EXPERIMENT_ID, max_runs: 6 }],
        lab_experiment_scenarios: [
          { id: "link-1", experiment_id: EXPERIMENT_ID, scenario_version_id: VERSION_V2, position: 1 },
        ],
      },
      readErrors: { lab_scenario_versions: { message: "db down" } },
    });

    await expect(getExperimentDetail(fake.client, EXPERIMENT_ID)).rejects.toThrow(
      "lab_scenario_versions_read_failed",
    );
  });

  it("falha de leitura dos cenários propaga (não devolve 200 incompleto)", async () => {
    const fake = createFakeSupabaseClient({
      tables: {
        lab_experiments: [{ id: EXPERIMENT_ID, max_runs: 6 }],
        lab_experiment_scenarios: [
          { id: "link-1", experiment_id: EXPERIMENT_ID, scenario_version_id: VERSION_V2, position: 1 },
        ],
        lab_scenario_versions: [
          { id: VERSION_V2, scenario_id: SCENARIO_ID, version: 2, content_hash: "hash-v2" },
        ],
      },
      readErrors: { lab_scenarios: { message: "db down" } },
    });

    await expect(getExperimentDetail(fake.client, EXPERIMENT_ID)).rejects.toThrow(
      "lab_scenarios_read_failed",
    );
  });
});

describe("getRunDetail", () => {
  const STORAGE_PATH = `experiments/${EXPERIMENT_ID}/runs/${RUN_ID}/output.png`;

  function tables(): Record<string, FakeRow[]> {
    return {
      lab_runs: [
        {
          id: RUN_ID,
          experiment_id: EXPERIMENT_ID,
          variant_id: BASELINE_VARIANT,
          scenario_version_id: VERSION_V2,
          repetition_index: 1,
          run_sequence: 1,
          status: "succeeded",
          snapshot: { runType: "lab" },
          created_at: "2026-09-16T00:00:05Z",
        },
      ],
      lab_artifacts: [
        {
          id: "artifact-1",
          run_id: RUN_ID,
          kind: "output",
          storage_path: STORAGE_PATH,
          mime_type: "image/png",
          width: 1024,
          height: 1024,
          bytes: 2048,
          checksum: "checksum",
          created_at: "2026-09-16T00:00:06Z",
        },
        {
          id: "artifact-removed",
          run_id: RUN_ID,
          kind: "output",
          storage_path: `experiments/${EXPERIMENT_ID}/runs/${RUN_ID}/output.jpg`,
          removed_at: "2026-09-16T00:00:07Z",
          created_at: "2026-09-16T00:00:07Z",
        },
      ],
    };
  }

  it("devolve o snapshot e o signedUrl dos artefatos não removidos", async () => {
    const fake = createFakeSupabaseClient({ tables: tables() });

    const detail = await getRunDetail(fake.client, RUN_ID);

    expect(detail).not.toBeNull();
    expect(detail?.snapshot).toEqual({ runType: "lab" });
    expect(detail?.run).not.toHaveProperty("snapshot");
    expect(detail?.artifacts).toHaveLength(1);
    expect(detail?.artifacts[0].signedUrl).toBe(`signed:${STORAGE_PATH}`);
  });

  it("mantém o artefato com signedUrl null quando a assinatura falha", async () => {
    const fake = createFakeSupabaseClient({
      tables: tables(),
      signedUrlErrors: { [STORAGE_PATH]: { message: "signed_url_failed" } },
    });

    const detail = await getRunDetail(fake.client, RUN_ID);

    expect(detail?.artifacts).toHaveLength(1);
    expect(detail?.artifacts[0].signedUrl).toBeNull();
  });

  it("devolve null para run inexistente", async () => {
    const fake = createFakeSupabaseClient({ tables: { lab_runs: [] } });

    await expect(getRunDetail(fake.client, RUN_ID)).resolves.toBeNull();
  });

  it("nenhuma escrita além da reconciliação (sem insert/delete)", async () => {
    const fake = createFakeSupabaseClient({ tables: tables() });

    await getRunDetail(fake.client, RUN_ID);

    expect(fake.insertCalls).toEqual([]);
    expect(fake.deleteCalls).toEqual([]);
  });
});
