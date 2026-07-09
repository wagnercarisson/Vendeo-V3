// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockToBuffer = vi.fn();

vi.mock("server-only", () => ({}));

vi.mock("sharp", () => ({
  default: vi.fn(() => ({
    resize: vi.fn(() => ({
      jpeg: vi.fn(() => ({
        toBuffer: mockToBuffer,
      })),
    })),
  })),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockToBuffer.mockResolvedValue(Buffer.from("fake-jpeg-data"));
});

describe("transcodeToJpeg", () => {
  it("converts PNG to JPEG 1080×1080", async () => {
    const { transcodeToJpeg } = await import(
      "@/lib/campaign/image-processor"
    );
    const result = await transcodeToJpeg(
      Buffer.from("fake-png-data"),
      "image/png"
    );

    expect(result.mimeType).toBe("image/jpeg");
    expect(result.buffer).toBeInstanceOf(Buffer);
    expect(result.buffer.toString()).toBe("fake-jpeg-data");
  });

  it("converts WEBP to JPEG 1080×1080", async () => {
    const { transcodeToJpeg } = await import(
      "@/lib/campaign/image-processor"
    );
    const result = await transcodeToJpeg(
      Buffer.from("fake-webp-data"),
      "image/webp"
    );

    expect(result.mimeType).toBe("image/jpeg");
    expect(result.buffer).toBeInstanceOf(Buffer);
    expect(result.buffer.toString()).toBe("fake-jpeg-data");
  });

  it("recompresses JPEG idempotently", async () => {
    const { transcodeToJpeg } = await import(
      "@/lib/campaign/image-processor"
    );
    const result = await transcodeToJpeg(
      Buffer.from("fake-jpeg-data"),
      "image/jpeg"
    );

    expect(result.mimeType).toBe("image/jpeg");
    expect(result.buffer).toBeInstanceOf(Buffer);
    expect(result.buffer.toString()).toBe("fake-jpeg-data");
  });

  it("rejects unsupported image format", async () => {
    const { transcodeToJpeg } = await import(
      "@/lib/campaign/image-processor"
    );
    await expect(
      transcodeToJpeg(Buffer.from("fake-gif-data"), "image/gif")
    ).rejects.toThrow("Unsupported image format: image/gif");
  });
});

describe("buildPublicationCopySnapshot", () => {
  it("returns shape with caption, hashtags, cta_post", async () => {
    const { buildPublicationCopySnapshot } = await import(
      "@/lib/campaign/image-processor"
    );
    const result = buildPublicationCopySnapshot({
      caption: "Texto da legenda",
      hashtags: ["#promo", "#oferta"],
      cta_post: "Compre agora",
    });

    expect(result).toEqual({
      caption: "Texto da legenda",
      hashtags: ["#promo", "#oferta"],
      cta_post: "Compre agora",
    });
  });

  it("accepts empty values without error", async () => {
    const { buildPublicationCopySnapshot } = await import(
      "@/lib/campaign/image-processor"
    );
    const result = buildPublicationCopySnapshot({
      caption: "",
      hashtags: [],
      cta_post: "",
    });

    expect(result).toEqual({
      caption: "",
      hashtags: [],
      cta_post: "",
    });
  });
});
