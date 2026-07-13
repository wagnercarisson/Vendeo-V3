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

vi.mock("@/lib/auth/require-user", () => ({
  requirePageUser: mockRequirePageUser,
}));

vi.mock("@/lib/auth/store-ownership", () => ({
  getCurrentStore: mockGetCurrentStore,
}));

vi.mock("@/lib/campaign/list", () => ({
  listCampaigns: mockListCampaigns,
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CampanhasPage (Server Component)", () => {
  it("renders empty state 'Configure sua loja' with CTA /loja when no store (does NOT redirect)", async () => {
    mockGetCurrentStore.mockResolvedValue(null);

    const { default: CampanhasPage } = await import(
      "@/app/(app)/campanhas/page"
    );
    const result = await CampanhasPage();
    const html = renderToString(result);

    expect(html).toContain("Configure sua loja");
    expect(html).toContain("/loja");
    expect(html).toContain("Configurar loja");
    expect(mockListCampaigns).not.toHaveBeenCalled();
  });

  it("renders empty state 'Nenhuma campanha ainda' when store exists but no campaigns", async () => {
    mockGetCurrentStore.mockResolvedValue({ id: "store-456" });
    mockListCampaigns.mockResolvedValue([]);

    const { default: CampanhasPage } = await import(
      "@/app/(app)/campanhas/page"
    );
    const result = await CampanhasPage();
    const html = renderToString(result);

    expect(html).toContain("Nenhuma campanha ainda");
    expect(html).toContain("/campanhas/nova");
    expect(html).toContain("Criar primeira campanha");
  });

  it("renders campaign list when store exists with campaigns", async () => {
    mockGetCurrentStore.mockResolvedValue({ id: "store-456" });
    mockListCampaigns.mockResolvedValue([
      {
        id: "c1",
        productName: "Produto Teste",
        status: "ready",
        createdAt: "2026-01-01T00:00:00Z",
        thumbnailUrl: null,
        storagePath: "s/c1.jpg",
      },
    ]);

    const { default: CampanhasPage } = await import(
      "@/app/(app)/campanhas/page"
    );
    const result = await CampanhasPage();
    const html = renderToString(result);

    expect(html).toContain("Produto Teste");
    expect(html).toContain("Pronta");
  });

  it("does NOT call listCampaigns when store is null (performance)", async () => {
    mockGetCurrentStore.mockResolvedValue(null);

    const { default: CampanhasPage } = await import(
      "@/app/(app)/campanhas/page"
    );
    await CampanhasPage();

    expect(mockListCampaigns).not.toHaveBeenCalled();
  });
});
