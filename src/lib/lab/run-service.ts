import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { sanitizeAiErrorMessage } from "@/lib/ai/types";
import type { AiInvocationRequest } from "@/lib/ai/types";
import type { AiInvoker } from "@/lib/ai/gateway";
import type { CostResolution } from "@/lib/ai-cost/types";
import type { LabTelemetrySink } from "@/lib/ai/lab-telemetry-sink";
import type { CampaignBrief } from "@/lib/campaign/brief";
import type { ResolvedCampaignContext } from "@/components/campaign/types";
import type { ImageGenerationService } from "@/lib/image-generation/services/image-generation-service";

import { LAB_RUN_STALE_MS } from "./limits";
import { computePromptContentHash } from "./domain/prompt-snapshot";
import type { LabPromptSnapshot } from "./domain/prompt-snapshot";
import type { LabExperimentParams, LabModelTarget } from "./domain/schemas";
import { createLabTelemetryContext, runLabCampaignImage } from "./gateway/runtime";
import type { LabPromptLoader } from "./gateway/lab-prompt-loader";
import {
  LAB_ALLOWED_ARTIFACT_MIME_TYPES,
  persistOutputArtifact,
} from "./persistence/artifact-service";
import type { LabArtifactMimeType } from "./persistence/artifact-service";
import { assertSnapshotComplete, buildLabRunSnapshot, readCodeVersion } from "./run-snapshot";
import type { LabRunSnapshot, LabVariantRole } from "./run-snapshot";
import { validateArtifactTechnically } from "./technical-validation";
import type { LabTechnicalValidation } from "./technical-validation";

/**
 * Serviço de execução do Laboratório de IA (F48.1, D7/D8/D14).
 *
 * Concentra o ciclo de vida do run:
 *  1. **reserva atômica** (`lab_reserve_run`) antes de qualquer chamada paga —
 *     o snapshot completo vai em `p_snapshot` na mesma transação;
 *  2. transições de estado do run (`pending → running → terminal`);
 *  3. persistência de latência/usage/custo/erro sanitizado/validação;
 *  4. reconciliação preguiçosa de runs órfãos (`pending` **e** `running`).
 *
 * O client Supabase entra **por parâmetro** em todas as funções — testes usam
 * fakes em memória (nenhuma chamada de rede e nenhuma chamada paga).
 */

// ─── Códigos de erro da reserva (11 + fallback) ──────────────────────────────

/** Códigos de erro mapeados da RPC `lab_reserve_run`. */
export const LAB_RESERVATION_ERROR_CODES = [
  "budget_exceeded",
  "run_already_active",
  "missing_snapshot",
  "missing_operation_id",
  "experiment_not_found",
  "experiment_not_ready",
  "idempotency_conflict",
  "variant_not_in_experiment",
  "scenario_not_in_experiment",
  "repetition_out_of_range",
  "invalid_supersedes_run",
] as const;

export type LabReservationErrorCode =
  | (typeof LAB_RESERVATION_ERROR_CODES)[number]
  | "lab_reservation_failed";

/**
 * Erro de reserva. Carrega o código determinístico para a rota mapear em HTTP
 * **antes** de abrir o stream — nenhuma execução acontece quando ele é lançado.
 */
export class LabReservationError extends Error {
  readonly code: LabReservationErrorCode;

  constructor(code: LabReservationErrorCode) {
    super(code);
    this.name = "LabReservationError";
    this.code = code;
  }
}

/** Código de transição/finalização do run que falhou no banco. */
export const LAB_RUN_TRANSITION_FAILED = "lab_run_transition_failed";

/** Código de falha da reconciliação de órfãos. */
export const LAB_RUN_RECONCILE_FAILED = "lab_run_reconcile_failed";

/** Estado do run (mesmo domínio do CHECK da tabela). */
export type LabRunStatus = "pending" | "running" | "succeeded" | "failed" | "cancelled" | "timeout";

/** Estados terminais do run — nenhum deles volta a ser executado. */
export type LabTerminalRunStatus = "succeeded" | "failed" | "cancelled" | "timeout";

