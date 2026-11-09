/**
 * F60 — Contratos puros do fluxo 9:16 em duas etapas.
 *
 * A autoridade financeira e as travas vivem no Postgres. Este módulo apenas
 * tipa os envelopes REAIS das RPCs aplicadas no 60-01, as decisões puras do
 * serviço e os erros observáveis. Nenhuma escrita/consulta vive aqui.
 */

export type TwoStageStage = "base" | "expansion";
export type TwoStageStepStatus =
  | "pending"
  | "in_progress"
  | "done"
  | "failed"
  | "abandoned";
export type AttemptTarget = "primary" | "fallback" | "initial" | "retry";
export type AcquireAuthorization = "execute" | "query_only";
export type TwoStageOutcome = "unknown" | "failed";

/** Ações REAIS devolvidas por `product_9_16_resume_operation`. */
export type ResumeAction =
  | "acquire_base"
  | "acquire_expansion"
  | "retry_base"
  | "retry_expansion"
  | "deliver"
  | "wait"
  | "blocked";

/** Motivos fechados devolvidos pelas RPCs. */
export type TwoStageReason =
  | "operation_terminal"
  | "operation_unknown"
  | "operation_in_progress"
  | "attempt_limit_reached"
  | "invalid_transition"
  | "invalid_target"
  | "operation_identity_conflict"
  | "operation_origin_conflict"
  | "operation_not_reserved"
  | "operation_not_found";

export type ProviderFailureClass = "transient" | "definitive" | "unknown";
export type ProviderFailureReason =
  | "rate_limit"
  | "capacity_unavailable"
  | "pre_send_failure"
  | "invalid_output"
  | "timeout"
  | "abort"
  | "comm_lost"
  | "other";
export type SendEvidence = "not_sent" | "possibly_sent" | "confirmed_sent";

/**
 * Classificação preservando motivo e evidência de envio. `null`/ausente NUNCA
 * significa `transient` por padrão: significa evidência insuficiente.
 */
export interface ProviderFailure {
  readonly class: ProviderFailureClass;
  readonly reason: ProviderFailureReason;
  readonly sendEvidence: SendEvidence;
}

export interface StepState {
  readonly stage: TwoStageStage;
  readonly status: TwoStageStepStatus;
  readonly attemptsUsed: number;
  readonly failureClass: ProviderFailureClass | null;
}

export interface OpenOperationRequest {
  readonly storeId: string;
  readonly campaignId: string;
  readonly operationId: string;
}

export type OpenOperationResult =
  | {
      readonly success: true;
      readonly idempotent: boolean;
      readonly status: string;
      readonly campaignId: string;
      readonly operationId: string;
      readonly origin: "9_16_two_stage";
      readonly steps: readonly StepState[];
    }
  | { readonly success: false; readonly reason: TwoStageReason };

export interface AcquireStepRequest {
  readonly campaignId: string;
  readonly operationId: string;
  readonly stage: TwoStageStage;
  readonly requestId: string;
  readonly target: AttemptTarget;
}

export type AcquireStepResult =
  | {
      readonly acquired: true;
      readonly authorization: "execute";
      readonly reason: null;
      readonly attemptToken: string;
      readonly attemptNumber: number;
      readonly stage: TwoStageStage;
      readonly target: AttemptTarget;
    }
  | {
      readonly acquired: false;
      readonly authorization: "query_only";
      readonly reason: TwoStageReason | null;
      readonly attemptToken?: string;
      readonly attemptNumber?: number;
      readonly stage?: TwoStageStage;
      readonly target?: AttemptTarget;
    };

export interface FinishStepRequest {
  readonly campaignId: string;
  readonly operationId: string;
  readonly attemptToken: string;
  readonly expectedStatus: "in_progress";
  readonly status: "completed" | "failed" | "abandoned";
  readonly failureClass?: ProviderFailureClass | null;
}

