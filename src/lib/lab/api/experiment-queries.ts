import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createArtifactSignedUrls,
  listRunArtifacts,
} from "@/lib/lab/persistence/artifact-service";
import * as labRunService from "@/lib/lab/run-service";

/**
 * Camada de **leitura** da API administrativa do Laboratório de IA
 * (F48.1, D11/D13).
 *
 * Regras de implementação:
 *  - o client Supabase entra **por parâmetro** em todas as funções (testes usam
 *    fakes em memória — nenhuma chamada de rede);
 *  - a superfície é **somente leitura**, com uma única exceção documentada: a
 *    reconciliação preguiçosa de runs órfãos no detalhe do experimento, que marca
 *    `pending`/`running` presos como `failed` antes de montar a resposta;
 *  - o catálogo de modelos é lido em modo **somente leitura** e a seleção
 *    produtiva de modelos não é consultada nem alterada;
 *  - nenhum `content` completo de cenário (nem base64 de imagens) é devolvido.
 */

type Row = Record<string, unknown>;

function asRows(data: unknown): Row[] {
  return Array.isArray(data) ? (data as Row[]) : [];
}

function asRow(data: unknown): Row | null {
  return data && typeof data === "object" ? (data as Row) : null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function num(value: unknown, fallback = 0): number {
  return typeof value === "number" ? value : fallback;
}

function countByExperiment(rows: Row[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const id = text(row.experiment_id);
    if (!id) continue;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

// ─── Cenários versionados (somente leitura) ──────────────────────────────────

export interface LabScenarioVersionSummary {
  id: string;
  scenarioId: string;
  slug: string;
  name: string;
  version: number;
  contentHash: string;
  intent: string;
  format: string;
  locale: string;
  createdAt: string;
}

/**
 * Lista as versões de cenário disponíveis, ordenadas por `slug` + `version desc`.
 *
 * Somente metadados: `content` é reduzido a `intent`/`format`/`locale` — o JSON
 * completo (e qualquer base64 de imagem controlada) nunca atravessa a API.
 */
export async function listScenarioVersions(
  client: SupabaseClient,
): Promise<LabScenarioVersionSummary[]> {
  const { data: versions, error } = await client
    .from("lab_scenario_versions")
    .select("id, scenario_id, version, content, content_hash, created_at");

  if (error) {
    throw new Error(`lab_scenario_versions_read_failed:${error.message}`);
  }

  const { data: scenarios, error: scenariosError } = await client
    .from("lab_scenarios")
    .select("id, slug, name");

  if (scenariosError) {
    throw new Error(`lab_scenarios_read_failed:${scenariosError.message}`);
  }

  const scenarioById = new Map(asRows(scenarios).map((row) => [text(row.id), row]));

  const summaries: LabScenarioVersionSummary[] = [];
  for (const version of asRows(versions)) {
    const scenario = scenarioById.get(text(version.scenario_id));
    if (!scenario) continue;
    const content = (version.content ?? {}) as Record<string, unknown>;
    summaries.push({
      id: text(version.id),
      scenarioId: text(version.scenario_id),
      slug: text(scenario.slug),
      name: text(scenario.name),
      version: num(version.version),
      contentHash: text(version.content_hash),
      intent: text(content.intent),
      format: text(content.format),
      locale: text(content.locale),
      createdAt: text(version.created_at),
    });
  }

  return summaries.sort((a, b) =>
    a.slug === b.slug ? b.version - a.version : a.slug.localeCompare(b.slug),
  );
}

// ─── Catálogo de modelos (somente leitura) ───────────────────────────────────

export interface ActiveCampaignImageTarget {
  provider: string;
  model: string;
  protocol: string;
}

/**
 * Alvo ativo de `campaign_image` no catálogo F47 — **apenas `select`**.
 *
 * A seleção produtiva de modelos não é referenciada: o laboratório nunca lê nem
 * altera a escolha de modelo em produção.
 */
export async function getActiveCampaignImageTarget(
  client: SupabaseClient,
): Promise<ActiveCampaignImageTarget | null> {
  const { data, error } = await client
    .from("ai_model_catalog")
    .select("provider, model, protocol")
    .eq("capability", "campaign_image")
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    throw new Error(`ai_model_catalog_read_failed:${error.message}`);
  }

  const row = asRow(data);
  if (!row) return null;

  return {
    provider: text(row.provider),
    model: text(row.model),
    protocol: text(row.protocol),
  };
}

// ─── Experimentos recentes ───────────────────────────────────────────────────

export interface LabExperimentSummary {
  id: string;
  name: string;
  status: string;
  repetitions: number;
  maxRuns: number;
  runsUsed: number;
  remainingRuns: number;
  scenarioCount: number;
  updatedAt: string;
}

/** Lista os experimentos mais recentes (default 20) com budget restante. */
export async function listRecentExperiments(
  client: SupabaseClient,
  limit = 20,
): Promise<LabExperimentSummary[]> {
  const { data: experiments, error } = await client
    .from("lab_experiments")
    .select("id, name, status, repetitions, max_runs, updated_at")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`lab_experiments_read_failed:${error.message}`);
  }

  const { data: runs, error: runsError } = await client
    .from("lab_runs")
    .select("id, experiment_id");

  if (runsError) {
    throw new Error(`lab_runs_read_failed:${runsError.message}`);
  }

  const { data: scenarios, error: scenariosError } = await client
    .from("lab_experiment_scenarios")
    .select("id, experiment_id");

  if (scenariosError) {
    throw new Error(`lab_experiment_scenarios_read_failed:${scenariosError.message}`);
  }

  const runsByExperiment = countByExperiment(asRows(runs));
  const scenariosByExperiment = countByExperiment(asRows(scenarios));

  return asRows(experiments).map((experiment) => {
    const id = text(experiment.id);
    const maxRuns = num(experiment.max_runs);
    const runsUsed = runsByExperiment.get(id) ?? 0;

    return {
      id,
      name: text(experiment.name),
      status: text(experiment.status),
      repetitions: num(experiment.repetitions),
      maxRuns,
      runsUsed,
      remainingRuns: Math.max(0, maxRuns - runsUsed),
      scenarioCount: scenariosByExperiment.get(id) ?? 0,
      updatedAt: text(experiment.updated_at),
    };
  });
}