/** `true` quando o estado não admite mais transições. */
export function isRunTerminal(status: LabRunStatus): boolean {
  return (
    status === "succeeded" || status === "failed" || status === "cancelled" || status === "timeout"
  );
}

function readReservationErrorCode(message: string): LabReservationErrorCode {
  const found = LAB_RESERVATION_ERROR_CODES.find((code) => message.includes(code));
  return found ?? "lab_reservation_failed";
}

/**
 * Reserva o run de forma transacional, **antes de qualquer chamada paga**.
 *
 * O snapshot é validado localmente (`assertSnapshotComplete`) antes do I/O: um
 * snapshot vazio nunca chega ao banco. O `run_sequence` é **sempre** o valor
 * devolvido pela RPC — o cliente nunca o calcula nem o envia.
 */
export async function reserveLabRun(params: {
  client: SupabaseClient;
  experimentId: string;
  variantId: string;
  scenarioVersionId: string;
  repetitionIndex: number;
  supersedesRunId: string | null;
  snapshot: LabRunSnapshot;
  operationId: string;
  actorId: string;
}): Promise<{ runId: string; runSequence: number | null; idempotent: boolean }> {
  assertSnapshotComplete(params.snapshot);

  const { data, error } = await params.client.rpc("lab_reserve_run", {
    p_experiment_id: params.experimentId,
    p_variant_id: params.variantId,
    p_scenario_version_id: params.scenarioVersionId,
    p_repetition_index: params.repetitionIndex,
    p_supersedes_run_id: params.supersedesRunId,
    p_snapshot: params.snapshot,
    p_operation_id: params.operationId,
    p_actor_id: params.actorId,
  });

  if (error) {
    throw new LabReservationError(readReservationErrorCode(error.message));
  }

  const payload = (data ?? {}) as {
    run_id?: string;
    run_sequence?: number;
    idempotent?: boolean;
  };

  return {
    runId: payload.run_id as string,
    runSequence: typeof payload.run_sequence === "number" ? payload.run_sequence : null,
    idempotent: payload.idempotent === true,
  };
}

/**
 * Marca o run como `running` — apenas colunas de resultado (o trigger permite).
 *
 * Transição **compare-and-set**: só promove um run que ainda está `pending` e
 * exige que exatamente 1 linha seja afetada. Um run já reconciliado como `failed`
 * (ou já terminal) nunca é sobrescrito.
 */
export async function markRunRunning(params: {
  client: SupabaseClient;
  runId: string;
  startedAt?: string;
}): Promise<void> {
  const { data, error } = await params.client
    .from("lab_runs")
    .update({
      status: "running",
      started_at: params.startedAt ?? new Date().toISOString(),
      attempts: 1,
    })
    .eq("id", params.runId)
    .eq("status", "pending")
    .select("id");

  if (error || !Array.isArray(data) || data.length !== 1) {
    throw new Error(LAB_RUN_TRANSITION_FAILED);
  }
}

/**
 * Grava o estado terminal do run com as evidências do resultado.
 *
 * Transição **compare-and-set**: só finaliza um run ainda ativo (`pending` ou
 * `running`) e exige exatamente 1 linha afetada — um run já terminal nunca é
 * sobrescrito. `snapshot` **nunca** é gravado aqui (imutável, definido na
 * reserva) e o `errorMessage` passa sempre por `sanitizeAiErrorMessage` antes de
 * persistir.
 */
