// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
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
  vi.clearAllMocks();
  sessionStorage.clear();
  mockRestoreFormState.mockReturnValue(null);
});

describe("useCampaignForm navigation", () => {
  it("navigates to campaignUrl on successful generation with restored image", async () => {
    sessionStorage.setItem("campaign_draft_image", VALID_DATA_URL);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        createNdjsonResponse([
          { type: "result", campaignId: "abc-123", campaignUrl: "/campanhas/abc-123" },
        ])
      )
    );

    mockRestoreFormState.mockReturnValue({
      productName: "Test Product",
      description: "",
      originalPriceCents: 10000,
      discountedPriceCents: 1990,
      badge: "Oferta",
      campaignIntent: "offer",
      preserveImageContext: false,
      productImages: [],
      mandatoryArtworkText: "",
      showIllustrativeNotice: true,
      mandatoryArtworkTextFree: "",
      validityMode: "",
      validityStartDate: "",
      validityEndDate: "",
      validityCustomText: "",
    });

    const { result } = renderHook(() => useCampaignForm("store-123"));

    await act(async () => {});

    expect(result.current.isValid).toBe(true);

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

    mockRestoreFormState.mockReturnValue({
      productName: "Test Product",
      description: "",
      originalPriceCents: 10000,
      discountedPriceCents: 1990,
      badge: "Oferta",
      campaignIntent: "offer",
      preserveImageContext: false,
      productImages: [],
      mandatoryArtworkText: "",
      showIllustrativeNotice: true,
      mandatoryArtworkTextFree: "",
      validityMode: "",
      validityStartDate: "",
      validityEndDate: "",
      validityCustomText: "",
    });

    const { result } = renderHook(() => useCampaignForm("store-123"));

    await act(async () => {});

    expect(result.current.isValid).toBe(true);

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

    mockRestoreFormState.mockReturnValue({
      productName: "Test Product",
      description: "",
      originalPriceCents: 10000,
      discountedPriceCents: 1990,
      badge: "Oferta",
      campaignIntent: "offer",
      preserveImageContext: false,
      productImages: [],
      mandatoryArtworkText: "",
      showIllustrativeNotice: true,
      mandatoryArtworkTextFree: "",
      validityMode: "",
      validityStartDate: "",
      validityEndDate: "",
      validityCustomText: "",
    });

    const { result } = renderHook(() => useCampaignForm("store-123"));

    await act(async () => {});

    expect(result.current.isValid).toBe(true);

    await act(async () => {
      await result.current.handleSubmit();
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalled();
      expect(sessionStorage.getItem("campaign_draft_image")).toBe(VALID_DATA_URL);
    });
  });

  it("migrates legacy mandatoryArtworkText draft into free text field on restore", async () => {
    mockRestoreFormState.mockReturnValue({
      productName: "X",
      description: "",
      originalPriceCents: 0,
      discountedPriceCents: undefined,
      badge: "",
      campaignIntent: "offer",
      preserveImageContext: false,
      productImages: [],
      mandatoryArtworkText: "Legado",
    });

    const { result } = renderHook(() => useCampaignForm("store-123"));

    await act(async () => {});

    expect(result.current.fields.mandatoryArtworkTextFree).toBe("Legado");
    expect(result.current.fields.mandatoryArtworkText).toBe("Legado");
    expect(result.current.fields.showIllustrativeNotice).toBe(true);
  });

  it("restores mirror alongside free text for new-shape draft", async () => {
    mockRestoreFormState.mockReturnValue({
      productName: "X",
      description: "",
      originalPriceCents: 0,
      discountedPriceCents: undefined,
      badge: "",
      campaignIntent: "offer",
      preserveImageContext: false,
      productImages: [],
      showIllustrativeNotice: false,
      mandatoryArtworkTextFree: "Novo texto",
      mandatoryArtworkText: "Novo texto",
    });

    const { result } = renderHook(() => useCampaignForm("store-123"));

    await act(async () => {});

    expect(result.current.fields.mandatoryArtworkTextFree).toBe("Novo texto");
    expect(result.current.fields.mandatoryArtworkText).toBe("Novo texto");
  });

  it("15 (F41): restaura draft multi com N imagens (file undefined — File não serializa)", async () => {
    mockRestoreFormState.mockReturnValue({
      productName: "Test Product",
      description: "",
      originalPriceCents: 10000,
      discountedPriceCents: 1990,
      badge: "Oferta",
      campaignIntent: "offer",
      preserveImageContext: false,
      productImages: [
        { id: "a", role: "primary", source: "upload", mimeType: "image/jpeg", dataUrl: VALID_DATA_URL },
        { id: "b", role: "reference", source: "camera", mimeType: "image/jpeg", dataUrl: VALID_DATA_URL },
      ],
      mandatoryArtworkText: "",
      showIllustrativeNotice: true,
      mandatoryArtworkTextFree: "",
      validityMode: "",
      validityStartDate: "",
      validityEndDate: "",
      validityCustomText: "",
    });

    const { result } = renderHook(() => useCampaignForm("store-123"));
    await act(async () => {});

    expect(result.current.fields.productImages).toHaveLength(2);
    expect(result.current.fields.productImages[0].role).toBe("primary");
    expect(result.current.fields.productImages[0].dataUrl).toBe(VALID_DATA_URL);
    expect(result.current.fields.productImages[0].file).toBeUndefined();
    expect(result.current.fields.productImages[1].role).toBe("reference");
    expect(result.current.fields.productImages[1].source).toBe("camera");
  });
});
