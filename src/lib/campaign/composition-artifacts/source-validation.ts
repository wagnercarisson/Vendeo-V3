import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";

import { resolveCampaignFormat } from "@/lib/campaign/format-resolution";
import { isEligibleCampaignArtPath } from "@/lib/campaign/thumbnail/thumbnail-path";
import { supabaseAdmin } from "@/lib/supabase/server";

import { verifyCampaignAccess } from "./access";
import {
  COMPOSITION_ARTIFACT_BUCKET,
  parseCompositionArtifactPath,
} from "./artifact-path";
import { isArtifactUuid } from "./identity";
import {
  computeChecksumSha256,
  verifyCompositionArtifactBytes,
} from "./integrity";
import { getArtifactById } from "./repository";
import {
  MAX_ARTIFACT_BYTES,
  MAX_ARTIFACT_PIXELS,
  isArtifactRole,
} from "./role-policy";
import { CAMPAIGN_IMAGES_BUCKET, CompositionArtifactStorage } from "./storage";
import type {
  AuthorizationContext,
  DeliveredCampaignSourceCandidate,
  ReusableSquareSource,
} from "./types";

export type SourceValidationFailureReason =
  | "not_owner"
  | "store_mismatch"
  | "identity_conflict"
  | "artifact_absent"
  | "artifact_invalid"
  | "artifact_indeterminate"
  | "metadata_conflict"
  | "role_not_reusable"
  | "source_origin_invalid"
  | "campaign_not_ready"
  | "format_not_square"
  | "path_not_canonical"
  | "unsupported_dimensions"
  | "unsupported_mime";

export type SourceValidationResult =
  | { readonly ok: true; readonly source: ReusableSquareSource }
  | { readonly ok: false; readonly reason: SourceValidationFailureReason };

export interface DerivativeScope {
  readonly storeId: string;
  readonly campaignId: string;
}

export interface SourceValidationDeps {
  readonly client?: SupabaseClient;
}

const UUID =
  "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/** Allowlist fechada da origem legada: `{store}/{campaign}.jpg`. */
const LEGACY_PATH_RE = new RegExp(`^(${UUID})/(${UUID})\\.jpe?g$`, "i");

/** Allowlist fechada da origem legada versionada: `v2.jpg`/`v3.jpg`. */
const VERSIONED_LEGACY_PATH_RE = new RegExp(
  `^(${UUID})/(${UUID})/v(?:2|3)\\.jpe?g$`,
  "i",
);

/** Allowlist fechada do novo fluxo 1:1: `product-1-1/{operation}/art-1024.jpg`. */
const NEW_FLOW_PATH_RE = new RegExp(
  `^(${UUID})/(${UUID})/product-1-1/(${UUID})/art-1024\\.jpe?g$`,
  "i",
);