export async function finalizeLabRun(params: {
  client: SupabaseClient;
  runId: string;
  status: LabTerminalRunStatus;
  latencyMs?: number;
  usage?: unknown;
  estimatedCostUsd?: number | null;
  costDetail?: CostResolution | null;
  calls?: unknown[];
  technicalValidation?: unknown;
  provider?: string | null;
  model?: string | null;
  protocol?: string | null;
  capability?: string | null;
  attempts?: number;
  errorType?: string | null;
  errorMessage?: string | null;
  finishedAt?: string;
}): Promise<void> {
  const update: Record<string, unknown> = {
    status: params.status,
    finished_at: params.finishedAt ?? new Date().toISOString(),
  };

  if (params.latencyMs !== undefined) update.latency_ms = params.latencyMs;
  if (params.usage !== undefined) update.usage = params.usage;
  if (params.estimatedCostUsd !== undefined) update.estimated_cost_usd = params.estimatedCostUsd;
  if (params.costDetail !== undefined) update.cost_detail = params.costDetail;
  if (params.calls !== undefined) update.calls = params.calls;
  if (params.technicalValidation !== undefined) {
    update.technical_validation = params.technicalValidation;
  }
  if (params.provider !== undefined) update.provider = params.provider;
  if (params.model !== undefined) update.model = params.model;
  if (params.protocol !== undefined) update.protocol = params.protocol;
  if (params.capability !== undefined) update.capability = params.capability;
  if (params.attempts !== undefined) update.attempts = params.attempts;
  if (params.errorType !== undefined) update.error_type = params.errorType;
  if (params.errorMessage !== undefined && params.errorMessage !== null) {
    update.error_message = sanitizeAiErrorMessage(params.errorMessage);
  }

  const { data, error } = await params.client
    .from("lab_runs")
    .update(update)
    .eq("id", params.runId)
    .in("status", ["pending", "running"])
    .select("id");

  // Compare-and-set: a transição só vale se o run ainda estava ativo. Um run já
  // terminal (ex.: reconciliado como órfão) **nunca** é sobrescrito.
  if (error || !Array.isArray(data) || data.length !== 1) {
    throw new Error(LAB_RUN_TRANSITION_FAILED);
  }
}

/**
 * Reconciliação preguiçosa de runs órfãos — sem scheduler.
 *
 * Marca como `failed` os runs que permanecem **`pending` ou `running`** além de
 * `staleMs` (default `LAB_RUN_STALE_MS`), usando `coalesce(started_at,
 * created_at)`. Cobre os dois estados ativos de propósito: um `pending` preso
 * (processo morto antes de `markRunRunning`) também bloquearia o experimento por
 * causa do índice único parcial global de run ativo.
 *
 * É chamada na leitura (detalhe do experimento), nunca por agendamento.
 *
 * O `UPDATE` reaplica **atomicamente** o estado de origem e o cutoff de
 * `coalesce(started_at, created_at)` — a seleção prévia serve apenas para o
 * curto-circuito e o filtro autoritativo roda no próprio update.
 */
export async function reconcileStaleRuns(params: {
  client: SupabaseClient;
  now?: Date;
  staleMs?: number;
}): Promise<{ reconciled: number }> {
  const now = params.now ?? new Date();
  const staleMs = params.staleMs ?? LAB_RUN_STALE_MS;
  const cutoffMs = now.getTime() - staleMs;

  const { data, error } = await params.client
    .from("lab_runs")
    .select("id, status, started_at, created_at")
    .in("status", ["pending", "running"]);

  if (error) {
    throw new Error(LAB_RUN_RECONCILE_FAILED);
  }

  const stale = ((data ?? []) as Array<Record<string, unknown>>).filter((row) => {
    const reference = (row.started_at as string | null) ?? (row.created_at as string | null);
    if (typeof reference !== "string") return false;
    const referenceMs = Date.parse(reference);
    return Number.isFinite(referenceMs) && referenceMs < cutoffMs;
  });

  if (stale.length === 0) {
    return { reconciled: 0 };
  }

  const staleIds = stale.map((row) => row.id);
  const cutoffIso = new Date(cutoffMs).toISOString();
  const terminal = {
    status: "failed",
    error_type: "orphan_run_timeout",
    error_message: "Run órfão marcado como falho",
    finished_at: now.toISOString(),
  };

  // O update **reaplica atomicamente** o estado de origem **e** o cutoff de
  // `coalesce(started_at, created_at)` — o filtro roda no próprio `UPDATE`.
  // Fecha a corrida em que um run `pending` antigo é promovido a `running` com
  // `started_at` recente entre o select e o update: ele deixa de casar o cutoff
  // e **não** é reconciliado (o executor continua dono do run, sem liberar o
  // índice global por baixo de uma chamada paga em andamento).
  //
  // O `coalesce` é expresso por dois ramos mutuamente exclusivos de estado:
  //  - `running`  ⇒ `started_at` sempre definido por `markRunRunning`;
  //  - `pending`  ⇒ `started_at` nulo (inserido pela reserva) e `created_at` é a referência.
  const runningResult = await params.client
    .from("lab_runs")
    .update(terminal)
    .in("id", staleIds)
    .eq("status", "running")
    .lt("started_at", cutoffIso)
    .select("id");

  if (runningResult.error) {
    throw new Error(LAB_RUN_RECONCILE_FAILED);
  }

  const pendingResult = await params.client
    .from("lab_runs")
    .update(terminal)
    .in("id", staleIds)
    .eq("status", "pending")
    .is("started_at", null)
    .lt("created_at", cutoffIso)
    .select("id");

  if (pendingResult.error) {
    throw new Error(LAB_RUN_RECONCILE_FAILED);
  }

  const reconciled =
    (Array.isArray(runningResult.data) ? runningResult.data.length : 0) +
    (Array.isArray(pendingResult.data) ? pendingResult.data.length : 0);

  return { reconciled };
}

