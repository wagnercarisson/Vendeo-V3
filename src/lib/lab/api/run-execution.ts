import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { LabRunExecuteRequest } from "@/lib/admin/schemas";
import { LabTelemetrySink } from "@/lib/ai/lab-telemetry-sink";
import type { CampaignBrief } from "@/lib/campaign/brief";
import type { ResolvedCampaignContext } from "@/components/campaign/types";
import { ImageGenerationService } from "@/lib/image-generation/services/image-generation-service";
import type { LabPromptSnapshot } from "@/lib/lab/domain/prompt-snapshot";
import type { LabExperimentParams, LabModelTarget } from "@/lib/lab/domain/schemas";
import { LabPromptLoader } from "@/lib/lab/gateway/lab-prompt-loader";
import { createNoopImageProvider } from "@/lib/lab/gateway/noop-image-provider";
import { createDefaultLabRuntime } from "@/lib/lab/gateway/runtime";
import {
  LabReservationError,
  prepareLabRun,
  runReservedLabRun,
} from "@/lib/lab/run-service";
import type { LabRunEvent, LabRunStatus } from "@/lib/lab/run-service";
import type { LabRunSnapshot, LabVariantRole } from "@/lib/lab/run-snapshot";
import {
  mapScenarioToCampaignBrief,
  mapScenarioToResolvedContext,
} from "@/lib/lab/scenarios/mapper";
import { loadScenarioFixture } from "@/lib/lab/scenarios/service";

/**
 * Wiring de execução do run do Laboratório de IA (F48.1, D7/D8/D11/D14).
 *
 * Encapsula a preparação pesada para que a rota NDJSON fique fina:
 *  1. `prepareExperimentRun` — defesa em profundidade das relações
 *     (experimento/variante/cenário), mapeamento do cenário controlado para o
 *     domínio de campanha e **reserva atômica** (`prepareLabRun`) **antes** de
 *     qualquer chamada paga. Erros de reserva propagam com código determinístico.
 *  2. `runPreparedExperimentRun` — runtime isolado do gateway (alvo fixo do
 *     experimento), loader de prompt servindo o snapshot da variante **em
 *     memória**, serviço de imagem com provider no-op (o run invoca a capacidade
 *     direto no gateway) e sink próprio de telemetria.
 *
 * Garantias: exatamente **uma** invocação por run (sem alvo alternativo, sem
 * fallback automático); nenhum provider de imagem de produção é instanciado;
 * nenhum evento de geração produtivo é gravado; nenhum secret entra no snapshot.
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

/** Cenário controlado já resolvido (data URLs + domínio de campanha). */
export interface LabScenarioExecutionContext {
  imagesDataUrls: Record<string, string>;
  logoDataUrl: string | null;
  brief: CampaignBrief;
  context: ResolvedCampaignContext;
}

/** Contexto de execução montado na preparação — **nunca** persistido. */
export interface LabRunExecutionContext {
  scenario: LabScenarioExecutionContext;
  experiment: { modelTarget: LabModelTarget; params: LabExperimentParams };
  variant: { role: LabVariantRole; promptSnapshot: LabPromptSnapshot };
  variants: { baseline: LabPromptSnapshot; candidate: LabPromptSnapshot };
}

export interface PreparedLabRun {
  runId: string;
  snapshot: LabRunSnapshot;
  idempotent: boolean;
  executionContext: LabRunExecutionContext;
}

function readPromptSnapshot(value: unknown): LabPromptSnapshot {
  const row = asRow(value);
  return {
    name: text(row?.name),
    content: text(row?.content),
    contentHash: text(row?.contentHash),
    source: row?.source === "override" ? "override" : "official",
  };
}

/**
 * Prepara e **reserva** o run — nenhuma chamada paga acontece aqui.
 *
 * A validação das relações é defesa em profundidade: a RPC de reserva valida as
 * mesmas condições sob lock, mas recusar antes evita qualquer I/O pago e devolve
 * um código estável para a rota mapear em HTTP.
 */