// ─── Avaliações pendentes ────────────────────────────────────────────────────

export interface LabPendingEvaluation {
  experimentId: string;
  experimentName: string;
  scenarioVersionId: string;
  scenarioLabel: string;
  baselineRunId: string;
  candidateRunId: string;
}

function latestSucceededRun(
  runs: Row[],
  params: { variantId: string; scenarioVersionId: string },
): Row | null {
  const candidates = runs
    .filter(
      (run) =>
        text(run.variant_id) === params.variantId &&
        text(run.scenario_version_id) === params.scenarioVersionId &&
        run.status === "succeeded",
    )
    .sort((a, b) => text(b.created_at).localeCompare(text(a.created_at)));

  return candidates[0] ?? null;
}

/**
 * Pendências de avaliação: por experimento em `running`/`evaluated` e por
 * cenário vinculado, o par (run mais recente `succeeded` de `baseline`, idem de
 * `candidate`) que **ainda não** possui avaliação registrada com exatamente
 * esses dois runs.
 */
export async function listPendingEvaluations(
  client: SupabaseClient,
): Promise<LabPendingEvaluation[]> {
  const { data: experiments, error } = await client
    .from("lab_experiments")
    .select("id, name, status")
    .in("status", ["running", "evaluated"]);

  if (error) {
    throw new Error(`lab_experiments_read_failed:${error.message}`);
  }

  const experimentRows = asRows(experiments);
  if (experimentRows.length === 0) return [];

  const experimentIds = experimentRows.map((row) => text(row.id));

  const { data: links, error: linksError } = await client
    .from("lab_experiment_scenarios")
    .select("id, experiment_id, scenario_version_id")
    .in("experiment_id", experimentIds);

  if (linksError) {
    throw new Error(`lab_experiment_scenarios_read_failed:${linksError.message}`);
  }

  const { data: runs, error: runsError } = await client
    .from("lab_runs")
    .select("id, experiment_id, scenario_version_id, variant_id, status, created_at")
    .in("experiment_id", experimentIds);

  if (runsError) {
    throw new Error(`lab_runs_read_failed:${runsError.message}`);
  }

  const { data: variants, error: variantsError } = await client
    .from("lab_experiment_variants")
    .select("id, experiment_id, role")
    .in("experiment_id", experimentIds);

  if (variantsError) {
    throw new Error(`lab_experiment_variants_read_failed:${variantsError.message}`);
  }

  const { data: evaluations, error: evaluationsError } = await client
    .from("lab_human_evaluations")
    .select("id, experiment_id, scenario_version_id, baseline_run_id, candidate_run_id")
    .in("experiment_id", experimentIds);

  if (evaluationsError) {
    throw new Error(`lab_human_evaluations_read_failed:${evaluationsError.message}`);
  }

  const { data: versions, error: versionsError } = await client
    .from("lab_scenario_versions")
    .select("id, scenario_id, version");

  if (versionsError) {
    throw new Error(`lab_scenario_versions_read_failed:${versionsError.message}`);
  }

  const { data: scenarios, error: scenariosError } = await client
    .from("lab_scenarios")
    .select("id, slug, name");

  if (scenariosError) {
    throw new Error(`lab_scenarios_read_failed:${scenariosError.message}`);
  }

  const scenarioBySlugId = new Map(asRows(scenarios).map((row) => [text(row.id), row]));
  const versionLabel = new Map<string, string>();
  for (const version of asRows(versions)) {
    const scenario = scenarioBySlugId.get(text(version.scenario_id));
    versionLabel.set(
      text(version.id),
      `${text(scenario?.slug) || text(scenario?.name)} v${num(version.version)}`,
    );
  }

  const pending: LabPendingEvaluation[] = [];

  for (const experiment of experimentRows) {
    const experimentId = text(experiment.id);
    const experimentRuns = asRows(runs).filter((run) => text(run.experiment_id) === experimentId);
    const experimentVariants = asRows(variants).filter(
      (variant) => text(variant.experiment_id) === experimentId,
    );
    const baselineVariant = experimentVariants.find((variant) => variant.role === "baseline");
    const candidateVariant = experimentVariants.find((variant) => variant.role === "candidate");
    if (!baselineVariant || !candidateVariant) continue;

    const evaluatedPairs = new Set(
      asRows(evaluations)
        .filter((evaluation) => text(evaluation.experiment_id) === experimentId)
        .map(
          (evaluation) =>
            `${text(evaluation.baseline_run_id)}|${text(evaluation.candidate_run_id)}`,
        ),
    );

    const experimentLinks = asRows(links).filter(
      (link) => text(link.experiment_id) === experimentId,
    );

    for (const link of experimentLinks) {
      const scenarioVersionId = text(link.scenario_version_id);
      const baselineRun = latestSucceededRun(experimentRuns, {
        variantId: text(baselineVariant.id),
        scenarioVersionId,
      });
      const candidateRun = latestSucceededRun(experimentRuns, {
        variantId: text(candidateVariant.id),
        scenarioVersionId,
      });
      if (!baselineRun || !candidateRun) continue;

      const baselineRunId = text(baselineRun.id);
      const candidateRunId = text(candidateRun.id);
      if (evaluatedPairs.has(`${baselineRunId}|${candidateRunId}`)) continue;

      pending.push({
        experimentId,
        experimentName: text(experiment.name),
        scenarioVersionId,
        scenarioLabel: versionLabel.get(scenarioVersionId) ?? scenarioVersionId,
        baselineRunId,
        candidateRunId,
      });
    }
  }

  return pending;
}

