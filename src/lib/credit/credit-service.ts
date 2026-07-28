import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { CreditOperationOptions, CreditTransaction } from "./types";

export class CreditService {
  constructor(
    private readonly client: SupabaseClient = supabaseAdmin,
  ) {}

  async getBalance(storeId: string): Promise<number> {
    const { data } = await this.client
      .from("credit_balances")
      .select("balance")
      .eq("store_id", storeId)
      .single();

    return data?.balance ?? 0;
  }

  async getBalanceBreakdown(storeId: string): Promise<{ balance: number; bonusBalance: number; purchasedBalance: number }> {
    const { data } = await this.client
      .from("credit_balances")
      .select("balance, bonus_balance, purchased_balance")
      .eq("store_id", storeId)
      .single();

    return {
      balance: data?.balance ?? 0,
      bonusBalance: data?.bonus_balance ?? 0,
      purchasedBalance: data?.purchased_balance ?? 0,
    };
  }

  async reserveCredit(
    storeId: string,
    amount: number,
    opts?: CreditOperationOptions,
  ): Promise<string> {
    const { data, error } = await this.client.rpc("reserve_credit", {
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

  async confirmCredit(_txId: string): Promise<void> {
    return Promise.resolve();
  }

  async refundCredit(
    txId: string,
    reason: string,
    opts?: CreditOperationOptions,
  ): Promise<string> {
    const { data, error } = await this.client.rpc("refund_credit", {
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

  async grantCredits(
    storeId: string,
    amount: number,
    reason: string,
    opts?: CreditOperationOptions,
  ): Promise<string> {
    const { data, error } = await this.client.rpc("grant_credits", {
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

  async getHistory(
    storeId: string,
    limit?: number,
    offset?: number,
  ): Promise<CreditTransaction[]> {
    const effectiveLimit = Math.min(limit ?? 50, 100);
    const effectiveOffset = offset ?? 0;

    const { data, error } = await this.client
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

  async countCreditTransactions(storeId: string): Promise<number> {
    const { count, error } = await this.client
      .from("credit_transactions")
      .select("*", { count: "exact", head: true })
      .neq("type", "adjustment")
      .eq("store_id", storeId);

    if (error) throw error;
    return count ?? 0;
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
