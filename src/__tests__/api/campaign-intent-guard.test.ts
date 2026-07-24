import { describe, it, expect, vi } from "vitest";
import { GenerateImageRequestSchema } from "@/lib/image-generation/schema";
import { CampaignGenerationInputSchema } from "@/lib/campaign-intelligence/schema";

describe("GenerateImageRequestSchema — campaignIntent and preserveImageContext", () => {
  const baseBody = {
    storeId: "00000000-0000-0000-0000-000000000001",
    productName: "Test Product",
    discountedPriceCents: 1990,
    productImageDataUrl: "data:image/jpeg;base64,/9j/4AAQSkZJRg==",
  };

  it("accepts optional campaignIntent and preserveImageContext", () => {
    const result = GenerateImageRequestSchema.safeParse({
      ...baseBody,
      campaignIntent: "spotlight",
      preserveImageContext: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.campaignIntent).toBe("spotlight");
      expect(result.data.preserveImageContext).toBe(true);
    }
  });

  it("defaults campaignIntent to 'offer' when omitted", () => {
    const result = GenerateImageRequestSchema.safeParse(baseBody);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.campaignIntent).toBe("offer");
    }
  });

  it("maintains discountedPriceCents as required", () => {
    const result = GenerateImageRequestSchema.safeParse({
      ...baseBody,
      discountedPriceCents: undefined,
    });
    expect(result.success).toBe(false);
  });
});

describe("CampaignGenerationInputSchema — campaignIntent", () => {
  const baseInput = {
    productName: "Test",
    discountedPriceCents: 1990,
    storeName: "Loja",
    storeSegment: "outros",
    brandColor: "#22C55E",
  };

  it("defaults campaignIntent to 'offer' when omitted", () => {
    const result = CampaignGenerationInputSchema.safeParse(baseInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.campaignIntent).toBe("offer");
    }
  });

  it("accepts campaignIntent when set to 'spotlight'", () => {
    const result = CampaignGenerationInputSchema.safeParse({
      ...baseInput,
      campaignIntent: "spotlight",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.campaignIntent).toBe("spotlight");
    }
  });

  it("rejects campaignIntent when set to invalid value", () => {
    const result = CampaignGenerationInputSchema.safeParse({
      ...baseInput,
      campaignIntent: "invalid",
    });
    expect(result.success).toBe(false);
  });
});
