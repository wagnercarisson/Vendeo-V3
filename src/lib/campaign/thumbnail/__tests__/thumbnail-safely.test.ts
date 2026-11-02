// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGenerate } = vi.hoisted(() => ({ mockGenerate: vi.fn() }));

vi.mock("../thumbnail-generator", () => ({
  generateCampaignThumbnail: mockGenerate,
}));

import { generateCampaignThumbnailSafely } from "../thumbnail-safe";

const STORE = "11111111-1111-4111-8111-111111111111";
const CAMPAIGN = "22222222-2222-4222-8222-222222222222";

describe("generateCampaignThumbnailSafely", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockGenerate.mockReset();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  it("não deixa exceção escapar mesmo com gerador lançando", async () => {
    mockGenerate.mockRejectedValueOnce(new Error("boom"));

    const result = await generateCampaignThumbnailSafely({
      originalPath: `${STORE}/${CAMPAIGN}.jpg`,
      originalBuffer: Buffer.from("x"),
      context: null,
      campaignId: CAMPAIGN,
    });

    expect(result).toMatchObject({
      status: "failed",
      reason: "thumbnail_unexpected_error",
    });
    expect(console.warn).toHaveBeenCalledWith(
      "[thumbnail] unexpected failure",
      expect.objectContaining({ campaignId: CAMPAIGN, code: "Error" }),
    );
  });

  it("repassa o resultado normal sem ruído de warning", async () => {
    mockGenerate.mockResolvedValueOnce({
      status: "created",
      thumbnailPath: `${STORE}/${CAMPAIGN}.thumb-v1.webp`,
      width: 288,
      height: 288,
    });

    await expect(
      generateCampaignThumbnailSafely({
        originalPath: `${STORE}/${CAMPAIGN}.jpg`,
        originalBuffer: Buffer.from("x"),
        context: null,
      }),
    ).resolves.toMatchObject({ status: "created" });
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("registra falha esperada (timeout) sem lançar", async () => {
    mockGenerate.mockResolvedValueOnce({
      status: "failed",
      reason: "thumbnail_upload_timeout",
      thumbnailPath: `${STORE}/${CAMPAIGN}.thumb-v1.webp`,
    });

    const result = await generateCampaignThumbnailSafely({
      originalPath: `${STORE}/${CAMPAIGN}.jpg`,
      originalBuffer: Buffer.from("x"),
      context: null,
      campaignId: CAMPAIGN,
    });

    expect(result).toMatchObject({
      status: "failed",
      reason: "thumbnail_upload_timeout",
    });
    expect(console.warn).toHaveBeenCalledWith(
      "[thumbnail] generation failed",
      expect.objectContaining({
        campaignId: CAMPAIGN,
        reason: "thumbnail_upload_timeout",
      }),
    );
  });

  it("registra desabilitação inesperada sem lançar", async () => {
    mockGenerate.mockResolvedValueOnce({
      status: "skipped",
      reason: "thumbnail_endpoint_mismatch",
      thumbnailPath: `${STORE}/${CAMPAIGN}.thumb-v1.webp`,
    });

    const result = await generateCampaignThumbnailSafely({
      originalPath: `${STORE}/${CAMPAIGN}.jpg`,
      originalBuffer: Buffer.from("x"),
      context: null,
    });

    expect(result).toMatchObject({
      status: "skipped",
      reason: "thumbnail_endpoint_mismatch",
    });
    expect(console.warn).toHaveBeenCalledWith(
      "[thumbnail] generation skipped",
      expect.objectContaining({ reason: "thumbnail_endpoint_mismatch" }),
    );
  });

  it("não loga ineligible_path (skip esperado)", async () => {
    mockGenerate.mockResolvedValueOnce({
      status: "skipped",
      reason: "ineligible_path",
    });

    await generateCampaignThumbnailSafely({
      originalPath: "not-eligible",
      originalBuffer: Buffer.from("x"),
      context: null,
    });
    expect(console.warn).not.toHaveBeenCalled();
  });
});
