import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { FreemiumEntitlement } from "./types";

export class FreemiumEntitlementService {
  constructor(private readonly adminClient: SupabaseClient = supabaseAdmin) {}

  async checkOnboardingEligibility(rootHash: string): Promise<boolean> {
    const { data } = await this.adminClient
      .from("freemium_entitlements")
      .select("id")
      .eq("root_hash", rootHash)
      .eq("benefit_type", "onboarding")
      .limit(1)
      .maybeSingle();

    return data === null;
  }

  async grantOnboardingEntitlement(
    storeId: string | null,
    rootHash: string,
    txId?: string
  ): Promise<string | null> {
    const { data, error } = await this.adminClient.rpc(
      "try_grant_onboarding_entitlement",
      {
        p_store_id: storeId,
        p_root_hash: rootHash,
        p_grant_transaction_id: txId ?? null,
      }
    );

    if (error) throw error;
    return data as string | null;
  }

  async checkMonthlyEligibility(
    rootHash: string,
    cycle: string
  ): Promise<boolean> {
    const { data } = await this.adminClient
      .from("freemium_entitlements")
      .select("id")
      .eq("root_hash", rootHash)
      .eq("benefit_type", "monthly")
      .eq("cycle", cycle)
      .limit(1)
      .maybeSingle();

    return data === null;
  }

  async grantMonthlyEntitlement(
    storeId: string,
    rootHash: string,
    cycle: string,
    txId?: string
  ): Promise<string | null> {
    const { data, error } = await this.adminClient.rpc(
      "try_grant_monthly_entitlement",
      {
        p_store_id: storeId,
        p_root_hash: rootHash,
        p_cycle: cycle,
        p_grant_transaction_id: txId ?? null,
      }
    );

    if (error) throw error;
    return data as string | null;
  }

  async getHistoryByStore(storeId: string): Promise<FreemiumEntitlement[]> {
    const { data } = await this.adminClient
      .from("freemium_entitlements")
      .select("*")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false });

    return (data ?? []).map(mapEntitlement);
  }

  async getHistoryByRoot(rootHash: string): Promise<FreemiumEntitlement[]> {
    const { data } = await this.adminClient
      .from("freemium_entitlements")
      .select("*")
      .eq("root_hash", rootHash)
      .order("created_at", { ascending: false });

    return (data ?? []).map(mapEntitlement);
  }
}

function mapEntitlement(raw: Record<string, unknown>): FreemiumEntitlement {
  return {
    id: raw.id as string,
    store_id: raw.store_id as string | null,
    root_hash: raw.root_hash as string,
    benefit_type: raw.benefit_type as "onboarding" | "monthly" | "admin_exception",
    cycle: raw.cycle as string | null,
    grant_transaction_id: raw.grant_transaction_id as string | null,
    granted_by: raw.granted_by as string | null,
    reason: raw.reason as string | null,
    created_at: raw.created_at as string,
  };
}
