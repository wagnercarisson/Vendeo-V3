import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";
import {
  THUMBNAIL_BUCKET,
  THUMBNAIL_CONTENT_TYPE,
  THUMBNAIL_MAX_EDGE_PX,
  THUMBNAIL_QUALITY,
  THUMBNAIL_UPLOAD_TIMEOUT_MS,
  deriveThumbnailPath,
} from "./thumbnail-path";

/**
 * Geração da miniatura: sharp + upload imutável no bucket privado.
 *
 * Invariantes:
 * - nunca lança para o chamador (`generateCampaignThumbnail`);
 * - nunca escreve em tabela, crédito, status ou telemetria de IA;
 * - `upsert:false`: conflito é `already_exists`, nunca sobrescrita;
 * - o uploader e o contexto precisam apontar para o MESMO endpoint.
 */

export interface ThumbnailStorageError {
  message?: string;
  statusCode?: string | number;
}

export interface ThumbnailUploadInput {
  path: string;
  buffer: Buffer;
  contentType: typeof THUMBNAIL_CONTENT_TYPE;
}

export interface ThumbnailUploader {
  /** Origem normalizada (protocolo + host + porta) do Storage. */
  readonly endpoint: string;
  upload(input: ThumbnailUploadInput): Promise<{ error: ThumbnailStorageError | null }>;
}

export interface ThumbnailContext {
  readonly endpoint: string;
  readonly uploader: ThumbnailUploader;
}

export type ThumbnailSkipReason =
  | "ineligible_path"
  | "thumbnail_disabled_no_context"
  | "thumbnail_endpoint_mismatch";

export type ThumbnailFailureReason =
  | "thumbnail_generation_failed"
  | "thumbnail_invalid_output"
  | "thumbnail_upload_failed"
  | "thumbnail_upload_timeout"
  | "thumbnail_unexpected_error";

export type ThumbnailResult =
  | { status: "created"; thumbnailPath: string; width: number; height: number }
  | { status: "already_exists"; thumbnailPath: string }
  | { status: "skipped"; reason: ThumbnailSkipReason; thumbnailPath?: string }
  | { status: "failed"; reason: ThumbnailFailureReason; thumbnailPath?: string };

export interface RenderedThumbnail {
  buffer: Buffer;
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
}

export function normalizeEndpoint(value: string): string | null {
  if (typeof value !== "string" || value.trim().length === 0) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function isTimeoutError(error: unknown): boolean {
  if (error === null || typeof error !== "object") return false;
  const record = error as { name?: unknown; message?: unknown; code?: unknown };
  const name = String(record.name ?? "");
  const code = String(record.code ?? "");
  const message = String(record.message ?? "").toLowerCase();
  return (
    name === "TimeoutError" ||
    name === "AbortError" ||
    code === "ABORT_ERR" ||
    code === "ETIMEDOUT" ||
    message.includes("timed out") ||
    message.includes("timeout") ||
    message.includes("aborted")
  );
}

function isDuplicateError(error: ThumbnailStorageError): boolean {
  const status = String(error.statusCode ?? "");
  const message = String(error.message ?? "").toLowerCase();
  return (
    status === "409" ||
    message.includes("already exists") ||
    message.includes("duplicate") ||
    message.includes("resource already exists")
  );
}

/**
 * Render WebP com a recipe versionada: maior aresta 288, proporção preservada
 * (`fit: inside`), sem crop, sem upscale e sem metadados.
 */
export async function renderThumbnail(buffer: Buffer): Promise<RenderedThumbnail> {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error("thumbnail_empty_input");
  }

  const source = sharp(buffer, {
    failOn: "error",
    limitInputPixels: 40_000_000,
  });
  const metadata = await source.metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error("thumbnail_unknown_dimensions");
  }

  const out = await sharp(buffer, {
    failOn: "error",
    limitInputPixels: 40_000_000,
  })
    .rotate()
    .resize(THUMBNAIL_MAX_EDGE_PX, THUMBNAIL_MAX_EDGE_PX, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({
      quality: THUMBNAIL_QUALITY,
      effort: 4,
      smartSubsample: true,
    })
    .toBuffer();

  const outMetadata = await sharp(out).metadata();
  if (outMetadata.format !== "webp") {
    throw new Error("thumbnail_invalid_format");
  }
  if (!outMetadata.width || !outMetadata.height) {
    throw new Error("thumbnail_invalid_dimensions");
  }
  if (Math.max(outMetadata.width, outMetadata.height) > THUMBNAIL_MAX_EDGE_PX) {
    throw new Error("thumbnail_exceeds_max_edge");
  }
  if (
    Math.max(outMetadata.width, outMetadata.height) >
    Math.max(metadata.width, metadata.height)
  ) {
    throw new Error("thumbnail_upscaled");
  }

  return {
    buffer: out,
    width: outMetadata.width,
    height: outMetadata.height,
    sourceWidth: metadata.width,
    sourceHeight: metadata.height,
  };
}