// ─── Execução real e focada (D7/D8) ──────────────────────────────────────────

/** Código da falha de persistência do artefato (nenhum órfão é deixado). */
export const ARTIFACT_PERSISTENCE_FAILED = "artifact_persistence_failed";

/** Código da ausência de payload de imagem no resultado do provider. */
export const MISSING_IMAGE_PAYLOAD = "missing_image_payload";

/** Código do descompasso entre o cenário reservado e o cenário congelado. */
export const LAB_RUN_SCENARIO_MISMATCH = "lab_run_scenario_mismatch";

/** Código do artefato cujo MIME real (dos bytes) não é aceito pelo bucket. */
export const UNSUPPORTED_ARTIFACT_MIME_TYPE = "unsupported_artifact_mime_type";

/** Código do run encerrado sem estado terminal conhecido (finally). */
export const LAB_RUN_ABORTED = "run_aborted";

/** Código do prompt servido que não corresponde ao snapshot congelado. */
export const LAB_PROMPT_SNAPSHOT_MISMATCH = "prompt_snapshot_mismatch";

/** Erro de execução do run — carrega o código determinístico persistido. */
class LabRunExecutionError extends Error {
  readonly code: string;

  constructor(code: string, message?: string) {
    super(message ?? code);
    this.name = "LabRunExecutionError";
    this.code = code;
  }
}

/** Evento emitido durante a execução (a rota de 48-1-08 o serializa em NDJSON). */
export interface LabRunEvent {
  type: "phase" | "done" | "error";
  phase?: string;
  status?: string;
  message?: string;
  runId?: string;
  code?: string;
}

/**
 * MIME **real** do artefato, derivado dos bytes pela validação técnica (nunca da
 * extensão nem de um default adivinhado) e restrito à allowlist do bucket.
 *
 * Bytes não decodificáveis ou com MIME fora da allowlist são recusados de forma
 * explícita — o objeto nunca é gravado com um MIME que não corresponde ao
 * conteúdo.
 */
function resolveArtifactMimeType(validation: LabTechnicalValidation): LabArtifactMimeType {
  const allowed = LAB_ALLOWED_ARTIFACT_MIME_TYPES as readonly string[];
  const detected = validation.mimeType;
  if (!validation.decodable || !detected || !allowed.includes(detected)) {
    throw new LabRunExecutionError(UNSUPPORTED_ARTIFACT_MIME_TYPE);
  }
  return detected as LabArtifactMimeType;
}

/**
 * Confere que o loader serve exatamente o prompt congelado no snapshot.
 *
 * O prompt do run vive apenas em memória (`LabPromptLoader`) e é montado a
 * partir do snapshot da variante. Esta checagem fecha o ciclo: o conteúdo
 * efetivamente servido precisa ter o mesmo hash do snapshot — nenhum prompt
 * oficial é lido/escrito e nenhum prompt diferente do congelado é executado.
 */
