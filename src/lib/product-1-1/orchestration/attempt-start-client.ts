import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/server";
import {
  AttemptStartError,
  type AcquireAttemptInput,
  type AttemptClaimStatus,
  type AttemptFinishResult,
  type AttemptStartErrorCode,
  type AttemptStartReason,
  type AttemptStartResult,
  type AttemptTarget,
  type CampaignOperationState,
  type CreditOperationStatus,
  type FinishAttemptInput,
  type GenerationOutcome,
  type RecordOperationOutcomeInput,
  type RecordOutcomeResult,
} from "./attempt-start-types";

/**
 * Cliente fino (server-only) do início de tentativa atômico do Produto 1:1.
 *
 * O cliente APENAS invoca as funções SQL/RPC — a trava comum por operação
 * (`SELECT ... FOR UPDATE` na linha de crédito), o teto 2+1 por alvo e a recusa
 * de operação terminal/desconhecida vivem no Postgres, nunca aqui. O vencedor da
 * corrida é quem recebe `acquired: true`; o perdedor (`acquired: false`, com
 * qualquer motivo, inclusive `operation_terminal`/`operation_unknown`) NÃO deve
 * prosseguir para a geração.
 *
 * F3 — envelope FECHADO (fail-closed): o cliente NUNCA aceita sucesso implícito.
 * `{acquired:true}` exige a identidade/alvo/tentativa EXATOS da requisição;
 * `finish`/`recordOperationOutcome` exigem `success:true` EXPLÍCITO e
 * correspondência com a requisição; replay divergente ⇒ `operation_identity_conflict`.
 */

const KNOWN_CODES: readonly AttemptStartErrorCode[] = [
  "missing_campaign_id",
  "missing_operation_id",
  "missing_attempt_number",
  "invalid_target",
  "invalid_attempt_number",
  "invalid_status",
  "invalid_outcome",
  "attempt_claim_not_found",
  "operation_not_found",
  "invalid_transition",
  "operation_terminal",
  "operation_unknown",
  "operation_identity_conflict",
];

const ATTEMPT_REASONS: readonly AttemptStartReason[] = [
  "in_progress",
  "already_started",
  "attempt_limit_reached",
  "operation_terminal",
  "operation_unknown",
  "operation_art_uploaded",
  "attempt_already_completed",
  "out_of_sequence",
  "fallback_before_primary",
  "primary_after_fallback",
];

const CLAIM_STATUSES: readonly AttemptClaimStatus[] = [
  "in_progress",
  "done",
  "failed",
  "abandoned",
];

const CREDIT_STATUSES: readonly CreditOperationStatus[] = [
  "reserved",
  "art_uploaded",
  "delivered",
  "refunded",
];

const OUTCOMES: readonly GenerationOutcome[] = ["unknown", "failed"];

function mapError(message: string | undefined | null): AttemptStartError {
  const text = message ?? "";
  for (const code of KNOWN_CODES) {
    if (text.includes(code)) return new AttemptStartError(code, text);
  }
  return new AttemptStartError("unknown", text || "unknown_error");
}

function asRecord(data: unknown): Record<string, unknown> {
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    throw new AttemptStartError("unknown", "empty_rpc_response");
  }
  return data as Record<string, unknown>;
}

function mapAcquire(data: unknown, input: AcquireAttemptInput): AttemptStartResult {
  const record = asRecord(data);
  const acquired = record.acquired;
  if (typeof acquired !== "boolean") {
    throw new AttemptStartError("unknown", "invalid_rpc_payload");
  }

  if (acquired) {
    // F3 — envelope FECHADO: `{acquired:true}` só é válido quando carrega a
    // identidade/alvo/tentativa EXATOS da requisição e `reason === null`.
    const campaignId = (record.campaign_id as string | undefined) ?? null;
    const operationId = (record.operation_id as string | undefined) ?? null;
    const attemptNumber =
      record.attempt_number == null ? null : Number(record.attempt_number);
    const target = (record.target as AttemptTarget | undefined) ?? null;
    if (
      record.reason !== null ||
      campaignId !== input.campaignId ||
      operationId !== input.operationId ||
      attemptNumber !== input.attemptNumber ||
      target !== input.target
    ) {
      throw new AttemptStartError("unknown", "incomplete_acquire_envelope");
    }
    return Object.freeze({
      acquired: true,
      reason: null,
      campaignId,
      operationId,
      attemptNumber,
      target,
    });
  }

  const reason = record.reason;
  if (
    typeof reason !== "string" ||
    !ATTEMPT_REASONS.includes(reason as AttemptStartReason)
  ) {
    throw new AttemptStartError("unknown", "invalid_acquire_reason");
  }
  return Object.freeze({
    acquired: false,
    reason: reason as AttemptStartReason,
    campaignId: (record.campaign_id as string | undefined) ?? null,
    operationId: (record.operation_id as string | undefined) ?? null,
    attemptNumber: null,
    target: null,
  });
}

function mapFinish(data: unknown, input: FinishAttemptInput): AttemptFinishResult {
  const record = asRecord(data);
  // F3 — sucesso EXPLÍCITO: ausência de `success:true` NÃO é sucesso.
  if (record.success !== true) {
    throw new AttemptStartError("unknown", "incomplete_finish_envelope");
  }
  const status = record.status;
  if (
    typeof status !== "string" ||
    !CLAIM_STATUSES.includes(status as AttemptClaimStatus)
  ) {
    throw new AttemptStartError("unknown", "invalid_rpc_status");
  }
  const campaignId = String(record.campaign_id ?? "");
  const operationId = String(record.operation_id ?? "");
  const attemptNumber = Number(record.attempt_number ?? 0);
  // F3 — o resultado DEVE corresponder à requisição (mesma identidade/estado).
  if (
    campaignId !== input.campaignId ||
    operationId !== input.operationId ||
    attemptNumber !== input.attemptNumber ||
    status !== input.status
  ) {
    throw new AttemptStartError("unknown", "incomplete_finish_envelope");
  }
  return Object.freeze({
    campaignId,
    operationId,
    attemptNumber,
    target: (record.target as AttemptTarget | undefined) ?? null,
    status: status as AttemptClaimStatus,
    idempotent: record.idempotent === true,
  });
}

