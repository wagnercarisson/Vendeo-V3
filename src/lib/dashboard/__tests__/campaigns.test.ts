// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreateServerClient = vi.fn();
const mockGenerateBatchThumbnailUrls = vi.fn();
const mockCountReadyCampaigns = vi.fn();

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: mockCreateServerClient,
  supabaseAdmin: {},
}));

vi.mock("@/lib/campaign/list", () => ({
  generateBatchThumbnailUrls: mockGenerateBatchThumbnailUrls,
}));

vi.mock("@/lib/campaign/metrics", () => ({
  countReadyCampaigns: mockCountReadyCampaigns,
}));

interface Row {
  id: string;
  product_name: string;
  created_at: string;
  storage_path: string;
  input_snapshot: Record<string, unknown> | null;
}

interface QueryChain {
  fromFn: ReturnType<typeof vi.fn>;
  selectFn: ReturnType<typeof vi.fn>;
  eqStoreFn: ReturnType<typeof vi.fn>;
  eqStatusFn: ReturnType<typeof vi.fn>;
  orderFn: ReturnType<typeof vi.fn>;
  limitFn: ReturnType<typeof vi.fn>;
}

function buildChain(
  rows: Row[],
  error: { message: string } | null = null,
): QueryChain {
  const limitFn = vi.fn().mockResolvedValue({ data: rows, error });
  const orderFn = vi.fn().mockReturnValue({ limit: limitFn });
  const eqStatusFn = vi.fn().mockReturnValue({ order: orderFn });
  const eqStoreFn = vi.fn().mockReturnValue({ eq: eqStatusFn });
  const selectFn = vi.fn().mockReturnValue({ eq: eqStoreFn });
  const fromFn = vi.fn().mockReturnValue({ select: selectFn });

  mockCreateServerClient.mockResolvedValue({ from: fromFn });

  return { fromFn, selectFn, eqStoreFn, eqStatusFn, orderFn, limitFn };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGenerateBatchThumbnailUrls.mockResolvedValue({});
});

const rows: Row[] = [
  {
    id: "campaign-1",
    product_name: "Tênis Runner",
    created_at: "2026-07-13T12:00:00Z",
    storage_path: "store-1/campaign-1.jpg",
    input_snapshot: {},
  },
  {
    id: "campaign-2",
    product_name: "Camiseta Dry",
    created_at: "2026-07-12T12:00:00Z",
    storage_path: "store-1/campaign-2.jpg",
    input_snapshot: {
      campaignFormat: "9:16",
      formatContractVersion: "f59-vertical-9-16-v1",
    },
  },
];

describe("DASHBOARD_CAMPAIGN_LIMIT", () => {
  it("is 3", async () => {
    const { DASHBOARD_CAMPAIGN_LIMIT } = await import(
      "@/lib/dashboard/campaigns"
    );
    expect(DASHBOARD_CAMPAIGN_LIMIT).toBe(3);
  });
});