function assertPromptUnderTestServed(
  promptLoader: LabPromptLoader,
  snapshot: LabRunSnapshot,
): void {
  const served = promptLoader.load(snapshot.prompt.name);
  if (computePromptContentHash(served) !== snapshot.prompt.contentHash) {
    throw new LabRunExecutionError(LAB_PROMPT_SNAPSHOT_MISMATCH);
  }
}

/** Recorte sanitizado de uma chamada real para `lab_runs.calls[]` (sem secret). */
function toCallRecord(entry: {
  capability: string;
  provider: string;
  model: string;
  protocol: string;
  status: string;
  durationMs: number;
  usage?: unknown;
  cost: CostResolution;
  errorType?: string;
}): Record<string, unknown> {
  return {
    capability: entry.capability,
    provider: entry.provider,
    model: entry.model,
    protocol: entry.protocol,
    status: entry.status,
    durationMs: entry.durationMs,
    usage: entry.usage,
    cost: entry.cost,
    errorType: entry.errorType,
  };
}

/**
 * Evidências reais acumuladas no sink, prontas para `finalizeLabRun`.
 *
 * Usada **tanto no sucesso quanto na falha**: uma chamada paga que falhou depois
 * de emitir o envelope (provider, imagem ausente, artefato) continua registrando
 * `calls`, custo, `usage`, provider/modelo e tentativas. `attempts` só é
 * sobrescrito quando houve chamada real — caso contrário preserva o valor
 * gravado por `markRunRunning`.
 */
function collectSinkEvidence(sink: LabTelemetrySink): {
  usage: unknown;
  estimatedCostUsd: number | null;
  costDetail: CostResolution | null;
  calls: unknown[];
  provider: string | null;
  model: string | null;
  protocol: string | null;
  capability: string | null;
  attempts?: number;
} {
  const entries = sink.entries;
  const lastEntry = entries[entries.length - 1];
  const costSummary = sink.costSummary;

  return {
    usage: lastEntry?.usage ?? null,
    estimatedCostUsd: costSummary?.estimatedCostUsd ?? null,
    costDetail: costSummary,
    calls: entries.map((entry) => toCallRecord(entry)),
    provider: lastEntry?.provider ?? null,
    model: lastEntry?.model ?? null,
    protocol: lastEntry?.protocol ?? null,
    capability: lastEntry?.capability ?? null,
    attempts: entries.length > 0 ? entries.length : undefined,
  };
}

function normalizeExecutionError(err: unknown): { code: string; message: string } {
  if (err instanceof LabRunExecutionError) {
    return { code: err.code, message: err.message };
  }
  const message = err instanceof Error ? err.message : String(err);
  return { code: "provider_error", message: message.length > 0 ? message : "provider_error" };
}

/**
 * Passos 1-2 do caminho de execução: monta o snapshot e **reserva** o run.
 *
 * Separada de `runReservedLabRun` de propósito: a rota (48-1-08) precisa mapear
 * erros de reserva para HTTP **antes** de abrir o stream NDJSON. Nenhuma chamada
 * paga acontece aqui — um erro de reserva propaga `LabReservationError` e
 * `idempotent === true` devolve o run existente sem executar nada.
 */
export async function prepareLabRun(params: {
  client: SupabaseClient;
  experimentId: string;
  variantId: string;
  scenarioVersionId: string;
  repetitionIndex: number;
  supersedesRunId: string | null;
  operationId: string;
  actorId: string;
  scenario: { id: string; version: number; contentHash: string };
  experiment: { modelTarget: LabModelTarget; params: LabExperimentParams };
  variant: { role: LabVariantRole; promptSnapshot: LabPromptSnapshot };
  variants: { baseline: LabPromptSnapshot; candidate: LabPromptSnapshot };
}): Promise<{ runId: string; snapshot: LabRunSnapshot; idempotent: boolean }> {
  if (params.scenario.id !== params.scenarioVersionId) {
    // O snapshot congelaria um cenário diferente do reservado — recusa antes do I/O.
    throw new Error(LAB_RUN_SCENARIO_MISMATCH);
  }

  const snapshot = buildLabRunSnapshot({
    scenarioVersionId: params.scenarioVersionId,
    scenarioVersion: params.scenario.version,
    scenarioContentHash: params.scenario.contentHash,
    prompt: params.variant.promptSnapshot,
    modelTarget: params.experiment.modelTarget,
    params: params.experiment.params,
    variantRole: params.variant.role,
    variants: params.variants,
    codeVersion: readCodeVersion(),
  });

  const reservation = await reserveLabRun({
    client: params.client,
    experimentId: params.experimentId,
    variantId: params.variantId,
    scenarioVersionId: params.scenarioVersionId,
    repetitionIndex: params.repetitionIndex,
    supersedesRunId: params.supersedesRunId,
    snapshot,
    operationId: params.operationId,
    actorId: params.actorId,
  });

  return { runId: reservation.runId, snapshot, idempotent: reservation.idempotent };
}

