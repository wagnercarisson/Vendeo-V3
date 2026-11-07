import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/server";
import { resolveCampaignFormat } from "@/lib/campaign/format-resolution";
import type { PendingArtifactProber } from "@/lib/product-1-1/pending/pending-operations-repository";
import type { projectDeliveredCampaign } from "@/lib/product-1-1/orchestration/project-delivered-campaign";
import { VerticalArtifactStore } from "../artifact/artifact-store";
import { makeVerticalProjection } from "../orchestration/entrypoint";

export type PendingFormatKind = "1:1" | "9:16" | "unavailable";

export interface PendingFormatAdapter {
  resolveFormat(campaignId: string): Promise<{ kind: PendingFormatKind }>;
  readonly verticalArtifacts: PendingArtifactProber;
  projectionFor(
    storeId: string,
    campaignId: string,
    operationId: string,
  ): typeof projectDeliveredCampaign;
}

/**
 * F59 — único ponto que conhece `product-1-1` e o módulo vertical para a
 * resolução administrativa de pendências. O repositório 1:1 permanece
 * format-agnóstico e recebe estas funções por injeção de interface.
 */
export function createPendingFormatAdapter(
  deps: { client?: SupabaseClient } = {},
): PendingFormatAdapter {
  const client = deps.client ?? supabaseAdmin;
  const verticalArtifacts = new VerticalArtifactStore({ client });

  return {
    async resolveFormat(campaignId: string) {
      const { data, error } = await client
        .from("campaigns")
        .select("input_snapshot")
        .eq("id", campaignId)
        .maybeSingle();
      if (error) return { kind: "unavailable" };
      const resolution = resolveCampaignFormat(
        (data as { input_snapshot?: unknown } | null)?.input_snapshot,
      );
      if (resolution.kind === "unavailable") return { kind: "unavailable" };
      return { kind: resolution.kind };
    },
    verticalArtifacts,
    projectionFor(storeId, campaignId, operationId) {
      return makeVerticalProjection(storeId, campaignId, operationId, { client });
    },
  };
}
