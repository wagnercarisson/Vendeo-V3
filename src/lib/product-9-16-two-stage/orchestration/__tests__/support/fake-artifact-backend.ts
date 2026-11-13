import sharp from "sharp";

import { compositionArtifactStoragePath } from "@/lib/campaign/composition-artifacts/artifact-path";
import {
  buildEvidenceMetadata,
  buildObjectEvidence,
  COMPOSITION_EVIDENCE_METADATA_KEY,
  computeEvidenceDigest,
} from "@/lib/campaign/composition-artifacts/evidence";
import { computeChecksumSha256 } from "@/lib/campaign/composition-artifacts/integrity";
import type { SupabaseClient } from "@supabase/supabase-js";

export const STORE_ID = "1a2b3c4d-1a2b-4c3d-8e4f-1a2b3c4d5e6f";
export const CAMPAIGN_ID = "2b3c4d5e-2b3c-4d5e-8f6a-2b3c4d5e6f7a";
export const OPERATION_ID = "3c4d5e6f-3c4d-4e5f-8a7b-3c4d5e6f7a8b";
export const ARTIFACT_ID = "4d5e6f7a-4d5e-4f6a-8b8c-4d5e6f7a8b9c";
export const SOURCE_ID = "5e6f7a8b-5e6f-4a8b-9c8d-5e6f7a8b9c0d";
export const SOURCE_CHECKSUM = "a".repeat(64);

export const VERTICAL_PROVENANCE = Object.freeze({
  sourceOrigin: "composition_artifact",
  sourceStoragePath: `${STORE_ID}/${CAMPAIGN_ID}/${OPERATION_ID}/square_prepared.jpg`,
  sourceWidth: 1152,
  sourceHeight: 1152,
  sourceMimeType: "image/jpeg",
  sourceChecksumSha256: SOURCE_CHECKSUM,
  derivedFromArtifactId: SOURCE_ID,
});

export async function buildVertical1080x1920Fixture(): Promise<Buffer> {
  return sharp({
    create: {
      width: 1080,
      height: 1920,
      channels: 3,
      background: { r: 10, g: 20, b: 30 },
    },
  })
    .jpeg({ quality: 80 })
    .toBuffer();
}

export function buildNonImageBuffer(): Buffer {
  return Buffer.from("this-is-not-an-image");
}

export function buildTruncatedVerticalFixture(valid: Buffer): Buffer {
  return valid.subarray(0, Math.max(64, Math.floor(valid.length / 2)));
}

export interface VerticalBackendOptions {
  readonly row?: boolean;
  readonly object?: "present" | "absent";
  readonly metadata?: "valid" | "missing" | "divergent";
  readonly infoAbsent?: boolean;
  readonly readError?: boolean;
  readonly downloadError?: boolean;
  readonly infoError?: boolean;
  readonly bytes?: Buffer;
  readonly rowOverrides?: Record<string, unknown>;
  readonly campaignStoreId?: string;
}

export interface FakeHandles {
  signed: number;
  uploads: number;
  downloads: number;
  infos: number;
  tables: string[];
}

