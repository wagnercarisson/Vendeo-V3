/**
 * F56.2b1a — Contratos da operação atômica de crédito do Produto 1:1.
 *
 * A correção financeira vive nas funções SQL/RPC (migration
 * `*product_1_1_campaign_credit*`); este módulo apenas tipa o estado e os erros
 * observáveis pelo serviço cliente.
 */

export type CreditOperationStatus =
  | "reserved"
  | "art_uploaded"
  | "delivered"
  | "refunded";

export interface CreditOperationState {
  readonly campaignId: string;
  readonly operationId: string;
  readonly status: CreditOperationStatus;
  readonly amount: number;
  readonly creditTxId: string | null;
  readonly refundTxId: string | null;
  /** Verdadeiro quando a chamada foi idempotente (sem novo efeito). */
  readonly idempotent: boolean;
  /** `true` apenas em `delivered` (consumo definitivo); `reserved` é temporário. */
  readonly consumedDefinitive: boolean;
}

export type CreditOperationErrorCode =
  | "missing_store_id"
  | "missing_campaign_id"
  | "missing_operation_id"
  | "invalid_amount"
  | "invalid_timeout"
  | "operation_identity_conflict"
  | "operation_not_found"
  | "invalid_transition"
  | "delivered_not_refundable"
  | "credit_reservation_failed"
  | "unknown";

export class CreditOperationError extends Error {
  constructor(
    public readonly code: CreditOperationErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "CreditOperationError";
  }
}
