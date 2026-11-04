import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { dataUrlToCampaignImage } from "@/lib/campaign/persistence";
import {
  createDefaultThumbnailContext,
  type ThumbnailContext,
} from "@/lib/campaign/thumbnail/thumbnail-generator";
import { generateCampaignThumbnailSafely } from "@/lib/campaign/thumbnail/thumbnail-safe";
import { supabaseAdmin } from "@/lib/supabase/server";

import { VERTICAL_ARTIFACT_PATH_RE, artifactStoragePath } from "./artifact-path";
import { resizeVerticalToJpeg1080x1920, verifyVerticalJpeg1080x1920 } from "./resize";
import {
  VerticalArtifactError,
  type ArtifactProbe,
  type VerticalArtifactRef,
} from "./types";

const BUCKET = "campaign-images";
const ARTIFACT_TABLE = "product_1_1_campaign_artifacts";
const DEFAULT_SIGNED_URL_TTL_SECONDS = 300;

export interface VerticalStoreDeps {
  readonly client?: SupabaseClient;
  readonly thumbnailContext?: ThumbnailContext | null;
}

export interface StoreVerticalArtifactInput {
  readonly storeId: string;
  readonly campaignId: string;
  readonly operationId: string;
  readonly imageDataUrl: string;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function mapUploadError(error: {
  message?: string;
  statusCode?: string | number;
}): VerticalArtifactError {
  const status = String(error.statusCode ?? "");
  const text = (error.message ?? "").toLowerCase();
  if (
    status === "409" ||
    text.includes("already exists") ||
    text.includes("duplicate")
  ) {
    return new VerticalArtifactError(
      "artifact_path_conflict",
      error.message ?? "artifact_path_conflict",
    );
  }
  return new VerticalArtifactError(
    "artifact_upload_failed",
    error.message ?? "artifact_upload_failed",
  );
}

/**
 * Ausência só é confirmada quando o 404 nomeia o OBJETO (não o bucket).
 * Qualquer outro erro é `indeterminate` — nunca ausência.
 */
function isAbsenceError(error: unknown): boolean {
  if (error === null || typeof error !== "object") return false;
  const record = error as { message?: unknown; statusCode?: unknown };
  if (String(record.statusCode ?? "") !== "404") return false;
  const text = String(record.message ?? "").toLowerCase();
  if (text.includes("bucket")) return false;
  return /object not found/i.test(text) || /object does not exist/i.test(text);
}

async function toBuffer(payload: unknown): Promise<Buffer> {
  if (Buffer.isBuffer(payload)) return payload;
  if (payload instanceof Uint8Array) return Buffer.from(payload);
  if (typeof payload === "string") return Buffer.from(payload, "binary");
  if (
    payload !== null &&
    typeof payload === "object" &&
    typeof (payload as { arrayBuffer?: unknown }).arrayBuffer === "function"
  ) {
    const buffer = await (payload as Blob).arrayBuffer();
    return Buffer.from(buffer);
  }
  throw new Error("unsupported_download_payload");
}

/**
 * F59 — Store do artefato vertical.
 *
 * O original é gravado no path dedicado
 * `{storeId}/{campaignId}/product-9-16/{operationId}/art-1080x1920.jpg`
 * com `upsert:false`; os metadados persistidos vêm dos bytes decodificados.
 */
export class VerticalArtifactStore {
  private readonly client: SupabaseClient;
  private readonly thumbnailContext: ThumbnailContext | null;

  constructor(deps: VerticalStoreDeps = {}) {
    this.client = deps.client ?? supabaseAdmin;
    this.thumbnailContext =
      deps.thumbnailContext !== undefined
        ? deps.thumbnailContext
        : this.client === supabaseAdmin
          ? createDefaultThumbnailContext()
          : null;
  }