// ─── Detalhe do experimento ──────────────────────────────────────────────────

export interface LabExperimentDetail {
  experiment: Row;
  variants: Row[];
  scenarios: Array<{
    id: string;
    scenarioVersionId: string;
    slug: string;
    name: string;
    version: number;
    contentHash: string;
    position: number;
  }>;
  runs: Row[];
  evaluations: Row[];
  budget: { maxRuns: number; used: number; remaining: number };
}

/**
 * Detalhe do experimento com variantes, cenários vinculados, runs, avaliações e
 * budget restante.
 *
 * A primeira operação é a **reconciliação preguiçosa** de runs órfãos
 * (`pending`/`running` além de `LAB_RUN_STALE_MS`) — única escrita deste módulo,
 * necessária para que o budget e o índice global de run ativo não fiquem presos
 * por um processo morto.
 */
export async function getExperimentDetail(
  client: SupabaseClient,
  experimentId: string,
): Promise<LabExperimentDetail | null> {
  await labRunService.reconcileStaleRuns({ client });

  const { data: experiment, error } = await client
    .from("lab_experiments")
    .select(
      "id, name, objective, hypothesis, changed_dimension, primary_capability, model_target, params, status, repetitions, max_runs, notes, created_by, created_at, updated_at",
    )
    .eq("id", experimentId)
    .maybeSingle();

  if (error) {
    throw new Error(`lab_experiment_read_failed:${error.message}`);
  }

  const experimentRow = asRow(experiment);
  if (!experimentRow) return null;

  const { data: variants, error: variantsError } = await client
    .from("lab_experiment_variants")
    .select("id, role, label, prompt_snapshot, created_at")
    .eq("experiment_id", experimentId);

  if (variantsError) {
    throw new Error(`lab_experiment_variants_read_failed:${variantsError.message}`);
  }

  const { data: links, error: linksError } = await client
    .from("lab_experiment_scenarios")
    .select("id, scenario_version_id, position")
    .eq("experiment_id", experimentId);

  if (linksError) {
    throw new Error(`lab_experiment_scenarios_read_failed:${linksError.message}`);
  }

  const linkRows = asRows(links);
  const versionIds = linkRows.map((link) => text(link.scenario_version_id));

  const versions = versionIds.length
    ? asRows(
        (
          await client
            .from("lab_scenario_versions")
            .select("id, scenario_id, version, content_hash")
            .in("id", versionIds)
        ).data,
      )
    : [];

  const scenarioIds = versions.map((version) => text(version.scenario_id));
  const scenarios = scenarioIds.length
    ? asRows(
        (await client.from("lab_scenarios").select("id, slug, name").in("id", scenarioIds)).data,
      )
    : [];

  const scenarioById = new Map(scenarios.map((scenario) => [text(scenario.id), scenario]));
  const versionById = new Map(versions.map((version) => [text(version.id), version]));

  const scenarioSummaries = linkRows
    .map((link) => {
      const version = versionById.get(text(link.scenario_version_id));
      const scenario = version ? scenarioById.get(text(version.scenario_id)) : undefined;
      if (!version) return null;
      return {
        id: text(link.id),
        scenarioVersionId: text(link.scenario_version_id),
        slug: text(scenario?.slug),
        name: text(scenario?.name),
        version: num(version.version),
        contentHash: text(version.content_hash),
        position: num(link.position),
      };
    })
    .filter((row): row is LabExperimentDetail["scenarios"][number] => row !== null)
    .sort((a, b) => a.position - b.position);

  const { data: runs, error: runsError } = await client
    .from("lab_runs")
    .select(
      "id, variant_id, scenario_version_id, repetition_index, run_sequence, supersedes_run_id, status, latency_ms, estimated_cost_usd, cost_detail, error_type, error_message, technical_validation, created_at, started_at, finished_at",
    )
    .eq("experiment_id", experimentId)
    .order("created_at", { ascending: false });

  if (runsError) {
    throw new Error(`lab_runs_read_failed:${runsError.message}`);
  }

  const { data: evaluations, error: evaluationsError } = await client
    .from("lab_human_evaluations")
    .select(
      "id, scenario_version_id, baseline_run_id, candidate_run_id, verdict, observation, evaluator_id, blind_order, created_at",
    )
    .eq("experiment_id", experimentId)
    .order("created_at", { ascending: false });

  if (evaluationsError) {
    throw new Error(`lab_human_evaluations_read_failed:${evaluationsError.message}`);
  }

  const runRows = asRows(runs);
  const maxRuns = num(experimentRow.max_runs);

  return {
    experiment: experimentRow,
    variants: asRows(variants),
    scenarios: scenarioSummaries,
    runs: runRows,
    evaluations: asRows(evaluations),
    budget: { maxRuns, used: runRows.length, remaining: Math.max(0, maxRuns - runRows.length) },
  };
}

