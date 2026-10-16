import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { ArtifactProbe } from "../artifact/types";
import {
  CreditOperationError,
  type CreditOperationErrorCode,
  type CreditOperationReconciliationReport,
  type CreditOperationState,
  type CreditOperationStatus,
} from "./types";

/**
 * Cliente fino (server-only) da operação atômica de crédito do Produto 1:1.
 *
 * O cliente APENAS invoca as funções SQL/RPC — a garantia de atomicidade, CAS e
 * idempotência vive no Postgres, nunca aqui. Erros de negócio são mapeados para
 * `CreditOperationError`.
 */

const KNOWN_CODES: readonly CreditOperationErrorCode[] = [
  "missing_store_id",
  "missing_campaign_id",
  "missing_operation_id",
  "invalid_credit_amount",
  "invalid_timeout",
  "campaign_store_mismatch",
  "credit_reservation_missing_tx",
  "operation_identity_conflict",
  "operation_not_found",
  "invalid_transition",
  "delivered_not_refundable",
  "operation_terminal",
  "finality_not_recorded",
  "operation_in_progress",
  "absent_not_confirmed",
  "publication_in_progress",
  "publication_not_owner",
  "stale_publication",
  "abort_not_allowed",
];

/** Um único crédito por entrega (fixado). */
export const PRODUCT_ONE_TO_ONE_CREDITS_PER_DELIVERY = 1;

const CREDIT_LEDGER_FAILURE_HINTS = [
  "saldo_insuficiente",
  "saldo_inexistente",
  "amount_invalido",
  "idempotency_conflict",
  "transacao_nao_encontrada",
  "tipo_invalido",
];

export interface ReserveCreditOperationInput {
  readonly storeId: string;
  readonly campaignId: string;
  readonly operationId: string;
  readonly metadata?: Record<string, unknown>;
}

function mapError(message: string | undefined | null): CreditOperationError {
  const text = message ?? "";
  for (const code of KNOWN_CODES) {
    if (text.includes(code)) return new CreditOperationError(code, text);
  }
  if (CREDIT_LEDGER_FAILURE_HINTS.some((hint) => text.includes(hint))) {
    return new CreditOperationError("credit_reservation_failed", text);
  }
  return new CreditOperationError("unknown", text || "unknown_error");
}

function mapState(data: unknown): CreditOperationState {
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    throw new CreditOperationError("unknown", "empty_rpc_response");
  }

  const record = data as Record<string, unknown>;
  const status = record.status;
  if (
    status !== "reserved" &&
    status !== "art_uploaded" &&
    status !== "delivered" &&
    status !== "refunded"
  ) {
    throw new CreditOperationError("unknown", "invalid_rpc_status");
  }

  return Object.freeze({
    campaignId: String(record.campaign_id ?? ""),
    operationId: String(record.operation_id ?? ""),
    status: status as CreditOperationStatus,
    amount: Number(record.amount ?? 0),
    creditTxId: (record.credit_tx_id as string | null) ?? null,
    refundTxId: (record.refund_tx_id as string | null) ?? null,
    idempotent: record.idempotent === true,
    consumedDefinitive: status === "delivered",
  });
}

/** Ação do envelope único de encerramento por falha final (Plano 01, C3). */
const CLOSE_FAILED_ACTION = "close_failed_operation" as const;

/**
 * C3 — parser FECHADO e COM IDENTIDADE do envelope de
 * `product_1_1_close_failed_operation`. Exige `success === true` EXPLÍCITO,
 * `idempotent` BOOLEANO explícito e correspondência EXATA de
 * `campaign_id`/`operation_id`/`action`. Além disso, esta RPC SÓ pode confirmar
 * sucesso com `status === 'refunded'` — qualquer outro status é CONTRADITÓRIO e
 * falha fechado (nunca aceita sucesso implícito, identidade divergente nem
 * status incoerente).
 */
