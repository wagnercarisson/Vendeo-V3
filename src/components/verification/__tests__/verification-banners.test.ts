import { describe, it, expect } from "vitest";

describe("VerificationBanners logic", () => {
  function shouldShowBanner(
    verificationStatus: string | null,
    dismissedApproved: boolean
  ): "review" | "approved" | null {
    if (!verificationStatus || verificationStatus === "unverified") return null;
    if (verificationStatus === "review") return "review";
    if (verificationStatus === "approved" && !dismissedApproved) return "approved";
    return null;
  }

  it("shows nothing when status is null", () => {
    expect(shouldShowBanner(null, false)).toBeNull();
  });

  it("shows nothing when status is unverified", () => {
    expect(shouldShowBanner("unverified", false)).toBeNull();
  });

  it("shows review banner for review status", () => {
    expect(shouldShowBanner("review", false)).toBe("review");
  });

  it("shows approved banner for approved status when not dismissed", () => {
    expect(shouldShowBanner("approved", false)).toBe("approved");
  });

  it("does not show approved banner when dismissed", () => {
    expect(shouldShowBanner("approved", true)).toBeNull();
  });

  it("shows nothing for rejected status", () => {
    expect(shouldShowBanner("rejected", false)).toBeNull();
  });

  it("shows nothing for defer status", () => {
    expect(shouldShowBanner("defer", false)).toBeNull();
  });
});
