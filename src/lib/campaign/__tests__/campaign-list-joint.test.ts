// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  readSummariesInput: null as unknown,
  admin: {} as {
    storage?: {
      from: () => {
        createSignedUrl: ReturnType<typeof vi.fn>;
        createSignedUrls: ReturnType<typeof vi.fn>;
      };
    };
  },
  createSignedUrl: vi.fn(),
  createSignedUrls: vi.fn(),
  readSummaries: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/product-two-format/list-summary", () => ({
  readTwoFormatListSummaries: h.readSummaries,
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
  supabaseAdmin: h.admin,
}));

beforeEach(() => {
  vi.clearAllMocks();
  h.createSignedUrl.mockResolvedValue({
    data: { signedUrl: "https://signed/legacy" },
    error: null,
  });
  h.createSignedUrls.mockResolvedValue({
    data: [
      {
        path: "store-1/campaign-1/operation-1/square_original.thumb-v1.webp",
        signedUrl: "https://signed/joint",
        error: null,
      },
    ],
    error: null,
  });
  h.admin.storage = {
    from: () => ({
      createSignedUrl: h.createSignedUrl,
      createSignedUrls: h.createSignedUrls,
    }),
  };
  h.readSummaries.mockImplementation(async (input: unknown) => {
    h.readSummariesInput = input;
    return new Map([
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
    ]);
  });
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
      thumbnailUrl: "https://signed/joint",
    });
  });

  it("F61: expõe a apresentação conjunta a partir do summary (view nula, lote)", async () => {
    const { listCampaigns } = await import("@/lib/campaign/list");
    const result = await listCampaigns("store-1");

    expect(result.items[0].formatPresentation).toMatchObject({
      flow: "two_format",
      partial: false,
      anyDelivered: true,
      formats: {
        "1:1": { state: "delivered", refunded: false, active: false },
        "9:16": { state: "delivered", refunded: false, active: false },
      },
    });
  });

  it("usa o cliente privilegiado e não passa conjuntos pela assinatura legada", async () => {
    const { listCampaigns } = await import("@/lib/campaign/list");
    await listCampaigns("store-1");

    expect(h.readSummariesInput).toMatchObject({
      client: h.admin,
      storeId: "store-1",
    });
    expect(h.createSignedUrls).toHaveBeenCalledTimes(1);
    // A assinatura legada (singular) não processa o conjunto.
    expect(h.createSignedUrl).not.toHaveBeenCalled();
  });
});
