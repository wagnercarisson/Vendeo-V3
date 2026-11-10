// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import sharp from "sharp";

vi.mock("server-only", () => ({}));

import {
  computeChecksumSha256,
  verifyCompositionArtifactBytes,
} from "../integrity";
import { MAX_ARTIFACT_BYTES } from "../role-policy";

async function jpeg(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 24, g: 160, b: 72 },
    },
  })
    .jpeg({ quality: 90 })
    .toBuffer();
}

describe("verifyCompositionArtifactBytes", () => {
  it("accepts the exact dimensions of each role", async () => {
    const original = await jpeg(1024, 1024);
    const prepared = await jpeg(1152, 1152);
    const vertical = await jpeg(1080, 1920);

    for (const [bytes, role] of [
      [original, "square_original"],
      [prepared, "square_prepared"],
      [vertical, "vertical"],
    ] as const) {
      const result = await verifyCompositionArtifactBytes(bytes, role);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.mimeType).toBe("image/jpeg");
        expect(result.byteSize).toBe(bytes.byteLength);
        expect(result.checksumSha256).toBe(computeChecksumSha256(bytes));
      }
    }
  });

  it("rejects a vertical JPEG presented as square_original", async () => {
    const result = await verifyCompositionArtifactBytes(
      await jpeg(1080, 1920),
      "square_original",
    );
    expect(result).toEqual({ ok: false, reason: "dimension_mismatch" });
  });

  it("rejects PNG bytes for any role", async () => {
    const png = await sharp({
      create: {
        width: 1024,
        height: 1024,
        channels: 3,
        background: { r: 1, g: 2, b: 3 },
      },
    })
      .png()
      .toBuffer();

    expect(await verifyCompositionArtifactBytes(png, "square_original")).toEqual({
      ok: false,
      reason: "not_jpeg",
    });
  });

  it("rejects truncated JPEG by full decode, not by header only", async () => {
    const valid = await jpeg(1024, 1024);
    const truncated = valid.subarray(0, Math.min(valid.length - 10, 2000));
    const result = await verifyCompositionArtifactBytes(
      truncated,
      "square_original",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(["decode_failed", "not_jpeg"]).toContain(result.reason);
    }
  });

  it("applies the byte limit before attempting to decode", async () => {
    const oversized = Buffer.alloc(MAX_ARTIFACT_BYTES + 1);
    expect(
      await verifyCompositionArtifactBytes(oversized, "square_original"),
    ).toEqual({ ok: false, reason: "byte_limit_exceeded" });
  });

  it("rejects pixels above the limit from the header", async () => {
    const tooManyPixels = await jpeg(4097, 4097);
    expect(
      await verifyCompositionArtifactBytes(tooManyPixels, "square_original"),
    ).toEqual({ ok: false, reason: "pixel_limit_exceeded" });
  });

  it("changes the checksum when a byte changes", () => {
    const first = Buffer.from([1, 2, 3]);
    const second = Buffer.from([1, 2, 4]);
    expect(computeChecksumSha256(first)).not.toBe(computeChecksumSha256(second));
  });
});
