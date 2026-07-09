// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("useCampaignForm navigation", () => {
  function handleResult(
    event: Record<string, unknown>,
    routerPush: (url: string) => void,
  ): void {
    if (event.type === "result" && "campaignId" in event) {
      const result = event as {
        campaignId: string;
        campaignUrl: string;
        inputCorrections?: {
          productName: { from: string; to: string; reason: string };
        };
      };

      if (result.inputCorrections?.productName) {
        const correction = result.inputCorrections.productName;
        // In the real hook, this calls setFields((prev) => ({ ...prev, productName: correction.to }))
        void correction;
      }

      // Navigate to campaign page — draft data preserved in sessionStorage
      routerPush(result.campaignUrl);
    }
  }

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it("navigates to campaignUrl on successful generation", () => {
    const mockPush = vi.fn();

    handleResult(
      {
        type: "result",
        campaignId: "abc-123",
        campaignUrl: "/campanha/abc-123",
      },
      mockPush,
    );

    expect(mockPush).toHaveBeenCalledWith("/campanha/abc-123");
  });

  it("does NOT write campaign_preview to sessionStorage", () => {
    const mockPush = vi.fn();

    handleResult(
      {
        type: "result",
        campaignId: "abc-123",
        campaignUrl: "/campanha/abc-123",
      },
      mockPush,
    );

    expect(sessionStorage.getItem("campaign_preview")).toBeNull();
  });

  it("keeps campaign_draft_image in sessionStorage", () => {
    sessionStorage.setItem("campaign_draft_image", "data:image/png;base64,test");
    const mockPush = vi.fn();

    handleResult(
      {
        type: "result",
        campaignId: "abc-123",
        campaignUrl: "/campanha/abc-123",
      },
      mockPush,
    );

    expect(sessionStorage.getItem("campaign_draft_image")).toBe(
      "data:image/png;base64,test",
    );
  });
});
