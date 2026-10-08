import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/server";
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
  ): Promise<CreditOperationState> {
    return this.invoke("product_1_1_mark_campaign_credit_art_uploaded", {
      p_campaign_id: campaignId,
      p_operation_id: operationId,
    });
  }

  async deliver(
    campaignId: string,
    operationId: string,
  ): Promise<CreditOperationState> {
    return this.invoke("product_1_1_deliver_campaign_credit_operation", {
      p_campaign_id: campaignId,
      p_operation_id: operationId,
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
