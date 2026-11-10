// @vitest-environment node
import { beforeAll, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import { compositionArtifactStoragePath } from "../artifact-path";
import { computeChecksumSha256 } from "../integrity";
import { retrieveCompositionArtifact } from "../retrieve";
import type { ArtifactIdentity, AuthorizationContext } from "../types";

const STORE_ID = "1a2b3c4d-1a2b-4c3d-8e4f-1a2b3c4d5e6f";
const CAMPAIGN_ID = "2b3c4d5e-2b3c-4d5e-8f6a-2b3c4d5e6f7a";
const OPERATION_ID = "3c4d5e6f-3c4d-4e5f-8a7b-3c4d5e6f7a8b";

const IDENTITY: ArtifactIdentity = {
  storeId: STORE_ID,
  campaignId: CAMPAIGN_ID,
  operationId: OPERATION_ID,
  role: "square_original",
};

type Row = Record<string, unknown>;

interface FakeHandles {
  downloads: string[];
  tables: string[];
  signed: number;
}

function createFakeState(options: {
  artifact?: Row | null;
  downloadError?: unknown;
  downloadThrows?: boolean;
  artifactReadThrows?: boolean;
} = {}) {
  const handles: FakeHandles = { downloads: [], tables: [], signed: 0 };
  const rows: Row[] = [
    { __table: "campaigns", id: CAMPAIGN_ID, store_id: STORE_ID },
    { __table: "stores", id: STORE_ID, user_id: "user-1" },
  ];
  if (options.artifact !== null) {
    rows.push({
      __table: "campaign_composition_artifacts",
      ...artifactRow(),
      ...(options.artifact ?? {}),
    });
  }

  const objects = new Map<string, Buffer>();

  const match = (row: Row, filters: [string, unknown][]) =>
    filters.every(([column, value]) => row[column] === value);

  function select(table: string) {
    const filters: [string, unknown][] = [];
    const builder = {
      eq(column: string, value: unknown) {
        filters.push([column, value]);
        return builder;
      },
      maybeSingle: async () => {
        if (
          options.artifactReadThrows &&
          table === "campaign_composition_artifacts"
        ) {
          throw new Error("artifact_read_timeout");
        }
        const row = rows.find(
          (entry) => entry.__table === table && match(entry, filters),
        );
        return { data: row ?? null, error: null };
      },
    };
    return builder;
  }

  const client = {
    from(table: string) {
      handles.tables.push(table);
      return {
        select: () => select(table),
      };
    },
    storage: {
      from(_bucket: string) {
        return {
          download: vi.fn(async (path: string) => {
            handles.downloads.push(path);
            if (options.downloadThrows) throw new Error("download_timeout");
            if (options.downloadError !== undefined) {
              return { data: null, error: options.downloadError };
            }
            const bytes = objects.get(path);
            if (!bytes) {
              return {
                data: null,
                error: { statusCode: "404", message: "Object not found" },
              };
            }
            return { data: bytes, error: null };
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
            throw new Error("remove_must_not_be_called");
          }),
          update: vi.fn(async () => {
            throw new Error("update_must_not_be_called");
          }),
          upload: vi.fn(async () => {
            throw new Error("upload_must_not_be_called");
          }),
          info: vi.fn(async () => {
            throw new Error("info_must_not_be_called");
          }),
        };
      },
    },
  } as unknown as SupabaseClient;

  return { client, handles, objects };
}

function artifactRow(overrides: Row = {}): Row {
  return {
    id: "5e6f7a8b-5e6f-4a8b-9c8d-5e6f7a8b9c0d",
    store_id: STORE_ID,
    campaign_id: CAMPAIGN_ID,
    operation_id: OPERATION_ID,
    role: "square_original",
    format: "1:1",
    origin: "provider_generation",
    derived_from_artifact_id: null,
    source_campaign_id: null,
    storage_bucket: "campaign-internal-artifacts",
    storage_path: compositionArtifactStoragePath(IDENTITY),
    width: 1024,
    height: 1024,
    mime_type: "image/jpeg",
    byte_size: 0,
    checksum_sha256: "",
    provenance: {},
    created_at: "2026-11-10T00:00:00.000Z",
    ...overrides,
  };
}

const SYSTEM: AuthorizationContext = { kind: "system" };

let image: Buffer;

beforeAll(async () => {
  image = await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 3,
      background: { r: 10, g: 20, b: 30 },
    },
  })
    .jpeg({ quality: 90 })
    .toBuffer();
});

function seededArtifact(overrides: Row = {}): Row {
  return artifactRow({
    byte_size: image.byteLength,
    checksum_sha256: computeChecksumSha256(image),
    ...overrides,
  });
}

