import "server-only";

import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/server";
import { dataUrlToCampaignImage } from "@/lib/campaign/persistence";
import {
  ProductOneToOneArtifactUploadError,
  type ProductOneToOneArtifactRef,
} from "./types";

/**
 * F56.2b1b — Armazenamento do artefato do Produto 1:1 (Plano 05, server-only).
 *
 * O novo fluxo define o PRÓPRIO pipeline `resizeToJpeg1024` (1024×1024) e NÃO
 * reutiliza o helper legado `transcodeToJpeg` (1080×1080, `image-processor.ts`),
 * que permanece intocado. As dimensões persistidas são DECODIFICADAS dos bytes
 * do arquivo produzido (`sharp(buffer).metadata()`), nunca um valor declarado
 * (F7). O upload é imutável (`upsert:false`) no bucket PRIVADO `campaign-images`.
 */

const BUCKET = "campaign-images";
const ARTIFACT_TABLE = "product_1_1_campaign_artifacts";
const ARTIFACT_SELECT_COLUMNS = "storage_path, width, height, mime_type";
const ARTIFACT_SIZE = 1024;
const SUPPORTED_INPUT_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

/** Caminho determinístico e exclusivo do novo fluxo (T-56.2.2-05-03). */
export function artifactStoragePath(
  storeId: string,
  campaignId: string,
  operationId: string,
): string {
  return `${storeId}/${campaignId}/product-1-1/${operationId}/art-1024.jpg`;
}

/**
 * Pipeline PRÓPRIO do novo fluxo: transcodifica para JPEG sRGB 1:1 1024×1024.
 * Não altera nem reutiliza o `transcodeToJpeg` legado (1080×1080).
 */
