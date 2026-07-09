// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import CampaignPageClient from "@/app/campanha/[id]/client";

const mockPush = vi.fn();
const mockRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

const defaultProps = {
  imageUrl: null,
  caption: "",
  hashtags: [] as string[],
  ctaPost: "",
  displayStatus: "ready" as const,
  productName: "",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  downloadUrl: "/api/campaign/123/download",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("CampaignPageClient — display states", () => {
  it("renders ready state with image, copy, and download", () => {
    render(
      <CampaignPageClient
        {...defaultProps}
        imageUrl="https://example.com/img.jpg"
        caption="Oferta!"
        hashtags={["#promo"]}
        ctaPost="Compre agora"
        productName="Produto X"
      />
    );

    expect(screen.getByRole("img")).toHaveAttribute("src", "https://example.com/img.jpg");
    expect(screen.getByText("Oferta!")).toBeInTheDocument();
    expect(screen.getByText("#promo")).toBeInTheDocument();
    expect(screen.getByText("Compre agora")).toBeInTheDocument();
    expect(screen.getByText("Produto X")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /baixar/i })).toHaveAttribute(
      "href",
      "/api/campaign/123/download"
    );
  });

  it("renders generating state with spinner and message", () => {
    render(
      <CampaignPageClient
        {...defaultProps}
        displayStatus="generating"
      />
    );

    expect(screen.getByText("Sua campanha está sendo gerada...")).toBeInTheDocument();
  });

  it("renders stale state with interruption message and CTA", () => {
    render(
      <CampaignPageClient
        {...defaultProps}
        displayStatus="stale"
      />
    );

    expect(screen.getByText("Geração interrompida. Tente novamente.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /criar nova campanha/i })).toBeInTheDocument();
  });

  it("renders error state with failure message and CTA", () => {
    render(
      <CampaignPageClient
        {...defaultProps}
        displayStatus="error"
      />
    );

    expect(screen.getByText("Não foi possível gerar sua campanha.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /criar nova campanha/i })).toBeInTheDocument();
  });

  describe("generating polling", () => {
    it("starts polling with router.refresh every 5s when generating", () => {
      render(
        <CampaignPageClient
          {...defaultProps}
          displayStatus="generating"
        />
      );

      expect(mockRefresh).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(mockRefresh).toHaveBeenCalledTimes(1);

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(mockRefresh).toHaveBeenCalledTimes(2);
    });

    it("stops polling on unmount", () => {
      const { unmount } = render(
        <CampaignPageClient
          {...defaultProps}
          displayStatus="generating"
        />
      );

      unmount();

      act(() => {
        vi.advanceTimersByTime(10000);
      });

      expect(mockRefresh).not.toHaveBeenCalled();
    });
  });
});
