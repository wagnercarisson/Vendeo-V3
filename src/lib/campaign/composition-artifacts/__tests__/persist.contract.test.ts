// @vitest-environment node
import { beforeAll, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import {
  COMPOSITION_ARTIFACT_BUCKET,
  compositionArtifactStoragePath,
} from "../artifact-path";
import { computeChecksumSha256 } from "../integrity";
import { persistCompositionArtifact } from "../persist";
import { CAMPAIGN_IMAGES_BUCKET } from "../storage";
import type { PersistArtifactInput } from "../types";

const STORE_ID = "1a2b3c4d-1a2b-4c3d-8e4f-1a2b3c4d5e6f";
const CAMPAIGN_ID = "2b3c4d5e-2b3c-4d5e-8f6a-2b3c4d5e6f7a";
const OPERATION_ID = "3c4d5e6f-3c4d-4e5f-8a7b-3c4d5e6f7a8b";
const OTHER_OPERATION_ID = "4d5e6f7a-4d5e-4f6a-8b8c-4d5e6f7a8b9c";
const OTHER_CAMPAIGN_ID = "8b9c0d1e-8b9c-4d1e-8f0a-8b9c0d1e2f3a";
const SOURCE_ARTIFACT_ID = "5e6f7a8b-5e6f-4a8b-9c8d-5e6f7a8b9c0d";

type Row = Record<string, unknown>;

interface FakeHandles {
  uploads: { path: string; options: Record<string, unknown> }[];
  inserts: Row[];
  downloads: string[];
  infos: string[];
  signed: number;
  removes: number;
  updates: number;
  lists: number;
}

interface FakeState {
  client: SupabaseClient;
  handles: FakeHandles;
  rows: Row[];
  objects: Map<string, { bytes: Buffer; metadata: Record<string, unknown> }>;
  setFailNextInsert: () => void;
  setUploadThrows: () => void;
  setInfoError: (error: unknown) => void;
  removeObject: (path: string) => void;
  replaceObjectBytes: (path: string, bytes: Buffer) => void;
  removeObjectMetadata: (path: string) => void;
  hideObjectOnce: (path: string) => void;
  clearArtifactRows: () => void;
  clearObjectOnNextPathConflict: (path: string) => void;
  addObject: (
    bucket: string,
    path: string,
    bytes: Buffer,
    metadata?: Record<string, unknown>,
  ) => void;
  updateCampaign: (fields: Row) => void;
  seedRow: (row: Row) => void;
}

function createFakeState(): FakeState {
  const handles: FakeHandles = {
    uploads: [],
    inserts: [],
    downloads: [],
    infos: [],
    signed: 0,
    removes: 0,
    updates: 0,
    lists: 0,
  };
  const rows: Row[] = [];
  const objects = new Map<string, { bytes: Buffer; metadata: Record<string, unknown> }>();
  const hiddenOnce = new Set<string>();
  const clearOnConflict = new Set<string>();
  let failNextInsert = false;
  let uploadThrows = false;
  let infoError: unknown = null;
  let rowCounter = 0;

  const key = (bucket: string, path: string) => `${bucket}:${path}`;

  const match = (row: Row, filters: [string, unknown][]): boolean =>
    filters.every(([column, value]) => row[column] === value);

  function select(table: string) {
    const filters: [string, unknown][] = [];
    const builder = {
      eq(column: string, value: unknown) {
        filters.push([column, value]);
        return builder;
      },
      maybeSingle: async () => {
        if (table === "campaigns") {
          const row = rows.find((entry) => entry.__table === "campaigns" && match(entry, filters));
          return { data: row ?? null, error: null };
        }
        if (table === "stores") {
          const row = rows.find((entry) => entry.__table === "stores" && match(entry, filters));
          return { data: row ?? null, error: null };
        }
        const row = rows.find(
          (entry) => entry.__table === "campaign_composition_artifacts" && match(entry, filters),
        );
        return { data: row ?? null, error: null };
      },
      single: async () => builder.maybeSingle(),
    };
    return builder;
  }

  function insert(table: string, row: Row) {
    handles.inserts.push(row);
    if (failNextInsert) {
      failNextInsert = false;
      return {
        select: () => ({
          single: async () => ({ data: null, error: { message: "injected_insert_failure" } }),
        }),
      };
    }

    const conflict = rows.some(
      (entry) =>
        entry.__table === "campaign_composition_artifacts" &&
        ((entry.store_id === row.store_id &&
          entry.campaign_id === row.campaign_id &&
          entry.operation_id === row.operation_id &&
          entry.role === row.role) ||
          entry.storage_path === row.storage_path),
    );
    if (conflict) {
      return {
        select: () => ({
          single: async () => ({
            data: null,
            error: { code: "23505", message: "duplicate key value" },
          }),
        }),
      };
    }

    const stored: Row = {
      ...row,
      __table: table,
      id: `99999999-9999-4999-8999-${String((rowCounter += 1)).padStart(12, "0")}`,
      created_at: "2026-11-10T00:00:00.000Z",
    };
    rows.push(stored);
    return {
      select: () => ({
        single: async () => ({ data: stored, error: null }),
      }),
    };
  }

  const client = {
    from(table: string) {
      return {
        select: () => select(table),
        insert: (row: Row) => insert(table, row),
      };
    },
    storage: {
      from(bucket: string) {
        return {
          upload: vi.fn(async (path: string, bytes: Buffer, options: Record<string, unknown>) => {
            handles.uploads.push({ path, options });
            if (uploadThrows) throw new Error("upload_timeout");
            if (objects.has(key(bucket, path))) {
              if (clearOnConflict.has(path)) {
                clearOnConflict.delete(path);
                objects.delete(key(bucket, path));
                for (let index = rows.length - 1; index >= 0; index -= 1) {
                  if (rows[index].__table === "campaign_composition_artifacts") {
                    rows.splice(index, 1);
                  }
                }
              }
              return { data: null, error: { statusCode: "409", message: "already exists" } };
            }
            const metadata = options.metadata as Record<string, unknown>;
            objects.set(key(bucket, path), { bytes: Buffer.from(bytes), metadata });
            return { data: { path }, error: null };
          }),
          download: vi.fn(async (path: string) => {
            handles.downloads.push(path);
            const object = objects.get(key(bucket, path));
            if (!object) {
              return { data: null, error: { statusCode: "404", message: "Object not found" } };
            }
            return { data: object.bytes, error: null };
          }),
          info: vi.fn(async (path: string) => {
            handles.infos.push(path);
            if (hiddenOnce.has(path)) {
              hiddenOnce.delete(path);
              return { data: null, error: { statusCode: "404", message: "Object not found" } };
            }
            if (infoError !== null) return { data: null, error: infoError };
            const object = objects.get(key(bucket, path));
            if (!object) {
              return { data: null, error: { statusCode: "404", message: "Object not found" } };
            }
            const metadata: Record<string, unknown> = {};
            for (const [entryKey, value] of Object.entries(object.metadata)) {
              metadata[
                entryKey === "vendeo_composition_artifact"
                  ? "vendeoCompositionArtifact"
                  : entryKey
              ] = value;
            }
            return { data: { metadata }, error: null };
          }),
          createSignedUrl: vi.fn(async () => {
            handles.signed += 1;
            return { data: null, error: null };
          }),
          getPublicUrl: vi.fn(() => {
            handles.signed += 1;
            return { data: { publicUrl: "public" } };
          }),
          remove: vi.fn(async () => {
            handles.removes += 1;
            return { data: null, error: null };
          }),
          update: vi.fn(async () => {
            handles.updates += 1;
            return { data: null, error: null };
          }),
          list: vi.fn(async () => {
            handles.lists += 1;
            return { data: [], error: null };
          }),
        };
      },
    },
  } as unknown as SupabaseClient;

  rows.push({
    __table: "campaigns",
    id: CAMPAIGN_ID,
    store_id: STORE_ID,
  });
  rows.push({
    __table: "stores",
    id: STORE_ID,
    user_id: "user-1",
  });

  return {
    client,
    handles,
    rows,
    objects,
    setFailNextInsert: () => {
      failNextInsert = true;
    },
    setUploadThrows: () => {
      uploadThrows = true;
    },
    setInfoError: (error: unknown) => {
      infoError = error;
    },
    removeObject: (path: string) => {
      objects.delete(key(COMPOSITION_ARTIFACT_BUCKET, path));
    },
    replaceObjectBytes: (path: string, bytes: Buffer) => {
      const object = objects.get(key(COMPOSITION_ARTIFACT_BUCKET, path));
      if (object) object.bytes = bytes;
    },
    removeObjectMetadata: (path: string) => {
      const object = objects.get(key(COMPOSITION_ARTIFACT_BUCKET, path));
      if (object) object.metadata = {};
    },
    hideObjectOnce: (path: string) => {
      hiddenOnce.add(path);
    },
    clearArtifactRows: () => {
      for (let index = rows.length - 1; index >= 0; index -= 1) {
        if (rows[index].__table === "campaign_composition_artifacts") {
          rows.splice(index, 1);
        }
      }
    },
    clearObjectOnNextPathConflict: (path: string) => {
      clearOnConflict.add(path);
    },
    addObject: (
      bucket: string,
      path: string,
      bytes: Buffer,
      metadata: Record<string, unknown> = {},
    ) => {
      objects.set(key(bucket, path), { bytes: Buffer.from(bytes), metadata });
    },
    updateCampaign: (fields: Row) => {
      const campaign = rows.find(
        (entry) => entry.__table === "campaigns" && entry.id === CAMPAIGN_ID,
      );
      if (campaign) Object.assign(campaign, fields);
    },
    seedRow: (row: Row) => {
      rows.push({ ...row, __table: "campaign_composition_artifacts" });
    },
  };
}

function baseInput(bytes: Buffer, overrides: Partial<PersistArtifactInput> = {}): PersistArtifactInput {
  return {
    identity: {
      storeId: STORE_ID,
      campaignId: CAMPAIGN_ID,
      operationId: OPERATION_ID,
      role: "square_original",
    },
    authorization: { kind: "system" },
    bytes,
    origin: "provider_generation",
    source: { kind: "none" },
    provenance: {},
    ...overrides,
  };
}

let image: Buffer;
let differentImage: Buffer;
let preparedImage: Buffer;
let verticalImage: Buffer;
let legacyImage: Buffer;

beforeAll(async () => {
  image = await sharp({
    create: { width: 1024, height: 1024, channels: 3, background: { r: 10, g: 20, b: 30 } },
  })
    .jpeg({ quality: 90 })
    .toBuffer();
  differentImage = await sharp({
    create: { width: 1024, height: 1024, channels: 3, background: { r: 200, g: 20, b: 30 } },
  })
    .jpeg({ quality: 90 })
    .toBuffer();
  preparedImage = await sharp({
    create: { width: 1152, height: 1152, channels: 3, background: { r: 30, g: 120, b: 60 } },
  })
    .jpeg({ quality: 90 })
    .toBuffer();
  verticalImage = await sharp({
    create: { width: 1080, height: 1920, channels: 3, background: { r: 60, g: 80, b: 120 } },
  })
    .jpeg({ quality: 90 })
    .toBuffer();
  legacyImage = await sharp({
    create: { width: 1080, height: 1080, channels: 3, background: { r: 120, g: 60, b: 40 } },
  })
    .jpeg({ quality: 90 })
    .toBuffer();
});

describe("persistCompositionArtifact", () => {
  it("creates with evidence metadata in the same upload", async () => {
    const state = createFakeState();
    const result = await persistCompositionArtifact(baseInput(image), { client: state.client });

    expect(result).toEqual({ kind: "created" });
    expect(state.handles.uploads).toHaveLength(1);
    expect(state.handles.inserts).toHaveLength(1);
    expect(state.handles.uploads[0].options).toMatchObject({
      contentType: "image/jpeg",
      upsert: false,
    });
    expect(state.handles.uploads[0].options.metadata).toHaveProperty(
      "vendeo_composition_artifact",
    );
    expect(state.objects.size).toBe(1);
    expect(state.rows.filter((r) => r.__table === "campaign_composition_artifacts")).toHaveLength(1);
  });

  it("reuses the same identity and content without a second upload/insert", async () => {
    const state = createFakeState();
    await persistCompositionArtifact(baseInput(image), { client: state.client });
    const result = await persistCompositionArtifact(baseInput(image), { client: state.client });

    expect(result).toEqual({ kind: "reused", adoption: false });
    expect(state.handles.uploads).toHaveLength(1);
    expect(state.handles.inserts).toHaveLength(1);
  });

  it("never reuses an existing row without reading the object", async () => {
    const state = createFakeState();
    await persistCompositionArtifact(baseInput(image), { client: state.client });
    const path = compositionArtifactStoragePath(baseInput(image).identity);

    state.replaceObjectBytes(path, differentImage);
    expect(
      await persistCompositionArtifact(baseInput(image), { client: state.client }),
    ).toMatchObject({ kind: "content_conflict", reason: "checksum_mismatch" });

    state.removeObject(path);
    expect(
      await persistCompositionArtifact(baseInput(image), { client: state.client }),
    ).toEqual({ kind: "integrity_failure", reason: "object_absent" });

    state.setInfoError({ statusCode: "403", message: "Forbidden" });
    expect(
      await persistCompositionArtifact(baseInput(image), { client: state.client }),
    ).toEqual({ kind: "indeterminate", reason: "object_indeterminate" });
  });

  it("rejects existing rows with invalid evidence", async () => {
    const state = createFakeState();
    await persistCompositionArtifact(baseInput(image), { client: state.client });
    const path = compositionArtifactStoragePath(baseInput(image).identity);
    state.removeObjectMetadata(path);

    expect(
      await persistCompositionArtifact(baseInput(image), { client: state.client }),
    ).toEqual({
      kind: "provenance_conflict",
      existing: expect.any(Object),
      reason: "evidence_missing",
    });
  });

  it("keeps distinct operations on distinct paths and rows", async () => {
    const state = createFakeState();
    await persistCompositionArtifact(baseInput(image), { client: state.client });
    const other = baseInput(image, {
      identity: { ...baseInput(image).identity, operationId: OTHER_OPERATION_ID },
    });
    await persistCompositionArtifact(other, { client: state.client });

    const paths = state.rows
      .filter((row) => row.__table === "campaign_composition_artifacts")
      .map((row) => row.storage_path);
    expect(paths).toHaveLength(2);
    expect(new Set(paths).size).toBe(2);
    expect(state.handles.uploads).toHaveLength(2);
  });

  it("rejects unauthorized owner before any storage access", async () => {
    const state = createFakeState();
    const result = await persistCompositionArtifact(
      baseInput(image, { authorization: { kind: "owner", userId: "other-user" } }),
      { client: state.client },
    );
    expect(result).toMatchObject({ kind: "identity_conflict", reason: "not_owner" });
    expect(state.handles.downloads).toHaveLength(0);
    expect(state.handles.uploads).toHaveLength(0);
    expect(state.handles.inserts).toHaveLength(0);
  });

  it("requires a source for deterministic_preparation and ai_expansion", async () => {
    for (const origin of ["deterministic_preparation", "ai_expansion"] as const) {
      const state = createFakeState();
      const result = await persistCompositionArtifact(
        baseInput(image, { origin, source: { kind: "none" } }),
        { client: state.client },
      );
      expect(result).toEqual({ kind: "invalid_input", reason: "source_required" });
      expect(state.handles.uploads).toHaveLength(0);
      expect(state.handles.inserts).toHaveLength(0);
    }
  });

  it("rejects a source on provider_generation", async () => {
    const state = createFakeState();
    const result = await persistCompositionArtifact(
      baseInput(image, {
        origin: "provider_generation",
        source: { kind: "internal_artifact", artifactId: SOURCE_ARTIFACT_ID },
      }),
      { client: state.client },
    );
    expect(result).toEqual({ kind: "invalid_input", reason: "source_not_allowed" });
    expect(state.handles.uploads).toHaveLength(0);
    expect(state.handles.inserts).toHaveLength(0);
  });

  it("rejects an internal source from another campaign without upload", async () => {
    const state = createFakeState();
    state.seedRow({
      id: SOURCE_ARTIFACT_ID,
      store_id: STORE_ID,
      campaign_id: OTHER_CAMPAIGN_ID,
      operation_id: OTHER_OPERATION_ID,
      role: "square_original",
      format: "1:1",
      origin: "provider_generation",
      derived_from_artifact_id: null,
      source_campaign_id: null,
      storage_bucket: "campaign-internal-artifacts",
      storage_path: `${STORE_ID}/${OTHER_CAMPAIGN_ID}/${OTHER_OPERATION_ID}/square_original.jpg`,
      width: 1024,
      height: 1024,
      mime_type: "image/jpeg",
      byte_size: image.byteLength,
      checksum_sha256: computeChecksumSha256(image),
      provenance: {},
      created_at: "2026-11-10T00:00:00.000Z",
    });

    const result = await persistCompositionArtifact(
      baseInput(preparedImage, {
        identity: {
          storeId: STORE_ID,
          campaignId: CAMPAIGN_ID,
          operationId: OPERATION_ID,
          role: "square_prepared",
        },
        origin: "deterministic_preparation",
        source: { kind: "internal_artifact", artifactId: SOURCE_ARTIFACT_ID },
      }),
      { client: state.client },
    );

    expect(result).toMatchObject({
      kind: "identity_conflict",
      reason: "invalid_identity",
    });
    expect(state.handles.uploads).toHaveLength(0);
    expect(state.handles.inserts).toHaveLength(0);
  });

  it("persists a prepared derivative from an internal square_original", async () => {
    const state = createFakeState();
    const originalIdentity = {
      storeId: STORE_ID,
      campaignId: CAMPAIGN_ID,
      operationId: OPERATION_ID,
      role: "square_original" as const,
    };
    await persistCompositionArtifact(baseInput(image, { identity: originalIdentity }), {
      client: state.client,
    });
    const originalRow = state.rows.find(
      (row) =>
        row.__table === "campaign_composition_artifacts" &&
        row.role === "square_original",
    );
    expect(originalRow).toBeTruthy();

    const preparedIdentity = {
      ...originalIdentity,
      operationId: OTHER_OPERATION_ID,
      role: "square_prepared" as const,
    };
    const preparedInput = baseInput(preparedImage, {
      identity: preparedIdentity,
      origin: "deterministic_preparation",
      source: {
        kind: "internal_artifact",
        artifactId: originalRow!.id as string,
      },
    });

    const result = await persistCompositionArtifact(preparedInput, {
      client: state.client,
    });
    expect(result).toEqual({ kind: "created" });
    expect(state.handles.uploads).toHaveLength(2);

    const preparedRow = state.rows.find(
      (row) =>
        row.__table === "campaign_composition_artifacts" &&
        row.role === "square_prepared",
    );
    expect(preparedRow).toMatchObject({
      derived_from_artifact_id: originalRow!.id,
      source_campaign_id: null,
      origin: "deterministic_preparation",
    });
    const provenance = preparedRow!.provenance as Record<string, unknown>;
    expect(provenance.sourceOrigin).toBe("composition_artifact");
    expect(provenance.sourceChecksumSha256).toBe(computeChecksumSha256(image));

    const repeat = await persistCompositionArtifact(preparedInput, {
      client: state.client,
    });
    expect(repeat).toEqual({ kind: "reused", adoption: false });
    expect(state.handles.uploads).toHaveLength(2);
  });

  it("persists a vertical derivative from an internal prepared source", async () => {
    const state = createFakeState();
    const baseIdentity = {
      storeId: STORE_ID,
      campaignId: CAMPAIGN_ID,
      operationId: OPERATION_ID,
      role: "square_original" as const,
    };
    await persistCompositionArtifact(baseInput(image, { identity: baseIdentity }), {
      client: state.client,
    });
    const originalRow = state.rows.find(
      (row) =>
        row.__table === "campaign_composition_artifacts" &&
        row.role === "square_original",
    );

    await persistCompositionArtifact(
      baseInput(preparedImage, {
        identity: { ...baseIdentity, role: "square_prepared" },
        origin: "deterministic_preparation",
        source: {
          kind: "internal_artifact",
          artifactId: originalRow!.id as string,
        },
      }),
      { client: state.client },
    );
    const preparedRow = state.rows.find(
      (row) =>
        row.__table === "campaign_composition_artifacts" &&
        row.role === "square_prepared",
    );

    const result = await persistCompositionArtifact(
      baseInput(verticalImage, {
        identity: { ...baseIdentity, role: "vertical" },
        origin: "ai_expansion",
        source: {
          kind: "internal_artifact",
          artifactId: preparedRow!.id as string,
        },
      }),
      { client: state.client },
    );
    expect(result).toEqual({ kind: "created" });

    const verticalRow = state.rows.find(
      (row) =>
        row.__table === "campaign_composition_artifacts" && row.role === "vertical",
    );
    expect(verticalRow).toMatchObject({
      derived_from_artifact_id: preparedRow!.id,
      source_campaign_id: null,
      origin: "ai_expansion",
      format: "9:16",
    });
    expect(state.handles.uploads).toHaveLength(3);
  });

  it("persists a prepared derivative from a delivered legacy campaign source", async () => {
    const state = createFakeState();
    const legacyPath = `${STORE_ID}/${CAMPAIGN_ID}.jpg`;
    state.updateCampaign({
      status: "ready",
      storage_path: legacyPath,
      input_snapshot: {},
    });
    state.addObject(CAMPAIGN_IMAGES_BUCKET, legacyPath, legacyImage);

    const descriptor = {
      origin: "legacy_campaign" as const,
      storeId: STORE_ID,
      campaignId: CAMPAIGN_ID,
      bucket: CAMPAIGN_IMAGES_BUCKET,
      storagePath: legacyPath,
      width: 1080,
      height: 1080,
      mimeType: "image/jpeg",
      byteSize: legacyImage.byteLength,
      checksumSha256: computeChecksumSha256(legacyImage),
    };

    const preparedIdentity = {
      storeId: STORE_ID,
      campaignId: CAMPAIGN_ID,
      operationId: OPERATION_ID,
      role: "square_prepared" as const,
    };
    const result = await persistCompositionArtifact(
      baseInput(preparedImage, {
        identity: preparedIdentity,
        origin: "deterministic_preparation",
        source: { kind: "delivered_campaign_source", descriptor },
      }),
      { client: state.client },
    );

    expect(result).toEqual({ kind: "created" });
    expect(state.handles.uploads).toHaveLength(1);

    const row = state.rows.find(
      (entry) => entry.__table === "campaign_composition_artifacts",
    );
    expect(row).toMatchObject({
      source_campaign_id: CAMPAIGN_ID,
      derived_from_artifact_id: null,
    });
    const provenance = row!.provenance as Record<string, unknown>;
    expect(provenance.sourceOrigin).toBe("legacy_campaign");
    expect(provenance.sourceStoragePath).toBe(legacyPath);
    expect(provenance.sourceChecksumSha256).toBe(computeChecksumSha256(legacyImage));
  });

  it("rejects a delivered descriptor with divergent checksum without upload", async () => {
    const state = createFakeState();
    const legacyPath = `${STORE_ID}/${CAMPAIGN_ID}.jpg`;
    state.updateCampaign({
      status: "ready",
      storage_path: legacyPath,
      input_snapshot: {},
    });
    state.addObject(CAMPAIGN_IMAGES_BUCKET, legacyPath, legacyImage);

    const descriptor = {
      origin: "legacy_campaign" as const,
      storeId: STORE_ID,
      campaignId: CAMPAIGN_ID,
      bucket: CAMPAIGN_IMAGES_BUCKET,
      storagePath: legacyPath,
      width: 1080,
      height: 1080,
      mimeType: "image/jpeg",
      byteSize: legacyImage.byteLength,
      checksumSha256: "b".repeat(64),
    };

    const result = await persistCompositionArtifact(
      baseInput(preparedImage, {
        identity: {
          storeId: STORE_ID,
          campaignId: CAMPAIGN_ID,
          operationId: OPERATION_ID,
          role: "square_prepared",
        },
        origin: "deterministic_preparation",
        source: { kind: "delivered_campaign_source", descriptor },
      }),
      { client: state.client },
    );

    expect(result).toMatchObject({
      kind: "metadata_conflict",
      reason: "source_mismatch",
    });
    expect(state.handles.uploads).toHaveLength(0);
    expect(state.handles.inserts).toHaveLength(0);
  });

  it("converges on concurrent identical uploads", async () => {
    const state = createFakeState();
    const results = await Promise.all([
      persistCompositionArtifact(baseInput(image), { client: state.client }),
      persistCompositionArtifact(baseInput(image), { client: state.client }),
    ]);
    const kinds = results.map((result) => result.kind).sort();
    expect(kinds).toEqual(["created", "reused"]);
    expect(state.rows.filter((row) => row.__table === "campaign_composition_artifacts")).toHaveLength(1);
    expect(state.objects.size).toBe(1);
  });

  it("rejects same bytes with different provenance", async () => {
    const state = createFakeState();
    await persistCompositionArtifact(
      baseInput(image, { provenance: { sourceStoragePath: "a/source.jpg" } }),
      { client: state.client },
    );
    const result = await persistCompositionArtifact(
      baseInput(image, { provenance: { sourceStoragePath: "b/source.jpg" } }),
      { client: state.client },
    );
    expect(result).toMatchObject({ kind: "provenance_conflict" });
    expect(result.kind).not.toBe("reused");
  });

  it("adopts an integral orphan after an injected insert failure", async () => {
    const state = createFakeState();
    state.setFailNextInsert();
    const first = await persistCompositionArtifact(baseInput(image), { client: state.client });
    expect(first).toMatchObject({ kind: "persistence_failure" });
    expect(state.handles.uploads).toHaveLength(1);
    expect(state.handles.removes).toBe(0);
    expect(state.rows.filter((row) => row.__table === "campaign_composition_artifacts")).toHaveLength(0);

    const second = await persistCompositionArtifact(baseInput(image), { client: state.client });
    expect(second).toEqual({ kind: "reused", adoption: true });
    expect(state.handles.uploads).toHaveLength(1);
    expect(state.handles.removes).toBe(0);
    expect(state.rows.filter((row) => row.__table === "campaign_composition_artifacts")).toHaveLength(1);
  });

  it("adopts after path_conflict when the winner uploaded but its insert failed", async () => {
    const state = createFakeState();
    const path = compositionArtifactStoragePath(baseInput(image).identity);

    state.setFailNextInsert();
    const winner = await persistCompositionArtifact(baseInput(image), {
      client: state.client,
    });
    expect(winner).toMatchObject({ kind: "persistence_failure" });
    expect(state.rows.filter((row) => row.__table === "campaign_composition_artifacts")).toHaveLength(0);
    expect(state.objects.size).toBe(1);

    // A segunda chamada verifica o objeto como ausente (corrida), recebe 409
    // no upload e precisa concluir a adoção inserindo a linha.
    state.hideObjectOnce(path);
    const adopter = await persistCompositionArtifact(baseInput(image), {
      client: state.client,
    });

    expect(adopter).toEqual({ kind: "reused", adoption: true });
    expect(state.rows.filter((row) => row.__table === "campaign_composition_artifacts")).toHaveLength(1);
    expect(state.handles.uploads).toHaveLength(2);
    expect(state.handles.removes).toBe(0);
  });

  it("fails when conflict is followed by absent row and object", async () => {
    const state = createFakeState();
    const path = compositionArtifactStoragePath(baseInput(image).identity);

    await persistCompositionArtifact(baseInput(image), { client: state.client });
    state.clearArtifactRows();
    state.hideObjectOnce(path);
    state.clearObjectOnNextPathConflict(path);

    const result = await persistCompositionArtifact(baseInput(image), {
      client: state.client,
    });

    expect(result).toEqual({
      kind: "persistence_failure",
      storagePath: path,
      reason: "conflict_without_persisted_artifact",
    });
    expect(state.rows.filter((row) => row.__table === "campaign_composition_artifacts")).toHaveLength(0);
    expect(state.objects.size).toBe(0);
    expect(state.handles.removes).toBe(0);
  });

  it("returns indeterminate when info is unavailable and does not upload", async () => {
    const state = createFakeState();
    state.setInfoError({ statusCode: "403", message: "Forbidden" });
    const result = await persistCompositionArtifact(baseInput(image), { client: state.client });
    expect(result).toEqual({ kind: "indeterminate", reason: "object_indeterminate" });
    expect(state.handles.uploads).toHaveLength(0);
  });

  it("returns persistence failure on ambiguous upload without destructive retry", async () => {
    const state = createFakeState();
    state.setUploadThrows();
    const result = await persistCompositionArtifact(baseInput(image), { client: state.client });
    expect(result).toMatchObject({ kind: "persistence_failure" });
    expect(state.handles.uploads).toHaveLength(1);
    expect(state.handles.removes).toBe(0);
  });

  it("rejects a path already bound to another identity", async () => {
    const state = createFakeState();
    const path = compositionArtifactStoragePath(baseInput(image).identity);
    state.seedRow({
      id: "77777777-7777-4777-8777-777777777777",
      store_id: STORE_ID,
      campaign_id: CAMPAIGN_ID,
      operation_id: OTHER_OPERATION_ID,
      role: "square_original",
      format: "1:1",
      origin: "provider_generation",
      derived_from_artifact_id: null,
      source_campaign_id: null,
      storage_bucket: "campaign-internal-artifacts",
      storage_path: path,
      width: 1024,
      height: 1024,
      mime_type: "image/jpeg",
      byte_size: image.byteLength,
      checksum_sha256: "a".repeat(64),
      provenance: {},
      created_at: "2026-11-10T00:00:00.000Z",
    });

    const result = await persistCompositionArtifact(baseInput(image), { client: state.client });
    expect(result).toMatchObject({ kind: "identity_conflict", reason: "path_bound_to_other_identity" });
    expect(state.handles.uploads).toHaveLength(0);
  });
});
