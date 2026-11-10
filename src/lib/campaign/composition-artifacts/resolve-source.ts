import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabase/server";

import { verifyCampaignAccess } from "./access";
import { isArtifactUuid } from "./identity";
import { getArtifactByIdentity } from "./repository";
import { isArtifactRole } from "./role-policy";
import {
  validateDeliveredCampaignSource,
  validateInternalArtifactSource,
  type SourceValidationFailureReason,
} from "./source-validation";
import type {
  ResolveSquareSourceInput,
  ResolveSquareSourceReason,
  ResolveSquareSourceResult,
} from "./types";

export interface ResolveSquareSourceDeps {
  readonly client?: SupabaseClient;
}

const REUSABLE_ROLES: ReadonlySet<string> = new Set([
  "square_original",
  "square_prepared",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function notReusable(
  reason: ResolveSquareSourceReason | SourceValidationFailureReason,
): ResolveSquareSourceResult {
  return Object.freeze({
    kind: "not_reusable" as const,
    reason: reason as ResolveSquareSourceReason,
  });
}

/**
 * Resolve uma fonte quadrada reutilizável de forma SOMENTE LEITURA. Recebe
 * apenas IDs/identidade — nunca `storagePath` — e delega toda a validação de
 * conteúdo aos validadores de origem.
 */
export async function resolveReusableSquareSource(
  input: ResolveSquareSourceInput,
  deps: ResolveSquareSourceDeps = {},
): Promise<ResolveSquareSourceResult> {
  const client = deps.client ?? supabaseAdmin;

  if (input.kind === "legacy_campaign" || input.kind === "new_flow_1_1") {
    const access = await verifyCampaignAccess(
      {
        storeId: input.storeId,
        campaignId: input.campaignId,
        authorization: input.authorization,
      },
      client,
    );
    if (!access.ok) {
      return notReusable(access.reason);
    }

    let campaignData: unknown;
    let campaignError: unknown;
    try {
      const result = await client
        .from("campaigns")
        .select("id, store_id, status, storage_path, input_snapshot")
        .eq("id", input.campaignId)
        .maybeSingle();
      campaignData = result.data;
      campaignError = result.error;
    } catch {
      return notReusable("identity_conflict");
    }
    if (campaignError || !isRecord(campaignData)) {
      return notReusable("identity_conflict");
    }

    const storagePath =
      typeof campaignData.storage_path === "string"
        ? campaignData.storage_path
        : "";

    const validated = await validateDeliveredCampaignSource(
      {
        origin: input.kind,
        storeId: input.storeId,
        campaignId: input.campaignId,
        storagePath,
      },
      input.authorization,
      { client },
    );
    if (!validated.ok) {
      return notReusable(validated.reason);
    }
    return Object.freeze({
      kind: "reusable" as const,
      source: validated.source,
    });
  }

  // Base interna: exige identidade quadrada e integridade; não exige campanha
  // `ready`, entrega quadrada ou formato global 1:1.
  if (
    !isArtifactRole(input.role) ||
    !REUSABLE_ROLES.has(input.role)
  ) {
    return notReusable("role_not_reusable");
  }

  if (
    !isArtifactUuid(input.storeId) ||
    !isArtifactUuid(input.campaignId) ||
    !isArtifactUuid(input.operationId)
  ) {
    return notReusable("identity_conflict");
  }

  const access = await verifyCampaignAccess(
    {
      storeId: input.storeId,
      campaignId: input.campaignId,
      authorization: input.authorization,
    },
    client,
  );
  if (!access.ok) {
    return notReusable(access.reason);
  }

  const row = await getArtifactByIdentity(
    {
      storeId: input.storeId.toLowerCase(),
      campaignId: input.campaignId.toLowerCase(),
      operationId: input.operationId.toLowerCase(),
      role: input.role,
    },
    client,
  );
  if (row.kind === "read_failed") {
    return notReusable("artifact_indeterminate");
  }
  if (row.kind === "absent") {
    return notReusable("artifact_absent");
  }

  const validated = await validateInternalArtifactSource(
    row.record.id,
    { storeId: input.storeId, campaignId: input.campaignId },
    input.authorization,
    { client },
  );
  if (!validated.ok) {
    return notReusable(validated.reason);
  }
  return Object.freeze({
    kind: "reusable" as const,
    source: validated.source,
  });
}
