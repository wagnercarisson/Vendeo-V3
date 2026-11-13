import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { transcodeToJpeg } from "./image-processor";
import type {
  CampaignArtVersion,
  CampaignRecord,
  CampaignReadyData,
  CreateCampaignInput,
} from "./types";

export async function createCampaign(
  storeId: string,
  input: CreateCampaignInput,
  campaignId?: string
): Promise<{ id: string; storagePath: string }> {
  const campaignIdFinal = campaignId ?? crypto.randomUUID();
  const storagePath = `${storeId}/${campaignIdFinal}.jpg`;

  // F38.1 (D1/D2): operation_run_id persistido na criação da campanha — o
  // operationRunId do run (campaign_delivery) é gravado aqui, preparando o reuso
  // do mesmo run pela F37 (recomposição cross-request). Ausente -> NULL.
  const { error } = await supabaseAdmin
    .from("campaigns")
    .insert({
      id: campaignIdFinal,
      store_id: storeId,
      status: "generating",
      product_name: input.productName,
      input_snapshot: input.inputSnapshot,
      identity_snapshot: input.identitySnapshot ?? null,
      storage_path: storagePath,
      operation_run_id: input.operationRunId ?? null,
    });

  if (error) {
    throw new Error(error.message);
  }

  return { id: campaignIdFinal, storagePath };
}

export function dataUrlToCampaignImage(
  dataUrl: string
): { buffer: Buffer; mimeType: string } {
  const match = dataUrl.match(/^data:(image\/(png|jpeg|webp));base64,(.+)$/);

  if (!match) {
    throw new Error("Unsupported or malformed data URL. Expected data:image/(png|jpeg|webp);base64,...");
  }

  const mimeType = match[1];
  const base64Payload = match[3];

  if (!base64Payload || base64Payload.length === 0) {
    throw new Error("Empty image payload in data URL");
  }

  const buffer = Buffer.from(base64Payload, "base64");

  if (buffer.length === 0) {
    throw new Error("Empty buffer after decoding base64 payload");
  }

  return { buffer, mimeType };
}

export async function uploadCampaignImage(
  storeId: string,
  campaignId: string,
  image: { buffer: Buffer; mimeType: "image/jpeg" }
): Promise<{ storagePath: string }> {
  if (image.mimeType !== "image/jpeg") {
    throw new Error("Only JPEG images are supported for upload. Expected mimeType: 'image/jpeg'");
  }

  const storagePath = `${storeId}/${campaignId}.jpg`;

  const { error } = await supabaseAdmin
    .storage
    .from("campaign-images")
    .upload(storagePath, image.buffer, {
      contentType: "image/jpeg",
      upsert: false,
    });

  if (error) {
    throw new Error(error.message);
  }

  return { storagePath };
}

