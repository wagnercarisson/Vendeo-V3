import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabase/server";
import {
  THUMBNAIL_BUCKET,
  deriveThumbnailPath,
} from "@/lib/campaign/thumbnail/thumbnail-path";
import { VerticalArtifactStore } from "@/lib/product-vertical-9-16/artifact/artifact-store";
import { resolveCampaignGenerationOrigin } from "./origin";
import type { VerticalAccessUnavailableReason } from "./vertical-access";

export type HistoricalVerticalAccess =
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

export interface HistoricalVerticalAccessInput {
  readonly storeId: string;
  readonly campaignId: string;
  readonly operationId: string;
  readonly mode: "preview" | "thumbnail" | "download";
}

export interface HistoricalVerticalAccessDeps {
  readonly client?: SupabaseClient;
  readonly store?: VerticalArtifactStore;
}

const SIGNED_URL_TTL_SECONDS = 300 as const;

function notAvailable(
  reason: VerticalAccessUnavailableReason,
): HistoricalVerticalAccess {
  return Object.freeze({ kind: "not_available" as const, reason });
}

/**
 * Acesso ao vertical DIRETO histórico (F59), sem conversão de origem e sem
 * marcador novo. Usa o store vertical existente; nunca gera, nunca assina antes
 * de uma arte íntegra.
 */
export async function historicalVerticalAccess(
  input: HistoricalVerticalAccessInput,
  deps: HistoricalVerticalAccessDeps = {},
): Promise<HistoricalVerticalAccess> {
  const client = deps.client ?? supabaseAdmin;
  const store = deps.store ?? new VerticalArtifactStore({ client });

  let snapshot: unknown;
  try {
    const { data, error } = await client
      .from("campaigns")
      .select("input_snapshot, store_id")
      .eq("id", input.campaignId)
      .maybeSingle();
    if (error) return notAvailable("indeterminate");
    if (!data) return notAvailable("not_found");
    const record = data as { input_snapshot?: unknown; store_id?: unknown };
    if (record.store_id !== input.storeId) return notAvailable("not_found");
    snapshot = record.input_snapshot;
  } catch {
    return notAvailable("indeterminate");
  }

  if (resolveCampaignGenerationOrigin(snapshot).kind !== "historical") {
    return notAvailable("origin_mismatch");
  }

  const probe = await store.probeArtifact({
    storeId: input.storeId,
    campaignId: input.campaignId,
    operationId: input.operationId,
  });
  if (probe.kind === "indeterminate") return notAvailable("indeterminate");
  if (probe.kind === "absent") return notAvailable("not_found");
  if (probe.kind !== "integral") return notAvailable("artifact_incompatible");

  if (input.mode === "thumbnail") {
    const thumbnailPath = deriveThumbnailPath(probe.storagePath);
    if (!thumbnailPath) {
      return Object.freeze({ kind: "thumbnailUrl" as const, url: null });
    }
    try {
      const { data, error } = await client.storage
        .from(THUMBNAIL_BUCKET)
        .createSignedUrl(thumbnailPath, SIGNED_URL_TTL_SECONDS);
      return Object.freeze({
        kind: "thumbnailUrl" as const,
        url: error || !data?.signedUrl ? null : data.signedUrl,
      });
    } catch {
      return Object.freeze({ kind: "thumbnailUrl" as const, url: null });
    }
  }

  if (input.mode === "preview") {
    try {
      const url = await store.getSignedArtifactUrl(
        probe.storagePath,
        SIGNED_URL_TTL_SECONDS,
      );
      return Object.freeze({
        kind: "previewUrl" as const,
        url,
        expiresInSeconds: SIGNED_URL_TTL_SECONDS,
      });
    } catch {
      return notAvailable("indeterminate");
    }
  }

  try {
    const downloaded = await store.downloadArtifact(probe.storagePath);
    return Object.freeze({
      kind: "downloadBytes" as const,
      bytes: downloaded.buffer,
      mimeType: downloaded.mimeType,
    });
  } catch {
    return notAvailable("indeterminate");
  }
}
