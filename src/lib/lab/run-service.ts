import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { sanitizeAiErrorMessage } from "@/lib/ai/types";
import type { CostResolution } from "@/lib/ai-cost/types";

import { LAB_RUN_STALE_MS } from "./limits";
import { assertSnapshotComplete } from "./run-snapshot";
import type { LabRunSnapshot } from "./run-snapshot";

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

/** Marca o run como `running` — apenas colunas de resultado (o trigger permite). */
export async function markRunRunning(params: {
  client: SupabaseClient;
  runId: string;
  startedAt?: string;
}): Promise<void> {
  const { error } = await params.client
    .from("lab_runs")
    .update({
      status: "running",
      started_at: params.startedAt ?? new Date().toISOString(),
      attempts: 1,
    })
    .eq("id", params.runId);

  if (error) {
    throw new Error(LAB_RUN_TRANSITION_FAILED);
  }
}

/**
 * Grava o estado terminal do run com as evidências do resultado.
 *
 * `snapshot` **nunca** é gravado aqui (imutável, definido na reserva) e o
 * `errorMessage` passa sempre por `sanitizeAiErrorMessage` antes de persistir.
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

  const { error } = await params.client
    .from("lab_runs")
    .update(update)
    .eq("id", params.runId);

  if (error) {
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

  const { error: updateError } = await params.client
    .from("lab_runs")
    .update({
      status: "failed",
      error_type: "orphan_run_timeout",
      error_message: "Run órfão marcado como falho",
      finished_at: now.toISOString(),
    })
    .in(
      "id",
      stale.map((row) => row.id),
    );

  if (updateError) {
    throw new Error(LAB_RUN_RECONCILE_FAILED);
  }

  return { reconciled: stale.length };
}