export async function resizeToJpeg1024(
  buffer: Buffer,
  mimeType: string,
): Promise<{ buffer: Buffer; mimeType: "image/jpeg" }> {
  if (!SUPPORTED_INPUT_MIME_TYPES.has(mimeType)) {
    throw new Error(
      `Unsupported image format: ${mimeType}. Expected PNG, JPEG, or WEBP.`,
    );
  }

  const jpegBuffer = await sharp(buffer)
    .resize(ARTIFACT_SIZE, ARTIFACT_SIZE, { fit: "contain", background: "#FFFFFF" })
    .jpeg({ quality: 90 })
    .toBuffer();

  return { buffer: jpegBuffer, mimeType: "image/jpeg" };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** DECODIFICA as dimensões dos BYTES do arquivo (F7 — não é valor declarado). */
async function decodeDimensions(
  buffer: Buffer,
): Promise<{ width: number; height: number }> {
  const metadata = await sharp(buffer).metadata();
  const { width, height } = metadata;
  if (typeof width !== "number" || typeof height !== "number") {
    throw new Error("undecodable_image_dimensions");
  }
  return { width, height };
}

function mapUploadError(error: {
  message?: string;
  statusCode?: string | number;
}): ProductOneToOneArtifactUploadError {
  const status = String(error?.statusCode ?? "");
  const text = (error?.message ?? "").toLowerCase();
  if (status === "409" || text.includes("already exists") || text.includes("duplicate")) {
    return new ProductOneToOneArtifactUploadError(
      "artifact_path_conflict",
      error?.message ?? "artifact_path_conflict",
    );
  }
  return new ProductOneToOneArtifactUploadError(
    "artifact_upload_failed",
    error?.message ?? "artifact_upload_failed",
  );
}

export interface StoreArtifactInput {
  readonly storeId: string;
  readonly campaignId: string;
  readonly operationId: string;
  readonly imageDataUrl: string;
}

export class ProductOneToOneArtifactStore {
  constructor(private readonly client: SupabaseClient = supabaseAdmin) {}

  /**
   * Produz a arte 1:1 1024×1024 (pipeline próprio), grava no caminho imutável
   * do novo fluxo (bucket privado, `upsert:false`) e persiste o registro com as
   * dimensões DECODIFICADAS dos bytes.
   */
  async storeArtifact(input: StoreArtifactInput): Promise<ProductOneToOneArtifactRef> {
    const { storeId, campaignId, operationId, imageDataUrl } = input;

    // (a) Decodifica a entrada (data URL → buffer + mimeType).
    let decoded: { buffer: Buffer; mimeType: string };
    try {
      decoded = dataUrlToCampaignImage(imageDataUrl);
    } catch (error) {
      throw new ProductOneToOneArtifactUploadError(
        "artifact_upload_failed",
        errorMessage(error),
      );
    }

    // (b) Pipeline PRÓPRIO do novo fluxo (1024×1024) — nunca o legado 1080×1080.
    let jpeg: { buffer: Buffer; mimeType: "image/jpeg" };
    try {
      jpeg = await resizeToJpeg1024(decoded.buffer, decoded.mimeType);
    } catch (error) {
      throw new ProductOneToOneArtifactUploadError(
        "artifact_upload_failed",
        errorMessage(error),
      );
    }

    // (c) DECODIFICA as dimensões do buffer resultante (fail-closed se ≠ 1024×1024).
    let dimensions: { width: number; height: number };
    try {
      dimensions = await decodeDimensions(jpeg.buffer);
    } catch (error) {
      throw new ProductOneToOneArtifactUploadError(
        "artifact_dimension_mismatch",
        errorMessage(error),
      );
    }
    if (dimensions.width !== ARTIFACT_SIZE || dimensions.height !== ARTIFACT_SIZE) {
      throw new ProductOneToOneArtifactUploadError(
        "artifact_dimension_mismatch",
        `expected ${ARTIFACT_SIZE}x${ARTIFACT_SIZE}, got ${dimensions.width}x${dimensions.height}`,
      );
    }

    const storagePath = artifactStoragePath(storeId, campaignId, operationId);

    // (d) Upload imutável no bucket PRIVADO (upsert:false — nunca sobrescreve).
    const { error: uploadError } = await this.client.storage
      .from(BUCKET)
      .upload(storagePath, jpeg.buffer, {
        contentType: "image/jpeg",
        upsert: false,
      });
    if (uploadError) {
      throw mapUploadError(uploadError);
    }

    // (e) Persiste o registro imutável com as dimensões DECODIFICADAS.
    const ref: ProductOneToOneArtifactRef = Object.freeze({
      storagePath,
      width: dimensions.width,
      height: dimensions.height,
      mimeType: "image/jpeg",
    });

    const { error: insertError } = await this.client.from(ARTIFACT_TABLE).insert({
      campaign_id: campaignId,
      operation_id: operationId,
      storage_path: ref.storagePath,
      width: ref.width,
      height: ref.height,
      mime_type: ref.mimeType,
    });
    if (insertError) {
      throw new ProductOneToOneArtifactUploadError(
        "artifact_metadata_persist_failed",
        errorMessage(insertError),
      );
    }

    return ref;
  }

  /** Recupera o registro persistido do artefato (ou `null` se ausente). */
  async getArtifactMetadata(
    campaignId: string,
    operationId: string,
  ): Promise<ProductOneToOneArtifactRef | null> {
    const { data, error } = await this.client
      .from(ARTIFACT_TABLE)
      .select(ARTIFACT_SELECT_COLUMNS)
      .eq("campaign_id", campaignId)
      .eq("operation_id", operationId)
      .maybeSingle();

    if (error) {
      throw new ProductOneToOneArtifactUploadError(
        "artifact_missing",
        errorMessage(error),
      );
    }
    if (!data) {
      return null;
    }

    const row = data as Record<string, unknown>;
    return Object.freeze({
      storagePath: String(row.storage_path ?? ""),
      width: Number(row.width ?? 0),
      height: Number(row.height ?? 0),
      mimeType: String(row.mime_type ?? ""),
    });
  }
}
