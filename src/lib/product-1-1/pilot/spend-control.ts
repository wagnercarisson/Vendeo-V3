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
  | "pilot_globally_blocked"
  | "pilot_busy"
  | "pilot_stream_busy"
  | "pilot_cap_reached"
  | "invalid_call_kind"
  | "invalid_estimated_usd"
  | "estimate_required"
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
    readonly actualEstimatedUsd?: number | null;
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
  "pilot_stream_busy",
  "pilot_globally_blocked",
  "pilot_cap_reached",
  "invalid_call_kind",
  "invalid_estimated_usd",
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
}

/**
 * Classifica um erro como RESULTADO DESCONHECIDO (exige reconciliação): abort/timeout
 * (inclui `AiInvocationError { kind: "timeout" }` e sinais de timeout do gateway).
 */
export function isUnknownPilotOutcome(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const e = error as { name?: unknown; kind?: unknown; code?: unknown; message?: unknown };
  if (e.name === "AbortError") return true;
  if (e.kind === "timeout" || e.kind === "network") return true;
  const code = typeof e.code === "string" ? e.code : "";
  const message = typeof e.message === "string" ? e.message.toLowerCase() : "";
  const haystack = `${code} ${message}`.toLowerCase();
  const signals = [
    "timeout",
    "timed out",
    "etimedout",
    "econnreset",
    "econnrefused",
    "eai_again",
    "socket hang up",
    "fetch failed",
    "network",
    "aborterror",
  ];
  return signals.some((signal) => haystack.includes(signal));
}

export class ProductOneToOnePilotSpendControl implements PilotSpendGate {
  private readonly repository: PilotSpendRepositoryPort;
  private readonly generateId: () => string;

  constructor(deps: PilotSpendControlDeps = {}) {
    this.repository = deps.repository ?? new SupabasePilotSpendRepository();
    this.generateId = deps.newId ?? newId;
  }

  async beginPaidCall(input: {
    campaignId: string;
    operationId: string;
    kind: PilotPaidCallKind;
    attemptSeq: number;
    estimatedUsd: number;
  }): Promise<PilotPaidCallDecision> {
    // Estimativa OBRIGATÓRIA e conservadora: ausência/inválida NÃO vira chamada gratuita.
    if (!Number.isFinite(input.estimatedUsd) || input.estimatedUsd < 0) {
      return { acquired: false, outcome: "blocked", reason: "estimate_required" };
    }
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
        estimatedUsd: input.estimatedUsd,
        ownerToken,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { acquired: false, outcome: "blocked", reason: classifyStop(message) };
    }

    // Envelope FECHADO COM IDENTIDADE: sucesso exige `success === true` E correspondência
    // EXATA de `call_id`/`campaign_id`/`operation_id`/`kind`/`attempt_seq`.
    const identityMatches =
      data.call_id === callId &&
      data.campaign_id === input.campaignId &&
      data.operation_id === input.operationId &&
      data.kind === input.kind &&
      data.attempt_seq === input.attemptSeq;
    if (data.success !== true || !identityMatches) {
      return { acquired: false, outcome: "blocked", reason: "read_failure" };
    }
    if (data.outcome === "acquired") {
      return { acquired: true, handle: { callId, ownerToken, kind: input.kind } };
    }
    if (data.outcome === "existing_in_flight") {
      return { acquired: false, outcome: "existing_in_flight", reason: "existing_in_flight" };
    }
    if (data.outcome === "closed") {
      return { acquired: false, outcome: "closed", reason: "closed" };
    }
    return { acquired: false, outcome: "blocked", reason: "read_failure" };
  }

  async endPaidCall(input: {
    handle: PilotPaidCallHandle;
    actualEstimatedUsd?: number | null;
  }): Promise<void> {
    // `actualEstimatedUsd` OMITIDO/null ⇒ passa `null` (a RPC mantém a estimativa
    // anterior; NUNCA zera). Falha PROPAGADA (não engolida).
    await this.repository.endPaidCall({
      callId: input.handle.callId,
      ownerToken: input.handle.ownerToken,
      actualEstimatedUsd:
        typeof input.actualEstimatedUsd === "number" && Number.isFinite(input.actualEstimatedUsd)
          ? input.actualEstimatedUsd
          : null,
    });
  }

  async markUnknown(input: { handle: PilotPaidCallHandle; reason: string }): Promise<void> {
    // Falha PROPAGADA + REDE DE SEGURANÇA: se não for possível marcar `unknown`,
    // instala um BLOQUEIO GLOBAL (recusa QUALQUER nova chamada, inclusive de outra
    // campanha/stream) — fechando a janela da chamada travada. Se o bloqueio global
    // também falhar, propaga (o consumidor deve abortar o fluxo).
    try {
      await this.repository.markUnknown({
        callId: input.handle.callId,
        ownerToken: input.handle.ownerToken,
        reason: input.reason,
      });
    } catch (error) {
      await this.repository.blockGlobal({
        callId: input.handle.callId,
        reason: `mark_unknown_failed:${input.reason}`,
      });
      void error;
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
