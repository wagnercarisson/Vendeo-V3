/**
 * F56.2b1b — Contratos do início de tentativa atômico do Produto 1:1 (Plano 03).
 *
 * A correção (trava comum por operação, teto 2+1 por alvo, recusa terminal /
 * desconhecida e precedência terminal) vive nas funções SQL/RPC
 * (`*atomic_attempt_start*`); este módulo apenas tipa o estado e os erros
 * observáveis pelo serviço cliente.
 */

export type AttemptClaimStatus = "in_progress" | "done" | "failed";
export type AttemptTarget = "primary" | "fallback";
export type GenerationOutcome = "unknown" | "failed";

/** Motivos de NÃO aquisição devolvidos pelo `acquire` (nunca lançam). */
export type AttemptStartReason =
  | "in_progress"
  | "already_started"
  | "attempt_limit_reached"
  | "operation_terminal"
  | "operation_unknown";

export interface AttemptStartResult {
  readonly acquired: boolean;
  readonly reason: AttemptStartReason | null;
  readonly campaignId: string | null;
  readonly operationId: string | null;
  readonly attemptNumber: number | null;
  readonly target: AttemptTarget | null;
}

export interface AttemptFinishResult {
  readonly campaignId: string;
  readonly operationId: string;
  readonly attemptNumber: number;
  readonly target: AttemptTarget | null;
  readonly status: AttemptClaimStatus;
  readonly idempotent: boolean;
}

export type CreditOperationStatus =
  | "reserved"
  | "art_uploaded"
  | "delivered"
  | "refunded";

export interface CampaignOperationState {
  readonly campaignId: string;
  readonly operationId: string;
  readonly status: CreditOperationStatus;
  readonly amount: number;
  readonly creditTxId: string | null;
  readonly refundTxId: string | null;
  readonly consumedDefinitive: boolean;
  /** I2 — `true` quando a operação é terminal (`delivered`/`refunded`). */
  readonly terminal: boolean;
  /** Marcador persistido de resultado desconhecido; só governa operação NÃO terminal. */
  readonly unknown: boolean;
  readonly outcome: GenerationOutcome | null;
  readonly supportReference: string | null;
}

export interface RecordOutcomeResult {
  readonly campaignId: string;
  readonly operationId: string;
  readonly outcome: GenerationOutcome;
  readonly supportReference: string | null;
  readonly idempotent: boolean;
}

export type AttemptStartErrorCode =
  | "missing_campaign_id"
  | "missing_operation_id"
  | "missing_attempt_number"
  | "invalid_target"
  | "invalid_attempt_number"
  | "invalid_status"
  | "invalid_outcome"
  | "attempt_claim_not_found"
  | "operation_not_found"
  | "invalid_transition"
  | "operation_terminal"
  | "operation_unknown"
  | "unknown";

export class AttemptStartError extends Error {
  constructor(
    public readonly code: AttemptStartErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "AttemptStartError";
  }
}

export interface AcquireAttemptInput {
  readonly campaignId: string;
  readonly operationId: string;
  readonly target: AttemptTarget;
  readonly attemptNumber: number;
}

export interface FinishAttemptInput {
  readonly campaignId: string;
  readonly operationId: string;
  readonly attemptNumber: number;
  readonly status: "done" | "failed";
}

export interface RecordOperationOutcomeInput {
  readonly campaignId: string;
  readonly operationId: string;
  readonly outcome: GenerationOutcome;
  readonly supportReference?: string | null;
}