const REUSABLE_ROLES: ReadonlySet<string> = new Set([
  "square_original",
  "square_prepared",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function fail(reason: SourceValidationFailureReason): SourceValidationResult {
  return Object.freeze({ ok: false as const, reason });
}

function normalizeUuid(value: string): string {
  return value.toLowerCase();
}

function pathHasForbiddenSegments(path: string): boolean {
  return (
    path.length === 0 ||
    path.startsWith("/") ||
    path.startsWith("\\") ||
    path.includes("\\") ||
    path.includes("..") ||
    path.toLowerCase().includes("%2e")
  );
}

/**
 * Confere o path canônico da origem entregue e o vínculo loja/campanha do
 * próprio path. `isEligibleCampaignArtPath` é barreira adicional.
 */
function isCanonicalDeliveredPath(
  origin: "legacy_campaign" | "new_flow_1_1",
  path: string,
  storeId: string,
  campaignId: string,
): boolean {
  if (pathHasForbiddenSegments(path)) return false;
  if (!isEligibleCampaignArtPath(path)) return false;

  const patterns =
    origin === "legacy_campaign"
      ? [LEGACY_PATH_RE, VERSIONED_LEGACY_PATH_RE]
      : [NEW_FLOW_PATH_RE];

  for (const pattern of patterns) {
    const match = pattern.exec(path);
    if (!match) continue;
    return (
      normalizeUuid(match[1]) === normalizeUuid(storeId) &&
      normalizeUuid(match[2]) === normalizeUuid(campaignId)
    );
  }
  return false;
}

type JpegInspection =
  | {
      readonly ok: true;
      readonly width: number;
      readonly height: number;
      readonly mimeType: "image/jpeg";
      readonly byteSize: number;
      readonly checksumSha256: string;
    }
  | {
      readonly ok: false;
      readonly reason:
        | "artifact_invalid"
        | "unsupported_dimensions"
        | "unsupported_mime";
    };

/**
 * Verifica bytes de campanha entregue por conteúdo, com dimensão esperada por
 * origem. Limites antes do decode e decodificação completa com `sharp`.
 */
async function inspectDeliveredJpeg(
  bytes: Buffer,
  expected: { readonly width: number; readonly height: number },
): Promise<JpegInspection> {
  if (
    !Buffer.isBuffer(bytes) ||
    bytes.byteLength === 0 ||
    bytes.byteLength > MAX_ARTIFACT_BYTES
  ) {
    return Object.freeze({ ok: false as const, reason: "artifact_invalid" as const });
  }

  let metadata: { format?: string; width?: number; height?: number };
  try {
    metadata = await sharp(bytes).metadata();
  } catch {
    return Object.freeze({ ok: false as const, reason: "artifact_invalid" as const });
  }

  if (metadata.format !== "jpeg") {
    return Object.freeze({ ok: false as const, reason: "unsupported_mime" as const });
  }

  const declaredWidth = metadata.width;
  const declaredHeight = metadata.height;
  if (!declaredWidth || !declaredHeight) {
    return Object.freeze({ ok: false as const, reason: "artifact_invalid" as const });
  }
  if (declaredWidth * declaredHeight > MAX_ARTIFACT_PIXELS) {
    return Object.freeze({ ok: false as const, reason: "artifact_invalid" as const });
  }

  let width: number;
  let height: number;
  try {
    const decoded = await sharp(bytes, { failOn: "error" })
      .raw()
      .toBuffer({ resolveWithObject: true });
    width = decoded.info.width;
    height = decoded.info.height;
  } catch {
    return Object.freeze({ ok: false as const, reason: "artifact_invalid" as const });
  }

  if (width !== expected.width || height !== expected.height) {
    return Object.freeze({
      ok: false as const,
      reason: "unsupported_dimensions" as const,
    });
  }

  return Object.freeze({
    ok: true as const,
    width,
    height,
    mimeType: "image/jpeg" as const,
    byteSize: bytes.byteLength,
    checksumSha256: computeChecksumSha256(bytes),
  });
}

/**
 * Revalida uma fonte interna `square_original`/`square_prepared` por linha,
 * autorização e conteúdo. Não exige campanha `ready`, entrega quadrada ou
 * formato global 1:1.
 */
export async function validateInternalArtifactSource(
  artifactId: string,
  derivativeScope: DerivativeScope,
  authorization: AuthorizationContext,
  deps: SourceValidationDeps = {},
): Promise<SourceValidationResult> {
  const client = deps.client ?? supabaseAdmin;

  const access = await verifyCampaignAccess(
    {
      storeId: derivativeScope.storeId,
      campaignId: derivativeScope.campaignId,
      authorization,
    },
    client,
  );
  if (!access.ok) {
    return fail(access.reason);
  }

  if (!isArtifactUuid(artifactId)) {
    return fail("identity_conflict");
  }

  const row = await getArtifactById(artifactId, client);
  if (row.kind === "read_failed") {
    return fail("artifact_indeterminate");
  }
  if (row.kind === "absent") {
    return fail("artifact_absent");
  }
  const source = row.record;

  if (
    normalizeUuid(source.storeId) !== normalizeUuid(derivativeScope.storeId) ||
    normalizeUuid(source.campaignId) !== normalizeUuid(derivativeScope.campaignId)
  ) {
    return fail("identity_conflict");
  }

  if (!isArtifactRole(source.role) || !REUSABLE_ROLES.has(source.role)) {
    return fail("role_not_reusable");
  }

  const parsed = parseCompositionArtifactPath(source.storagePath);
  if (
    parsed === null ||
    normalizeUuid(parsed.storeId) !== normalizeUuid(source.storeId) ||
    normalizeUuid(parsed.campaignId) !== normalizeUuid(source.campaignId) ||
    normalizeUuid(parsed.operationId) !== normalizeUuid(source.operationId) ||
    parsed.role !== source.role
  ) {
    return fail("metadata_conflict");
  }

  if (source.storageBucket !== COMPOSITION_ARTIFACT_BUCKET) {
    return fail("metadata_conflict");
  }

  const storage = new CompositionArtifactStorage(client);
  const download = await storage.downloadBytes(source.storagePath);
  if (download.kind === "absent") {
    return fail("artifact_absent");
  }
  if (download.kind === "indeterminate") {
    return fail("artifact_indeterminate");
  }

  const integrity = await verifyCompositionArtifactBytes(
    download.bytes,
    source.role,
  );
  if (!integrity.ok) {
    return fail("artifact_invalid");
  }

  if (
    integrity.width !== source.width ||
    integrity.height !== source.height ||
    integrity.mimeType !== source.mimeType ||
    integrity.byteSize !== source.byteSize ||
    integrity.checksumSha256 !== source.checksumSha256
  ) {
    return fail("metadata_conflict");
  }

  return Object.freeze({
    ok: true as const,
    source: Object.freeze({
      origin: "composition_artifact" as const,
      storeId: source.storeId,
      campaignId: source.campaignId,
      operationId: source.operationId,
      artifactId: source.id,
      bucket: source.storageBucket,
      storagePath: source.storagePath,
      width: integrity.width,
      height: integrity.height,
      mimeType: integrity.mimeType,
      byteSize: integrity.byteSize,
      checksumSha256: integrity.checksumSha256,
      role: source.role,
    }),
  });
}

/**
 * Revalida uma campanha já entregue (legado ou novo fluxo 1:1) sem confiar no
 * descritor recebido. Nenhuma linha fictícia é criada.
 */
export async function validateDeliveredCampaignSource(
  candidate: DeliveredCampaignSourceCandidate,
  authorization: AuthorizationContext,
  deps: SourceValidationDeps = {},
): Promise<SourceValidationResult> {
  const client = deps.client ?? supabaseAdmin;

  const origin = candidate.origin;
  if (origin !== "legacy_campaign" && origin !== "new_flow_1_1") {
    return fail("source_origin_invalid");
  }

  if (!isArtifactUuid(candidate.storeId) || !isArtifactUuid(candidate.campaignId)) {
    return fail("identity_conflict");
  }

  const access = await verifyCampaignAccess(
    {
      storeId: candidate.storeId,
      campaignId: candidate.campaignId,
      authorization,
    },
    client,
  );
  if (!access.ok) {
    return fail(access.reason);
  }

  let campaignData: unknown;
  let campaignError: unknown;
  try {
    const result = await client
      .from("campaigns")
      .select("id, store_id, status, storage_path, input_snapshot")
      .eq("id", candidate.campaignId)
      .maybeSingle();
    campaignData = result.data;
    campaignError = result.error;
  } catch {
    return fail("identity_conflict");
  }
  if (campaignError || !isRecord(campaignData)) {
    return fail("identity_conflict");
  }

  if (campaignData.status !== "ready") {
    return fail("campaign_not_ready");
  }

  if (resolveCampaignFormat(campaignData.input_snapshot).kind !== "1:1") {
    return fail("format_not_square");
  }

  const campaignPath = campaignData.storage_path;
  if (
    typeof campaignPath !== "string" ||
    campaignPath !== candidate.storagePath ||
    !isCanonicalDeliveredPath(
      origin,
      candidate.storagePath,
      candidate.storeId,
      candidate.campaignId,
    )
  ) {
    return fail("path_not_canonical");
  }

  const storage = new CompositionArtifactStorage(client);
  const download = await storage.downloadBytes(
    candidate.storagePath,
    CAMPAIGN_IMAGES_BUCKET,
  );
  if (download.kind === "absent") {
    return fail("artifact_absent");
  }
  if (download.kind === "indeterminate") {
    return fail("artifact_indeterminate");
  }

  const expected =
    origin === "legacy_campaign"
      ? { width: 1080, height: 1080 }
      : { width: 1024, height: 1024 };
  const inspection = await inspectDeliveredJpeg(download.bytes, expected);
  if (!inspection.ok) {
    return fail(inspection.reason);
  }

  if (
    (candidate.width !== undefined && candidate.width !== inspection.width) ||
    (candidate.height !== undefined && candidate.height !== inspection.height) ||
    (candidate.mimeType !== undefined &&
      candidate.mimeType !== inspection.mimeType) ||
    (candidate.byteSize !== undefined &&
      candidate.byteSize !== inspection.byteSize) ||
    (candidate.checksumSha256 !== undefined &&
      candidate.checksumSha256.toLowerCase() !== inspection.checksumSha256)
  ) {
    return fail("metadata_conflict");
  }

  return Object.freeze({
    ok: true as const,
    source: Object.freeze({
      origin,
      storeId: candidate.storeId.toLowerCase(),
      campaignId: candidate.campaignId.toLowerCase(),
      bucket: CAMPAIGN_IMAGES_BUCKET,
      storagePath: candidate.storagePath,
      width: inspection.width,
      height: inspection.height,
      mimeType: inspection.mimeType,
      byteSize: inspection.byteSize,
      checksumSha256: inspection.checksumSha256,
    }),
  });
}