describe("retrieveCompositionArtifact", () => {
  it("returns integral bytes when the line matches the object", async () => {
    const state = createFakeState({ artifact: seededArtifact() });
    state.objects.set(compositionArtifactStoragePath(IDENTITY), image);

    const result = await retrieveCompositionArtifact(
      { identity: IDENTITY, authorization: SYSTEM },
      { client: state.client },
    );

    expect(result.kind).toBe("integral");
    if (result.kind === "integral") {
      expect(result.bytes).toEqual(image);
      expect(result.artifact.checksumSha256).toBe(computeChecksumSha256(image));
    }
    expect(state.handles.signed).toBe(0);
  });

  it("returns absent without downloading when the line is missing", async () => {
    const state = createFakeState({ artifact: null });
    const result = await retrieveCompositionArtifact(
      { identity: IDENTITY, authorization: SYSTEM },
      { client: state.client },
    );

    expect(result).toEqual({ kind: "absent" });
    expect(state.handles.downloads).toHaveLength(0);
  });

  it("returns absent when the line exists and the object is provably absent", async () => {
    const state = createFakeState({ artifact: seededArtifact() });
    const result = await retrieveCompositionArtifact(
      { identity: IDENTITY, authorization: SYSTEM },
      { client: state.client },
    );

    expect(result).toEqual({ kind: "absent" });
    expect(state.handles.downloads).toHaveLength(1);
  });

  it("never treats storage errors as absence", async () => {
    for (const downloadError of [
      { statusCode: "403", message: "Forbidden" },
      { statusCode: "500", message: "Server error" },
      { statusCode: "404", message: "Bucket not found" },
    ]) {
      const state = createFakeState({ artifact: seededArtifact(), downloadError });
      state.objects.set(compositionArtifactStoragePath(IDENTITY), image);
      expect(
        await retrieveCompositionArtifact(
          { identity: IDENTITY, authorization: SYSTEM },
          { client: state.client },
        ),
      ).toEqual({ kind: "indeterminate" });
    }

    const throwing = createFakeState({
      artifact: seededArtifact(),
      downloadThrows: true,
    });
    throwing.objects.set(compositionArtifactStoragePath(IDENTITY), image);
    expect(
      await retrieveCompositionArtifact(
        { identity: IDENTITY, authorization: SYSTEM },
        { client: throwing.client },
      ),
    ).toEqual({ kind: "indeterminate" });
  });

  it("returns indeterminate when the artifact read rejects", async () => {
    const state = createFakeState({
      artifact: seededArtifact(),
      artifactReadThrows: true,
    });
    const result = await retrieveCompositionArtifact(
      { identity: IDENTITY, authorization: SYSTEM },
      { client: state.client },
    );

    expect(result).toEqual({ kind: "indeterminate" });
    expect(state.handles.downloads).toHaveLength(0);
  });

  it("classifies truncated JPEG, PNG and wrong dimensions as invalid", async () => {
    const truncated = image.subarray(0, Math.min(image.length - 10, 2000));
    const png = await sharp({
      create: {
        width: 1024,
        height: 1024,
        channels: 3,
        background: { r: 1, g: 2, b: 3 },
      },
    })
      .png()
      .toBuffer();
    const vertical = await sharp({
      create: {
        width: 1080,
        height: 1920,
        channels: 3,
        background: { r: 1, g: 2, b: 3 },
      },
    })
      .jpeg()
      .toBuffer();

    for (const bytes of [truncated, png, vertical]) {
      const state = createFakeState({
        artifact: seededArtifact({
          byte_size: bytes.byteLength,
          checksum_sha256: computeChecksumSha256(bytes),
        }),
      });
      state.objects.set(compositionArtifactStoragePath(IDENTITY), bytes);
      const result = await retrieveCompositionArtifact(
        { identity: IDENTITY, authorization: SYSTEM },
        { client: state.client },
      );
      expect(result.kind).toBe("invalid");
    }
  });

  it("returns metadata_conflict for checksum, byte size, dimension and MIME divergence", async () => {
    const cases: { override: Row; reason: string }[] = [
      { override: { checksum_sha256: "a".repeat(64) }, reason: "checksum_mismatch" },
      { override: { byte_size: image.byteLength + 1 }, reason: "byte_size_mismatch" },
      { override: { width: 999 }, reason: "width_mismatch" },
      { override: { height: 999 }, reason: "height_mismatch" },
      { override: { mime_type: "image/png" }, reason: "mime_mismatch" },
    ];

    for (const { override, reason } of cases) {
      const state = createFakeState({ artifact: seededArtifact(override) });
      state.objects.set(compositionArtifactStoragePath(IDENTITY), image);
      const result = await retrieveCompositionArtifact(
        { identity: IDENTITY, authorization: SYSTEM },
        { client: state.client },
      );
      expect(result).toMatchObject({ kind: "metadata_conflict", reason });
    }
  });

  it("rejects a line pointing to a non-deterministic path without download", async () => {
    const state = createFakeState({
      artifact: seededArtifact({ storage_path: "other/path.jpg" }),
    });
    const result = await retrieveCompositionArtifact(
      { identity: IDENTITY, authorization: SYSTEM },
      { client: state.client },
    );

    expect(result).toMatchObject({
      kind: "metadata_conflict",
      reason: "storage_path_mismatch",
    });
    expect(state.handles.downloads).toHaveLength(0);
  });

  it("refuses without a valid authorization context and downloads nothing", async () => {
    const state = createFakeState({ artifact: seededArtifact() });
    state.objects.set(compositionArtifactStoragePath(IDENTITY), image);
    const result = await retrieveCompositionArtifact(
      {
        identity: IDENTITY,
        authorization: undefined as unknown as AuthorizationContext,
      },
      { client: state.client },
    );

    expect(result.kind).toBe("invalid");
    expect(state.handles.downloads).toHaveLength(0);
  });

  it("reads only campaigns, stores and the artifact table", async () => {
    const state = createFakeState({ artifact: seededArtifact() });
    state.objects.set(compositionArtifactStoragePath(IDENTITY), image);
    await retrieveCompositionArtifact(
      { identity: IDENTITY, authorization: SYSTEM },
      { client: state.client },
    );

    expect(new Set(state.handles.tables)).toEqual(
      new Set(["campaigns", "campaign_composition_artifacts"]),
    );
    expect(state.handles.signed).toBe(0);
  });
});
