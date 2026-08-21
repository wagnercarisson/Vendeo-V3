import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/server";
import { FeatureFlagService } from "@/lib/feature-flags/feature-flag-service";
import type { OperationKey, OperationCostResolution } from "./types";
import { OPERATION_KEYS } from "./types";

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

export interface AdminOperationCost {
  operationKey: OperationKey;
  costCredits: number;
  enabled: boolean;
  updatedByUserId: string | null;
  updatedAt: string | null;
  source: "table" | "fallback";
}

export class OperationCostService {
  constructor(private readonly client: SupabaseClient = supabaseAdmin) {}

  /**
   * Enabled vira flag (QCW): habilitação de geração é resolvida das feature
   * flags (campaign_generation_enabled / visual_signature_generation_enabled),
   * não mais da coluna legada `credit_operation_costs.enabled`. Fallback
   * fail-open (F38 D5): falha de leitura da flag → enabled=true — NUNCA
   * desliga geração por acidente.
   *
   * `source` reflete APENAS o custo ("table" | "fallback") — contrato de
   * OperationCostResolution inalterado.
   */
  private async resolveEnabled(operationKey: OperationKey): Promise<boolean> {
    const flagService = new FeatureFlagService(this.client);
    if (operationKey === "campaign_generation") {
      return flagService.isCampaignGenerationEnabled();
    }
    return flagService.isVisualSignatureGenerationEnabled();
  }

  async getCost(operationKey: OperationKey): Promise<OperationCostResolution> {
    const { data, error } = await this.client
      .from("credit_operation_costs")
      .select("cost_credits, enabled")
      .eq("operation_key", operationKey)
      .maybeSingle();

    const enabled = await this.resolveEnabled(operationKey);

    if (error) {
      console.error("[operation-cost] getCost error", error.message);
      throw new OperationCostUnavailableError(operationKey, error.message);
    }

    if (!data) {
      console.warn("[operation-cost] getCost fallback", { operationKey });
      return {
        operationKey,
        costCredits: DEFAULT_OPERATION_COSTS[operationKey].costCredits,
        enabled,
        source: "fallback" as const,
      };
    }

    return {
      operationKey,
      costCredits: data.cost_credits,
      enabled,
      source: "table" as const,
    };
  }

  async getAllCosts(): Promise<AdminOperationCost[]> {
    const { data, error } = await this.client
      .from("credit_operation_costs")
      .select("operation_key, cost_credits, enabled, updated_by, updated_at")
      .in("operation_key", [...OPERATION_KEYS]);

    // Resolve as duas flags UMA vez (evita N+1) e mapeia por operationKey.
    const flagService = new FeatureFlagService(this.client);
    const enabledByKey: Record<OperationKey, boolean> = {
      campaign_generation: await flagService.isCampaignGenerationEnabled(),
      visual_signature_generation:
        await flagService.isVisualSignatureGenerationEnabled(),
    };

    if (error) {
      console.error("[operation-cost] getAllCosts error", error.message);
      throw new OperationCostUnavailableError(undefined, error.message);
    }

    const byKey = new Map(
      (data ?? []).map((row) => [row.operation_key as OperationKey, row]),
    );

    return OPERATION_KEYS.map((operationKey) => {
      const row = byKey.get(operationKey);
      if (!row) {
        const defaults = DEFAULT_OPERATION_COSTS[operationKey];
        return {
          operationKey,
          costCredits: defaults.costCredits,
          enabled: enabledByKey[operationKey],
          updatedByUserId: null,
          updatedAt: null,
          source: "fallback" as const,
        };
      }
      return {
        operationKey,
        costCredits: row.cost_credits,
        enabled: enabledByKey[operationKey],
        updatedByUserId: row.updated_by ?? null,
        updatedAt: row.updated_at ?? null,
        source: "table" as const,
      };
    });
  }
}