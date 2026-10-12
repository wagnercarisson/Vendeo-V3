import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  resolveSnapshotPairForTarget,
  type ImageGenerationConfigSnapshot,
  type ImageModelTarget,
} from "@/lib/ai/image-generation-config-snapshot";
import {
  SupabaseImageGenerationOperationsRepository,
  type ImageGenerationOperation,
  type RecordImageGenerationOperationResult,
} from "@/lib/ai/image-generation-operations-repository";

/**
 * F56.2b1b (F6 / REQ-56.2.2-02) — histórico append-only por tentativa.
 *
 * Cada tentativa real é registrada via `recordOperation` (append-only no
 * Postgres: a relação `image_generation_operations` bloqueia reescrita/remoção
 * por trigger), vinculada à campanha, ao snapshot e à operação, sem sobrescrever
 * tentativas anteriores. O par modelo–qualidade de cada tentativa é reconstruível
 * a partir do snapshot congelado (`resolveSnapshotPairForTarget`), identificando
 * principal × fallback.
 *
 * F6: `recordAttempt` RECUSA registrar nova tentativa quando a operação está em
 * estado TERMINAL (`delivered`/`refunded`) ou INCERTO (resultado desconhecido) —
 * nunca continua após resultado incerto nem reabre operação encerrada. `run_id`/
 * `trace_id` são preservados e nunca regeneram a linha.
 *
 * Este módulo não emite escrita mutável: a imutabilidade vive no Postgres.
 */

/** Estados observáveis da operação relevantes à decisão de registrar tentativa. */
export type AttemptOperationState =
  | "reserved"
  | "art_uploaded"
  | "delivered"
  | "refunded"
  | "in_progress"
  | "unknown";

/** Estados TERMINAIS: a operação encerrou — não admitir nova tentativa (F6). */
export const TERMINAL_ATTEMPT_STATES = Object.freeze([
  "delivered",
  "refunded",
] as const satisfies readonly AttemptOperationState[]);

/** Estados INCERTOS: resultado desconhecido — não repetir cegamente (F6). */
export const UNCERTAIN_ATTEMPT_STATES = Object.freeze([
  "unknown",
] as const satisfies readonly AttemptOperationState[]);

/** Erro tipado: operação encerrada/incerta recusa registrar nova tentativa (F6). */
export class AttemptHistoryError extends Error {
  readonly code = "attempt_operation_closed" as const;
  readonly state: AttemptOperationState | null;

  constructor(state: AttemptOperationState | null) {
    super(state ? `attempt_operation_closed:${state}` : "attempt_operation_closed");
    this.name = "AttemptHistoryError";
    this.state = state;
  }
}

/**
 * Erro tipado F4: a leitura do estado da operação é OBRIGATÓRIA e não pôde ser
 * realizada (dependency ausente) — a tentativa é BLOQUEADA antes de qualquer
 * insert. (Uma FALHA na própria leitura propaga o erro original, também sem gravar.)
 */
export class AttemptHistoryStateError extends Error {
  readonly code = "attempt_operation_state_unavailable" as const;

  constructor(detail?: string) {
    super(
      detail
        ? `attempt_operation_state_unavailable:${detail}`
        : "attempt_operation_state_unavailable",
    );
    this.name = "AttemptHistoryStateError";
  }
}

export interface RecordAttemptInput {
  readonly campaignId: string;
  readonly snapshotOriginalId: string;
  readonly operationId: string;
  readonly attemptNumber: number;
  readonly target: ImageModelTarget;
  /** Snapshot congelado — fonte do par modelo/qualidade por alvo. */
  readonly snapshot: ImageGenerationConfigSnapshot;
  readonly runId?: string;
  readonly traceId?: string;
}

export interface RecordAttemptDeps {
  /**
   * Resolve o estado vigente da operação — OBRIGATÓRIO (F4). Quando TERMINAL ou
   * INCERTO, a tentativa é recusada sem gravar. `null` = operação inexistente
   * (nova) — prossegue. A ausência deste leitor BLOQUEIA (`AttemptHistoryStateError`);
   * uma falha da leitura também BLOQUEIA (o erro propaga, sem gravar). O leitor
   * mandatório é fornecido pelo chamador/orquestrador (Plano 04).
   */
  readonly resolveOperationState?: (input: {
    campaignId: string;
    operationId: string;
  }) => Promise<AttemptOperationState | null>;
}

function isClosedState(state: AttemptOperationState): boolean {
  return (
    (TERMINAL_ATTEMPT_STATES as readonly AttemptOperationState[]).includes(state) ||
    (UNCERTAIN_ATTEMPT_STATES as readonly AttemptOperationState[]).includes(state)
  );
}

/**
 * Registra uma tentativa append-only, com o par modelo/qualidade do alvo
 * reconstruído do snapshot. F4: a leitura do estado da operação é OBRIGATÓRIA —
 * sem o leitor, BLOQUEIA (`AttemptHistoryStateError`) antes de qualquer insert;
 * falha da leitura BLOQUEIA (propaga, sem gravar). Recusa operação terminal/incerta
 * (F6) sem gravar. Somente `reserved`/`art_uploaded`/`null` (inexistente) prosseguem.
 */
export async function recordAttempt(
  client: SupabaseClient,
  input: RecordAttemptInput,
  deps: RecordAttemptDeps = {},
): Promise<RecordImageGenerationOperationResult> {
  const resolveOperationState = deps.resolveOperationState;
  if (!resolveOperationState) {
    throw new AttemptHistoryStateError("missing_resolver");
  }

  // Falha da leitura propaga (bloqueia) — nenhum insert é executado.
  const state = await resolveOperationState({
    campaignId: input.campaignId,
    operationId: input.operationId,
  });
  if (state !== null && isClosedState(state)) {
    throw new AttemptHistoryError(state);
  }

  const pair = resolveSnapshotPairForTarget(input.snapshot, input.target);
  const repository = new SupabaseImageGenerationOperationsRepository(client);

  return repository.recordOperation({
    campaignId: input.campaignId,
    snapshotOriginalId: input.snapshotOriginalId,
    operationId: input.operationId,
    attemptNumber: input.attemptNumber,
    target: input.target,
    model: pair.model,
    quality: pair.quality,
    runId: input.runId,
    traceId: input.traceId,
  });
}

/** Lista as tentativas da operação, preservando a ordem por `attempt_number`. */
export async function listAttempts(
  client: SupabaseClient,
  input: { campaignId: string; operationId: string },
): Promise<ImageGenerationOperation[]> {
  const repository = new SupabaseImageGenerationOperationsRepository(client);
  return repository.listByOperationId(input);
}