// ─── Detalhe do run ──────────────────────────────────────────────────────────

export interface LabRunDetail {
  run: Row;
  snapshot: unknown;
  artifacts: Array<Record<string, unknown>>;
}

/**
 * Detalhe do run com o snapshot congelado e os artefatos **não removidos**,
 * cada um enriquecido com `signedUrl` (TTL de 3600s, resolvido server-side).
 *
 * Artefato cuja assinatura falha permanece na lista com `signedUrl: null` — o
 * detalhe nunca é derrubado por um único path problemático.
 */
export async function getRunDetail(
  client: SupabaseClient,
  runId: string,
): Promise<LabRunDetail | null> {
  const { data: run, error } = await client
    .from("lab_runs")
    .select(
      "id, experiment_id, variant_id, scenario_version_id, repetition_index, run_sequence, supersedes_run_id, status, provider, model, protocol, capability, attempts, latency_ms, usage, estimated_cost_usd, cost_detail, error_type, error_message, technical_validation, calls, snapshot, started_at, finished_at, created_at",
    )
    .eq("id", runId)
    .maybeSingle();

  if (error) {
    throw new Error(`lab_run_read_failed:${error.message}`);
  }

  const runRow = asRow(run);
  if (!runRow) return null;

  const artifacts = await listRunArtifacts({ client, runId });
  const signedUrls = await createArtifactSignedUrls({
    client,
    storagePaths: artifacts.map((artifact) => artifact.storagePath),
  });

  const { snapshot, ...runSummary } = runRow;

  return {
    run: runSummary,
    snapshot: snapshot ?? null,
    artifacts: artifacts.map((artifact) => ({
      ...artifact,
      signedUrl: signedUrls[artifact.storagePath] ?? null,
    })),
  };
}