function parseClosedEnvelope(
  data: unknown,
  input: { readonly campaignId: string; readonly operationId: string },
): CreditOperationState {
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    throw new CreditOperationError("invalid_close_envelope", "empty_close_envelope");
  }
  const record = data as Record<string, unknown>;
  if (record.success !== true || typeof record.idempotent !== "boolean") {
    throw new CreditOperationError("invalid_close_envelope", "incomplete_close_envelope");
  }
  // A RPC de encerramento SÓ confirma sucesso com `refunded` (nunca `reserved`/
  // `art_uploaded`/`delivered`/desconhecido): status contraditório ⇒ fail-closed.
  if (record.status !== "refunded") {
    throw new CreditOperationError("unexpected_close_status", "unexpected_close_status");
  }
  const campaignId = String(record.campaign_id ?? "");
  const operationId = String(record.operation_id ?? "");
  if (
    campaignId !== input.campaignId ||
    operationId !== input.operationId ||
    record.action !== CLOSE_FAILED_ACTION
  ) {
    throw new CreditOperationError("invalid_close_envelope", "incomplete_close_envelope");
  }
  return Object.freeze({
    campaignId,
    operationId,
    status: "refunded",
    amount: Number(record.amount ?? 0),
    creditTxId: (record.credit_tx_id as string | null) ?? null,
    refundTxId: (record.refund_tx_id as string | null) ?? null,
    idempotent: record.idempotent,
    consumedDefinitive: false,
  });
}

export class ProductOneToOneCreditOperationClient {
  constructor(private readonly client: SupabaseClient = supabaseAdmin) {}

  async reserve(input: ReserveCreditOperationInput): Promise<CreditOperationState> {
    return this.invoke("product_1_1_reserve_credit_operation", {
      p_store_id: input.storeId,
      p_campaign_id: input.campaignId,
      p_operation_id: input.operationId,
      // Um único crédito por entrega (fixado; o RPC recusa qualquer outro valor).
      p_amount: PRODUCT_ONE_TO_ONE_CREDITS_PER_DELIVERY,
      p_metadata: input.metadata ?? {},
    });
  }

  async markArtUploaded(
    campaignId: string,
    operationId: string,
    publicationToken: string,
  ): Promise<CreditOperationState> {
    return this.invoke("product_1_1_mark_campaign_credit_art_uploaded", {
      p_campaign_id: campaignId,
      p_operation_id: operationId,
      p_publication_token: publicationToken,
    });
  }

  async deliver(
    campaignId: string,
    operationId: string,
    publicationToken: string,
  ): Promise<CreditOperationState> {
    return this.invoke("product_1_1_deliver_campaign_credit_operation", {
      p_campaign_id: campaignId,
      p_operation_id: operationId,
      p_publication_token: publicationToken,
    });
  }

  /**
   * Recorte 1 (Plano 08) — FENCE pré-upload. `beginPublication` ANUNCIA a
   * publicação ANTES de `storeArtifact` (sob C4) e devolve o TOKEN do dono.
   * `acquired:false` ⇒ reenvio ACOMPANHA a publicação existente (não publica).
   */
  async beginPublication(
    campaignId: string,
    operationId: string,
  ): Promise<{ acquired: boolean; token: string | null; publicationState: string }> {
    const { data, error } = await this.client.rpc("product_1_1_begin_publication", {
      p_campaign_id: campaignId,
      p_operation_id: operationId,
    });
    if (error) throw mapError(error.message);
    const record = (data ?? {}) as Record<string, unknown>;
    return Object.freeze({
      acquired: record.acquired === true,
      token: (record.token as string | null) ?? null,
      publicationState: String(record.publication_state ?? ""),
    });
  }

  /** `abort` SÓ com falha comprovada ANTES do envio (`phase='before_upload'`). */
  async abortPublication(
    campaignId: string,
    operationId: string,
    publicationToken: string,
    phase: "before_upload" | "metadata_failed" | "result_unknown",
  ): Promise<{ success: boolean; reason?: string }> {
    return this.invokeFenceAction("product_1_1_abort_publication", {
      p_campaign_id: campaignId,
      p_operation_id: operationId,
      p_publication_token: publicationToken,
      p_phase: phase,
    });
  }

  /** Resultado do upload DESCONHECIDO ⇒ mantém a proteção (`result_unknown`). */
  async markResultUnknown(
    campaignId: string,
    operationId: string,
    publicationToken: string,
  ): Promise<{ success: boolean; reason?: string }> {
    return this.invokeFenceAction("product_1_1_mark_result_unknown", {
      p_campaign_id: campaignId,
      p_operation_id: operationId,
      p_publication_token: publicationToken,
    });
  }