export async function createVerticalBackend(
  options: VerticalBackendOptions = {},
) {
  const bytes = options.bytes ?? (await buildVertical1080x1920Fixture());
  const checksum = computeChecksumSha256(bytes);
  const identity = {
    storeId: STORE_ID,
    campaignId: CAMPAIGN_ID,
    operationId: OPERATION_ID,
    role: "vertical" as const,
  };

  const row: Record<string, unknown> = {
    id: ARTIFACT_ID,
    store_id: STORE_ID,
    campaign_id: CAMPAIGN_ID,
    operation_id: OPERATION_ID,
    role: "vertical",
    format: "9:16",
    origin: "ai_expansion",
    derived_from_artifact_id: SOURCE_ID,
    source_campaign_id: null,
    storage_bucket: "campaign-internal-artifacts",
    storage_path: compositionArtifactStoragePath(identity),
    width: 1080,
    height: 1920,
    mime_type: "image/jpeg",
    byte_size: bytes.byteLength,
    checksum_sha256: checksum,
    provenance: VERTICAL_PROVENANCE,
    created_at: "2026-11-13T00:00:00.000Z",
    ...options.rowOverrides,
  };

  const evidenceResult = buildObjectEvidence({
    storeId: STORE_ID,
    campaignId: CAMPAIGN_ID,
    operationId: OPERATION_ID,
    role: "vertical",
    origin: "ai_expansion",
    sourceKind: "internal_artifact",
    sourceArtifactId: SOURCE_ID,
    sourceOrigin: "composition_artifact",
    sourceChecksumSha256: SOURCE_CHECKSUM,
    width: 1080,
    height: 1920,
    mimeType: "image/jpeg",
    byteSize: bytes.byteLength,
    checksumSha256: checksum,
    provenance: VERTICAL_PROVENANCE,
  });
  if (!evidenceResult.ok) throw new Error("fixture evidence failed");

  const validMetadata = buildEvidenceMetadata(evidenceResult.evidence);
  const metadata =
    options.metadata === "missing"
      ? {}
      : options.metadata === "divergent"
        ? {
            [COMPOSITION_EVIDENCE_METADATA_KEY]: {
              evidence: {
                ...evidenceResult.evidence,
                checksumSha256: "0".repeat(64),
              },
              evidenceDigest: computeEvidenceDigest({
                ...evidenceResult.evidence,
                checksumSha256: "0".repeat(64),
              }),
            },
          }
        : validMetadata;

  const rows: Array<Record<string, unknown>> = [
    {
      __table: "campaigns",
      id: CAMPAIGN_ID,
      store_id: options.campaignStoreId ?? STORE_ID,
    },
    { __table: "stores", id: STORE_ID, user_id: "user-1" },
    ...(options.row === false
      ? []
      : [{ __table: "campaign_composition_artifacts", ...row }]),
  ];
  const handles: FakeHandles = {
    signed: 0,
    uploads: 0,
    downloads: 0,
    infos: 0,
    tables: [],
  };

  const match = (entry: Record<string, unknown>, filters: [string, unknown][]) =>
    filters.every(([column, value]) => entry[column] === value);

  function select(table: string) {
    const filters: [string, unknown][] = [];
    const builder = {
      eq(column: string, value: unknown) {
        filters.push([column, value]);
        return builder;
      },
      maybeSingle: async () => {
        if (
          options.readError &&
          table === "campaign_composition_artifacts"
        ) {
          throw new Error("artifact_read_timeout");
        }
        const entry = rows.find(
          (candidate) =>
            candidate.__table === table && match(candidate, filters),
        );
        return { data: entry ?? null, error: null };
      },
    };
    return builder;
  }

  const client = {
    from(table: string) {
      handles.tables.push(table);
      return { select: () => select(table) };
    },
    storage: {
      from() {
        return {
          download: async (path: string) => {
            handles.downloads += 1;
            if (options.downloadError) throw new Error("download_timeout");
            if (options.object === "absent") {
              return {
                data: null,
                error: { statusCode: "404", message: "Object not found" },
              };
            }
            return { data: bytes, error: null };
          },
          info: async () => {
            handles.infos += 1;
            if (options.infoError) throw new Error("info_timeout");
            if (options.infoAbsent) {
              return {
                data: null,
                error: { statusCode: "404", message: "Object not found" },
              };
            }
            return { data: { metadata }, error: null };
          },
          createSignedUrl: async () => {
            handles.signed += 1;
            return { data: { signedUrl: "https://signed" }, error: null };
          },
          upload: async () => {
            handles.uploads += 1;
            throw new Error("upload_must_not_be_called");
          },
          remove: async () => {
            throw new Error("remove_must_not_be_called");
          },
          update: async () => {
            throw new Error("update_must_not_be_called");
          },
          getPublicUrl: () => {
            handles.signed += 1;
            return { data: { publicUrl: "public" } };
          },
        };
      },
    },
  } as unknown as SupabaseClient;

  return { client, handles, bytes, row, identity };
}
