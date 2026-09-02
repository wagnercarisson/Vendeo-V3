// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetCampaignForDisplay = vi.fn();
const mockGetCurrentStore = vi.fn();
const mockGenerateSignedPreviewUrl = vi.fn();
const mockMapCampaignToProps = vi.fn();
const mockNotFound = vi.fn();
const mockRedirect = vi.fn();
const mockIsCampaignApprovalEnabled = vi.fn();
const mockListArtVersions = vi.fn();
const mockComputeApprovalState = vi.fn();
const mockGetActiveCandidateArtVersion = vi.fn();

vi.mock("@/lib/campaign/display", () => ({
  getCampaignForDisplay: mockGetCampaignForDisplay,
  generateSignedPreviewUrl: mockGenerateSignedPreviewUrl,
  mapCampaignToProps: mockMapCampaignToProps,
  computeApprovalState: mockComputeApprovalState,
  getActiveCandidateArtVersion: mockGetActiveCandidateArtVersion,
}));

vi.mock("@/lib/campaign/persistence", () => ({
  listArtVersions: mockListArtVersions,
}));

vi.mock("@/lib/feature-flags/feature-flag-service", () => ({
  isCampaignApprovalEnabled: mockIsCampaignApprovalEnabled,
}));

vi.mock("@/lib/auth/store-ownership", () => ({
  getCurrentStore: mockGetCurrentStore,
}));

vi.mock("@/lib/auth/require-user", () => ({
  requirePageUser: vi.fn().mockResolvedValue({ userId: "user-123", claims: { sub: "user-123" } }),
}));

const NEXT_CONTROL = new Error("NEXT_CONTROL");
const notFoundFn = vi.fn(() => { throw NEXT_CONTROL; });
const redirectFn = vi.fn(() => { throw NEXT_CONTROL; });

vi.mock("next/navigation", () => ({
  notFound: notFoundFn,
  redirect: redirectFn,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CampaignDetailPage (Server Component)", () => {
  it("calls notFound() when getCampaignForDisplay returns null", async () => {
    mockGetCurrentStore.mockResolvedValue({ id: "store-123" });
    mockGetCampaignForDisplay.mockResolvedValue(null);

    const { default: CampaignDetailPage } = await import("@/app/(app)/campanhas/[id]/page");
    const params = Promise.resolve({ id: "550e8400-e29b-41d4-a716-446655440000" });

    await expect(CampaignDetailPage({ params })).rejects.toThrow("NEXT_CONTROL");
    expect(notFoundFn).toHaveBeenCalled();
  });

  it("calls notFound() when getCurrentStore returns null (no redirect)", async () => {
    mockGetCurrentStore.mockResolvedValue(null);

    const { default: CampaignDetailPage } = await import("@/app/(app)/campanhas/[id]/page");
    const params = Promise.resolve({ id: "550e8400-e29b-41d4-a716-446655440000" });

    await expect(CampaignDetailPage({ params })).rejects.toThrow("NEXT_CONTROL");
    expect(notFoundFn).toHaveBeenCalled();
    expect(redirectFn).not.toHaveBeenCalled();
  });

  describe("approval derivation (F37.1)", () => {
    const campaignFixture = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      store_id: "store-123",
      status: "ready",
      product_name: "Produto",
      storage_path: "store-123/camp.jpg",
      approval_status: "pending_approval",
      rejection_count: 0,
      approved_version_id: null,
      approved_at: null,
    };

    beforeEach(() => {
      mockGetCurrentStore.mockResolvedValue({ id: "store-123" });
      mockGetCampaignForDisplay.mockResolvedValue(campaignFixture);
      mockMapCampaignToProps.mockReturnValue({
        imageUrl: null,
        caption: "",
        hashtags: [],
        ctaPost: "",
        displayStatus: "ready",
        productName: "Produto",
        createdAt: "2026-09-01T10:00:00Z",
        updatedAt: "2026-09-01T10:00:00Z",
        downloadUrl: "/api/campaign/x/download",
        campaignId: "550e8400-e29b-41d4-a716-446655440000",
        isPublicationCopyEdited: false,
      });
    });

    it("preenche props.approval.candidateVersionId apenas em pending (candidata ativa)", async () => {
      mockIsCampaignApprovalEnabled.mockResolvedValue(true);
      mockListArtVersions.mockResolvedValue([
        {
          id: "version-1",
          campaign_id: "550e8400-e29b-41d4-a716-446655440000",
          version_number: 1,
          status: "pending",
          storage_path: "store-123/camp.jpg",
          asset_status: "active",
          asset_deleted_at: null,
          brief_snapshot: {},
          render_snapshot: null,
          generation_metadata: null,
          rejection_reason: null,
          correction_in_progress: false,
          created_at: "2026-09-01T10:00:00Z",
        },
      ]);
      mockComputeApprovalState.mockReturnValue({ status: "pending" });
      mockGetActiveCandidateArtVersion.mockReturnValue({
        id: "version-1",
        campaign_id: "550e8400-e29b-41d4-a716-446655440000",
        version_number: 1,
        status: "pending",
        storage_path: "store-123/camp.jpg",
        asset_status: "active",
        asset_deleted_at: null,
        brief_snapshot: {},
        render_snapshot: null,
        generation_metadata: null,
        rejection_reason: null,
        correction_in_progress: false,
        created_at: "2026-09-01T10:00:00Z",
      });
      mockGenerateSignedPreviewUrl.mockResolvedValue("https://preview/art.jpg");

      const { default: CampaignDetailPage } = await import("@/app/(app)/campanhas/[id]/page");
      const params = Promise.resolve({ id: "550e8400-e29b-41d4-a716-446655440000" });

      await CampaignDetailPage({ params });

      const calledProps = mockMapCampaignToProps.mock.results[0].value;
      expect(calledProps.approval).toBeDefined();
      expect(calledProps.approval.state).toEqual({ status: "pending" });
      expect(calledProps.approval.candidateVersionId).toBe("version-1");
      expect(calledProps.approval.candidateImageUrl).toBe("https://preview/art.jpg");
    });

    it("não preenche props.approval em legacy (flag on + zero versões → legado usa storage_path)", async () => {
      mockIsCampaignApprovalEnabled.mockResolvedValue(true);
      mockListArtVersions.mockResolvedValue([]);
      mockComputeApprovalState.mockReturnValue({ status: "legacy" });

      const { default: CampaignDetailPage } = await import("@/app/(app)/campanhas/[id]/page");
      const params = Promise.resolve({ id: "550e8400-e29b-41d4-a716-446655440000" });

      await CampaignDetailPage({ params });

      const calledProps = mockMapCampaignToProps.mock.results[0].value;
      expect(calledProps.approval).toBeUndefined();
    });

    it("não preenche props.approval quando flag off (not_enabled)", async () => {
      mockIsCampaignApprovalEnabled.mockResolvedValue(false);
      mockListArtVersions.mockResolvedValue([]);
      mockComputeApprovalState.mockReturnValue({ status: "not_enabled" });

      const { default: CampaignDetailPage } = await import("@/app/(app)/campanhas/[id]/page");
      const params = Promise.resolve({ id: "550e8400-e29b-41d4-a716-446655440000" });

      await CampaignDetailPage({ params });

      const calledProps = mockMapCampaignToProps.mock.results[0].value;
      expect(calledProps.approval).toBeUndefined();
    });
  });
});
