// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useCampaignForm } from "../use-campaign-form";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const mockSaveFormState = vi.fn();
const mockRestoreFormState = vi.fn();
const mockClearFormState = vi.fn();

vi.mock("@/hooks/use-input-preservation", () => ({
  useInputPreservation: () => ({
    saveFormState: mockSaveFormState,
    restoreFormState: mockRestoreFormState,
    clearFormState: mockClearFormState,
  }),
}));

const VALID_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

function createNdjsonResponse(
  events: Record<string, unknown>[]
): Response {
  const body = events.map((e) => JSON.stringify(e) + "\n").join("");
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(body));
        controller.close();
      },
    }),
    { status: 200, headers: { "Content-Type": "application/x-ndjson" } }
  );
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  sessionStorage.clear();
  mockRestoreFormState.mockReturnValue({
    productName: "Test Product",
    description: "",
    originalPriceCents: 0,
    discountedPriceCents: 1990,
    badge: "Oferta",
    imageFile: null,
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useCampaignForm navigation", () => {
  it("navigates to campaignUrl on successful generation", async () => {
    sessionStorage.setItem("campaign_draft_image", VALID_DATA_URL);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        createNdjsonResponse([
          { type: "result", campaignId: "abc-123", campaignUrl: "/campanhas/abc-123" },
        ])
      )
    );

    const { result } = renderHook(() => useCampaignForm("store-123"));

    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    await waitFor(() => expect(result.current.isValid).toBe(true));

    await act(async () => {
      await result.current.handleSubmit();
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/campanhas/abc-123");
    });
  });

  it("does NOT write campaign_preview to sessionStorage", async () => {
    sessionStorage.setItem("campaign_draft_image", VALID_DATA_URL);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        createNdjsonResponse([
          { type: "result", campaignId: "abc-123", campaignUrl: "/campanhas/abc-123" },
        ])
      )
    );

    const { result } = renderHook(() => useCampaignForm("store-123"));

    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    await waitFor(() => expect(result.current.isValid).toBe(true));

    await act(async () => {
      await result.current.handleSubmit();
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalled();
      expect(sessionStorage.getItem("campaign_preview")).toBeNull();
    });
  });

  it("keeps campaign_draft_image in sessionStorage after success", async () => {
    sessionStorage.setItem("campaign_draft_image", VALID_DATA_URL);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        createNdjsonResponse([
          { type: "result", campaignId: "abc-123", campaignUrl: "/campanhas/abc-123" },
        ])
      )
    );

    const { result } = renderHook(() => useCampaignForm("store-123"));

    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    await waitFor(() => expect(result.current.isValid).toBe(true));

    await act(async () => {
      await result.current.handleSubmit();
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalled();
      expect(sessionStorage.getItem("campaign_draft_image")).toBe(VALID_DATA_URL);
    });
  });
});
