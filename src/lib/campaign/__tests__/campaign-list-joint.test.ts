// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/campaign/list", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/campaign/list")>();
  return {
    ...actual,
    generateBatchThumbnailUrls: vi.fn(async () => ({})),
    generateBatchPreferredThumbnailUrls: vi.fn(async () => ({
      "campaign-1": "https://signed/joint",
    })),
  };
});
vi.mock("@/lib/product-two-format/list-summary", () => ({
  readTwoFormatListSummaries: vi.fn(async () => new Map([
    [
      "campaign-1",
      {
        campaignId: "campaign-1",
        operationId: "operation-1",
        formats: { "1:1": "delivered", "9:16": "delivered" },
        preferredFormat: "1:1",
        preferredThumbnailPath:
          "store-1/campaign-1/operation-1/square_original.thumb-v1.webp",
        view: null,
      },
    ],
  ])),
}));

const rows = [
  {
    id: "campaign-1",
    product_name: "Conjunta",
    status: "ready",
    created_at: "2026-11-19T00:00:00.000Z",
    storage_path: "store-1/campaign-1.jpg",
    input_snapshot: {
      campaignFormat: "1:1+9:16",
      formatContractVersion: "f60.7-two-format-v1",
      generationOrigin: "two_format_two_stage",
      generationContractVersion: "f60.7-two-format-v1",
    },
  },
];

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: async () => {
    const query: Record<string, unknown> = {};
    query.select = () => query;
    query.eq = () => query;
    query.in = () => query;
    query.order = () => query;
    query.range = () => query;
    query.then = (resolve: (value: unknown) => unknown) =>
      Promise.resolve({ data: rows, count: rows.length, error: null }).then(resolve);
    return { from: () => query };
  },
  supabaseAdmin: {
    storage: {
      from: () => ({
        createSignedUrl: async (path: string) => ({
          data: { signedUrl: `https://signed/${path}` },
          error: null,
        }),
      }),
    },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("F60.7 C3 — listagem real", () => {
  it("campanha conjunta usa uma única linha com formatos/preferred", async () => {
    const { listCampaigns } = await import("@/lib/campaign/list");
    const result = await listCampaigns("store-1");
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: "campaign-1",
      joint: true,
      formats: { "1:1": "delivered", "9:16": "delivered" },
      preferredFormat: "1:1",
      thumbnailUrl:
        "https://signed/store-1/campaign-1/operation-1/square_original.thumb-v1.webp",
    });
  });
});
