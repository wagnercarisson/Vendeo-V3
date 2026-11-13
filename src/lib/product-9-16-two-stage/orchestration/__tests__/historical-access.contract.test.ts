// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import { historicalVerticalAccess } from "../historical-access";
import type { VerticalArtifactStore } from "@/lib/product-vertical-9-16/artifact/artifact-store";

const STORE = "11111111-1111-4111-8111-111111111111";
const CAMPAIGN = "22222222-2222-4222-8222-222222222222";
const OPERATION = "33333333-3333-4333-8333-333333333333";
const VERTICAL = `${STORE}/${CAMPAIGN}/product-9-16/${OPERATION}/art-1080x1920.jpg`;

function makeClient(options: { campaign?: unknown } = {}) {
  const signed: string[] = [];
  const client = {
    from() {
      const builder = {
        select: () => builder,
        eq: () => builder,
        maybeSingle: async () => ({
          data:
            options.campaign === undefined
              ? { store_id: STORE, input_snapshot: {} }
              : options.campaign,
          error: null,
        }),
      };
      return builder;
    },
    storage: {
      from(bucket: string) {
        return {
          createSignedUrl: async (path: string) => {
            signed.push(`${bucket}:${path}`);
            return { data: { signedUrl: "https://thumb" }, error: null };
          },
        };
      },
    },
  };
  return { client: client as never, signed };
}

function store(overrides: Partial<VerticalArtifactStore> = {}): VerticalArtifactStore {
  return {
    probeArtifact: vi.fn(async () => ({
      kind: "integral",
      ref: { storagePath: VERTICAL, width: 1080, height: 1920, mimeType: "image/jpeg" },
      width: 1080,
      height: 1920,
      mimeType: "image/jpeg",
      storagePath: VERTICAL,
    })),
    getSignedArtifactUrl: vi.fn(async () => "https://original"),
    downloadArtifact: vi.fn(async () => ({
      buffer: Buffer.from("bytes"),
      mimeType: "image/jpeg" as const,
    })),
    ...overrides,
  } as unknown as VerticalArtifactStore;
}

function run(
  mode: "preview" | "thumbnail" | "download",
  options: { campaign?: unknown; store?: VerticalArtifactStore } = {},
) {
  const backend = makeClient(options);
  return historicalVerticalAccess(
    { storeId: STORE, campaignId: CAMPAIGN, operationId: OPERATION, mode },
    { client: backend.client, store: options.store ?? store() },
  );
}

describe("historicalVerticalAccess", () => {
  it("uses the direct store for preview and download", async () => {
    await expect(run("preview")).resolves.toMatchObject({ kind: "previewUrl" });
    await expect(run("download")).resolves.toMatchObject({
      kind: "downloadBytes",
      mimeType: "image/jpeg",
    });
  });

  it("signs the derived thumbnail in campaign-images", async () => {
    const backend = makeClient();
    const result = await historicalVerticalAccess(
      { storeId: STORE, campaignId: CAMPAIGN, operationId: OPERATION, mode: "thumbnail" },
      { client: backend.client, store: store() },
    );
    expect(result).toMatchObject({ kind: "thumbnailUrl", url: "https://thumb" });
    expect(backend.signed).toEqual([
      `campaign-images:${STORE}/${CAMPAIGN}/product-9-16/${OPERATION}/art-1080x1920.thumb-v1.webp`,
    ]);
  });

  it("refuses a two-stage origin and non-integral art", async () => {
    await expect(
      run("preview", {
        campaign: {
          store_id: STORE,
          input_snapshot: {
            generationOrigin: "9_16_two_stage",
            generationContractVersion: "f60.5-two-stage-9-16-v1",
          },
        },
      }),
    ).resolves.toEqual({ kind: "not_available", reason: "origin_mismatch" });

    await expect(
      run("preview", {
        store: store({
          probeArtifact: vi.fn(async () => ({ kind: "absent" })),
        } as never),
      }),
    ).resolves.toEqual({ kind: "not_available", reason: "not_found" });

    await expect(
      run("preview", {
        store: store({
          probeArtifact: vi.fn(async () => ({ kind: "indeterminate" })),
        } as never),
      }),
    ).resolves.toEqual({ kind: "not_available", reason: "indeterminate" });
  });
});
