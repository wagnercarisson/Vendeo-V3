// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
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

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  sessionStorage.clear();
  mockRestoreFormState.mockReturnValue(null);
});

describe("badge cleanup on intent change", () => {
  it("clears badge when switching from offer to spotlight and badge is invalid for spotlight", () => {
    const { result } = renderHook(() => useCampaignForm("store-123"));

    // Set DE+POR to trigger "offer" intent
    act(() => {
      result.current.setField("originalPriceCents", 10000);
    });
    act(() => {
      result.current.setField("discountedPriceCents", 5000);
    });
    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(result.current.fields.campaignIntent).toBe("offer");
    expect(result.current.fields.discountedPriceCents).toBe(5000);

    // Set badge for offer
    act(() => {
      result.current.setField("badge", "Promoção");
    });
    expect(result.current.fields.badge).toBe("Promoção");

    // Remove original price to trigger spotlight inference
    act(() => {
      result.current.setField("originalPriceCents", 0);
    });
    act(() => {
      vi.advanceTimersByTime(600);
    });

    // Since user didn't manually set campaignIntent, it auto-updates to spotlight
    expect(result.current.fields.campaignIntent).toBe("spotlight");
    // Badge "Promoção" should be cleared because it's not in spotlight's list
    expect(result.current.fields.badge).toBe("");
  });

  it("preserveImageContext is reset when switching back to offer", () => {
    const { result } = renderHook(() => useCampaignForm("store-123"));

    // Start with only discounted price → "spotlight" intent
    act(() => {
      result.current.setField("discountedPriceCents", 1000);
    });
    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(result.current.fields.campaignIntent).toBe("spotlight");

    // Enable preserveImageContext
    act(() => {
      result.current.setField("preserveImageContext", true);
    });
    expect(result.current.fields.preserveImageContext).toBe(true);

    // Add original price → triggers "offer" inference
    act(() => {
      result.current.setField("originalPriceCents", 10000);
    });
    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(result.current.fields.campaignIntent).toBe("offer");
    // preserveImageContext should reset to false
    expect(result.current.fields.preserveImageContext).toBe(false);
  });
});
