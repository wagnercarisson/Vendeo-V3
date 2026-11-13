// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));
vi.mock("@/lib/campaign/composition-artifacts/retrieve", () => ({
  retrieveCompositionArtifact: vi.fn(async () => ({
    kind: "integral",
    artifact: { storagePath: "s/c/o/vertical.jpg" },
    bytes: Buffer.from("vertical-bytes"),
  })),
}));

import { nineSixteenVerticalAccess } from "../vertical-access";
import type { VerticalArtifactProbe } from "../../two-stage-financial-service";

const STORE = "11111111-1111-4111-8111-111111111111";
const CAMPAIGN = "22222222-2222-4222-8222-222222222222";
const OPERATION = "33333333-3333-4333-8333-333333333333";
const VERTICAL = `${STORE}/${CAMPAIGN}/${OPERATION}/vertical.jpg`;

function twoStageSnapshot() {
  return {
    generationOrigin: "9_16_two_stage",
    generationContractVersion: "f60.5-two-stage-9-16-v1",
  };
}

function makeClient(options: {
  campaign?: unknown;
  credit?: unknown;
  signed?: string[];
} = {}) {
  const signed = options.signed ?? [];
  const client = {
    from(table: string) {
      const builder = {
        select: () => builder,
        eq: () => builder,
        maybeSingle: async () => {
          if (table === "campaigns") {
            return {
              data:
                options.campaign === undefined
                  ? {
                      store_id: STORE,
                      input_snapshot: twoStageSnapshot(),
                    }
                  : options.campaign,
              error: null,
            };
          }
          if (table === "product_1_1_campaign_credit_operations") {
            return {
              data:
                options.credit === undefined
                  ? { status: "delivered", store_id: STORE }
                  : options.credit,
              error: null,
            };
          }
          return { data: null, error: null };
        },
      };
      return builder;
    },
    storage: {
      from(bucket: string) {
        return {
          createSignedUrl: async (path: string) => {
            signed.push(`${bucket}:${path}`);
            return { data: { signedUrl: `https://signed/${path}` }, error: null };
          },
        };
      },
    },
  };
  return { client: client as never, signed };
}

const integralProbe: VerticalArtifactProbe = {
  probeVerticalArtifact: vi.fn(async () => ({
    kind: "integral" as const,
    format: "9:16" as const,
    width: 1080 as const,
    height: 1920 as const,
    mimeType: "image/jpeg" as const,
    storagePath: VERTICAL,
    evidenceRef: "ref",
  })),
};

function access(
  mode: "preview" | "thumbnail" | "download",
  options: Parameters<typeof makeClient>[0] = {},
  probe: VerticalArtifactProbe = integralProbe,
) {
  const backend = makeClient(options);
  return {
    ...backend,
    run: nineSixteenVerticalAccess(
      { storeId: STORE, campaignId: CAMPAIGN, operationId: OPERATION, mode },
      { client: backend.client, probe },
    ),
  };
}

describe("nineSixteenVerticalAccess", () => {
  it("signs the original only after delivered and only for the vertical role", async () => {
    const { run, signed } = access("preview");
    await expect(run).resolves.toMatchObject({
      kind: "previewUrl",
      expiresInSeconds: 300,
    });
    expect(signed).toEqual([`campaign-internal-artifacts:${VERTICAL}`]);
  });

  it("returns not_delivered before signing", async () => {
    const { run, signed } = access("preview", {
      credit: { status: "reserved", store_id: STORE },
    });
    await expect(run).resolves.toEqual({
      kind: "not_available",
      reason: "not_delivered",
    });
    expect(signed).toHaveLength(0);
  });

  it("maps absent campaign and origin mismatch", async () => {
    const missing = access("preview", { campaign: null });
    await expect(missing.run).resolves.toEqual({
      kind: "not_available",
      reason: "not_found",
    });

    const historical = access("preview", {
      campaign: { store_id: STORE, input_snapshot: {} },
    });
    await expect(historical.run).resolves.toEqual({
      kind: "not_available",
      reason: "origin_mismatch",
    });
    expect(historical.signed).toHaveLength(0);
  });

  it("maps invalid and indeterminate probes", async () => {
    const invalid = access("download", {}, {
      probeVerticalArtifact: vi.fn(async () => ({ kind: "invalid" as const })),
    });
    await expect(invalid.run).resolves.toEqual({
      kind: "not_available",
      reason: "artifact_incompatible",
    });

    const indeterminate = access("preview", {}, {
      probeVerticalArtifact: vi.fn(async () => ({ kind: "indeterminate" as const })),
    });
    await expect(indeterminate.run).resolves.toEqual({
      kind: "not_available",
      reason: "indeterminate",
    });
  });

  it("signs the derived thumbnail in campaign-images", async () => {
    const { run, signed } = access("thumbnail");
    await expect(run).resolves.toMatchObject({ kind: "thumbnailUrl" });
    expect(signed).toEqual([
      `campaign-images:${STORE}/${CAMPAIGN}/${OPERATION}/vertical.thumb-v1.webp`,
    ]);
  });

  it("returns the original bytes for download", async () => {
    const { run, signed } = access("download");
    await expect(run).resolves.toMatchObject({
      kind: "downloadBytes",
      mimeType: "image/jpeg",
    });
    expect(signed).toHaveLength(0);
  });
});
