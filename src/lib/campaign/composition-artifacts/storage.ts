import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabase/server";

import { COMPOSITION_ARTIFACT_BUCKET } from "./artifact-path";
import { COMPOSITION_EVIDENCE_METADATA_KEY } from "./evidence";

export const CAMPAIGN_IMAGES_BUCKET = "campaign-images" as const;

const CAMEL_EVIDENCE_KEY = "vendeoCompositionArtifact";

export type DownloadBytesResult =
  | { readonly kind: "bytes"; readonly bytes: Buffer }
  | { readonly kind: "absent" }
  | { readonly kind: "indeterminate" };

export type ReadObjectInfoResult =
  | { readonly kind: "found"; readonly metadata: unknown }
  | { readonly kind: "absent" }
  | { readonly kind: "indeterminate" };

export type UploadImmutableResult =
  | { readonly kind: "uploaded" }
  | { readonly kind: "path_conflict" }
  | { readonly kind: "upload_failed"; readonly message: string };

/**
 * Ausência só é confirmada quando o 404 nomeia o OBJETO e não menciona o
 * bucket. Qualquer outra resposta é `indeterminate`.
 */
function isAbsenceError(error: unknown): boolean {
  if (error === null || typeof error !== "object") return false;
  const record = error as { message?: unknown; statusCode?: unknown };
  if (String(record.statusCode ?? "") !== "404") return false;
  const text = String(record.message ?? "").toLowerCase();
  if (text.includes("bucket")) return false;
  return /object not found/i.test(text) || /object does not exist/i.test(text);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Normaliza a metadata customizada devolvida por `info()` (Camelize) para a
 * chave canônica snake_case, preservando as demais chaves.
 */
function normalizeInfoMetadata(metadata: unknown): unknown {
  if (!isRecord(metadata)) return metadata;
  if (
    Object.prototype.hasOwnProperty.call(metadata, COMPOSITION_EVIDENCE_METADATA_KEY) ||
    !Object.prototype.hasOwnProperty.call(metadata, CAMEL_EVIDENCE_KEY)
  ) {
    return metadata;
  }
  const normalized: Record<string, unknown> = { ...metadata };
  normalized[COMPOSITION_EVIDENCE_METADATA_KEY] = metadata[CAMEL_EVIDENCE_KEY];
  delete normalized[CAMEL_EVIDENCE_KEY];
  return normalized;
}

/**
 * Acesso server-only ao Storage. `downloadBytes` e `readObjectInfo` aceitam
 * bucket explícito para a leitura de fontes entregues em `campaign-images`;
 * `uploadImmutable` grava exclusivamente no bucket interno.
 */
export class CompositionArtifactStorage {
  constructor(private readonly client: SupabaseClient = supabaseAdmin) {}

  async downloadBytes(
    path: string,
    bucket: string = COMPOSITION_ARTIFACT_BUCKET,
  ): Promise<DownloadBytesResult> {
    let data: unknown;
    let error: unknown;
    try {
      ({ data, error } = await this.client.storage.from(bucket).download(path));
    } catch {
      return { kind: "indeterminate" };
    }

    if (error) {
      return isAbsenceError(error) ? { kind: "absent" } : { kind: "indeterminate" };
    }
    if (!data) return { kind: "indeterminate" };

    try {
      return { kind: "bytes", bytes: await toBuffer(data) };
    } catch {
      return { kind: "indeterminate" };
    }
  }

  async readObjectInfo(
    path: string,
    bucket: string = COMPOSITION_ARTIFACT_BUCKET,
  ): Promise<ReadObjectInfoResult> {
    let data: unknown;
    let error: unknown;
    try {
      ({ data, error } = await this.client.storage.from(bucket).info(path));
    } catch {
      return { kind: "indeterminate" };
    }

    if (error) {
      return isAbsenceError(error) ? { kind: "absent" } : { kind: "indeterminate" };
    }
    if (!data || typeof data !== "object") return { kind: "indeterminate" };

    const metadata = (data as { metadata?: unknown }).metadata;
    return { kind: "found", metadata: normalizeInfoMetadata(metadata) };
  }

  async uploadImmutable(
    path: string,
    bytes: Buffer,
    metadata: Record<string, unknown>,
  ): Promise<UploadImmutableResult> {
    let error: { message?: string; statusCode?: string | number } | null = null;
    try {
      const uploaded = await this.client.storage
        .from(COMPOSITION_ARTIFACT_BUCKET)
        .upload(path, bytes, {
          contentType: "image/jpeg",
          upsert: false,
          metadata,
        });
      error = uploaded.error;
    } catch (uploadError) {
      return { kind: "upload_failed", message: errorMessage(uploadError) };
    }

    if (error) {
      const status = String(error.statusCode ?? "");
      const text = (error.message ?? "").toLowerCase();
      if (
        status === "409" ||
        text.includes("already exists") ||
        text.includes("duplicate")
      ) {
        return { kind: "path_conflict" };
      }
      return {
        kind: "upload_failed",
        message: error.message ?? "artifact_upload_failed",
      };
    }

    return { kind: "uploaded" };
  }
}
