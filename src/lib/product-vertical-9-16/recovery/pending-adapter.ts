import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/server";
import { resolveCampaignFormat } from "@/lib/campaign/format-resolution";
import { getArtifactByIdentity } from "@/lib/campaign/composition-artifacts/repository";
import {
  projectDeliveredCampaign,
  type ProjectDeliveredCampaignResult,
} from "@/lib/product-1-1/orchestration/project-delivered-campaign";
import {
  SupabasePendingOperationsRepository,
  type PendingArtifactProber,
} from "@/lib/product-1-1/pending/pending-operations-repository";
import { resolveCampaignGenerationOrigin } from "@/lib/product-9-16-two-stage/orchestration/origin";
import { CompositionVerticalProbe } from "@/lib/product-9-16-two-stage/orchestration/vertical-probe";
import { VerticalArtifactStore } from "../artifact/artifact-store";
import { makeVerticalProjection } from "../orchestration/entrypoint";

export type PendingFormatKind = "1:1" | "9:16" | "unavailable";

export interface PendingFormatAdapter {
  resolveFormat(campaignId: string): Promise<{ kind: PendingFormatKind }>;
  readonly verticalArtifacts: PendingArtifactProber;
  /** F60.5 — sonda de composição para a origem canônica de duas etapas. */
  readonly twoStageArtifacts: PendingArtifactProber;
  projectionFor(
    storeId: string,
    campaignId: string,
    operationId: string,
  ): typeof projectDeliveredCampaign;
}

async function readSnapshot(
  client: SupabaseClient,
  campaignId: string,
): Promise<unknown> {
  const { data, error } = await client
    .from("campaigns")
    .select("input_snapshot")
    .eq("id", campaignId)
    .maybeSingle();
  if (error) return undefined;
  return (data as { input_snapshot?: unknown } | null)?.input_snapshot;
}

/**
 * F59/F60.5 — único ponto que conhece `product-1-1`, o módulo vertical direto e
 * a composição de duas etapas para a resolução administrativa de pendências.
 */
export function createPendingFormatAdapter(
  deps: { client?: SupabaseClient } = {},
): PendingFormatAdapter {
  const client = deps.client ?? supabaseAdmin;
  const verticalArtifacts = new VerticalArtifactStore({ client });
  const twoStageArtifacts = new CompositionVerticalProbe({ client });

  async function resolveFormat(campaignId: string) {
    const snapshot = await readSnapshot(client, campaignId);
    if (snapshot === undefined) return { kind: "unavailable" as const };
    const resolution = resolveCampaignFormat(snapshot);
    if (resolution.kind === "unavailable") return { kind: "unavailable" as const };
    return { kind: resolution.kind };
  }

  return {
    resolveFormat,
    verticalArtifacts,
    twoStageArtifacts,
    projectionFor(storeId, campaignId, operationId) {
      return async (input, projectionDeps = {}) => {
        const snapshot = await readSnapshot(client, campaignId);
        if (snapshot === undefined) {
          return { projected: false, reason: "artifact_missing" } as ProjectDeliveredCampaignResult;
        }
        const origin = resolveCampaignGenerationOrigin(snapshot);
        if (origin.kind === "two_stage_9_16") {
          const row = await getArtifactByIdentity(
            { storeId, campaignId, operationId, role: "vertical" },
            client,
          );
          if (row.kind !== "found") {
            return { projected: false, reason: "artifact_missing" } as ProjectDeliveredCampaignResult;
          }
          return projectDeliveredCampaign(
            {
              ...input,
              source: {
                kind: "composition",
                role: "vertical",
                expectedPath: row.record.storagePath,
              },
            },
            { ...projectionDeps, client },
          );
        }
        if (origin.kind === "indeterminate") {
          return { projected: false, reason: "artifact_missing" } as ProjectDeliveredCampaignResult;
        }
        const format = await resolveFormat(campaignId);
        if (format.kind === "9:16") {
          return makeVerticalProjection(storeId, campaignId, operationId, {
            client,
          })(input);
        }
        return projectDeliveredCampaign(input, { ...projectionDeps, client });
      };
    },
  };
}

/**
 * Fábrica ÚNICA do repositório administrativo, compartilhada por GET, POST e
 * pela página de listagem. Garante `twoStageArtifacts` em todas as superfícies.
 */
export function buildAdminPendingRepository(
  adapter: PendingFormatAdapter,
  client: SupabaseClient = supabaseAdmin,
): SupabasePendingOperationsRepository {
  return new SupabasePendingOperationsRepository(client, undefined, {
    resolveFormat: adapter.resolveFormat,
    verticalArtifacts: adapter.verticalArtifacts,
    twoStageArtifacts: adapter.twoStageArtifacts,
  });
}
