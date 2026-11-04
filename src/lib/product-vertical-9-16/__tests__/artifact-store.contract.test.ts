// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import sharp from "sharp";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import {
  VerticalArtifactStore,
  type VerticalStoreDeps,
} from "../artifact/artifact-store";
import { artifactStoragePath } from "../artifact/artifact-path";
import { VerticalArtifactError } from "../artifact/types";
import type { ThumbnailContext } from "@/lib/campaign/thumbnail/thumbnail-generator";

const STORE = "11111111-1111-4111-8111-111111111111";
const CAMPAIGN = "22222222-2222-4222-8222-222222222222";
const OPERATION = "33333333-3333-4333-8333-333333333333";
const PATH = artifactStoragePath(STORE, CAMPAIGN, OPERATION);

async function providerPng(): Promise<Buffer> {
  return sharp({
    create: {
      width: 1152,
      height: 2048,
      channels: 3,
      background: { r: 200, g: 40, b: 40 },
    },
  })
    .png()
    .toBuffer();
}

async function deliveredJpeg(width = 1080, height = 1920): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 200, g: 40, b: 40 },
    },
  })
    .jpeg({ quality: 90 })
    .toBuffer();
}

function dataUrl(buffer: Buffer, mime = "image/png"): string {
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

interface FakeOverrides {
  uploadError?: { message?: string; statusCode?: string | number } | null;
  insertError?: { message?: string } | null;
  downloadData?: Buffer | null;
  downloadError?: { message?: string; statusCode?: string | number } | null;
  downloadThrows?: unknown;
  signError?: { message?: string } | null;
}

function fakeClient(overrides: FakeOverrides = {}) {
  const uploads: Array<{ bucket: string; path: string; opts: unknown; buffer: Buffer }> = [];
  const inserts: Array<{ table: string; row: Record<string, unknown> }> = [];
  const downloads: string[] = [];
  const signed: Array<{ path: string; ttl: number }> = [];

  const client = {
    storage: {
      from(bucket: string) {
        return {
          async upload(path: string, buffer: Buffer, opts: unknown) {
            uploads.push({ bucket, path, opts, buffer });
            return { error: overrides.uploadError ?? null };
          },
          async download(path: string) {
            downloads.push(path);
            if (overrides.downloadThrows) throw overrides.downloadThrows;
            if (overrides.downloadError) {
              return { data: null, error: overrides.downloadError };
            }
            return {
              data: overrides.downloadData ?? null,
              error: null,
            };
          },
          async createSignedUrl(path: string, ttl: number) {
            signed.push({ path, ttl });
            return {
              data: { signedUrl: `https://signed/${path}` },
              error: overrides.signError ?? null,
            };
          },
        };
      },
    },
    from(table: string) {
      return {
        async insert(row: Record<string, unknown>) {
          inserts.push({ table, row });
          return { error: overrides.insertError ?? null };
        },
      };
    },
  };

  return { client, uploads, inserts, downloads, signed };
}

function store(client: unknown, deps: Partial<VerticalStoreDeps> = {}) {
  return new VerticalArtifactStore({
    client: client as never,
    thumbnailContext: null,
    ...deps,
  });
}

describe("F59 — store do artefato vertical", () => {
  it("grava upload imutável no path vertical e metadados decodificados", async () => {
    const fake = fakeClient();
    const result = await store(fake.client).storeArtifact({
      storeId: STORE,
      campaignId: CAMPAIGN,
      operationId: OPERATION,
      imageDataUrl: dataUrl(await providerPng()),
    });

    expect(result).toMatchObject({
      storagePath: PATH,
      width: 1080,
      height: 1920,
      mimeType: "image/jpeg",
      sourceWidth: 1152,
      sourceHeight: 2048,
    });
    expect(fake.uploads).toHaveLength(1);
    expect(fake.uploads[0].bucket).toBe("campaign-images");
    expect(fake.uploads[0].path).toBe(PATH);
    expect(fake.uploads[0].opts).toEqual({
      contentType: "image/jpeg",
      upsert: false,
    });
    expect(fake.inserts).toHaveLength(1);
    expect(fake.inserts[0]).toEqual({
      table: "product_1_1_campaign_artifacts",
      row: {
        campaign_id: CAMPAIGN,
        operation_id: OPERATION,
        storage_path: PATH,
        width: 1080,
        height: 1920,
        mime_type: "image/jpeg",
      },
    });
  });

  it("fonte fora de 1152×2048 falha fechada antes do upload", async () => {
    const fake = fakeClient();
    const square = await sharp({
      create: { width: 1024, height: 1024, channels: 3, background: "#fff" },
    })
      .png()
      .toBuffer();
    await expect(
      store(fake.client).storeArtifact({
        storeId: STORE,
        campaignId: CAMPAIGN,
        operationId: OPERATION,
        imageDataUrl: dataUrl(square),
      }),
    ).rejects.toMatchObject({ code: "artifact_upload_failed" });
    expect(fake.uploads).toHaveLength(0);
    expect(fake.inserts).toHaveLength(0);
  });

  it("conflito de path vira artifact_path_conflict sem insert", async () => {
    const fake = fakeClient({
      uploadError: { message: "The resource already exists", statusCode: 409 },
    });
    await expect(
      store(fake.client).storeArtifact({
        storeId: STORE,
        campaignId: CAMPAIGN,
        operationId: OPERATION,
        imageDataUrl: dataUrl(await providerPng()),
      }),
    ).rejects.toMatchObject({ code: "artifact_path_conflict" });
    expect(fake.inserts).toHaveLength(0);
  });

  it("falha de insert após upload vira artifact_metadata_persist_failed", async () => {
    const fake = fakeClient({ insertError: { message: "insert boom" } });
    await expect(
      store(fake.client).storeArtifact({
        storeId: STORE,
        campaignId: CAMPAIGN,
        operationId: OPERATION,
        imageDataUrl: dataUrl(await providerPng()),
      }),
    ).rejects.toMatchObject({ code: "artifact_metadata_persist_failed" });
    expect(fake.uploads).toHaveLength(1);
  });

  it("probe integral não assina URL", async () => {
    const fake = fakeClient({ downloadData: await deliveredJpeg() });
    const result = await store(fake.client).probeArtifact({
      storeId: STORE,
      campaignId: CAMPAIGN,
      operationId: OPERATION,
    });

    expect(result).toMatchObject({
      kind: "integral",
      width: 1080,
      height: 1920,
      mimeType: "image/jpeg",
      storagePath: PATH,
    });
    expect(fake.signed).toHaveLength(0);
    expect(fake.downloads).toEqual([PATH]);
  });

  it("probe 1024×1024 no path vertical é invalid", async () => {
    const fake = fakeClient({ downloadData: await deliveredJpeg(1024, 1024) });
    const result = await store(fake.client).probeArtifact({
      storeId: STORE,
      campaignId: CAMPAIGN,
      operationId: OPERATION,
    });
    expect(result).toEqual({ kind: "invalid" });
  });

  it("probe de objeto ausente é absent; erro de bucket/rede é indeterminate", async () => {
    const absent = fakeClient({
      downloadError: { message: "Object not found", statusCode: 404 },
    });
    await expect(
      store(absent.client).probeArtifact({
        storeId: STORE,
        campaignId: CAMPAIGN,
        operationId: OPERATION,
      }),
    ).resolves.toEqual({ kind: "absent" });

    const bucket = fakeClient({
      downloadError: { message: "Bucket not found", statusCode: 404 },
    });
    await expect(
      store(bucket.client).probeArtifact({
        storeId: STORE,
        campaignId: CAMPAIGN,
        operationId: OPERATION,
      }),
    ).resolves.toEqual({ kind: "indeterminate" });

    const network = fakeClient({ downloadThrows: new Error("socket reset") });
    await expect(
      store(network.client).probeArtifact({
        storeId: STORE,
        campaignId: CAMPAIGN,
        operationId: OPERATION,
      }),
    ).resolves.toEqual({ kind: "indeterminate" });
  });

  it("download recusa path não vertical", async () => {
    const fake = fakeClient({ downloadData: await deliveredJpeg() });
    await expect(
      store(fake.client).downloadArtifact(
        `${STORE}/${CAMPAIGN}/product-1-1/${OPERATION}/art-1024.jpg`,
      ),
    ).rejects.toMatchObject({ code: "artifact_invalid_path" });
  });

  it("download valida bytes JPEG 1080×1920", async () => {
    const fake = fakeClient({ downloadData: await deliveredJpeg() });
    const result = await store(fake.client).downloadArtifact(PATH);
    expect(result.mimeType).toBe("image/jpeg");
    expect(result.buffer.length).toBeGreaterThan(0);
  });

  it("URL assinada é separada e recusa path 1:1", async () => {
    const fake = fakeClient();
    const instance = store(fake.client);
    const url = await instance.getSignedArtifactUrl(PATH, 120);
    expect(url).toContain(PATH);
    expect(fake.signed).toEqual([{ path: PATH, ttl: 120 }]);
    expect(fake.downloads).toHaveLength(0);

    await expect(
      instance.getSignedArtifactUrl(
        `${STORE}/${CAMPAIGN}/product-1-1/${OPERATION}/art-1024.jpg`,
      ),
    ).rejects.toMatchObject({ code: "artifact_invalid_path" });
    expect(fake.signed).toHaveLength(1);
  });

  it("falha da miniatura não lança nem altera o ref", async () => {
    const uploader = {
      endpoint: "http://127.0.0.1:54321",
      upload: vi.fn(async () => {
        throw new Error("thumbnail boom");
      }),
    };
    const thumbnailContext: ThumbnailContext = {
      endpoint: "http://127.0.0.1:54321",
      uploader,
    };
    const fake = fakeClient();
    const result = await store(fake.client, { thumbnailContext }).storeArtifact({
      storeId: STORE,
      campaignId: CAMPAIGN,
      operationId: OPERATION,
      imageDataUrl: dataUrl(await providerPng()),
    });

    expect(result.storagePath).toBe(PATH);
    expect(uploader.upload).toHaveBeenCalledTimes(1);
    expect(fake.inserts).toHaveLength(1);
  });

  it("expõe erro tipado VerticalArtifactError", async () => {
    await expect(
      store(fakeClient()).downloadArtifact("arbitrary/path.jpg"),
    ).rejects.toBeInstanceOf(VerticalArtifactError);
  });
});
