import "server-only";

import {
  SupabasePilotSpendRepository,
  type PilotPaidCallKind,
  type PilotSpendRepositoryPort,
} from "./pilot-spend-repository";

export type { PilotPaidCallKind } from "./pilot-spend-repository";

/**
 * F56.2b2c (B2.3) — Gate de gasto mínimo do piloto (POR CHAMADA).
 *
 * Protocolo (ver CONTEXT §5 / migration `20261017000002`):
 * - Contabilidade POR CHAMADA (`call_id` + `kind` + `attempt_seq`) — não por operação.
 * - Só `acquired` autoriza invocar o provider; `existing_in_flight`/`closed` NÃO.
 * - Resultado desconhecido ⇒ `markUnknown` (state `unknown`): mantém a estimativa
 *   contabilizada e bloqueia TODAS as novas chamadas (inclusive da MESMA campanha)
 *   até `reconcileUnknown` explícita — SEM liberação por tempo.
 * - Estimativa conservadora; NÃO garante a cobrança final; NÃO é subsistema de orçamento.
 *
 * O gate é INJETÁVEL (testes usam um fake). Quando NÃO fornecido ao orquestrador/copy,
 * o piloto está INATIVO (não consultado).
 */

export const PILOT_PAID_CALL_KINDS: readonly PilotPaidCallKind[] = Object.freeze([
  "image_primary",
  "image_retry",
  "image_fallback",
  "copy_initial",
  "copy_auto",
  "copy_manual",
]);

/** Limites DURIOS de chamadas do piloto (existentes): imagem ≤3; copy ≤6. */
export const PILOT_IMAGE_CALL_LIMIT = 3;
export const PILOT_COPY_CALL_LIMIT = 6;

export type PilotStopReason =
  | "pilot_cap_not_configured"
  | "pilot_requires_reconciliation"
  | "pilot_busy"
  | "pilot_cap_reached"
  | "invalid_call_kind"
  | "operation_identity_conflict"
  | "existing_in_flight"
  | "closed"
  | "read_failure";

export interface PilotPaidCallHandle {
  readonly callId: string;
  readonly ownerToken: string;
  readonly kind: PilotPaidCallKind;
}

export type PilotPaidCallDecision =
  | { readonly acquired: true; readonly handle: PilotPaidCallHandle }
  | { readonly acquired: false; readonly outcome: "existing_in_flight" | "closed" | "blocked"; readonly reason: PilotStopReason };

export interface PilotSpendGate {
  beginPaidCall(input: {
    readonly campaignId: string;
    readonly operationId: string;
    readonly kind: PilotPaidCallKind;
    readonly attemptSeq: number;
    readonly estimatedUsd: number;
  }): Promise<PilotPaidCallDecision>;
  endPaidCall(input: {
    readonly handle: PilotPaidCallHandle;
    readonly actualEstimatedUsd?: number;
  }): Promise<void>;
  markUnknown(input: {
    readonly handle: PilotPaidCallHandle;
    readonly reason: string;
  }): Promise<void>;
}

/** Códigos fechados de STOP que a RPC devolve como EXCEÇÃO. */
const STOP_REASONS: readonly PilotStopReason[] = [
  "pilot_cap_not_configured",
  "pilot_requires_reconciliation",
  "pilot_busy",
  "pilot_cap_reached",
  "invalid_call_kind",
];

function classifyStop(message: string): PilotStopReason {
  const found = STOP_REASONS.find((reason) => message.includes(reason));
  return found ?? "read_failure";
}

function newId(): string {
  return globalThis.crypto.randomUUID();
}

export interface PilotSpendControlDeps {
  readonly repository?: PilotSpendRepositoryPort;
  /** Gerador de ids (testes podem fixar). */
  readonly newId?: () => string;
  /** Estimativa padrão (USD) quando o chamador não informa (conservadora). */
  readonly defaultEstimatedUsd?: number;
}

export class ProductOneToOnePilotSpendControl implements PilotSpendGate {
  private readonly repository: PilotSpendRepositoryPort;
  private readonly generateId: () => string;
  private readonly defaultEstimatedUsd: number;

  constructor(deps: PilotSpendControlDeps = {}) {
    this.repository = deps.repository ?? new SupabasePilotSpendRepository();
    this.generateId = deps.newId ?? newId;
    this.defaultEstimatedUsd = deps.defaultEstimatedUsd ?? 0;
  }

  async beginPaidCall(input: {
    campaignId: string;
    operationId: string;
    kind: PilotPaidCallKind;
    attemptSeq: number;
    estimatedUsd: number;
  }): Promise<PilotPaidCallDecision> {
    const callId = this.generateId();
    const ownerToken = this.generateId();
    let data: Record<string, unknown>;
    try {
      data = await this.repository.beginPaidCall({
        campaignId: input.campaignId,
        operationId: input.operationId,
        callId,
        kind: input.kind,
        attemptSeq: input.attemptSeq,
        estimatedUsd: input.estimatedUsd ?? this.defaultEstimatedUsd,
        ownerToken,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { acquired: false, outcome: "blocked", reason: classifyStop(message) };
    }

    // Envelope FECHADO: sucesso exige `success === true` explícito.
    if (data.success !== true) {
      return { acquired: false, outcome: "blocked", reason: "read_failure" };
    }
    const outcome = data.outcome;
    if (outcome === "acquired") {
      return { acquired: true, handle: { callId, ownerToken, kind: input.kind } };
    }
    if (outcome === "existing_in_flight") {
      return { acquired: false, outcome: "existing_in_flight", reason: "existing_in_flight" };
    }
    if (outcome === "closed") {
      return { acquired: false, outcome: "closed", reason: "closed" };
    }
    return { acquired: false, outcome: "blocked", reason: "read_failure" };
  }

  async endPaidCall(input: {
    handle: PilotPaidCallHandle;
    actualEstimatedUsd?: number;
  }): Promise<void> {
    try {
      await this.repository.endPaidCall({
        callId: input.handle.callId,
        ownerToken: input.handle.ownerToken,
        actualEstimatedUsd: input.actualEstimatedUsd ?? this.defaultEstimatedUsd,
      });
    } catch {
      // Encerrar é best-effort; uma falha de encerramento NÃO autoriza nova chamada.
    }
  }

  async markUnknown(input: { handle: PilotPaidCallHandle; reason: string }): Promise<void> {
    try {
      await this.repository.markUnknown({
        callId: input.handle.callId,
        ownerToken: input.handle.ownerToken,
        reason: input.reason,
      });
    } catch {
      // Mantém `in_flight`; a estimativa segue contabilizada.
    }
  }

  /** Define o teto (decisão humana) — exposto para a superfície administrativa. */
  async setCap(input: {
    actorId: string;
    capUsd: number;
    reason: string;
    operationId: string;
  }): Promise<void> {
    await this.repository.setCap(input);
  }

  /** Reconciliação EXPLÍCITA — única via de liberação após `unknown`. */
  async reconcileUnknown(input: {
    actorId: string;
    callId: string;
    decision: string;
    reason: string;
    operationId: string;
  }): Promise<void> {
    await this.repository.reconcileUnknown(input);
  }
}
