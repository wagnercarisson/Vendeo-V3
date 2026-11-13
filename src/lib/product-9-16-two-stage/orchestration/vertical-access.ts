import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabase/server";
import {
  COMPOSITION_ARTIFACT_BUCKET,
  parseCompositionArtifactPath,
} from "@/lib/campaign/composition-artifacts/artifact-path";
import { retrieveCompositionArtifact } from "@/lib/campaign/composition-artifacts/retrieve";
import {
  THUMBNAIL_BUCKET,
  deriveThumbnailPath,
} from "@/lib/campaign/thumbnail/thumbnail-path";
import type { VerticalArtifactProbe } from "../two-stage-financial-service";
import { resolveCampaignGenerationOrigin } from "./origin";
import { CompositionVerticalProbe } from "./vertical-probe";

export type VerticalAccessUnavailableReason =
  | "not_delivered"
  | "not_found"
  | "indeterminate"
  | "origin_mismatch"
  | "artifact_incompatible"
  | "suspended";

export type NineSixteenVerticalAccess =
  | {
      readonly kind: "previewUrl";
      readonly url: string;
      readonly expiresInSeconds: 300;
    }
  | { readonly kind: "thumbnailUrl"; readonly url: string | null }
  | {
      readonly kind: "downloadBytes";
      readonly bytes: Buffer;
      readonly mimeType: "image/jpeg";
    }
  | {
      readonly kind: "not_available";
      readonly reason: VerticalAccessUnavailableReason;
    };

export type VerticalAccessMode = "preview" | "thumbnail" | "download";

export interface NineSixteenVerticalAccessInput {
  readonly storeId: string;
  readonly campaignId: string;
  readonly operationId: string;
  readonly mode: VerticalAccessMode;
}

export interface NineSixteenVerticalAccessDeps {
  readonly client?: SupabaseClient;
  readonly probe?: VerticalArtifactProbe;
}

const CREDIT_TABLE = "product_1_1_campaign_credit_operations";
const SIGNED_URL_TTL_SECONDS = 300 as const;

function notAvailable(
  reason: VerticalAccessUnavailableReason,
): NineSixteenVerticalAccess {
  return Object.freeze({ kind: "not_available" as const, reason });
}

async function readCampaignSnapshot(
  client: SupabaseClient,
  campaignId: string,
): Promise<
  | { readonly kind: "found"; readonly inputSnapshot: unknown; readonly storeId: string }
  | { readonly kind: "absent" }
  | { readonly kind: "indeterminate" }
> {
  try {
    const { data, error } = await client
      .from("campaigns")
      .select("input_snapshot, store_id")
      .eq("id", campaignId)
      .maybeSingle();
    if (error) return { kind: "indeterminate" };
    if (!data) return { kind: "absent" };
    const record = data as { input_snapshot?: unknown; store_id?: unknown };
    if (typeof record.store_id !== "string") return { kind: "indeterminate" };
    return {
      kind: "found",
      inputSnapshot: record.input_snapshot,
      storeId: record.store_id,
    };
  } catch {
    return { kind: "indeterminate" };
  }
}

async function readCreditStatus(
  client: SupabaseClient,
  campaignId: string,
  operationId: string,
): Promise<
  | { readonly kind: "found"; readonly status: string; readonly storeId: string }
  | { readonly kind: "absent" }
  | { readonly kind: "indeterminate" }
> {
  try {
    const { data, error } = await client
      .from(CREDIT_TABLE)
      .select("status, store_id")
      .eq("campaign_id", campaignId)
      .eq("operation_id", operationId)
      .maybeSingle();
    if (error) return { kind: "indeterminate" };
    if (!data) return { kind: "absent" };
    const record = data as { status?: unknown; store_id?: unknown };
    if (typeof record.status !== "string" || typeof record.store_id !== "string") {
      return { kind: "indeterminate" };
    }
    return { kind: "found", status: record.status, storeId: record.store_id };
  } catch {
    return { kind: "indeterminate" };
  }
}

async function signPath(
  client: SupabaseClient,
  bucket: string,
  path: string,
): Promise<string | null> {
  try {
    const { data, error } = await client.storage
      .from(bucket)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  } catch {
    return null;
  }
}

/**
 * Acesso autorizado ao vertical de composição. Só produz preview/download do
 * ORIGINAL após `delivered` e origem `two_stage_9_16`; a miniatura é derivada em
 * `campaign-images` e nunca cai para o original. Nunca expõe bucket/checksum.
 */
export async function nineSixteenVerticalAccess(
  input: NineSixteenVerticalAccessInput,
  deps: NineSixteenVerticalAccessDeps = {},
): Promise<NineSixteenVerticalAccess> {
  const client = deps.client ?? supabaseAdmin;
  const probe = deps.probe ?? new CompositionVerticalProbe({ client });

  const campaign = await readCampaignSnapshot(client, input.campaignId);
  if (campaign.kind === "indeterminate") return notAvailable("indeterminate");
  if (campaign.kind === "absent") return notAvailable("not_found");
  if (campaign.storeId !== input.storeId) return notAvailable("not_found");

  const origin = resolveCampaignGenerationOrigin(campaign.inputSnapshot);
  if (origin.kind !== "two_stage_9_16") return notAvailable("origin_mismatch");

  const credit = await readCreditStatus(client, input.campaignId, input.operationId);
  if (credit.kind === "indeterminate") return notAvailable("indeterminate");
  if (credit.kind === "absent") return notAvailable("not_found");
  if (credit.storeId !== input.storeId) return notAvailable("not_found");
  if (credit.status !== "delivered") return notAvailable("not_delivered");

  const vertical = await probe.probeVerticalArtifact({
    storeId: input.storeId,
    campaignId: input.campaignId,
    operationId: input.operationId,
  });
  if (vertical.kind === "indeterminate") return notAvailable("indeterminate");
  if (vertical.kind === "absent") return notAvailable("not_found");
  if (vertical.kind !== "integral") return notAvailable("artifact_incompatible");

  if (input.mode === "thumbnail") {
    const thumbnailPath = deriveThumbnailPath(vertical.storagePath);
    if (!thumbnailPath) return Object.freeze({ kind: "thumbnailUrl" as const, url: null });
    const url = await signPath(client, THUMBNAIL_BUCKET, thumbnailPath);
    return Object.freeze({ kind: "thumbnailUrl" as const, url });
  }

  const parsed = parseCompositionArtifactPath(vertical.storagePath);
  if (!parsed || parsed.role !== "vertical") {
    return notAvailable("artifact_incompatible");
  }

  if (input.mode === "preview") {
    const url = await signPath(
      client,
      COMPOSITION_ARTIFACT_BUCKET,
      vertical.storagePath,
    );
    if (!url) return notAvailable("indeterminate");
    return Object.freeze({
      kind: "previewUrl" as const,
      url,
      expiresInSeconds: SIGNED_URL_TTL_SECONDS,
    });
  }

  const retrieved = await retrieveCompositionArtifact(
    {
      identity: {
        storeId: input.storeId,
        campaignId: input.campaignId,
        operationId: input.operationId,
        role: "vertical",
      },
      authorization: { kind: "system" },
    },
    { client },
  );
  if (retrieved.kind === "indeterminate") return notAvailable("indeterminate");
  if (retrieved.kind === "absent") return notAvailable("not_found");
  if (retrieved.kind !== "integral") return notAvailable("artifact_incompatible");
  return Object.freeze({
    kind: "downloadBytes" as const,
    bytes: retrieved.bytes,
    mimeType: "image/jpeg" as const,
  });
}
