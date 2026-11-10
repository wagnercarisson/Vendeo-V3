import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabase/server";

import type {
  ArtifactFormat,
  ArtifactIdentity,
  ArtifactOrigin,
  ArtifactRecord,
  ArtifactRole,
} from "./types";

export const ARTIFACT_TABLE = "campaign_composition_artifacts" as const;

export const ARTIFACT_SELECT_COLUMNS = [
  "id",
  "store_id",
  "campaign_id",
  "operation_id",
  "role",
  "format",
  "origin",
  "derived_from_artifact_id",
  "source_campaign_id",
  "storage_bucket",
  "storage_path",
  "width",
  "height",
  "mime_type",
  "byte_size",
  "checksum_sha256",
  "provenance",
  "created_at",
].join(", ");

export type ArtifactReadResult =
  | { readonly kind: "found"; readonly record: ArtifactRecord }
  | { readonly kind: "absent" }
  | { readonly kind: "read_failed"; readonly message: string };

export interface InsertArtifactRowInput {
  readonly storeId: string;
  readonly campaignId: string;
  readonly operationId: string;
  readonly role: ArtifactRole;
  readonly format: ArtifactFormat;
  readonly origin: ArtifactOrigin;
  readonly derivedFromArtifactId?: string | null;
  readonly sourceCampaignId?: string | null;
  readonly storageBucket: string;
  readonly storagePath: string;
  readonly width: number;
  readonly height: number;
  readonly mimeType: string;
  readonly byteSize: number;
  readonly checksumSha256: string;
  readonly provenance: Record<string, unknown>;
}

export type InsertArtifactRowResult =
  | { readonly kind: "inserted"; readonly record: ArtifactRecord }
  | { readonly kind: "unique_violation" }
  | { readonly kind: "insert_failed"; readonly message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function mapRow(row: unknown): ArtifactRecord | null {
  if (!isRecord(row)) return null;
  const provenance = row.provenance;
  if (!isRecord(provenance)) return null;

  const role = row.role;
  const format = row.format;
  const origin = row.origin;
  const storagePath = row.storage_path;
  const storageBucket = row.storage_bucket;
  const mimeType = row.mime_type;
  const checksumSha256 = row.checksum_sha256;
  const createdAt = row.created_at;

  if (
    typeof row.id !== "string" ||
    typeof row.store_id !== "string" ||
    typeof row.campaign_id !== "string" ||
    typeof row.operation_id !== "string" ||
    typeof role !== "string" ||
    typeof format !== "string" ||
    typeof origin !== "string" ||
    typeof storageBucket !== "string" ||
    typeof storagePath !== "string" ||
    typeof mimeType !== "string" ||
    typeof checksumSha256 !== "string" ||
    typeof createdAt !== "string"
  ) {
    return null;
  }

  const width = Number(row.width);
  const height = Number(row.height);
  const byteSize = Number(row.byte_size);
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    !Number.isInteger(byteSize)
  ) {
    return null;
  }

  return Object.freeze({
    id: row.id,
    storeId: row.store_id,
    campaignId: row.campaign_id,
    operationId: row.operation_id,
    role: role as ArtifactRole,
    format: format as ArtifactFormat,
    origin: origin as ArtifactOrigin,
    derivedFromArtifactId: stringOrNull(row.derived_from_artifact_id),
    sourceCampaignId: stringOrNull(row.source_campaign_id),
    storageBucket,
    storagePath,
    width,
    height,
    mimeType,
    byteSize,
    checksumSha256,
    provenance,
    createdAt,
  });
}

async function readOne(
  query: PromiseLike<{ data: unknown; error: unknown }>,
): Promise<ArtifactReadResult> {
  let data: unknown;
  let error: unknown;
  try {
    ({ data, error } = await query);
  } catch (readError) {
    return {
      kind: "read_failed",
      message:
        readError instanceof Error ? readError.message : String(readError),
    };
  }
  if (error) {
    const message =
      error instanceof Error ? error.message : String(error);
    return { kind: "read_failed", message };
  }
  if (!data) return { kind: "absent" };
  const record = mapRow(data);
  return record
    ? { kind: "found", record }
    : { kind: "read_failed", message: "artifact_row_malformed" };
}

export async function getArtifactByIdentity(
  identity: ArtifactIdentity,
  client: SupabaseClient = supabaseAdmin,
): Promise<ArtifactReadResult> {
  return readOne(
    client
      .from(ARTIFACT_TABLE)
      .select(ARTIFACT_SELECT_COLUMNS)
      .eq("store_id", identity.storeId)
      .eq("campaign_id", identity.campaignId)
      .eq("operation_id", identity.operationId)
      .eq("role", identity.role)
      .maybeSingle(),
  );
}

export async function getArtifactById(
  id: string,
  client: SupabaseClient = supabaseAdmin,
): Promise<ArtifactReadResult> {
  return readOne(
    client
      .from(ARTIFACT_TABLE)
      .select(ARTIFACT_SELECT_COLUMNS)
      .eq("id", id)
      .maybeSingle(),
  );
}

export async function getArtifactByStoragePath(
  storagePath: string,
  client: SupabaseClient = supabaseAdmin,
): Promise<ArtifactReadResult> {
  return readOne(
    client
      .from(ARTIFACT_TABLE)
      .select(ARTIFACT_SELECT_COLUMNS)
      .eq("storage_path", storagePath)
      .maybeSingle(),
  );
}

export async function insertArtifactRow(
  input: InsertArtifactRowInput,
  client: SupabaseClient = supabaseAdmin,
): Promise<InsertArtifactRowResult> {
  let data: unknown;
  let error: unknown;
  try {
    const inserted = await client
      .from(ARTIFACT_TABLE)
      .insert({
        store_id: input.storeId,
        campaign_id: input.campaignId,
        operation_id: input.operationId,
        role: input.role,
        format: input.format,
        origin: input.origin,
        derived_from_artifact_id: input.derivedFromArtifactId ?? null,
        source_campaign_id: input.sourceCampaignId ?? null,
        storage_bucket: input.storageBucket,
        storage_path: input.storagePath,
        width: input.width,
        height: input.height,
        mime_type: input.mimeType,
        byte_size: input.byteSize,
        checksum_sha256: input.checksumSha256,
        provenance: input.provenance,
      })
      .select(ARTIFACT_SELECT_COLUMNS)
      .single();
    data = inserted.data;
    error = inserted.error;
  } catch (insertError) {
    return {
      kind: "insert_failed",
      message: insertError instanceof Error ? insertError.message : String(insertError),
    };
  }

  if (error) {
    const record = error as { code?: unknown; message?: unknown };
    if (String(record.code ?? "") === "23505") {
      return { kind: "unique_violation" };
    }
    return {
      kind: "insert_failed",
      message: String(record.message ?? "artifact_insert_failed"),
    };
  }

  const mapped = mapRow(data);
  return mapped
    ? { kind: "inserted", record: mapped }
    : { kind: "insert_failed", message: "artifact_row_malformed_after_insert" };
}
