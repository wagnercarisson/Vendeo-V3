// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mockCreateSignedUrl = vi.fn(async (thumbnailPath: string) => ({
  data: { signedUrl: `https://signed/${thumbnailPath}` },
  error: null,
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(),
  supabaseAdmin: {
    storage: {
      from: vi.fn(() => ({ createSignedUrl: mockCreateSignedUrl })),
    },
  },
}));

import {
  deriveThumbnailPath,
  isEligibleCampaignArtPath,
  isThumbnailPath,
} from "@/lib/campaign/thumbnail/thumbnail-path";
import { generateBatchThumbnailUrls } from "@/lib/campaign/list";

const STORE_ID = "11111111-1111-4111-8111-111111111111";
const CAMPAIGN_ID = "22222222-2222-4222-8222-222222222222";
const OPERATION_ID = "33333333-3333-4333-8333-333333333333";
const VERTICAL_PATH = `${STORE_ID}/${CAMPAIGN_ID}/product-9-16/${OPERATION_ID}/art-1080x1920.jpg`;

describe("F59/59-08 — listagem reconhece a miniatura vertical", () => {
  it("deriva a miniatura reconhecida do path vertical sem mudar o card", () => {
    expect(isEligibleCampaignArtPath(VERTICAL_PATH)).toBe(true);
    const thumbnail = deriveThumbnailPath(VERTICAL_PATH);
    expect(thumbnail).toBe(
      `${STORE_ID}/${CAMPAIGN_ID}/product-9-16/${OPERATION_ID}/art-1080x1920.thumb-v1.webp`,
    );
    expect(isThumbnailPath(thumbnail!)).toBe(true);
  });

  it("assina a MINIATURA vertical (nunca a arte original) no slot existente", async () => {
    const urls = await generateBatchThumbnailUrls([
      {
        id: CAMPAIGN_ID,
        status: "ready",
        storagePath: VERTICAL_PATH,
      },
    ]);

    const expectedThumbnail = deriveThumbnailPath(VERTICAL_PATH);
    expect(mockCreateSignedUrl).toHaveBeenCalledWith(expectedThumbnail, 3600);
    expect(mockCreateSignedUrl).not.toHaveBeenCalledWith(VERTICAL_PATH, 3600);
    expect(urls[CAMPAIGN_ID]).toBe(`https://signed/${expectedThumbnail}`);
  });
});