export interface TimedUploaderOptions {
  timeoutMs?: number;
  url?: string;
  key?: string;
  fetchImpl?: typeof fetch;
  client?: SupabaseClient;
}

/**
 * Uploader com timeout de transporte.
 *
 * `@supabase/storage-js@2.110.0` não expõe `signal` em `FileOptions.upload`,
 * então o orçamento é aplicado no `global.fetch` do client dedicado. O aborto
 * encerra o `fetch` de verdade; a promise é aguardada (sem tarefa solta).
 */
export function createTimedSupabaseUploader(
  options: TimedUploaderOptions = {},
): ThumbnailUploader {
  const timeoutMs = options.timeoutMs ?? THUMBNAIL_UPLOAD_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error("thumbnail_invalid_timeout");
  }

  const rawUrl = options.url ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = options.key ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!rawUrl) throw new Error("missing NEXT_PUBLIC_SUPABASE_URL");
  if (!key) throw new Error("missing SUPABASE_SERVICE_ROLE_KEY");

  const endpoint = normalizeEndpoint(rawUrl);
  if (!endpoint) throw new Error("invalid NEXT_PUBLIC_SUPABASE_URL");

  const baseFetch =
    options.fetchImpl ??
    ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init));

  const client =
    options.client ??
    createClient(rawUrl, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        fetch: (input, init) => {
          const timeoutSignal = AbortSignal.timeout(timeoutMs);
          const signal =
            init?.signal && typeof AbortSignal.any === "function"
              ? AbortSignal.any([init.signal, timeoutSignal])
              : timeoutSignal;
          return baseFetch(input, { ...init, signal });
        },
      },
    });

  return {
    endpoint,
    async upload({ path, buffer, contentType }) {
      const { error } = await client.storage
        .from(THUMBNAIL_BUCKET)
        .upload(path, buffer, {
          contentType,
          upsert: false,
        });
      return { error: error ?? null };
    },
  };
}

/**
 * Contexto padrão: usa o MESMO ambiente do `supabaseAdmin`.
 * Lazy e fail-safe: ausência de env retorna `null` (miniatura desabilitada),
 * nunca lança e nunca é chamado por clients customizados.
 */
export function createDefaultThumbnailContext(): ThumbnailContext | null {
  try {
    const uploader = createTimedSupabaseUploader();
    return { endpoint: uploader.endpoint, uploader };
  } catch {
    return null;
  }
}

/**
 * Gera a miniatura sem lançar. `context` nulo ou endpoints divergentes
 * resultam em `skipped` com ZERO upload.
 */
export async function generateCampaignThumbnail(input: {
  originalPath: string;
  originalBuffer: Buffer;
  context: ThumbnailContext | null;
}): Promise<ThumbnailResult> {
  const { originalPath, originalBuffer, context } = input;

  const thumbnailPath = deriveThumbnailPath(originalPath);
  if (!thumbnailPath) {
    return { status: "skipped", reason: "ineligible_path" };
  }

  if (!context) {
    return {
      status: "skipped",
      reason: "thumbnail_disabled_no_context",
      thumbnailPath,
    };
  }

  const contextEndpoint = normalizeEndpoint(context.endpoint);
  const uploaderEndpoint = normalizeEndpoint(context.uploader.endpoint);
  if (
    !contextEndpoint ||
    !uploaderEndpoint ||
    contextEndpoint !== uploaderEndpoint
  ) {
    return {
      status: "skipped",
      reason: "thumbnail_endpoint_mismatch",
      thumbnailPath,
    };
  }

  let rendered: RenderedThumbnail;
  try {
    rendered = await renderThumbnail(originalBuffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return {
      status: "failed",
      reason: message.startsWith("thumbnail_")
        ? "thumbnail_invalid_output"
        : "thumbnail_generation_failed",
      thumbnailPath,
    };
  }

  try {
    const { error } = await context.uploader.upload({
      path: thumbnailPath,
      buffer: rendered.buffer,
      contentType: THUMBNAIL_CONTENT_TYPE,
    });

    if (!error) {
      return {
        status: "created",
        thumbnailPath,
        width: rendered.width,
        height: rendered.height,
      };
    }

    if (isDuplicateError(error)) {
      return { status: "already_exists", thumbnailPath };
    }

    return {
      status: "failed",
      reason: isTimeoutError(error)
        ? "thumbnail_upload_timeout"
        : "thumbnail_upload_failed",
      thumbnailPath,
    };
  } catch (error) {
    return {
      status: "failed",
      reason: isTimeoutError(error)
        ? "thumbnail_upload_timeout"
        : "thumbnail_upload_failed",
      thumbnailPath,
    };
  }
}
