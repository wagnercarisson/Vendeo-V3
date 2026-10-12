import "server-only";

import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/server";
import { dataUrlToCampaignImage } from "@/lib/campaign/persistence";
import {
  ProductOneToOneArtifactUploadError,
  type ArtifactProbe,
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
const ARTIFACT_MIME_TYPE = "image/jpeg" as const;
const DEFAULT_SIGNED_URL_TTL_SECONDS = 3600;
const SUPPORTED_INPUT_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

/**
 * Prefixo EXCLUSIVO do novo fluxo (`{storeId}/{campaignId}/product-1-1/{operationId}/art-1024.jpg`)
 * — usado para RECUSAR assinatura de path arbitrário do cliente (T-56.2.2-05-03).
 */
const NEW_FLOW_PATH_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/product-1-1\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/art-1024\.jpg$/i;

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

/** Dimensões + mimeType VERIFICADOS por conteúdo (nunca declarados). */
interface VerifiedArtifact {
  readonly width: number;
  readonly height: number;
  readonly mimeType: typeof ARTIFACT_MIME_TYPE;
}

/**
 * F1 — verifica a integridade por CONTEÚDO (não apenas o header/metadados):
 * (a) o formato REAL dos bytes precisa ser `jpeg` (NÃO o `mime_type` persistido
 *     nem a extensão `.jpg` do caminho);
 * (b) força um decode COMPLETO de pixels (`raw()`) — entrada truncada/incompleta
 *     LANÇA (ex.: `VipsJpeg: premature end of JPEG image`), ao contrário de
 *     `metadata()`, que lê só o header e reportaria 1024×1024 mesmo truncado;
 * (c) exige `width === 1024 && height === 1024` (dimensões decodificadas).
 *
 * Qualquer falha ⇒ lança; o chamador classifica como `invalid` (probe) ou
 * `artifact_dimension_mismatch` (storeArtifact). O `mimeType` devolvido é
 * derivado do formato DECODIFICADO (`image/jpeg`), nunca do path/metadados.
 */
async function verifyJpeg1024(buffer: Buffer): Promise<VerifiedArtifact> {
  const metadata = await sharp(buffer).metadata();
  if (metadata.format !== "jpeg") {
    throw new Error(`artifact_format_not_jpeg: ${String(metadata.format)}`);
  }

  // Decode COMPLETO (raw) — não apenas o header. Truncamento/incompletude lança aqui.
  const decoded = await sharp(buffer, { failOn: "error" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = decoded.info;
  if (width !== ARTIFACT_SIZE || height !== ARTIFACT_SIZE) {
    throw new Error(`artifact_dimension_mismatch: ${width}x${height}`);
  }

  return { width, height, mimeType: ARTIFACT_MIME_TYPE };
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

/**
 * F2 — ausência só é CONFIRMADA quando o OBJETO é PROVADO ausente no bucket
 * esperado. Somente `statusCode === 404` cuja mensagem identifica o OBJETO como
 * ausente (`object not found` / `object does not exist`) qualifica — e a
 * mensagem NÃO pode indicar o bucket. Tudo o mais (404 genérico/ambíguo,
 * bucket-not-found, 401/403/auth, 5xx, rede/timeout, mensagem vazia) é
 * `indeterminate`: NUNCA colapsa com `absent` (evita autorizar estorno sem prova).
 */
function isAbsenceError(error: unknown): boolean {
  if (error === null || typeof error !== "object") return false;
  const record = error as { message?: unknown; statusCode?: unknown };
  if (String(record.statusCode ?? "") !== "404") return false;
  const text = String(record.message ?? "").toLowerCase();
  // 404 cuja mensagem indica o BUCKET (não o objeto) não prova ausência do objeto.
  if (text.includes("bucket")) return false;
  return /object not found/i.test(text) || /object does not exist/i.test(text);
}

/** Normaliza o payload de download (Blob/ArrayBuffer/Uint8Array/string) para Buffer. */
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

    // (c) Verifica o buffer resultante por CONTEÚDO: formato real JPEG + decode
    //     COMPLETO de pixels + 1024×1024 (fail-closed em truncado/não-jpeg/dimensão).
    let verified: VerifiedArtifact;
    try {
      verified = await verifyJpeg1024(jpeg.buffer);
    } catch (error) {
      throw new ProductOneToOneArtifactUploadError(
        "artifact_dimension_mismatch",
        errorMessage(error),
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
      width: verified.width,
      height: verified.height,
      mimeType: verified.mimeType,
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

  /**
   * I3 — leitura ASSINADA do bucket privado. É SEPARADA do probe e só deve ser
   * chamada pelo portão de download (Plano 06) APÓS `delivered`. Nunca é chamada
   * por `probeArtifact` nem por caminho de investigação. O TTL é do servidor
   * (não vem do cliente) e o path precisa pertencer ao novo fluxo.
   */
  async getSignedArtifactUrl(
    storagePath: string,
    ttlSeconds: number = DEFAULT_SIGNED_URL_TTL_SECONDS,
  ): Promise<string> {
    if (!NEW_FLOW_PATH_RE.test(storagePath)) {
      throw new ProductOneToOneArtifactUploadError(
        "artifact_invalid_path",
        `refusing to sign non-new-flow path: ${storagePath}`,
      );
    }

    const { data, error } = await this.client.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, ttlSeconds);
    if (error) {
      throw new ProductOneToOneArtifactUploadError(
        "artifact_sign_failed",
        errorMessage(error),
      );
    }

    return data.signedUrl;
  }

  /**
   * C2 — verifica a integridade por CONTEÚDO do artefato e devolve um resultado
   * TIPADO (`integral` | `absent` | `invalid` | `indeterminate`), nunca um `null`
   * ambíguo. Usa o caminho DETERMINÍSTICO do novo fluxo mesmo quando a linha de
   * `product_1_1_campaign_artifacts` está ausente (upload-ok + metadata-fail ⇒
   * `integral`, permitindo investigar/recuperar a arte SEM regenerar).
   *
   * I3 — o probe NUNCA assina URL: devolve apenas evidência/metadados.
   */
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

    // Meta persistida é OPCIONAL (C2): uma falha de leitura não governa ausência.
    let metadata: ProductOneToOneArtifactRef | null = null;
    try {
      metadata = await this.getArtifactMetadata(input.campaignId, input.operationId);
    } catch {
      metadata = null;
    }

    // Baixa os bytes do objeto do bucket PRIVADO — o probe NUNCA assina (I3).
    // F2 — uma EXCEÇÃO do `download()` (rede/socket/abort) é `indeterminate`,
    //      NUNCA `absent`: ausência precisa ser PROVADA, não inferida de falha.
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
      // Ausência CONFIRMADA ≠ erro/instabilidade do Storage (nunca colapsam).
      return isAbsenceError(error) ? { kind: "absent" } : { kind: "indeterminate" };
    }
    if (!data) {
      return { kind: "indeterminate" };
    }

    let buffer: Buffer;
    try {
      buffer = await toBuffer(data);
    } catch {
      return { kind: "indeterminate" };
    }

    // Integridade por CONTEÚDO (F1): formato REAL dos bytes + decode COMPLETO
    // (truncado/não-jpeg/dimensão divergente ⇒ `invalid`), NUNCA integral.
    let verified: VerifiedArtifact;
    try {
      verified = await verifyJpeg1024(buffer);
    } catch {
      return { kind: "invalid" };
    }

    // Consistência com o metadado persistido (quando presente): divergência ⇒ invalid.
    const expectedWidth = metadata?.width ?? ARTIFACT_SIZE;
    const expectedHeight = metadata?.height ?? ARTIFACT_SIZE;
    if (verified.width !== expectedWidth || verified.height !== expectedHeight) {
      return { kind: "invalid" };
    }

    // O `mimeType` é derivado do CONTEÚDO DECODIFICADO (image/jpeg) — nunca do
    // path `.jpg` nem do `mime_type` persistido.
    const ref: ProductOneToOneArtifactRef = Object.freeze({
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
  }
}
