// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToString } from "react-dom/server";

const mockRequirePageUser = vi
  .fn()
  .mockResolvedValue({
    userId: "user-123",
    claims: { sub: "user-123" },
  });
const mockGetCurrentStore = vi.fn();
const mockListCampaigns = vi.fn();
const mockParseCampaignListSearchParams = vi.fn();

vi.mock("@/lib/auth/require-user", () => ({
  requirePageUser: mockRequirePageUser,
}));

vi.mock("@/lib/auth/store-ownership", () => ({
  getCurrentStore: mockGetCurrentStore,
}));

vi.mock("@/lib/campaign/list", () => ({
  listCampaigns: mockListCampaigns,
}));

vi.mock("@/lib/campaign/search-params", () => ({
  parseCampaignListSearchParams: mockParseCampaignListSearchParams,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

const defaultValidated = {
  page: 1,
  pageSize: 10,
  q: undefined,
  status: ["ready", "error"] as const,
  dateFrom: undefined,
  dateTo: undefined,
  sortBy: "created_at" as const,
  sortOrder: "desc" as const,
};

const mockCampaignsResult = (items: any[], total: number) => ({
  items,
  total,
  page: 1,
  pageSize: 10,
  totalPages: Math.ceil(total / 10) || 1,
});

const ctaHref = "/campanhas/nova";

beforeEach(() => {
  vi.clearAllMocks();
  mockParseCampaignListSearchParams.mockReturnValue(defaultValidated);
});

describe("CampanhasPage (Server Component — SSR with searchParams)", () => {
  it("renders empty state 'Configure sua loja' with CTA /loja when no store (does NOT redirect)", async () => {
    mockGetCurrentStore.mockResolvedValue(null);

    const { default: CampanhasPage } = await import(
      "@/app/(app)/campanhas/page"
    );
    const result = await CampanhasPage({ searchParams: Promise.resolve({}) });
    const html = renderToString(result);

    expect(html).toContain("Configure sua loja");
    expect(html).toContain("/loja");
    expect(html).toContain("Configurar loja");
    expect(mockListCampaigns).not.toHaveBeenCalled();
  });

  it("renders empty state 'Nenhuma campanha ainda' when store exists but no campaigns", async () => {
    mockGetCurrentStore.mockResolvedValue({ id: "store-456" });
    mockListCampaigns.mockResolvedValue(mockCampaignsResult([], 0));

    const { default: CampanhasPage } = await import(
      "@/app/(app)/campanhas/page"
    );
    const result = await CampanhasPage({ searchParams: Promise.resolve({}) });
    const html = renderToString(result);

    expect(html).toContain("Nenhuma campanha ainda");
    expect(html).toContain("/campanhas/nova");
    expect(html).toContain("Criar primeira campanha");
  });

  it("renders campaign list when store exists with campaigns", async () => {
    mockGetCurrentStore.mockResolvedValue({ id: "store-456" });
    mockListCampaigns.mockResolvedValue(
      mockCampaignsResult(
        [
          {
            id: "c1",
            productName: "Produto Teste",
            status: "ready",
            createdAt: "2026-01-01T00:00:00Z",
            thumbnailUrl: null,
            storagePath: "s/c1.jpg",
          },
        ],
        1,
      ),
    );

    const { default: CampanhasPage } = await import(
      "@/app/(app)/campanhas/page"
    );
    const result = await CampanhasPage({ searchParams: Promise.resolve({}) });
    const html = renderToString(result);

    expect(html).toContain("Produto Teste");
    expect(html).toContain("Pronta");
  });

  it("does NOT call listCampaigns when store is null (performance)", async () => {
    mockGetCurrentStore.mockResolvedValue(null);

    const { default: CampanhasPage } = await import(
      "@/app/(app)/campanhas/page"
    );
    await CampanhasPage({ searchParams: Promise.resolve({}) });

    expect(mockListCampaigns).not.toHaveBeenCalled();
  });

  it("calls listCampaigns with defaults when no searchParams", async () => {
    mockGetCurrentStore.mockResolvedValue({ id: "store-456" });
    mockListCampaigns.mockResolvedValue(mockCampaignsResult([], 0));

    const { default: CampanhasPage } = await import(
      "@/app/(app)/campanhas/page"
    );
    await CampanhasPage({ searchParams: Promise.resolve({}) });

    expect(mockParseCampaignListSearchParams).toHaveBeenCalledWith({});
    expect(mockListCampaigns).toHaveBeenCalledWith("store-456", {
      page: 1,
      pageSize: 10,
      search: undefined,
      status: ["ready", "error"],
      dateFrom: undefined,
      dateTo: undefined,
      sortBy: "created_at",
      sortOrder: "desc",
    });
  });

  it("passes search params from URL to listCampaigns", async () => {
    mockGetCurrentStore.mockResolvedValue({ id: "store-456" });
    mockParseCampaignListSearchParams.mockReturnValue({
      ...defaultValidated,
      q: "tenis",
    });
    mockListCampaigns.mockResolvedValue(mockCampaignsResult([], 0));

    const { default: CampanhasPage } = await import(
      "@/app/(app)/campanhas/page"
    );
    await CampanhasPage({
      searchParams: Promise.resolve({ q: "tenis" }),
    });

    expect(mockParseCampaignListSearchParams).toHaveBeenCalledWith({
      q: "tenis",
    });
    expect(mockListCampaigns).toHaveBeenCalledWith("store-456", {
      page: 1,
      pageSize: 10,
      search: "tenis",
      status: ["ready", "error"],
      dateFrom: undefined,
      dateTo: undefined,
      sortBy: "created_at",
      sortOrder: "desc",
    });
  });

  it("passes status, date, page params correctly", async () => {
    mockGetCurrentStore.mockResolvedValue({ id: "store-456" });
    mockParseCampaignListSearchParams.mockReturnValue({
      ...defaultValidated,
      page: 2,
      status: ["ready"],
      dateFrom: "2026-04-15T00:00:00.000Z",
      dateTo: "2026-07-14T00:00:00.000Z",
    });
    mockListCampaigns.mockResolvedValue(mockCampaignsResult([], 0));

    const { default: CampanhasPage } = await import(
      "@/app/(app)/campanhas/page"
    );
    await CampanhasPage({
      searchParams: Promise.resolve({
        status: "ready",
        date: "90d",
        page: "2",
      }),
    });

    expect(mockListCampaigns).toHaveBeenCalledWith("store-456", {
      page: 2,
      pageSize: 10,
      search: undefined,
      status: ["ready"],
      dateFrom: "2026-04-15T00:00:00.000Z",
      dateTo: "2026-07-14T00:00:00.000Z",
      sortBy: "created_at",
      sortOrder: "desc",
    });
  });

  it("renders empty state 'Nenhuma campanha encontrada' when search has no results", async () => {
    mockGetCurrentStore.mockResolvedValue({ id: "store-456" });
    mockParseCampaignListSearchParams.mockReturnValue({
      ...defaultValidated,
      q: "inexistente",
    });
    mockListCampaigns.mockResolvedValue(mockCampaignsResult([], 0));

    const { default: CampanhasPage } = await import(
      "@/app/(app)/campanhas/page"
    );
    const result = await CampanhasPage({
      searchParams: Promise.resolve({ q: "inexistente" }),
    });
    const html = renderToString(result);

    expect(html).toContain("Nenhuma campanha encontrada");
  });
});