/**
 * Passos 3-10: executa o run já reservado.
 *
 * Exatamente **uma** invocação de `campaign_image` (sem alvo alternativo e sem
 * fallback automático), artefato persistido com validação técnica objetiva e
 * estado terminal garantido no `finally` — mesmo com erro, exceção ou
 * desconexão do cliente.
 */
export async function runReservedLabRun(params: {
  client: SupabaseClient;
  experimentId: string;
  runId: string;
  snapshot: LabRunSnapshot;
  actorId: string;
  scenario: {
    imagesDataUrls: Record<string, string>;
    logoDataUrl: string | null;
    brief: CampaignBrief;
    context: ResolvedCampaignContext;
  };
  experiment: { params: LabExperimentParams };
  gateway: AiInvoker;
  sink: LabTelemetrySink;
  promptLoader: LabPromptLoader;
  imageService: ImageGenerationService;
  onEvent?: (event: LabRunEvent) => void;
}): Promise<{ runId: string; status: LabRunStatus }> {
  const { client, runId } = params;
  const startedMs = performance.now();
  let terminalReached = false;
  let validation: LabTechnicalValidation | null = null;

  const emit = (event: LabRunEvent): void => {
    try {
      params.onEvent?.(event);
    } catch {
      // Best-effort: um consumidor desconectado não pode corromper o run.
    }
  };

  try {
    await markRunRunning({ client, runId });
    emit({ type: "phase", phase: "running", runId });

    assertPromptUnderTestServed(params.promptLoader, params.snapshot);
    const prompt = params.imageService.buildDirectorPrompt(
      params.scenario.brief,
      params.scenario.context,
    );
    emit({ type: "phase", phase: "prompt", runId });

    const request: AiInvocationRequest = {
      prompt,
      productImagesDataUrls: Object.values(params.scenario.imagesDataUrls),
      identityImageUrl: params.scenario.logoDataUrl ?? undefined,
      tools: "image_generation",
      size: params.experiment.params.size,
      quality: params.experiment.params.quality,
    };

    emit({ type: "phase", phase: "generation", runId });
    const telemetry = createLabTelemetryContext({
      sink: params.sink,
      operationRunId: runId,
      traceId: runId,
      storeId: params.experimentId,
      userId: params.actorId,
    });
    const result = await runLabCampaignImage({ gateway: params.gateway, request, telemetry });

    if (!result.imageBase64) {
      throw new LabRunExecutionError(MISSING_IMAGE_PAYLOAD);
    }

    const buffer = Buffer.from(result.imageBase64, "base64");
    const declaredMimeType = result.mimeType ?? null;

    // Validação técnica **antes** da persistência: o MIME real (dos bytes) e as
    // dimensões alimentam o próprio insert — o objeto nunca é gravado com um
    // MIME adivinhado nem recebe um update de dimensões separado.
    emit({ type: "phase", phase: "validation", runId });
    validation = await validateArtifactTechnically({
      buffer,
      declaredMimeType,
      expectedAspectRatio: 1,
    });
    const artifactMimeType = resolveArtifactMimeType(validation);

    emit({ type: "phase", phase: "artifact", runId });
    try {
      await persistOutputArtifact({
        client,
        experimentId: params.experimentId,
        runId,
        buffer,
        mimeType: artifactMimeType,
        width: validation.width,
        height: validation.height,
      });
    } catch {
      throw new LabRunExecutionError(ARTIFACT_PERSISTENCE_FAILED);
    }

    const latencyMs = Math.round(performance.now() - startedMs);

    await finalizeLabRun({
      client,
      runId,
      status: "succeeded",
      latencyMs,
      ...collectSinkEvidence(params.sink),
      technicalValidation: validation,
    });
    terminalReached = true;

    emit({ type: "done", status: "succeeded", runId });
    return { runId, status: "succeeded" };
  } catch (err) {
    const { code, message } = normalizeExecutionError(err);
    // Sanitiza **uma única vez**, na origem: a mesma mensagem segura vai para o
    // banco e para o evento (NDJSON) — nenhum token/URL vaza no stream.
    const safeMessage = sanitizeAiErrorMessage(message);
    try {
      await finalizeLabRun({
        client,
        runId,
        status: "failed",
        latencyMs: Math.round(performance.now() - startedMs),
        ...collectSinkEvidence(params.sink),
        technicalValidation: validation ?? undefined,
        errorType: code,
        errorMessage: safeMessage,
      });
      terminalReached = true;
    } catch {
      // A transição terminal é reexecutada no `finally` (best-effort).
    }
    emit({ type: "error", code, message: safeMessage, runId });
    return { runId, status: "failed" };
  } finally {
    if (!terminalReached) {
      try {
        await finalizeLabRun({
          client,
          runId,
          status: "failed",
          errorType: LAB_RUN_ABORTED,
          errorMessage: "Execução interrompida",
        });
      } catch {
        // Sem banco não há transição possível; o run será reconciliado como órfão.
      }
    }
  }
}