function mapOutcome(
  data: unknown,
  input: RecordOperationOutcomeInput,
): RecordOutcomeResult {
  const record = asRecord(data);
  if (record.success === false) {
    const reason = record.reason;
    if (reason === "operation_terminal") {
      throw new AttemptStartError("operation_terminal", "operation_terminal");
    }
    if (reason === "operation_identity_conflict") {
      throw new AttemptStartError(
        "operation_identity_conflict",
        "operation_identity_conflict",
      );
    }
    throw new AttemptStartError(
      "unknown",
      typeof reason === "string" ? reason : "record_outcome_failed",
    );
  }
  // F3 — sucesso EXPLÍCITO (não basta "não-false") + correspondência com a requisição.
  if (record.success !== true) {
    throw new AttemptStartError("unknown", "incomplete_outcome_envelope");
  }
  const outcome = record.outcome;
  if (typeof outcome !== "string" || !OUTCOMES.includes(outcome as GenerationOutcome)) {
    throw new AttemptStartError("unknown", "invalid_rpc_outcome");
  }
  const campaignId = String(record.campaign_id ?? "");
  const operationId = String(record.operation_id ?? "");
  if (
    campaignId !== input.campaignId ||
    operationId !== input.operationId ||
    (outcome as GenerationOutcome) !== input.outcome
  ) {
    throw new AttemptStartError("unknown", "incomplete_outcome_envelope");
  }
  return Object.freeze({
    campaignId,
    operationId,
    outcome: outcome as GenerationOutcome,
    supportReference: (record.support_reference as string | null | undefined) ?? null,
    idempotent: record.idempotent === true,
  });
}

function mapCampaignOperation(data: unknown): CampaignOperationState {
  const record = asRecord(data);
  const status = record.status;
  if (
    typeof status !== "string" ||
    !CREDIT_STATUSES.includes(status as CreditOperationStatus)
  ) {
    throw new AttemptStartError("unknown", "invalid_rpc_status");
  }
  const rawOutcome = record.outcome;
  const outcome: GenerationOutcome | null =
    typeof rawOutcome === "string" &&
    OUTCOMES.includes(rawOutcome as GenerationOutcome)
      ? (rawOutcome as GenerationOutcome)
      : null;
  return Object.freeze({
    campaignId: String(record.campaign_id ?? ""),
    operationId: String(record.operation_id ?? ""),
    status: status as CreditOperationStatus,
    amount: Number(record.amount ?? 0),
    creditTxId: (record.credit_tx_id as string | null | undefined) ?? null,
    refundTxId: (record.refund_tx_id as string | null | undefined) ?? null,
    consumedDefinitive: record.consumed_definitive === true,
    terminal: record.terminal === true,
    unknown: record.unknown === true,
    outcome,
    supportReference: (record.support_reference as string | null | undefined) ?? null,
  });
}

export class ProductOneToOneAttemptStartClient {
  constructor(private readonly client: SupabaseClient = supabaseAdmin) {}

  /** Adquire (ou perde) o início de tentativa. O perdedor NÃO lança. */
  async acquire(input: AcquireAttemptInput): Promise<AttemptStartResult> {
    const { data, error } = await this.client.rpc(
      "product_1_1_acquire_attempt_start",
      {
        p_campaign_id: input.campaignId,
        p_operation_id: input.operationId,
        p_target: input.target,
        p_attempt_number: input.attemptNumber,
      },
    );
    if (error) throw mapError(error.message);
    return mapAcquire(data, input);
  }

  /** Finaliza o claim (CAS `in_progress -> done|failed`). */
  async finish(input: FinishAttemptInput): Promise<AttemptFinishResult> {
    const { data, error } = await this.client.rpc("product_1_1_finish_attempt", {
      p_campaign_id: input.campaignId,
      p_operation_id: input.operationId,
      p_attempt_number: input.attemptNumber,
      p_status: input.status,
    });
    if (error) throw mapError(error.message);
    return mapFinish(data, input);
  }

  /** Grava o resultado persistido (`unknown`/`failed`); idempotente. */
  async recordOperationOutcome(
    input: RecordOperationOutcomeInput,
  ): Promise<RecordOutcomeResult> {
    const { data, error } = await this.client.rpc(
      "product_1_1_record_generation_outcome",
      {
        p_campaign_id: input.campaignId,
        p_operation_id: input.operationId,
        p_outcome: input.outcome,
        p_support_reference: input.supportReference ?? null,
      },
    );
    if (error) throw mapError(error.message);
    return mapOutcome(data, input);
  }

  /**
   * Lê a operação de crédito da campanha E o resultado desconhecido PERSISTIDO.
   * `null` para legado. I2 — precedência terminal: `delivered`/`refunded`
   * prevalecem e `unknown` não governa.
   */
  async getCampaignOperation(
    campaignId: string,
  ): Promise<CampaignOperationState | null> {
    const { data, error } = await this.client.rpc(
      "product_1_1_get_campaign_operation_by_campaign",
      { p_campaign_id: campaignId },
    );
    if (error) throw mapError(error.message);
    if (data === null || data === undefined) return null;
    return mapCampaignOperation(data);
  }
}