  private async invokeFenceAction(
    fn: string,
    params: Record<string, unknown>,
  ): Promise<{ success: boolean; reason?: string }> {
    const { data, error } = await this.client.rpc(fn, params);
    if (error) throw mapError(error.message);
    const record = (data ?? {}) as Record<string, unknown>;
    return Object.freeze({
      success: record.success === true,
      ...(typeof record.reason === "string" ? { reason: record.reason } : {}),
    });
  }

  async refund(
    campaignId: string,
    operationId: string,
    reason = "refund",
  ): Promise<CreditOperationState> {
    return this.invoke("product_1_1_refund_campaign_credit_operation", {
      p_campaign_id: campaignId,
      p_operation_id: operationId,
      p_reason: reason,
    });
  }

  /**
   * C3 — encerramento local por falha FINAL (predicado PF) via a RPC do Plano 01.
   * O `artKind` é o tipo REAL da sonda (nunca um literal fixo). Envelope FECHADO
   * COM IDENTIDADE (exige `success === true` explícito + `campaign_id`/
   * `operation_id`/`action` exatos). Recusas de PF são mapeadas para erros
   * tipados: `delivered_not_refundable`/`operation_terminal`/
   * `finality_not_recorded`/`operation_in_progress`/`absent_not_confirmed`.
   */
  async closeFailedOperation(input: {
    campaignId: string;
    operationId: string;
    artKind: ArtifactProbe["kind"];
    /** Frescor observado ANTES da sonda. Ausente ⇒ o cliente lê o epoch corrente. */
    observedEpoch?: number;
    reason?: string;
  }): Promise<CreditOperationState> {
    const observedEpoch =
      input.observedEpoch ?? (await this.getPublicationEpoch(input.campaignId, input.operationId).catch(() => 0));
    const { data, error } = await this.client.rpc("product_1_1_close_failed_operation", {
      p_campaign_id: input.campaignId,
      p_operation_id: input.operationId,
      p_art_kind: input.artKind,
      p_observed_epoch: observedEpoch,
      p_reason: input.reason ?? CLOSE_FAILED_ACTION,
    });
    if (error) throw mapError(error.message);
    return parseClosedEnvelope(data, input);
  }

  /** Recorte 1 — frescor da publicação, capturado ANTES da sonda. */
  async getPublicationEpoch(campaignId: string, operationId: string): Promise<number> {
    const { data, error } = await this.client.rpc("product_1_1_get_publication_epoch", {
      p_campaign_id: campaignId,
      p_operation_id: operationId,
    });
    if (error) throw mapError(error.message);
    return Number(data ?? 0);
  }

  async get(
    campaignId: string,
    operationId: string,
  ): Promise<CreditOperationState | null> {
    const { data, error } = await this.client.rpc(
      "product_1_1_get_campaign_credit_operation",
      { p_campaign_id: campaignId, p_operation_id: operationId },
    );
    if (error) throw mapError(error.message);
    if (data === null || data === undefined) return null;
    return mapState(data);
  }

  async reconcile(
    timeoutMinutes = 30,
  ): Promise<CreditOperationReconciliationReport> {
    const { data, error } = await this.client.rpc(
      "product_1_1_reconcile_campaign_credit_operations",
      { p_timeout_minutes: timeoutMinutes },
    );
    if (error) throw mapError(error.message);

    const record = (data ?? {}) as Record<string, unknown>;
    const deferredRaw = Array.isArray(record.deferred) ? record.deferred : [];

    return Object.freeze({
      resolved: Number(record.resolved ?? 0),
      deferredCount: Number(record.deferred_count ?? 0),
      deferred: Object.freeze(
        deferredRaw.map((item) => {
          const row = (item ?? {}) as Record<string, unknown>;
          return Object.freeze({
            campaignId: String(row.campaign_id ?? ""),
            operationId: String(row.operation_id ?? ""),
            status: row.status as CreditOperationStatus,
            amount: Number(row.amount ?? 0),
            hasCreditTx: row.has_credit_tx === true,
          });
        }),
      ),
    });
  }

  private async invoke(
    fn: string,
    params: Record<string, unknown>,
  ): Promise<CreditOperationState> {
    const { data, error } = await this.client.rpc(fn, params);
    if (error) throw mapError(error.message);
    return mapState(data);
  }
}