/**
 * Composição de conveniência: reserva e, quando não idempotente, executa.
 *
 * Retorna `status: "pending"` no caminho idempotente (o run existente não é
 * reexecutado e nenhuma chamada paga é feita).
 */
export async function executeLabRun(params: {
  client: SupabaseClient;
  experimentId: string;
  variantId: string;
  scenarioVersionId: string;
  repetitionIndex: number;
  supersedesRunId: string | null;
  operationId: string;
  actorId: string;
  scenario: {
    id: string;
    version: number;
    contentHash: string;
    imagesDataUrls: Record<string, string>;
    logoDataUrl: string | null;
    brief: CampaignBrief;
    context: ResolvedCampaignContext;
  };
  experiment: { modelTarget: LabModelTarget; params: LabExperimentParams };
  variant: { role: LabVariantRole; promptSnapshot: LabPromptSnapshot };
  variants: { baseline: LabPromptSnapshot; candidate: LabPromptSnapshot };
  gateway: AiInvoker;
  sink: LabTelemetrySink;
  promptLoader: LabPromptLoader;
  imageService: ImageGenerationService;
  onEvent?: (event: LabRunEvent) => void;
}): Promise<{ runId: string; status: LabRunStatus; idempotent: boolean }> {
  const prepared = await prepareLabRun({
    client: params.client,
    experimentId: params.experimentId,
    variantId: params.variantId,
    scenarioVersionId: params.scenarioVersionId,
    repetitionIndex: params.repetitionIndex,
    supersedesRunId: params.supersedesRunId,
    operationId: params.operationId,
    actorId: params.actorId,
    scenario: params.scenario,
    experiment: params.experiment,
    variant: params.variant,
    variants: params.variants,
  });

  if (prepared.idempotent) {
    return { runId: prepared.runId, status: "pending", idempotent: true };
  }

  const executed = await runReservedLabRun({
    client: params.client,
    experimentId: params.experimentId,
    runId: prepared.runId,
    snapshot: prepared.snapshot,
    actorId: params.actorId,
    scenario: params.scenario,
    experiment: { params: params.experiment.params },
    gateway: params.gateway,
    sink: params.sink,
    promptLoader: params.promptLoader,
    imageService: params.imageService,
    onEvent: params.onEvent,
  });

  return { runId: executed.runId, status: executed.status, idempotent: false };
}
