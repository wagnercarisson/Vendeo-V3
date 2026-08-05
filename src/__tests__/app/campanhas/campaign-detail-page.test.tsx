// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequirePageUser = vi
  .fn()
  .mockResolvedValue({
    userId: "user-123",
    claims: { sub: "user-123" },
  });
const mockGetCurrentStore = vi.fn();
const mockGetCampaignForDisplay = vi.fn();
const mockGenerateSignedPreviewUrl = vi.fn();
const mockMapCampaignToProps = vi.fn();
const NEXT_CONTROL = new Error("NEXT_CONTROL");
const mockNotFound = vi.fn(() => {
  throw NEXT_CONTROL;
});
const mockRedirect = vi.fn(() => {
  throw NEXT_CONTROL;
});

vi.mock("@/lib/auth/require-user", () => ({
  requirePageUser: mockRequirePageUser,
}));

vi.mock("@/lib/auth/store-ownership", () => ({
  getCurrentStore: mockGetCurrentStore,
}));

vi.mock("@/lib/campaign/display", () => ({
  getCampaignForDisplay: mockGetCampaignForDisplay,
  generateSignedPreviewUrl: mockGenerateSignedPreviewUrl,
  mapCampaignToProps: mockMapCampaignToProps,
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn().mockResolvedValue({}),
}));

const mockGetStoreReadiness = vi.fn();

vi.mock("@/lib/store-readiness", () => ({
  getStoreReadiness: mockGetStoreReadiness,
}));

vi.mock("@/lib/credit/credit-service", () => {
  class MockCreditService {
    getBalance = vi.fn();
  }
  return { CreditService: MockCreditService };
});

vi.mock("next/navigation", () => ({
  notFound: mockNotFound,
  redirect: mockRedirect,
}));

vi.mock("./client", () => ({
  default: () => <div>Campaign Detail Client</div>,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CampaignDetailPage (Server Component)", () => {
  it("calls notFound() (NOT redirect) when store is null", async () => {
    mockGetCurrentStore.mockResolvedValue(null);

    const { default: CampaignDetailPage } = await import(
      "@/app/(app)/campanhas/[id]/page"
    );

    await expect(
      CampaignDetailPage({ params: Promise.resolve({ id: "c1" }) }),
    ).rejects.toThrow("NEXT_CONTROL");

    expect(mockNotFound).toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it("renders campaign detail when store exists and campaign found", async () => {
    mockGetCurrentStore.mockResolvedValue({ id: "store-456" });
    mockGetCampaignForDisplay.mockResolvedValue({
      id: "c1",
      productName: "Produto Teste",
      status: "ready",
      storage_path: "s/c1.jpg",
    });
    mockMapCampaignToProps.mockReturnValue({
      productName: "Produto Teste",
      status: "ready",
    });
    mockGenerateSignedPreviewUrl.mockResolvedValue("https://example.com/img.jpg");

    const { default: CampaignDetailPage } = await import(
      "@/app/(app)/campanhas/[id]/page"
    );

    const result = await CampaignDetailPage({
      params: Promise.resolve({ id: "c1" }),
    });

    expect(mockNotFound).not.toHaveBeenCalled();
    expect(result).toBeDefined();
  });
});

describe("NovaCampanhaPage — redirect mantido", () => {
  it("calls redirect('/loja') when store is null (mantido)", async () => {
    mockGetCurrentStore.mockResolvedValue(null);
    const NEXT_CONTROL = new Error("NEXT_CONTROL");
    mockRedirect.mockImplementation(() => {
      throw NEXT_CONTROL;
    });

    const { default: NovaCampanhaPage } = await import(
      "@/app/(app)/campanhas/nova/page"
    );

    await expect(NovaCampanhaPage()).rejects.toThrow("NEXT_CONTROL");
    expect(mockRedirect).toHaveBeenCalledWith("/loja");
  });

  it("redirects draft store (cadastro_fiscal pendente) to /loja?tab=dados&fiscal=pending (F36-READINESS-02/D12)", async () => {
    mockGetCurrentStore.mockResolvedValue({ id: "store-draft-1", user_id: "user-123" });
    mockGetStoreReadiness.mockResolvedValue({
      ready: false,
      missing: [{ item: "cadastro_fiscal", reason: "CNPJ, razão social e nome fantasia são obrigatórios" }],
    });
    mockRedirect.mockImplementation(() => {
      throw NEXT_CONTROL;
    });

    const { default: NovaCampanhaPage } = await import(
      "@/app/(app)/campanhas/nova/page"
    );

    await expect(NovaCampanhaPage()).rejects.toThrow("NEXT_CONTROL");
    expect(mockRedirect).toHaveBeenCalledWith(
      "/loja?tab=dados&fiscal=pending&returnTo=%2Fcampanhas%2Fnova",
    );
  });

  it("redirects to /loja?tab=direcao-visual when only brand_profile is missing (F36-READINESS-02)", async () => {
    mockGetCurrentStore.mockResolvedValue({ id: "store-1", user_id: "user-123" });
    mockGetStoreReadiness.mockResolvedValue({
      ready: false,
      missing: [{ item: "brand_profile", reason: "Direção visual da loja não configurada" }],
    });
    mockRedirect.mockImplementation(() => {
      throw NEXT_CONTROL;
    });

    const { default: NovaCampanhaPage } = await import(
      "@/app/(app)/campanhas/nova/page"
    );

    await expect(NovaCampanhaPage()).rejects.toThrow("NEXT_CONTROL");
    expect(mockRedirect).toHaveBeenCalledWith(
      "/loja?tab=direcao-visual&message=needs-visual-direction&returnTo=%2Fcampanhas%2Fnova",
    );
  });

  it("redirects to fiscal first when both are missing (prioridade cadastro_fiscal → brand_profile)", async () => {
    mockGetCurrentStore.mockResolvedValue({ id: "store-draft-2", user_id: "user-123" });
    mockGetStoreReadiness.mockResolvedValue({
      ready: false,
      missing: [
        { item: "cadastro_fiscal", reason: "CNPJ, razão social e nome fantasia são obrigatórios" },
        { item: "brand_profile", reason: "Direção visual da loja não configurada" },
      ],
    });
    mockRedirect.mockImplementation(() => {
      throw NEXT_CONTROL;
    });

    const { default: NovaCampanhaPage } = await import(
      "@/app/(app)/campanhas/nova/page"
    );

    await expect(NovaCampanhaPage()).rejects.toThrow("NEXT_CONTROL");
    expect(mockRedirect).toHaveBeenCalledWith(
      "/loja?tab=dados&fiscal=pending&returnTo=%2Fcampanhas%2Fnova",
    );
  });
});
