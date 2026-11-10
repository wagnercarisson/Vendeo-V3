import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabase/server";

import {
  checkCampaignStoreBinding,
  validateAuthorizationContext,
} from "./identity";
import type { AuthorizationContext } from "./types";

/**
 * F60.1 — Checagem de acesso comum a recuperação, resolução e revalidação de
 * fonte. O contexto chega já resolvido pelo servidor; nada é lido de
 * request/body e nenhum path participa da autorização.
 */

export type AccessFailureReason =
  | "identity_conflict"
  | "store_mismatch"
  | "not_owner";

export type AccessResult =
  | { readonly ok: true; readonly authorization: AuthorizationContext }
  | { readonly ok: false; readonly reason: AccessFailureReason };

export interface CampaignAccessInput {
  readonly storeId: string;
  readonly campaignId: string;
  readonly authorization: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

async function readColumn(
  client: SupabaseClient,
  table: "campaigns" | "stores",
  id: string,
  column: string,
): Promise<unknown> {
  let data: unknown;
  let error: unknown;
  try {
    const result = await client
      .from(table)
      .select(column)
      .eq("id", id)
      .maybeSingle();
    data = result.data;
    error = result.error;
  } catch {
    return undefined;
  }
  if (error || !isRecord(data)) return undefined;
  return data[column];
}

/**
 * Exige contexto válido, vínculo campanha→loja e, para `owner`, propriedade da
 * loja. `system` não dispensa o vínculo.
 */
export async function verifyCampaignAccess(
  input: CampaignAccessInput,
  client: SupabaseClient = supabaseAdmin,
): Promise<AccessResult> {
  const authorization = validateAuthorizationContext(input.authorization);
  if (!authorization.ok) {
    return Object.freeze({ ok: false as const, reason: "identity_conflict" as const });
  }

  const campaignStoreId = await readColumn(
    client,
    "campaigns",
    input.campaignId,
    "store_id",
  );
  if (campaignStoreId === undefined) {
    return Object.freeze({ ok: false as const, reason: "identity_conflict" as const });
  }

  const binding = checkCampaignStoreBinding(campaignStoreId, input.storeId);
  if (!binding.ok) {
    return Object.freeze({ ok: false as const, reason: "store_mismatch" as const });
  }

  if (authorization.authorization.kind === "owner") {
    const ownerId = await readColumn(client, "stores", input.storeId, "user_id");
    if (
      typeof ownerId !== "string" ||
      ownerId !== authorization.authorization.userId
    ) {
      return Object.freeze({ ok: false as const, reason: "not_owner" as const });
    }
  }

  return Object.freeze({
    ok: true as const,
    authorization: authorization.authorization,
  });
}