export async function prepareExperimentRun(params: {
  client: SupabaseClient;
  experimentId: string;
  actorId: string;
  input: LabRunExecuteRequest;
}): Promise<PreparedLabRun> {
  const { client, experimentId, actorId, input } = params;

  const { data: experiment, error } = await client
    .from("lab_experiments")
    .select("id, model_target, params, status")
    .eq("id", experimentId)
    .maybeSingle();

  if (error) {
    throw new Error(`lab_experiment_read_failed:${error.message}`);
  }

  const experimentRow = asRow(experiment);
  if (!experimentRow) {
    throw new LabReservationError("experiment_not_found");
  }

  const { data: variants, error: variantsError } = await client
    .from("lab_experiment_variants")
    .select("id, role, prompt_snapshot")
    .eq("experiment_id", experimentId);

  if (variantsError) {
    throw new Error(`lab_experiment_variants_read_failed:${variantsError.message}`);
  }

  const variantRows = asRows(variants);
  const variantRow = variantRows.find((variant) => text(variant.id) === input.variantId);
  if (!variantRow) {
    throw new LabReservationError("variant_not_in_experiment");
  }

  const baselineRow = variantRows.find((variant) => variant.role === "baseline");
  const candidateRow = variantRows.find((variant) => variant.role === "candidate");
  if (!baselineRow || !candidateRow) {
    throw new LabReservationError("missing_snapshot");
  }

  const { data: link, error: linkError } = await client
    .from("lab_experiment_scenarios")
    .select("id, scenario_version_id")
    .eq("experiment_id", experimentId)
    .eq("scenario_version_id", input.scenarioVersionId)
    .maybeSingle();

  if (linkError) {
    throw new Error(`lab_experiment_scenarios_read_failed:${linkError.message}`);
  }
  if (!link) {
    throw new LabReservationError("scenario_not_in_experiment");
  }

  const { data: version, error: versionError } = await client
    .from("lab_scenario_versions")
    .select("id, scenario_id, version, content_hash")
    .eq("id", input.scenarioVersionId)
    .maybeSingle();

  if (versionError) {
    throw new Error(`lab_scenario_versions_read_failed:${versionError.message}`);
  }

  const versionRow = asRow(version);
  if (!versionRow) {
    throw new LabReservationError("scenario_not_in_experiment");
  }

  const { data: scenario, error: scenarioError } = await client
    .from("lab_scenarios")
    .select("slug")
    .eq("id", text(versionRow.scenario_id))
    .maybeSingle();

  if (scenarioError) {
    throw new Error(`lab_scenarios_read_failed:${scenarioError.message}`);
  }

  // O fixture é a fonte dos data URLs das imagens controladas e pode recusar a
  // modalidade (`unsupported_scenario_mode`) ou uma imagem ausente — nenhuma
  // reserva nem chamada paga acontece antes desta resolução.
  const fixture = await loadScenarioFixture(text(asRow(scenario)?.slug));
  const brief = mapScenarioToCampaignBrief(fixture.content, fixture.imagesDataUrls);
  const context = mapScenarioToResolvedContext(
    fixture.content,
    fixture.imagesDataUrls,
    fixture.logoDataUrl,
  );

  const modelTarget = experimentRow.model_target as LabModelTarget;
  const experimentParams = experimentRow.params as LabExperimentParams;

  const executionContext: LabRunExecutionContext = {
    scenario: {
      imagesDataUrls: fixture.imagesDataUrls,
      logoDataUrl: fixture.logoDataUrl,
      brief,
      context,
    },
    experiment: { modelTarget, params: experimentParams },
    variant: {
      role: variantRow.role === "candidate" ? "candidate" : "baseline",
      promptSnapshot: readPromptSnapshot(variantRow.prompt_snapshot),
    },
    variants: {
      baseline: readPromptSnapshot(baselineRow.prompt_snapshot),
      candidate: readPromptSnapshot(candidateRow.prompt_snapshot),
    },
  };

  const prepared = await prepareLabRun({
    client,
    experimentId,
    variantId: input.variantId,
    scenarioVersionId: input.scenarioVersionId,
    repetitionIndex: input.repetitionIndex,
    supersedesRunId: input.supersedesRunId ?? null,
    operationId: input.operationId,
    actorId,
    scenario: {
      id: input.scenarioVersionId,
      version: typeof versionRow.version === "number" ? versionRow.version : 0,
      contentHash: text(versionRow.content_hash),
    },
    experiment: { modelTarget, params: experimentParams },
    variant: executionContext.variant,
    variants: executionContext.variants,
  });

  return {
    runId: prepared.runId,
    snapshot: prepared.snapshot,
    idempotent: prepared.idempotent,
    executionContext,
  };
}

/**
 * Executa o run **já reservado** com o harness isolado.
 *
 * O contexto econômico do run (`campaign_delivery`) é montado dentro do serviço
 * de execução a partir do sink — o laboratório não reutiliza a telemetria
 * produtiva e marca `runType: "lab"` no próprio snapshot.
 */
export async function runPreparedExperimentRun(params: {
  client: SupabaseClient;
  experimentId: string;
  runId: string;
  snapshot: LabRunSnapshot;
  actorId: string;
  executionContext: LabRunExecutionContext;
  onEvent?: (event: LabRunEvent) => void;
}): Promise<{ runId: string; status: LabRunStatus }> {
  const { executionContext } = params;

  const runtime = await createDefaultLabRuntime({
    fixedTarget: executionContext.experiment.modelTarget,
  });

  const promptLoader = new LabPromptLoader([
    {
      name: executionContext.variant.promptSnapshot.name,
      content: executionContext.variant.promptSnapshot.content,
    },
  ]);

  // O provider no-op existe apenas para satisfazer o construtor do serviço: o
  // prompt é montado por `buildDirectorPrompt` e a capacidade é invocada direto
  // no gateway (se o provider for chamado, ele lança — prova de que não há
  // segunda chamada paga).
  const imageService = new ImageGenerationService(createNoopImageProvider(), promptLoader);

  const sink = new LabTelemetrySink();

  const result = await runReservedLabRun({
    client: params.client,
    experimentId: params.experimentId,
    runId: params.runId,
    snapshot: params.snapshot,
    actorId: params.actorId,
    scenario: executionContext.scenario,
    experiment: { params: executionContext.experiment.params },
    gateway: runtime.gateway,
    sink,
    promptLoader,
    imageService,
    onEvent: params.onEvent,
  });

  return { runId: result.runId, status: result.status };
}