  async storeArtifact(
    input: StoreVerticalArtifactInput,
  ): Promise<VerticalArtifactRef> {
    const { storeId, campaignId, operationId, imageDataUrl } = input;

    let decoded: { buffer: Buffer; mimeType: string };
    try {
      decoded = dataUrlToCampaignImage(imageDataUrl);
    } catch (error) {
      throw new VerticalArtifactError(
        "artifact_upload_failed",
        errorMessage(error),
      );
    }

    let jpeg: Awaited<ReturnType<typeof resizeVerticalToJpeg1080x1920>>;
    try {
      jpeg = await resizeVerticalToJpeg1080x1920(decoded.buffer);
    } catch (error) {
      throw new VerticalArtifactError(
        "artifact_upload_failed",
        errorMessage(error),
      );
    }

    const storagePath = artifactStoragePath(storeId, campaignId, operationId);

    let uploadError: { message?: string; statusCode?: string | number } | null = null;
    try {
      const uploaded = await this.client.storage
        .from(BUCKET)
        .upload(storagePath, jpeg.buffer, {
          contentType: "image/jpeg",
          upsert: false,
        });
      uploadError = uploaded.error;
    } catch (error) {
      throw new VerticalArtifactError(
        "artifact_upload_failed",
        errorMessage(error),
      );
    }
    if (uploadError) throw mapUploadError(uploadError);
    const ref: VerticalArtifactRef = Object.freeze({
      storagePath,
      width: jpeg.width,
      height: jpeg.height,
      mimeType: jpeg.mimeType,
      sourceWidth: jpeg.sourceWidth,
      sourceHeight: jpeg.sourceHeight,
    });

    let insertError: { message?: string } | null = null;
    try {
      const inserted = await this.client.from(ARTIFACT_TABLE).insert({
        campaign_id: campaignId,
        operation_id: operationId,
        storage_path: ref.storagePath,
        width: ref.width,
        height: ref.height,
        mime_type: ref.mimeType,
      });
      insertError = inserted.error;
    } catch (error) {
      throw new VerticalArtifactError(
        "artifact_metadata_persist_failed",
        errorMessage(error),
      );
    }
    if (insertError) {
      throw new VerticalArtifactError(
        "artifact_metadata_persist_failed",
        errorMessage(insertError),
      );
    }

    // Best-effort: miniatura nunca bloqueia entrega/crédito/download.
    if (this.thumbnailContext !== null) {
      try {
        await generateCampaignThumbnailSafely({
          originalPath: storagePath,
          originalBuffer: jpeg.buffer,
          context: this.thumbnailContext,
          campaignId,
        });
      } catch {
        // isolado por contrato
      }
    }

    return ref;
  }

  async probeArtifact(input: {
    storeId: string;
    campaignId: string;
    operationId: string;
  }): Promise<ArtifactProbe> {
    const storagePath = artifactStoragePath(
      input.storeId,
      input.campaignId,
      input.operationId,
    );

    let data: unknown;
    let error: unknown;
    try {
      ({ data, error } = await this.client.storage
        .from(BUCKET)
        .download(storagePath));
    } catch {
      return { kind: "indeterminate" };
    }

    if (error) {
      return isAbsenceError(error) ? { kind: "absent" } : { kind: "indeterminate" };
    }
    if (!data) return { kind: "indeterminate" };

    let buffer: Buffer;
    try {
      buffer = await toBuffer(data);
    } catch {
      return { kind: "indeterminate" };
    }

    try {
      const verified = await verifyVerticalJpeg1080x1920(buffer);
      const ref: VerticalArtifactRef = Object.freeze({
        storagePath,
        width: verified.width,
        height: verified.height,
        mimeType: verified.mimeType,
      });
      return Object.freeze({
        kind: "integral",
        ref,
        width: ref.width,
        height: ref.height,
        mimeType: ref.mimeType,
        storagePath,
      });
    } catch {
      return { kind: "invalid" };
    }
  }

  async downloadArtifact(
    storagePath: string,
  ): Promise<{ buffer: Buffer; mimeType: "image/jpeg" }> {
    if (!VERTICAL_ARTIFACT_PATH_RE.test(storagePath)) {
      throw new VerticalArtifactError(
        "artifact_invalid_path",
        `refusing to download non-vertical path: ${storagePath}`,
      );
    }

    const { data, error } = await this.client.storage
      .from(BUCKET)
      .download(storagePath);
    if (error || !data) {
      throw new VerticalArtifactError(
        "artifact_download_failed",
        errorMessage(error ?? "artifact_download_failed"),
      );
    }

    let buffer: Buffer;
    try {
      buffer = await toBuffer(data);
    } catch (bufferError) {
      throw new VerticalArtifactError(
        "artifact_download_failed",
        errorMessage(bufferError),
      );
    }
    try {
      await verifyVerticalJpeg1080x1920(buffer);
    } catch (verifyError) {
      throw new VerticalArtifactError(
        "artifact_download_failed",
        errorMessage(verifyError),
      );
    }

    return { buffer, mimeType: "image/jpeg" };
  }

  async getSignedArtifactUrl(
    storagePath: string,
    ttlSeconds: number = DEFAULT_SIGNED_URL_TTL_SECONDS,
  ): Promise<string> {
    if (!VERTICAL_ARTIFACT_PATH_RE.test(storagePath)) {
      throw new VerticalArtifactError(
        "artifact_invalid_path",
        `refusing to sign non-vertical path: ${storagePath}`,
      );
    }
    if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) {
      throw new VerticalArtifactError(
        "artifact_sign_failed",
        "invalid signed url ttl",
      );
    }

    const { data, error } = await this.client.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, ttlSeconds);
    if (error) {
      throw new VerticalArtifactError(
        "artifact_sign_failed",
        errorMessage(error),
      );
    }
    if (!data?.signedUrl) {
      throw new VerticalArtifactError(
        "artifact_sign_failed",
        "missing signed url",
      );
    }

    return data.signedUrl;
  }
}

export { artifactStoragePath };
