import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { OperationKey, OperationCostResolution } from "./types";

export const DEFAULT_OPERATION_COSTS: Record<
  OperationKey,
  { costCredits: number; enabled: boolean }
> = {
  campaign_generation: { costCredits: 1, enabled: true },
  visual_signature_generation: { costCredits: 1, enabled: true },
};

export class OperationCostUnavailableError extends Error {
  constructor(
    public readonly operationKey?: OperationKey,
    message?: string,
  ) {
    super(
      message ??
        (operationKey
          ? `Falha ao ler custo de operação: ${operationKey}`
          : "Falha ao ler custos de operação"),
    );
    this.name = "OperationCostUnavailableError";
  }
}

export class OperationCostService {
  constructor(private readonly client: SupabaseClient = supabaseAdmin) {}

  async getCost(operationKey: OperationKey): Promise<OperationCostResolution> {
    const { data, error } = await this.client
      .from("credit_operation_costs")
      .select("cost_credits, enabled")
      .eq("operation_key", operationKey)
      .maybeSingle();

    if (error) {
      console.error("[operation-cost] getCost error", error.message);
      throw new OperationCostUnavailableError(operationKey, error.message);
    }

    if (!data) {
      console.warn("[operation-cost] getCost fallback", { operationKey });
      return {
        operationKey,
        ...DEFAULT_OPERATION_COSTS[operationKey],
        source: "fallback" as const,
      };
    }

    return {
      operationKey,
      costCredits: data.cost_credits,
      enabled: data.enabled,
      source: "table" as const,
    };
  }
}
