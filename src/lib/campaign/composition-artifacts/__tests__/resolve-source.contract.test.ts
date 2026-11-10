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
import { resolveReusableSquareSource } from "../resolve-source";
import {
  validateDeliveredCampaignSource,
} from "../source-validation";
import { CAMPAIGN_IMAGES_BUCKET } from "../storage";
import type {
  ArtifactIdentity,
  ArtifactRole,
  AuthorizationContext,
  ReusableSquareSource,
} from "../types";

const STORE_ID = "1a2b3c4d-1a2b-4c3d-8e4f-1a2b3c4d5e6f";
const OTHER_STORE_ID = "6f7a8b9c-6f7a-4b9c-8d9e-6f7a8b9c0d1e";
const CAMPAIGN_ID = "2b3c4d5e-2b3c-4d5e-8f6a-2b3c4d5e6f7a";
const OTHER_CAMPAIGN_ID = "7a8b9c0d-7a8b-4c0d-9e0f-7a8b9c0d1e2f";
const OPERATION_ID = "3c4d5e6f-3c4d-4e5f-8a7b-3c4d5e6f7a8b";
const PREP_OPERATION_ID = "8b9c0d1e-8b9c-4d1e-8f0a-8b9c0d1e2f3a";

const SYSTEM: AuthorizationContext = { kind: "system" };

type Row = Record<string, unknown>;

interface FakeHandles {
  uploads: { path: string; options: Record<string, unknown> }[];
  inserts: Row[];
  downloads: string[];
  infos: string[];
  tables: string[];
  signed: number;
  removes: number;
  updates: number;
}