describe("queryEligibleCampaigns", () => {
  it("selects input_snapshot only server-side for format resolution", async () => {
    const chain = buildChain(rows);

    const { queryEligibleCampaigns } = await import(
      "@/lib/dashboard/campaigns"
    );
    await queryEligibleCampaigns("store-1");

    expect(chain.selectFn).toHaveBeenCalledTimes(1);
    const selectArg = chain.selectFn.mock.calls[0][0] as string;
    expect(selectArg).toBe(
      "id, product_name, created_at, storage_path, input_snapshot",
    );
  });

  it("filters by store_id and status=ready, orders desc and limits to 3", async () => {
    const chain = buildChain(rows);

    const { queryEligibleCampaigns } = await import(
      "@/lib/dashboard/campaigns"
    );
    await queryEligibleCampaigns("store-1");

    expect(chain.eqStoreFn).toHaveBeenCalledWith("store_id", "store-1");
    expect(chain.eqStatusFn).toHaveBeenCalledWith("status", "ready");
    expect(chain.orderFn).toHaveBeenCalledWith("created_at", {
      ascending: false,
    });
    expect(chain.limitFn).toHaveBeenCalledWith(3);
  });

  it("maps rows to DTO with productName/createdAt and no storagePath", async () => {
    buildChain(rows);
    mockGenerateBatchThumbnailUrls.mockResolvedValue({
      "campaign-1": "https://signed/1.jpg",
      "campaign-2": "https://signed/2.jpg",
    });

    const { queryEligibleCampaigns } = await import(
      "@/lib/dashboard/campaigns"
    );
    const result = await queryEligibleCampaigns("store-1");

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: "campaign-1",
      productName: "Tênis Runner",
      createdAt: "2026-07-13T12:00:00Z",
      thumbnailUrl: "https://signed/1.jpg",
      format: "1:1",
    });
    expect(result[1]).toMatchObject({ format: "9:16" });
    expect(result[0]).not.toHaveProperty("storagePath");
    expect(result[0]).not.toHaveProperty("storage_path");
    expect(result[0]).not.toHaveProperty("status");
    expect(result[0]).not.toHaveProperty("input_snapshot");
    expect(result[0]).not.toHaveProperty("error_message");
  });

  it("Quick 261106-qxn: formato indisponível permanece null, sem fallback para 1:1", async () => {
    buildChain([
      {
        id: "campaign-invalid",
        product_name: "Produto inválido",
        created_at: "2026-07-13T12:00:00Z",
        storage_path: "store-1/campaign-invalid.jpg",
        input_snapshot: { campaignFormat: "9:16" },
      },
    ]);

    const { queryEligibleCampaigns } = await import(
      "@/lib/dashboard/campaigns"
    );
    const result = await queryEligibleCampaigns("store-1");

    expect(result[0].format).toBeNull();
  });

  it("passes status ready and storagePath to the signing helper", async () => {
    buildChain(rows);

    const { queryEligibleCampaigns } = await import(
      "@/lib/dashboard/campaigns"
    );
    await queryEligibleCampaigns("store-1");

    expect(mockGenerateBatchThumbnailUrls).toHaveBeenCalledWith([
      { id: "campaign-1", status: "ready", storagePath: "store-1/campaign-1.jpg" },
      { id: "campaign-2", status: "ready", storagePath: "store-1/campaign-2.jpg" },
    ]);
  });

  it("uses null thumbnailUrl when signing returns null", async () => {
    buildChain(rows);
    mockGenerateBatchThumbnailUrls.mockResolvedValue({
      "campaign-1": null,
    });

    const { queryEligibleCampaigns } = await import(
      "@/lib/dashboard/campaigns"
    );
    const result = await queryEligibleCampaigns("store-1");

    expect(result[0].thumbnailUrl).toBeNull();
    expect(result[1].thumbnailUrl).toBeNull();
  });

  it("returns no cards when server returns no ready rows (error/generating filtered at source)", async () => {
    buildChain([]);

    const { queryEligibleCampaigns } = await import(
      "@/lib/dashboard/campaigns"
    );
    const result = await queryEligibleCampaigns("store-1");

    expect(result).toEqual([]);
  });

  it("throws on supabase error", async () => {
    buildChain([], { message: "DB error" });

    const { queryEligibleCampaigns } = await import(
      "@/lib/dashboard/campaigns"
    );
    await expect(queryEligibleCampaigns("store-1")).rejects.toThrow("DB error");
  });
});

describe("loadEligibleCampaignOverview", () => {
  it("uses countReadyCampaigns as the only count source", async () => {
    buildChain(rows);
    mockCountReadyCampaigns.mockResolvedValue(3);

    const { loadEligibleCampaignOverview } = await import(
      "@/lib/dashboard/campaigns"
    );
    const overview = await loadEligibleCampaignOverview("store-1");

    expect(mockCountReadyCampaigns).toHaveBeenCalledWith("store-1");
    expect(overview.count).toBe(3);
    expect(overview.items).toHaveLength(2);
  });

  it("returns zero count and no items for a store without ready campaigns", async () => {
    buildChain([]);
    mockCountReadyCampaigns.mockResolvedValue(0);

    const { loadEligibleCampaignOverview } = await import(
      "@/lib/dashboard/campaigns"
    );
    const overview = await loadEligibleCampaignOverview("store-1");

    expect(overview).toEqual({ count: 0, items: [] });
  });
});