export async function updateCampaignReady(
  campaignId: string,
  data: CampaignReadyData
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("campaigns")
    .update({
      status: "ready",
      generation_metadata: data.generationMetadata,
      render_snapshot: data.renderSnapshot,
      publication_copy_snapshot: data.publicationCopySnapshot,
      error_message: null,
    })
    .eq("id", campaignId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function updateCampaignError(
  campaignId: string,
  errorMessage: string
): Promise<void> {
  if (!errorMessage || errorMessage.trim().length === 0) {
    throw new Error("errorMessage must not be empty");
  }

  const { error } = await supabaseAdmin
    .from("campaigns")
    .update({
      status: "error",
      error_message: errorMessage,
    })
    .eq("id", campaignId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function getCampaign(
  id: string
): Promise<CampaignRecord | null> {
  const { data, error } = await supabaseAdmin
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as CampaignRecord | null;
}

export async function deleteCampaignImage(
  storagePath: string
): Promise<void> {
  const { error } = await supabaseAdmin
    .storage
    .from("campaign-images")
    .remove([storagePath]);

  if (error) {
    throw new Error(error.message);
  }
}

// ─── F41 D5: persistência dos inputs da campanha ─────────────────────────────

// Sobe um input do produto ao bucket campaign-images em
// {storeId}/{campaignId}/inputs/{imageId}.jpg (objeto imutável, upsert: false).
// Sempre transcode JPEG via transcodeToJpeg (image-processor.ts).
export async function uploadCampaignInputImage(
  storeId: string,
  campaignId: string,
  imageId: string,
  image: { buffer: Buffer; mimeType: string }
): Promise<{ storagePath: string }> {
  const storagePath = `${storeId}/${campaignId}/inputs/${imageId}.jpg`;

  const jpeg = await transcodeToJpeg(image.buffer, image.mimeType);

  const { error } = await supabaseAdmin
    .storage
    .from("campaign-images")
    .upload(storagePath, jpeg.buffer, {
      contentType: "image/jpeg",
      upsert: false,
    });

  if (error) {
    throw new Error(error.message);
  }

  return { storagePath };
}

// Remove todos os inputs de uma campanha (falha pré-stream — sem órfãos, D5).
// No-op quando não há objetos no prefixo.
export async function removeCampaignInputs(
  storeId: string,
  campaignId: string
): Promise<void> {
  const { data, error } = await supabaseAdmin
    .storage
    .from("campaign-images")
    .list(`${storeId}/${campaignId}/inputs/`, { limit: 100 });

  if (error) {
    throw new Error(error.message);
  }

  if (!data || data.length === 0) {
    return;
  }

  const paths = data.map((file) => `${storeId}/${campaignId}/inputs/${file.name}`);
  const { error: removeError } = await supabaseAdmin
    .storage
    .from("campaign-images")
    .remove(paths);

  if (removeError) {
    throw new Error(removeError.message);
  }
}

// ─── F37.1 (D5/D7): versões de arte (campaign_art_versions) ──────────────────

// Insere a v1 (candidata pending/active). v1 nasce pending/active (candidata da
// revisão); render_snapshot/generation_metadata/rejection_reason ficam NULL na
// 37.1 (D4). Chamado pelo generate-image quando a flag campaign_approval_enabled
// está ligada (fail-safe — falha → log + continua, campanha legacy).
export async function createArtVersion(
  campaignId: string,
  versionNumber: number,
  storagePath: string | null,
  briefSnapshot: Record<string, unknown>
): Promise<void> {
  const { error } = await supabaseAdmin
    .from("campaign_art_versions")
    .insert({
      campaign_id: campaignId,
      version_number: versionNumber,
      status: "pending",
      asset_status: "active",
      storage_path: storagePath,
      brief_snapshot: briefSnapshot,
    });

  if (error) {
    throw new Error(error.message);
  }
}

// Lista as versões de arte de uma campanha ordenadas por version_number —
// fonte única para computeApprovalState e para a tela de revisão (decisão 3).
// Campanha sem linhas → [] (estado legacy).
export async function listArtVersions(
  campaignId: string
): Promise<CampaignArtVersion[]> {
  const { data, error } = await supabaseAdmin
    .from("campaign_art_versions")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("version_number", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as CampaignArtVersion[];
}

// ─── F60.5 — inputs duráveis para reconstrução da primeira execução ──────────
// Bytes ORIGINAIS, sem transcode, para que `dataUrlPrefix + base64(bytes)`
// reproduza o hash exato do data URL congelado. Nunca sobrescreve.

export type CampaignInputDownloadResult =
  | { readonly kind: "bytes"; readonly bytes: Buffer }
  | { readonly kind: "absent" }
  | { readonly kind: "indeterminate" };

export type CampaignInputUploadResult =
  | { readonly kind: "uploaded" }
  | { readonly kind: "reused" }
  | { readonly kind: "conflict"; readonly reason: "content_mismatch" }
  | { readonly kind: "indeterminate" };

function inputFileExtension(mimeType: string): "png" | "webp" | "jpg" {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

function isAbsentStorageError(error: unknown): boolean {
  if (error === null || typeof error !== "object") return false;
  const record = error as { message?: unknown; statusCode?: unknown };
  if (String(record.statusCode ?? "") !== "404") return false;
  const text = String(record.message ?? "").toLowerCase();
  if (text.includes("bucket")) return false;
  return /object not found|object does not exist/.test(text);
}

async function downloadInputBytes(storagePath: string): Promise<CampaignInputDownloadResult> {
  let data: Blob | null = null;
  let error: unknown = null;
  try {
    const result = await supabaseAdmin.storage.from("campaign-images").download(storagePath);
    data = result.data;
    error = result.error;
  } catch {
    return { kind: "indeterminate" };
  }
  if (error) {
    return isAbsentStorageError(error) ? { kind: "absent" } : { kind: "indeterminate" };
  }
  if (!data) return { kind: "indeterminate" };
  try {
    return { kind: "bytes", bytes: Buffer.from(await data.arrayBuffer()) };
  } catch {
    return { kind: "indeterminate" };
  }
}

export async function downloadCampaignInputFile(
  storagePath: string,
): Promise<CampaignInputDownloadResult> {
  return downloadInputBytes(storagePath);
}

export async function uploadCampaignInputFile(
  storeId: string,
  campaignId: string,
  input: {
    readonly contentId: string;
    readonly mimeType: string;
    readonly dataUrlPrefix: string;
    readonly buffer: Buffer;
  },
): Promise<CampaignInputUploadResult> {
  const extension = inputFileExtension(input.mimeType);
  const storagePath = `${storeId}/${campaignId}/inputs/${input.contentId}.${extension}`;
  let uploadError: unknown = null;
  try {
    const uploaded = await supabaseAdmin.storage.from("campaign-images").upload(
      storagePath,
      input.buffer,
      { contentType: input.mimeType, upsert: false },
    );
    uploadError = uploaded.error;
  } catch {
    return { kind: "indeterminate" };
  }
  if (!uploadError) return { kind: "uploaded" };

  const existing = await downloadInputBytes(storagePath);
  if (existing.kind === "absent") return { kind: "indeterminate" };
  if (existing.kind === "indeterminate") return { kind: "indeterminate" };
  if (!existing.bytes.equals(input.buffer)) {
    return { kind: "conflict", reason: "content_mismatch" };
  }
  const expected = `${input.dataUrlPrefix}${existing.bytes.toString("base64")}`;
  const { createHash } = await import("node:crypto");
  const hash = createHash("sha256").update(expected).digest("hex");
  if (hash !== input.contentId) {
    return { kind: "conflict", reason: "content_mismatch" };
  }
  return { kind: "reused" };
}
