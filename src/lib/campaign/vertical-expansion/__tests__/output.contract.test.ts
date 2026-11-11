// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";

import sharp from "sharp";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { MAX_ARTIFACT_BYTES } from "@/lib/campaign/composition-artifacts/role-policy";
import { verifyVerticalJpeg1080x1920 } from "@/lib/product-vertical-9-16/artifact/resize";
import {
  buildJpeg,
  buildPng,
  buildVertical1080x1920Fixture,
  buildVertical1152x2048Fixture,
  truncateJpeg,
} from "@/lib/campaign/__tests__/support/jpeg-fixtures";

import { exportVerticalJpeg, validateProviderImageBytes } from "../output";

let providerJpeg: Buffer;
let providerPng: Buffer;
let deliveredJpeg: Buffer;
let square1024: Buffer;
let deliveredSizeJpeg: Buffer;
let oddHeightJpeg: Buffer;

beforeAll(async () => {
  providerJpeg = await buildVertical1152x2048Fixture();
  providerPng = await buildPng(1152, 2048);
  deliveredJpeg = await buildVertical1080x1920Fixture();
  square1024 = await buildJpeg(1024, 1024);
  deliveredSizeJpeg = await buildJpeg(1080, 1920);
  oddHeightJpeg = await buildJpeg(1152, 2049);
});

async function centerAndCorner(bytes: Buffer): Promise<{
  center: readonly number[];
  corner: readonly number[];
  width: number;
  height: number;
}> {
  const decoded = await sharp(bytes).raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = decoded.info;
  const at = (x: number, y: number): number[] => {
    const offset = (y * width + x) * channels;
    const pixel: number[] = [];
    for (let i = 0; i < channels; i += 1) pixel.push(decoded.data[offset + i]);
    return pixel;
  };
  return {
    center: at(Math.floor(width / 2), Math.floor(height / 2)),
    corner: at(2, 2),
    width,
    height,
  };
}

describe("fixtures compartilhadas do vertical", () => {
  it("buildVertical1152x2048Fixture é JPEG 1152×2048 com marcador central distinguível", async () => {
    const sampled = await centerAndCorner(providerJpeg);

    expect(sampled.width).toBe(1152);
    expect(sampled.height).toBe(2048);
    expect(sampled.center).not.toEqual(sampled.corner);
  });

  it("buildVertical1080x1920Fixture é JPEG 1080×1920 sem metadata de evidência", async () => {
    const metadata = await sharp(deliveredJpeg).metadata();

    expect(metadata.format).toBe("jpeg");
    expect(metadata.width).toBe(1080);
    expect(metadata.height).toBe(1920);
    expect(metadata.exif).toBeUndefined();
    expect(metadata.xmp).toBeUndefined();
  });
});

describe("validateProviderImageBytes", () => {
  it("aceita 1152×2048 em PNG (saída real do provider) e em JPEG", async () => {
    const png = await validateProviderImageBytes(providerPng);
    const jpeg = await validateProviderImageBytes(providerJpeg);

    expect(png).toEqual({
      ok: true,
      width: 1152,
      height: 2048,
      returnedSize: "1152x2048",
    });
    expect(jpeg).toEqual({
      ok: true,
      width: 1152,
      height: 2048,
      returnedSize: "1152x2048",
    });
  });

  it("recusa 1024×1024 por proporção", async () => {
    const result = await validateProviderImageBytes(square1024);
    expect(result).toMatchObject({
      ok: false,
      reason: "aspect_mismatch",
      returnedSize: "1024x1024",
    });
  });

  it("recusa 1080×1920 (proporção 9:16, mas dimensão não suportada pelo provider)", async () => {
    const result = await validateProviderImageBytes(deliveredSizeJpeg);
    expect(result).toMatchObject({
      ok: false,
      reason: "dimensions_mismatch",
      returnedSize: "1080x1920",
    });
  });

  it("recusa 1152×2049 e mede o tamanho dos bytes", async () => {
    const result = await validateProviderImageBytes(oddHeightJpeg);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(["aspect_mismatch", "dimensions_mismatch"]).toContain(result.reason);
      expect(result.returnedSize).toBe("1152x2049");
    }
  });

  it("buffer truncado vira decode_failed", async () => {
    const result = await validateProviderImageBytes(truncateJpeg(providerJpeg));
    expect(result).toMatchObject({ ok: false, reason: "decode_failed" });
  });

  it("texto, buffer vazio e payload acima do limite nunca lançam", async () => {
    const text = await validateProviderImageBytes(Buffer.from("isto não é uma imagem"));
    const empty = await validateProviderImageBytes(Buffer.alloc(0));
    const oversized = await validateProviderImageBytes(
      Buffer.alloc(MAX_ARTIFACT_BYTES + 1),
    );

    expect(text).toMatchObject({ ok: false, reason: "not_image", returnedSize: null });
    expect(empty).toMatchObject({ ok: false, reason: "not_image" });
    expect(oversized).toMatchObject({ ok: false, reason: "not_image" });
  });
});

describe("exportVerticalJpeg", () => {
  it("exporta o retorno válido para JPEG 1080×1920 verificado por decode", async () => {
    const result = await exportVerticalJpeg(providerPng);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.width).toBe(1080);
    expect(result.height).toBe(1920);
    expect(result.mimeType).toBe("image/jpeg");
    await expect(verifyVerticalJpeg1080x1920(result.buffer)).resolves.toMatchObject({
      width: 1080,
      height: 1920,
      mimeType: "image/jpeg",
    });
  });

  it("bytes inválidos devolvem reason tipado e nunca lançam VerticalResizeError", async () => {
    const result = await exportVerticalJpeg(Buffer.from("não é imagem"));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect([
      "source_decode_failed",
      "source_dimension_mismatch",
      "source_aspect_mismatch",
      "artifact_format_not_jpeg",
      "artifact_dimension_mismatch",
    ]).toContain(result.reason);
  });

  it("fonte com dimensão errada não é exportada", async () => {
    const result = await exportVerticalJpeg(square1024);
    expect(result.ok).toBe(false);
  });
});

describe("output.ts — fronteiras de I/O", () => {
  it("não importa filesystem, Supabase nem provider e não reimplementa recorte/redimensionamento", () => {
    const source = readFileSync(
      path.resolve(process.cwd(), "src/lib/campaign/vertical-expansion/output.ts"),
      "utf8",
    );

    expect(source).not.toContain("node:fs");
    expect(source).not.toContain("@supabase/");
    expect(source).not.toContain("fetch(");
    expect(source).not.toContain("crop");
    expect(source).not.toContain("extend");
    expect(source).not.toContain("pad");
    expect(source).not.toContain(".resize(");
  });
});