function createFakeState(options: { campaign?: Row; artifactReadThrows?: boolean } = {}) {
  const handles: FakeHandles = {
    uploads: [],
    inserts: [],
    downloads: [],
    infos: [],
    tables: [],
    signed: 0,
    removes: 0,
    updates: 0,
  };
  const rows: Row[] = [
    {
      __table: "campaigns",
      id: CAMPAIGN_ID,
      store_id: STORE_ID,
      status: "ready",
      storage_path: null,
      input_snapshot: {},
      ...(options.campaign ?? {}),
    },
    { __table: "stores", id: STORE_ID, user_id: "user-1" },
    { __table: "stores", id: OTHER_STORE_ID, user_id: "user-2" },
  ];
  const objects = new Map<string, { bytes: Buffer; metadata: Record<string, unknown> }>();
  const downloadErrors = new Map<string, unknown>();
  let rowCounter = 0;

  const key = (bucket: string, path: string) => `${bucket}:${path}`;
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
      single: async () => builder.maybeSingle(),
    };
    return builder;
  }

  function insert(table: string, row: Row) {
    handles.inserts.push(row);
    const conflict = rows.some(
      (entry) =>
        entry.__table === table &&
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
      select: () => ({ single: async () => ({ data: stored, error: null }) }),
    };
  }

  const client = {
    from(table: string) {
      handles.tables.push(table);
      return {
        select: () => select(table),
        insert: (row: Row) => insert(table, row),
      };
    },
    storage: {
      from(bucket: string) {
        return {
          upload: vi.fn(
            async (path: string, bytes: Buffer, opts: Record<string, unknown>) => {
              handles.uploads.push({ path, options: opts });
              if (objects.has(key(bucket, path))) {
                return {
                  data: null,
                  error: { statusCode: "409", message: "already exists" },
                };
              }
              objects.set(key(bucket, path), {
                bytes: Buffer.from(bytes),
                metadata: (opts.metadata as Record<string, unknown>) ?? {},
              });
              return { data: { path }, error: null };
            },
          ),
          download: vi.fn(async (path: string) => {
            handles.downloads.push(path);
            const error = downloadErrors.get(bucket);
            if (error !== undefined) return { data: null, error };
            const object = objects.get(key(bucket, path));
            if (!object) {
              return {
                data: null,
                error: { statusCode: "404", message: "Object not found" },
              };
            }
            return { data: object.bytes, error: null };
          }),
          info: vi.fn(async (path: string) => {
            handles.infos.push(path);
            const object = objects.get(key(bucket, path));
            if (!object) {
              return {
                data: null,
                error: { statusCode: "404", message: "Object not found" },
              };
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
          list: vi.fn(async () => ({ data: [], error: null })),
        };
      },
    },
  } as unknown as SupabaseClient;

  return {
    client,
    handles,
    rows,
    objects,
    addObject: (
      bucket: string,
      path: string,
      bytes: Buffer,
      metadata: Record<string, unknown> = {},
    ) => {
      objects.set(key(bucket, path), { bytes: Buffer.from(bytes), metadata });
    },
    removeObject: (bucket: string, path: string) => {
      objects.delete(key(bucket, path));
    },
    setDownloadError: (bucket: string, error: unknown) => {
      downloadErrors.set(bucket, error);
    },
    seedArtifact: (row: Row) => {
      rows.push({ __table: "campaign_composition_artifacts", ...row });
    },
  };
}

function artifactRow(
  role: ArtifactRole,
  bytes: Buffer,
  overrides: Row = {},
): Row {
  const identity: ArtifactIdentity = {
    storeId: STORE_ID,
    campaignId: CAMPAIGN_ID,
    operationId: OPERATION_ID,
    role,
  };
  const width = role === "vertical" ? 1080 : role === "square_prepared" ? 1152 : 1024;
  const height = role === "vertical" ? 1920 : width;
  return {
    id:
      role === "square_original"
        ? "5e6f7a8b-5e6f-4a8b-9c8d-5e6f7a8b9c0d"
        : role === "square_prepared"
          ? "6f7a8b9c-6f7a-4b9c-8d9e-6f7a8b9c0d1e"
          : "7a8b9c0d-7a8b-4c0d-9e0f-7a8b9c0d1e2f",
    store_id: STORE_ID,
    campaign_id: CAMPAIGN_ID,
    operation_id: OPERATION_ID,
    role,
    format: role === "vertical" ? "9:16" : "1:1",
    origin: "provider_generation",
    derived_from_artifact_id: null,
    source_campaign_id: null,
    storage_bucket: COMPOSITION_ARTIFACT_BUCKET,
    storage_path: compositionArtifactStoragePath(identity),
    width,
    height,
    mime_type: "image/jpeg",
    byte_size: bytes.byteLength,
    checksum_sha256: computeChecksumSha256(bytes),
    provenance: {},
    created_at: "2026-11-10T00:00:00.000Z",
    ...overrides,
  };
}

let original: Buffer;
let prepared: Buffer;
let legacy: Buffer;
let newFlow: Buffer;
let truncated: Buffer;
let png: Buffer;

beforeAll(async () => {
  original = await sharp({
    create: { width: 1024, height: 1024, channels: 3, background: { r: 10, g: 20, b: 30 } },
  })
    .jpeg({ quality: 90 })
    .toBuffer();
  prepared = await sharp({
    create: { width: 1152, height: 1152, channels: 3, background: { r: 30, g: 120, b: 60 } },
  })
    .jpeg({ quality: 90 })
    .toBuffer();
  legacy = await sharp({
    create: { width: 1080, height: 1080, channels: 3, background: { r: 120, g: 60, b: 40 } },
  })
    .jpeg({ quality: 90 })
    .toBuffer();
  newFlow = await sharp({
    create: { width: 1024, height: 1024, channels: 3, background: { r: 40, g: 60, b: 120 } },
  })
    .jpeg({ quality: 90 })
    .toBuffer();
  truncated = original.subarray(0, Math.min(original.length - 10, 2000));
  png = await sharp({
    create: { width: 1024, height: 1024, channels: 3, background: { r: 1, g: 2, b: 3 } },
  })
    .png()
    .toBuffer();
});

const LEGACY_PATH = `${STORE_ID}/${CAMPAIGN_ID}.jpg`;
const V2_PATH = `${STORE_ID}/${CAMPAIGN_ID}/v2.jpg`;
const V3_PATH = `${STORE_ID}/${CAMPAIGN_ID}/v3.jpg`;
const NEW_FLOW_PATH = `${STORE_ID}/${CAMPAIGN_ID}/product-1-1/${OPERATION_ID}/art-1024.jpg`;

function internalIdentity(role: ArtifactRole): ArtifactIdentity {
  return {
    storeId: STORE_ID,
    campaignId: CAMPAIGN_ID,
    operationId: OPERATION_ID,
    role,
  };
}

function seedInternal(
  state: ReturnType<typeof createFakeState>,
  role: ArtifactRole,
  bytes: Buffer,
  overrides: Row = {},
) {
  const row = artifactRow(role, bytes, overrides);
  state.seedArtifact(row);
  state.addObject(COMPOSITION_ARTIFACT_BUCKET, row.storage_path as string, bytes);
  return row;
}

describe("resolveReusableSquareSource — internal base", () => {
  it("accepts square_original and square_prepared", async () => {
    for (const [role, bytes] of [
      ["square_original", original],
      ["square_prepared", prepared],
    ] as const) {
      const state = createFakeState();
      seedInternal(state, role, bytes);
      const result = await resolveReusableSquareSource(
        {
          kind: "composition_artifact",
          storeId: STORE_ID,
          campaignId: CAMPAIGN_ID,
          operationId: OPERATION_ID,
          role,
          authorization: SYSTEM,
        },
        { client: state.client },
      );

      expect(result.kind).toBe("reusable");
      if (result.kind === "reusable") {
        expect(result.source.origin).toBe("composition_artifact");
        expect(result.source.role).toBe(role);
        expect(result.source.checksumSha256).toBe(computeChecksumSha256(bytes));
      }
      expect(state.handles.inserts).toHaveLength(0);
      expect(state.handles.signed).toBe(0);
    }
  });

  it("rejects vertical as a square source", async () => {
    const state = createFakeState();
    const result = await resolveReusableSquareSource(
      {
        kind: "composition_artifact",
        storeId: STORE_ID,
        campaignId: CAMPAIGN_ID,
        operationId: OPERATION_ID,
        role: "vertical",
        authorization: SYSTEM,
      },
      { client: state.client },
    );

    expect(result).toEqual({ kind: "not_reusable", reason: "role_not_reusable" });
    expect(state.handles.downloads).toHaveLength(0);
  });

  it("rejects a row from another operation", async () => {
    const state = createFakeState();
    seedInternal(state, "square_original", original);
    const result = await resolveReusableSquareSource(
      {
        kind: "composition_artifact",
        storeId: STORE_ID,
        campaignId: CAMPAIGN_ID,
        operationId: PREP_OPERATION_ID,
        role: "square_original",
        authorization: SYSTEM,
      },
      { client: state.client },
    );

    expect(result).toEqual({ kind: "not_reusable", reason: "artifact_absent" });
    expect(state.handles.downloads).toHaveLength(0);
  });

  it("rejects a row from another store before reading bytes", async () => {
    const state = createFakeState();
    seedInternal(state, "square_original", original);
    const result = await resolveReusableSquareSource(
      {
        kind: "composition_artifact",
        storeId: OTHER_STORE_ID,
        campaignId: CAMPAIGN_ID,
        operationId: OPERATION_ID,
        role: "square_original",
        authorization: SYSTEM,
      },
      { client: state.client },
    );

    expect(result).toEqual({ kind: "not_reusable", reason: "store_mismatch" });
    expect(state.handles.downloads).toHaveLength(0);
  });

  it("rejects divergent checksum as metadata_conflict", async () => {
    const state = createFakeState();
    seedInternal(state, "square_original", original, {
      checksum_sha256: "a".repeat(64),
    });
    const result = await resolveReusableSquareSource(
      {
        kind: "composition_artifact",
        storeId: STORE_ID,
        campaignId: CAMPAIGN_ID,
        operationId: OPERATION_ID,
        role: "square_original",
        authorization: SYSTEM,
      },
      { client: state.client },
    );

    expect(result).toEqual({ kind: "not_reusable", reason: "metadata_conflict" });
  });

  it("rejects owner of another store with zero downloads", async () => {
    const state = createFakeState();
    seedInternal(state, "square_original", original);
    const result = await resolveReusableSquareSource(
      {
        kind: "composition_artifact",
        storeId: STORE_ID,
        campaignId: CAMPAIGN_ID,
        operationId: OPERATION_ID,
        role: "square_original",
        authorization: { kind: "owner", userId: "other-user" },
      },
      { client: state.client },
    );

    expect(result).toEqual({ kind: "not_reusable", reason: "not_owner" });
    expect(state.handles.downloads).toHaveLength(0);
  });

  it("rejects system without campaign binding before download", async () => {
    const state = createFakeState();
    const result = await resolveReusableSquareSource(
      {
        kind: "composition_artifact",
        storeId: STORE_ID,
        campaignId: OTHER_CAMPAIGN_ID,
        operationId: OPERATION_ID,
        role: "square_original",
        authorization: SYSTEM,
      },
      { client: state.client },
    );

    expect(result).toEqual({
      kind: "not_reusable",
      reason: "identity_conflict",
    });
    expect(state.handles.downloads).toHaveLength(0);
  });

  it("accepts an internal square in a vertical campaign still generating", async () => {
    const state = createFakeState({
      campaign: {
        status: "generating",
        input_snapshot: {
          campaignFormat: "9:16",
          formatContractVersion: "f59-vertical-9-16-v1",
        },
      },
    });
    seedInternal(state, "square_original", original);
    const result = await resolveReusableSquareSource(
      {
        kind: "composition_artifact",
        storeId: STORE_ID,
        campaignId: CAMPAIGN_ID,
        operationId: OPERATION_ID,
        role: "square_original",
        authorization: SYSTEM,
      },
      { client: state.client },
    );

    expect(result.kind).toBe("reusable");
    expect(state.handles.inserts).toHaveLength(0);
  });

  it("returns artifact_indeterminate when the artifact read rejects", async () => {
    const state = createFakeState({ artifactReadThrows: true });
    const result = await resolveReusableSquareSource(
      {
        kind: "composition_artifact",
        storeId: STORE_ID,
        campaignId: CAMPAIGN_ID,
        operationId: OPERATION_ID,
        role: "square_original",
        authorization: SYSTEM,
      },
      { client: state.client },
    );

    expect(result).toEqual({
      kind: "not_reusable",
      reason: "artifact_indeterminate",
    });
    expect(state.handles.downloads).toHaveLength(0);
  });

  it("distinguishes absent, truncated and storage error", async () => {
    const absent = createFakeState();
    const absentRow = artifactRow("square_original", original);
    absent.seedArtifact(absentRow);
    expect(
      await resolveReusableSquareSource(
        {
          kind: "composition_artifact",
          storeId: STORE_ID,
          campaignId: CAMPAIGN_ID,
          operationId: OPERATION_ID,
          role: "square_original",
          authorization: SYSTEM,
        },
        { client: absent.client },
      ),
    ).toEqual({ kind: "not_reusable", reason: "artifact_absent" });

    const truncatedState = createFakeState();
    seedInternal(truncatedState, "square_original", truncated);
    expect(
      await resolveReusableSquareSource(
        {
          kind: "composition_artifact",
          storeId: STORE_ID,
          campaignId: CAMPAIGN_ID,
          operationId: OPERATION_ID,
          role: "square_original",
          authorization: SYSTEM,
        },
        { client: truncatedState.client },
      ),
    ).toEqual({ kind: "not_reusable", reason: "artifact_invalid" });

    const errorState = createFakeState();
    seedInternal(errorState, "square_original", original);
    errorState.setDownloadError(COMPOSITION_ARTIFACT_BUCKET, {
      statusCode: "403",
      message: "Forbidden",
    });
    expect(
      await resolveReusableSquareSource(
        {
          kind: "composition_artifact",
          storeId: STORE_ID,
          campaignId: CAMPAIGN_ID,
          operationId: OPERATION_ID,
          role: "square_original",
          authorization: SYSTEM,
        },
        { client: errorState.client },
      ),
    ).toEqual({ kind: "not_reusable", reason: "artifact_indeterminate" });
  });
});

describe("resolveReusableSquareSource — delivered campaigns", () => {
  it("accepts the three canonical legacy paths", async () => {
    for (const path of [LEGACY_PATH, V2_PATH, V3_PATH]) {
      const state = createFakeState({
        campaign: { status: "ready", storage_path: path, input_snapshot: {} },
      });
      state.addObject(CAMPAIGN_IMAGES_BUCKET, path, legacy);

      const result = await resolveReusableSquareSource(
        {
          kind: "legacy_campaign",
          storeId: STORE_ID,
          campaignId: CAMPAIGN_ID,
          authorization: SYSTEM,
        },
        { client: state.client },
      );

      expect(result.kind).toBe("reusable");
      if (result.kind === "reusable") {
        expect(result.source.origin).toBe("legacy_campaign");
        expect(result.source.storagePath).toBe(path);
        expect(result.source.width).toBe(1080);
        expect(result.source.checksumSha256).toBe(computeChecksumSha256(legacy));
      }
      expect(state.handles.inserts).toHaveLength(0);
    }
  });

  it("rejects legacy paths with extra suffix or segment", async () => {
    for (const path of [
      `${STORE_ID}/${CAMPAIGN_ID}.jpg.extra`,
      `${STORE_ID}/${CAMPAIGN_ID}/extra.jpg`,
    ]) {
      const state = createFakeState({
        campaign: { status: "ready", storage_path: path, input_snapshot: {} },
      });
      state.addObject(CAMPAIGN_IMAGES_BUCKET, path, legacy);
      const result = await resolveReusableSquareSource(
        {
          kind: "legacy_campaign",
          storeId: STORE_ID,
          campaignId: CAMPAIGN_ID,
          authorization: SYSTEM,
        },
        { client: state.client },
      );
      expect(result).toEqual({
        kind: "not_reusable",
        reason: "path_not_canonical",
      });
      expect(state.handles.downloads).toHaveLength(0);
    }
  });

  it("rejects 1024 bytes under a legacy path as unsupported_dimensions", async () => {
    const state = createFakeState({
      campaign: {
        status: "ready",
        storage_path: LEGACY_PATH,
        input_snapshot: {},
      },
    });
    state.addObject(CAMPAIGN_IMAGES_BUCKET, LEGACY_PATH, newFlow);
    const result = await resolveReusableSquareSource(
      {
        kind: "legacy_campaign",
        storeId: STORE_ID,
        campaignId: CAMPAIGN_ID,
        authorization: SYSTEM,
      },
      { client: state.client },
    );

    expect(result).toEqual({
      kind: "not_reusable",
      reason: "unsupported_dimensions",
    });
  });

  it("rejects an arbitrary path before downloading", async () => {
    const state = createFakeState({
      campaign: {
        status: "ready",
        storage_path: "arbitrary/source.jpg",
        input_snapshot: {},
      },
    });
    state.addObject(CAMPAIGN_IMAGES_BUCKET, "arbitrary/source.jpg", legacy);
    const result = await resolveReusableSquareSource(
      {
        kind: "legacy_campaign",
        storeId: STORE_ID,
        campaignId: CAMPAIGN_ID,
        authorization: SYSTEM,
      },
      { client: state.client },
    );

    expect(result).toEqual({
      kind: "not_reusable",
      reason: "path_not_canonical",
    });
    expect(state.handles.downloads).toHaveLength(0);
  });

  it("accepts the new 1:1 flow and rejects 1080 bytes there", async () => {
    const ok = createFakeState({
      campaign: {
        status: "ready",
        storage_path: NEW_FLOW_PATH,
        input_snapshot: {},
      },
    });
    ok.addObject(CAMPAIGN_IMAGES_BUCKET, NEW_FLOW_PATH, newFlow);
    const accepted = await resolveReusableSquareSource(
      {
        kind: "new_flow_1_1",
        storeId: STORE_ID,
        campaignId: CAMPAIGN_ID,
        authorization: SYSTEM,
      },
      { client: ok.client },
    );
    expect(accepted.kind).toBe("reusable");
    if (accepted.kind === "reusable") {
      expect(accepted.source.origin).toBe("new_flow_1_1");
      expect(accepted.source.width).toBe(1024);
    }

    const wrong = createFakeState({
      campaign: {
        status: "ready",
        storage_path: NEW_FLOW_PATH,
        input_snapshot: {},
      },
    });
    wrong.addObject(CAMPAIGN_IMAGES_BUCKET, NEW_FLOW_PATH, legacy);
    expect(
      await resolveReusableSquareSource(
        {
          kind: "new_flow_1_1",
          storeId: STORE_ID,
          campaignId: CAMPAIGN_ID,
          authorization: SYSTEM,
        },
        { client: wrong.client },
      ),
    ).toEqual({ kind: "not_reusable", reason: "unsupported_dimensions" });
  });

  it("rejects non-ready campaigns and non-square campaigns", async () => {
    for (const status of ["generating", "error"]) {
      const state = createFakeState({
        campaign: { status, storage_path: LEGACY_PATH, input_snapshot: {} },
      });
      state.addObject(CAMPAIGN_IMAGES_BUCKET, LEGACY_PATH, legacy);
      expect(
        await resolveReusableSquareSource(
          {
            kind: "legacy_campaign",
            storeId: STORE_ID,
            campaignId: CAMPAIGN_ID,
            authorization: SYSTEM,
          },
          { client: state.client },
        ),
      ).toEqual({ kind: "not_reusable", reason: "campaign_not_ready" });
    }

    const vertical = createFakeState({
      campaign: {
        status: "ready",
        storage_path: LEGACY_PATH,
        input_snapshot: {
          campaignFormat: "9:16",
          formatContractVersion: "f59-vertical-9-16-v1",
        },
      },
    });
    vertical.addObject(CAMPAIGN_IMAGES_BUCKET, LEGACY_PATH, legacy);
    expect(
      await resolveReusableSquareSource(
        {
          kind: "legacy_campaign",
          storeId: STORE_ID,
          campaignId: CAMPAIGN_ID,
          authorization: SYSTEM,
        },
        { client: vertical.client },
      ),
    ).toEqual({ kind: "not_reusable", reason: "format_not_square" });
  });

  it("rejects another user's store and another store's campaign", async () => {
    const owner = createFakeState({
      campaign: { status: "ready", storage_path: LEGACY_PATH, input_snapshot: {} },
    });
    owner.addObject(CAMPAIGN_IMAGES_BUCKET, LEGACY_PATH, legacy);
    expect(
      await resolveReusableSquareSource(
        {
          kind: "legacy_campaign",
          storeId: STORE_ID,
          campaignId: CAMPAIGN_ID,
          authorization: { kind: "owner", userId: "other-user" },
        },
        { client: owner.client },
      ),
    ).toEqual({ kind: "not_reusable", reason: "not_owner" });
    expect(owner.handles.downloads).toHaveLength(0);

    const otherStore = createFakeState({
      campaign: { status: "ready", storage_path: LEGACY_PATH, input_snapshot: {} },
    });
    otherStore.addObject(CAMPAIGN_IMAGES_BUCKET, LEGACY_PATH, legacy);
    expect(
      await resolveReusableSquareSource(
        {
          kind: "legacy_campaign",
          storeId: OTHER_STORE_ID,
          campaignId: CAMPAIGN_ID,
          authorization: SYSTEM,
        },
        { client: otherStore.client },
      ),
    ).toEqual({ kind: "not_reusable", reason: "store_mismatch" });
    expect(otherStore.handles.downloads).toHaveLength(0);
  });

  it("distinguishes absent, truncated and storage error", async () => {
    const absent = createFakeState({
      campaign: { status: "ready", storage_path: LEGACY_PATH, input_snapshot: {} },
    });
    expect(
      await resolveReusableSquareSource(
        {
          kind: "legacy_campaign",
          storeId: STORE_ID,
          campaignId: CAMPAIGN_ID,
          authorization: SYSTEM,
        },
        { client: absent.client },
      ),
    ).toEqual({ kind: "not_reusable", reason: "artifact_absent" });

    const truncatedState = createFakeState({
      campaign: { status: "ready", storage_path: LEGACY_PATH, input_snapshot: {} },
    });
    truncatedState.addObject(CAMPAIGN_IMAGES_BUCKET, LEGACY_PATH, truncated);
    expect(
      await resolveReusableSquareSource(
        {
          kind: "legacy_campaign",
          storeId: STORE_ID,
          campaignId: CAMPAIGN_ID,
          authorization: SYSTEM,
        },
        { client: truncatedState.client },
      ),
    ).toEqual({ kind: "not_reusable", reason: "artifact_invalid" });

    const errorState = createFakeState({
      campaign: { status: "ready", storage_path: LEGACY_PATH, input_snapshot: {} },
    });
    errorState.addObject(CAMPAIGN_IMAGES_BUCKET, LEGACY_PATH, legacy);
    errorState.setDownloadError(CAMPAIGN_IMAGES_BUCKET, {
      statusCode: "500",
      message: "Server error",
    });
    expect(
      await resolveReusableSquareSource(
        {
          kind: "legacy_campaign",
          storeId: STORE_ID,
          campaignId: CAMPAIGN_ID,
          authorization: SYSTEM,
        },
        { client: errorState.client },
      ),
    ).toEqual({ kind: "not_reusable", reason: "artifact_indeterminate" });
  });
});

describe("validateDeliveredCampaignSource", () => {
  it("rejects a composition_artifact descriptor", async () => {
    const state = createFakeState();
    const result = await validateDeliveredCampaignSource(
      {
        origin: "composition_artifact" as unknown as "legacy_campaign",
        storeId: STORE_ID,
        campaignId: CAMPAIGN_ID,
        storagePath: LEGACY_PATH,
      },
      SYSTEM,
      { client: state.client },
    );

    expect(result).toEqual({
      ok: false,
      reason: "source_origin_invalid",
    });
    expect(state.handles.downloads).toHaveLength(0);
  });

  it("rejects a complete descriptor with divergent checksum", async () => {
    const state = createFakeState({
      campaign: { status: "ready", storage_path: LEGACY_PATH, input_snapshot: {} },
    });
    state.addObject(CAMPAIGN_IMAGES_BUCKET, LEGACY_PATH, legacy);
    const result = await validateDeliveredCampaignSource(
      {
        origin: "legacy_campaign",
        storeId: STORE_ID,
        campaignId: CAMPAIGN_ID,
        storagePath: LEGACY_PATH,
        width: 1080,
        height: 1080,
        mimeType: "image/jpeg",
        byteSize: legacy.byteLength,
        checksumSha256: "b".repeat(64),
      },
      SYSTEM,
      { client: state.client },
    );

    expect(result).toEqual({ ok: false, reason: "metadata_conflict" });
  });
});

describe("full flow — current 1:1 campaign to square_prepared", () => {
  it("creates once and reuses on repetition without a fictitious source row", async () => {
    const state = createFakeState({
      campaign: {
        status: "ready",
        storage_path: NEW_FLOW_PATH,
        input_snapshot: {},
      },
    });
    state.addObject(CAMPAIGN_IMAGES_BUCKET, NEW_FLOW_PATH, newFlow);

    const resolved = await resolveReusableSquareSource(
      {
        kind: "new_flow_1_1",
        storeId: STORE_ID,
        campaignId: CAMPAIGN_ID,
        authorization: SYSTEM,
      },
      { client: state.client },
    );
    expect(resolved.kind).toBe("reusable");
    if (resolved.kind !== "reusable") return;
    const descriptor: ReusableSquareSource = resolved.source;

    const preparedIdentity: ArtifactIdentity = {
      storeId: STORE_ID,
      campaignId: CAMPAIGN_ID,
      operationId: PREP_OPERATION_ID,
      role: "square_prepared",
    };
    const input = {
      identity: preparedIdentity,
      authorization: SYSTEM,
      bytes: prepared,
      origin: "deterministic_preparation" as const,
      source: { kind: "delivered_campaign_source" as const, descriptor },
      provenance: {},
    };

    const first = await persistCompositionArtifact(input, {
      client: state.client,
    });
    expect(first).toEqual({ kind: "created" });

    const artifactRows = state.rows.filter(
      (row) => row.__table === "campaign_composition_artifacts",
    );
    expect(artifactRows).toHaveLength(1);
    expect(artifactRows[0]).toMatchObject({
      source_campaign_id: CAMPAIGN_ID,
      derived_from_artifact_id: null,
      origin: "deterministic_preparation",
      role: "square_prepared",
    });
    const provenance = artifactRows[0].provenance as Record<string, unknown>;
    expect(provenance.sourceOrigin).toBe("new_flow_1_1");
    expect(provenance.sourceChecksumSha256).toBe(computeChecksumSha256(newFlow));
    expect(provenance.sourceStoragePath).toBe(NEW_FLOW_PATH);

    // Nenhuma linha fictícia para a campanha de origem: continua só a campanha
    // semeada e o derivado.
    expect(
      state.rows.filter((row) => row.__table === "campaigns"),
    ).toHaveLength(1);
    expect(state.handles.inserts).toHaveLength(1);
    expect(state.handles.uploads).toHaveLength(1);

    const second = await persistCompositionArtifact(input, {
      client: state.client,
    });
    expect(second).toEqual({ kind: "reused", adoption: false });
    expect(state.handles.inserts).toHaveLength(1);
    expect(state.handles.uploads).toHaveLength(1);
    expect(state.handles.signed).toBe(0);
  });
});