export type FinishStepResult =
  | {
      readonly success: true;
      readonly idempotent: boolean;
      readonly status: "completed" | "failed" | "abandoned";
      readonly stage: TwoStageStage;
      readonly attemptNumber: number;
    }
  | { readonly success: false; readonly reason: TwoStageReason };

export interface RecordOutcomeRequest {
  readonly campaignId: string;
  readonly operationId: string;
  readonly stage: TwoStageStage;
  readonly outcome: TwoStageOutcome;
  readonly supportReference?: string | null;
}

export type RecordOutcomeResult =
  | {
      readonly success: true;
      readonly idempotent: boolean;
      readonly outcome: TwoStageOutcome;
      readonly stage: TwoStageStage;
      readonly supportReference: string | null;
    }
  | { readonly success: false; readonly reason: TwoStageReason };

export interface ResumeOperationRequest {
  readonly campaignId: string;
  readonly operationId: string;
}

export type ResumeOperationResult =
  | {
      readonly success: true;
      readonly action: ResumeAction;
      readonly nextTarget: AttemptTarget | null;
      readonly origin: "9_16_two_stage";
      readonly creditStatus: string;
      readonly baseStatus: TwoStageStepStatus;
      readonly baseAttempts: number;
      readonly expansionStatus: TwoStageStepStatus;
      readonly expansionAttempts: number;
      readonly unknown: boolean;
      readonly failedOutcome: boolean;
    }
  | { readonly success: false; readonly reason: "operation_not_found" };

export interface DerivedFinancialView {
  readonly status: string;
  readonly terminal: boolean;
  readonly delivered: boolean;
  readonly refunded: boolean;
  readonly reserved: boolean;
}

/** Histórico persistido consumido pela decisão pura (uma linha por tentativa). */
export interface AttemptHistoryEntry {
  readonly attemptNumber: number;
  readonly target: AttemptTarget;
  readonly status: "in_progress" | "completed" | "failed" | "abandoned";
  readonly failure: ProviderFailure | null;
}

export interface DecideNextAttemptInput {
  readonly stage: TwoStageStage;
  readonly targetHistory: readonly AttemptHistoryEntry[];
  /** `null`/ausente = evidência insuficiente; NUNCA assume `transient`. */
  readonly lastFailure: ProviderFailure | null;
  readonly requestedTarget: AttemptTarget;
}

export type ProviderFailureDisposition =
  | "retry_primary"
  | "fallback"
  | "retry_expansion"
  | "unknown"
  | "definitive"
  | "insufficient";

export interface DecideNextAttemptResult {
  readonly allowed: boolean;
  readonly target: AttemptTarget | null;
  readonly reason:
    | TwoStageReason
    | "insufficient_failure_evidence"
    | "invalid_target"
    | null;
}

export interface DecideNextActionInput {
  readonly creditStatus: string;
  readonly terminal: boolean;
  readonly unknown: boolean;
  readonly failedOutcome: boolean;
  readonly base: {
    readonly status: TwoStageStepStatus;
    readonly attemptsUsed: number;
    readonly failure: ProviderFailure | null;
  };
  readonly expansion: {
    readonly status: TwoStageStepStatus;
    readonly attemptsUsed: number;
    readonly failure: ProviderFailure | null;
  };
  readonly baseHistory?: readonly AttemptHistoryEntry[];
  readonly expansionHistory?: readonly AttemptHistoryEntry[];
}

export interface DecideNextActionResult {
  readonly action: ResumeAction;
  readonly nextTarget: AttemptTarget | null;
}

export const BASE_MAX_ATTEMPTS = 3;
export const BASE_MAX_PRIMARY_ATTEMPTS = 2;
export const BASE_MAX_FALLBACK_ATTEMPTS = 1;
export const EXPANSION_MAX_ATTEMPTS = 2;
export const EXPANSION_MAX_AUTO_RETRIES = 1;

export type TwoStageErrorCode = TwoStageReason | "invalid_envelope" | "unknown";

export class ProductTwoStageOperationError extends Error {
  constructor(
    public readonly code: TwoStageErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "ProductTwoStageOperationError";
  }
}
