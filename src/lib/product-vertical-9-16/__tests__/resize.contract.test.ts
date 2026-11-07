// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import sharp from "sharp";

vi.mock("server-only", () => ({}));

import {
  VerticalResizeError,
  resizeVerticalToJpeg1080x1920,
  verifyVerticalJpeg1080x1920,
} from "../artifact/resize";

async function source(
  width = 1152,
  height = 2048,
  color = { r: 200, g: 40, b: 40 },
): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: color },
  })
    .png()
    .toBuffer();
}

async function cornerPixels(buffer: Buffer) {
  const { data, info } = await sharp(buffer)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const at = (x: number, y: number): [number, number, number] => {
    const offset = (y * info.width + x) * info.channels;
    return [data[offset], data[offset + 1], data[offset + 2]];
  };
  return {
    topLeft: at(0, 0),
    topRight: at(info.width - 1, 0),
    bottomLeft: at(0, info.height - 1),
    bottomRight: at(info.width - 1, info.height - 1),
  };
}

describe("F59 — resize vertical 1152×2048 → JPEG 1080×1920", () => {
  it("produz JPEG sRGB 1080×1920 e preserva source 1152×2048", async () => {
    const result = await resizeVerticalToJpeg1080x1920(await source());
    expect(result.width).toBe(1080);
    expect(result.height).toBe(1920);
    expect(result.mimeType).toBe("image/jpeg");
    expect(result.sourceWidth).toBe(1152);
    expect(result.sourceHeight).toBe(2048);

    const metadata = await sharp(result.buffer).metadata();
    expect(metadata.format).toBe("jpeg");
    expect(metadata.width).toBe(1080);
    expect(metadata.height).toBe(1920);
    expect(metadata.space).toBe("srgb");
  });

  it("não injeta faixas brancas nos quatro cantos", async () => {
    const result = await resizeVerticalToJpeg1080x1920(await source());
    const corners = await cornerPixels(result.buffer);
    for (const pixel of Object.values(corners)) {
      expect(pixel[0]).toBeGreaterThan(180);
      expect(pixel[1]).toBeLessThan(60);
      expect(pixel[2]).toBeLessThan(60);
      expect(pixel).not.toEqual([255, 255, 255]);
    }
  });

  it("rejeita 1024×1024 por proporção", async () => {
    await expect(resizeVerticalToJpeg1080x1920(await source(1024, 1024))).rejects.toMatchObject({
      code: "source_aspect_mismatch",
    });
  });

  it("rejeita 1080×1920 por dimensão do provider", async () => {
    await expect(resizeVerticalToJpeg1080x1920(await source(1080, 1920))).rejects.toMatchObject({
      code: "source_dimension_mismatch",
    });
  });

  it("rejeita 1152×2047 e 1152×2049 por dimensão", async () => {
    for (const height of [2047, 2049]) {
      await expect(
        resizeVerticalToJpeg1080x1920(await source(1152, height)),
      ).rejects.toMatchObject({ code: "source_dimension_mismatch" });
    }
  });

  it("rejeita 1200×2048 por proporção", async () => {
    await expect(resizeVerticalToJpeg1080x1920(await source(1200, 2048))).rejects.toMatchObject({
      code: "source_aspect_mismatch",
    });
  });

  it("rejeita buffer não-imagem e truncado", async () => {
    await expect(
      resizeVerticalToJpeg1080x1920(Buffer.from("not-an-image")),
    ).rejects.toMatchObject({ code: "source_decode_failed" });

    const full = await source();
    const truncated = full.subarray(0, Math.floor(full.length / 2));
    await expect(
      resizeVerticalToJpeg1080x1920(truncated),
    ).rejects.toMatchObject({ code: "source_decode_failed" });
  });

  it("verifyVerticalJpeg1080x1920 rejeita não-JPEG e dimensão errada", async () => {
    const png = await source(1080, 1920);
    await expect(verifyVerticalJpeg1080x1920(png)).rejects.toMatchObject({
      code: "artifact_format_not_jpeg",
    });

    const wrong = await sharp({
      create: { width: 1024, height: 1024, channels: 3, background: "#fff" },
    })
      .jpeg()
      .toBuffer();
    await expect(verifyVerticalJpeg1080x1920(wrong)).rejects.toMatchObject({
      code: "artifact_dimension_mismatch",
    });
  });

  it("rejeita buffer vazio", async () => {
    await expect(resizeVerticalToJpeg1080x1920(Buffer.alloc(0))).rejects.toMatchObject({
      code: "source_decode_failed",
    });
  });

  it("expõe erro tipado VerticalResizeError", async () => {
    await expect(resizeVerticalToJpeg1080x1920(await source(1024, 1024))).rejects.toBeInstanceOf(
      VerticalResizeError,
    );
  });
});
