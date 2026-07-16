import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { CreditOperationOptions, CreditTransaction } from "./types";

// Infer the concrete SupabaseClient type from the already-instantiated admin client.
// This avoids depending on generated database types which do not yet exist.
type AdminClient = typeof supabaseAdmin;

export class CreditService {
  constructor(
    private readonly adminClient: AdminClient = supabaseAdmin,
  ) {}

  /**
   * Returns the current credit balance for a store.
   * If no record exists in credit_balances, returns 0.
   */
  async getBalance(storeId: string): Promise<number> {
    const { data } = await this.adminClient
      .from("credit_balances")
      .select("balance")
      .eq("store_id", storeId)
      .single();

    return data?.balance ?? 0;
  }

  /**
   * Reserves (deducts) credits from a store's wallet.
   * Amount must be a positive integer (converted to negative in SQL function).
   * Propagates saldo_insuficiente error for HTTP handler to treat as 402.
   */
  async reserveCredit(
    storeId: string,
    amount: number,
    opts?: CreditOperationOptions,
  ): Promise<string> {
    const { data, error } = await this.adminClient.rpc("reserve_credit", {
      p_store_id: storeId,
      p_amount: amount,
      p_campaign_id: opts?.campaignId ?? null,
      p_idempotency_key: opts?.idempotencyKey ?? null,
      p_metadata: opts?.metadata ?? {},
    });

    if (error) {
      throw error;
    }

    return data as string;
  }

  /**
   * Confirms a credit reservation. No-op in v1.5.
   * Prepared for two-phase commit in future versions.
   */
  async confirmCredit(_txId: string): Promise<void> {
    return Promise.resolve();
  }

  /**
   * Refunds (reverses) a deduction transaction, restoring the balance.
   * Validates original transaction exists and is type 'deduction'.
   */
  async refundCredit(
    txId: string,
    reason: string,
    opts?: CreditOperationOptions,
  ): Promise<string> {
    const { data, error } = await this.adminClient.rpc("refund_credit", {
      p_tx_id: txId,
      p_reason: reason,
      p_idempotency_key: opts?.idempotencyKey ?? null,
      p_metadata: opts?.metadata ?? {},
    });

    if (error) {
      throw error;
    }

    return data as string;
  }

  /**
   * Grants credits to a store's wallet.
   * Creates credit_balances row if not exists.
   */
  async grantCredits(
    storeId: string,
    amount: number,
    reason: string,
    opts?: CreditOperationOptions,
  ): Promise<string> {
    const { data, error } = await this.adminClient.rpc("grant_credits", {
      p_store_id: storeId,
      p_amount: amount,
      p_reason: reason,
      p_idempotency_key: opts?.idempotencyKey ?? null,
      p_metadata: opts?.metadata ?? {},
    });

    if (error) {
      throw error;
    }

    return data as string;
  }

  /**
   * Returns paginated transaction history for a store.
   * Filters out 'adjustment' type transactions.
   * Default limit 50, maximum 100. Ordered by created_at DESC.
   */
  async getHistory(
    storeId: string,
    limit?: number,
    offset?: number,
  ): Promise<CreditTransaction[]> {
    const effectiveLimit = Math.min(limit ?? 50, 100);
    const effectiveOffset = offset ?? 0;

    const { data, error } = await this.adminClient
      .from("credit_transactions")
      .select("*")
      .neq("type", "adjustment")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false })
      .range(effectiveOffset, effectiveOffset + effectiveLimit - 1);

    if (error) {
      throw error;
    }

    return (data ?? []).map(mapRowToCamelCase);
  }
}

function mapRowToCamelCase(row: Record<string, unknown>): CreditTransaction {
  return {
    id: row.id as string,
    storeId: row.store_id as string,
    type: row.type as CreditTransaction["type"],
    amount: row.amount as number,
    balanceBefore: row.balance_before as number,
    balanceAfter: row.balance_after as number,
    campaignId: row.campaign_id as string | null,
    reason: row.reason as string | null,
    reference: row.reference as string | null,
    idempotencyKey: row.idempotency_key as string | null,
    metadata: row.metadata as Record<string, unknown> | null,
    createdAt: row.created_at as string,
  };
}
