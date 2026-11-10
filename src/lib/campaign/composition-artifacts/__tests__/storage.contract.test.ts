// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  CAMPAIGN_IMAGES_BUCKET,
  CompositionArtifactStorage,
} from "../storage";
import { COMPOSITION_ARTIFACT_BUCKET } from "../artifact-path";
import { COMPOSITION_EVIDENCE_METADATA_KEY } from "../evidence";

interface FakeHandles {
  buckets: string[];
  uploads: { bucket: string; path: string; options: Record<string, unknown> }[];
  signed: number;
  removed: number;
  updated: number;
  listed: number;
}

function createFakeClient(options: {
  download?: { data?: unknown; error?: unknown; throws?: unknown };
  info?: { data?: unknown; error?: unknown; throws?: unknown };
  upload?: { error?: unknown };
}): { client: SupabaseClient; handles: FakeHandles } {
  const handles: FakeHandles = {
    buckets: [],
    uploads: [],
    signed: 0,
    removed: 0,
    updated: 0,
    listed: 0,
  };

  const client = {
    storage: {
      from(bucket: string) {
        handles.buckets.push(bucket);
        return {
          download: vi.fn(async () => {
            if (options.download?.throws !== undefined) throw options.download.throws;
            return {
              data: options.download?.data ?? null,
              error: options.download?.error ?? null,
            };
          }),
          info: vi.fn(async () => {
            if (options.info?.throws !== undefined) throw options.info.throws;
            return {
              data: options.info?.data ?? null,
              error: options.info?.error ?? null,
            };
          }),
          upload: vi.fn(async (path: string, _bytes: Buffer, opts: Record<string, unknown>) => {
            handles.uploads.push({ bucket, path, options: opts });
            return { data: null, error: options.upload?.error ?? null };
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
            handles.removed += 1;
            return { data: null, error: null };
          }),
          update: vi.fn(async () => {
            handles.updated += 1;
            return { data: null, error: null };
          }),
          list: vi.fn(async () => {
            handles.listed += 1;
            return { data: [], error: null };
          }),
        };
      },
    },
  } as unknown as SupabaseClient;

  return { client, handles };
}

function objectNotFound(): { statusCode: string; message: string } {
  return { statusCode: "404", message: "Object not found" };
}

describe("CompositionArtifactStorage.downloadBytes", () => {
  it("reads bytes from the internal bucket and from campaign-images", async () => {
    const { client } = createFakeClient({
      download: { data: Buffer.from("bytes"), error: null },
    });
    const storage = new CompositionArtifactStorage(client);
    const internal = await storage.downloadBytes("path");
    const source = await storage.downloadBytes("path", CAMPAIGN_IMAGES_BUCKET);

    expect(internal).toEqual({ kind: "bytes", bytes: Buffer.from("bytes") });
    expect(source).toEqual({ kind: "bytes", bytes: Buffer.from("bytes") });
  });

  it("classifies proven object absence versus indeterminate errors", async () => {
    const absent = new CompositionArtifactStorage(
      createFakeClient({ download: { error: objectNotFound() } }).client,
    );
    expect(await absent.downloadBytes("path")).toEqual({ kind: "absent" });

    for (const error of [
      { statusCode: "404", message: "Bucket not found" },
      { statusCode: "403", message: "Forbidden" },
      { statusCode: "500", message: "Server error" },
    ]) {
      const storage = new CompositionArtifactStorage(
        createFakeClient({ download: { error } }).client,
      );
      expect(await storage.downloadBytes("path")).toEqual({
        kind: "indeterminate",
      });
    }

    const throwing = new CompositionArtifactStorage(
      createFakeClient({ download: { throws: new Error("timeout") } }).client,
    );
    expect(await throwing.downloadBytes("path")).toEqual({
      kind: "indeterminate",
    });
  });
});

describe("CompositionArtifactStorage.readObjectInfo", () => {
  it("normalizes camelized evidence metadata back to snake_case", async () => {
    const payload = { evidence: { v: 1 }, evidenceDigest: "a".repeat(64) };
    const { client } = createFakeClient({
      info: {
        data: {
          metadata: {
            vendeoCompositionArtifact: payload,
            other: "kept",
          },
        },
        error: null,
      },
    });
    const storage = new CompositionArtifactStorage(client);
    const result = await storage.readObjectInfo("path", CAMPAIGN_IMAGES_BUCKET);

    expect(result.kind).toBe("found");
    if (result.kind === "found") {
      const metadata = result.metadata as Record<string, unknown>;
      expect(metadata[COMPOSITION_EVIDENCE_METADATA_KEY]).toEqual(payload);
      expect(metadata).not.toHaveProperty("vendeoCompositionArtifact");
      expect(metadata.other).toBe("kept");
    }
  });

  it("accepts the snake_case form and classifies absence/indeterminate", async () => {
    const payload = { evidence: { v: 1 }, evidenceDigest: "a".repeat(64) };
    const snake = new CompositionArtifactStorage(
      createFakeClient({
        info: { data: { metadata: { [COMPOSITION_EVIDENCE_METADATA_KEY]: payload } }, error: null },
      }).client,
    );
    const result = await snake.readObjectInfo("path");
    expect(result.kind).toBe("found");
    if (result.kind === "found") {
      expect((result.metadata as Record<string, unknown>)[COMPOSITION_EVIDENCE_METADATA_KEY]).toEqual(payload);
    }

    const absent = new CompositionArtifactStorage(
      createFakeClient({ info: { error: objectNotFound() } }).client,
    );
    expect(await absent.readObjectInfo("path")).toEqual({ kind: "absent" });

    const indeterminate = new CompositionArtifactStorage(
      createFakeClient({ info: { error: { statusCode: "403", message: "Forbidden" } } }).client,
    );
    expect(await indeterminate.readObjectInfo("path")).toEqual({
      kind: "indeterminate",
    });
  });
});

describe("CompositionArtifactStorage.uploadImmutable", () => {
  it("uploads only to the internal bucket with upsert:false and metadata", async () => {
    const { client, handles } = createFakeClient({});
    const storage = new CompositionArtifactStorage(client);
    const metadata = { vendeo_composition_artifact: { evidence: {}, evidenceDigest: "a".repeat(64) } };
    const result = await storage.uploadImmutable("path", Buffer.from("bytes"), metadata);

    expect(result).toEqual({ kind: "uploaded" });
    expect(handles.uploads).toHaveLength(1);
    expect(handles.uploads[0]).toMatchObject({
      bucket: COMPOSITION_ARTIFACT_BUCKET,
      path: "path",
      options: {
        contentType: "image/jpeg",
        upsert: false,
        metadata,
      },
    });
    expect(handles.signed).toBe(0);
    expect(handles.removed).toBe(0);
    expect(handles.updated).toBe(0);
    expect(handles.listed).toBe(0);
  });

  it("classifies path conflict and generic upload failure", async () => {
    const conflict = new CompositionArtifactStorage(
      createFakeClient({ upload: { error: { statusCode: "409", message: "already exists" } } }).client,
    );
    expect(
      await conflict.uploadImmutable("path", Buffer.from("x"), {}),
    ).toEqual({ kind: "path_conflict" });

    const failed = new CompositionArtifactStorage(
      createFakeClient({ upload: { error: { statusCode: "500", message: "boom" } } }).client,
    );
    expect(await failed.uploadImmutable("path", Buffer.from("x"), {})).toEqual({
      kind: "upload_failed",
      message: "boom",
    });
  });
});
