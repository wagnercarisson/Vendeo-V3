import "server-only";

import { supabaseAdmin } from "@/lib/supabase/server";

export type MissingItem = {
  item: "cadastro_fiscal" | "brand_profile";
  reason: string;
};

export interface StoreReadinessResult {
  ready: boolean;
  missing: MissingItem[];
}

export async function getStoreReadiness(storeId: string): Promise<StoreReadinessResult> {
  try {
    const { data, error } = await supabaseAdmin.rpc("check_store_readiness", {
      p_store_id: storeId,
    });

    if (error) {
      console.error("[getStoreReadiness] RPC error:", error.message);
      return fallbackResult(error.message);
    }

    const result = data as { ready: boolean; missing: MissingItem[] } | null;

    if (!result) {
      return fallbackResult("Resposta vazia do RPC");
    }

    return {
      ready: result.ready,
      missing: result.missing ?? [],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[getStoreReadiness] Unexpected error:", message);
    return fallbackResult(message);
  }
}

function fallbackResult(reason: string): StoreReadinessResult {
  return {
    ready: false,
    missing: [
      {
        item: "brand_profile",
        reason: `Não foi possível verificar a prontidão da loja: ${reason}`,
      },
    ],
  };
}
