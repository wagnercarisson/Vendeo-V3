// @vitest-environment node
import { beforeAll, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

vi.mock("server-only", () => ({}));

import { computeChecksumSha256 } from "@/lib/campaign/composition-artifacts/integrity";

import { SQUARE_PREPARATION_TARGET } from "../recipe";
import { transformSquare1024To1152 } from "../transform";
import {
  buildJpeg,
  buildPng,
  buildSquare1024Fixture,
  truncateJpeg,
} from "./support/jpeg-fixtures";

let sourceImage: Buffer;

beforeAll(async () => {
  sourceImage = await buildSquare1024Fixture();
});

describe("transformSquare1024To1152", () => {
  it("transforma JPEG 1024×1024 em JPEG 1152×1152 de 3 canais", async () => {
    const result = await transformSquare1024To1152(sourceImage);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.width).toBe(SQUARE_PREPARATION_TARGET.width);
    expect(result.height).toBe(SQUARE_PREPARATION_TARGET.height);
    expect(result.mimeType).toBe("image/jpeg");

    const metadata = await sharp(result.bytes).metadata();
    expect(metadata.format).toBe("jpeg");
    expect(metadata.width).toBe(1152);
    expect(metadata.height).toBe(1152);

    const decoded = await sharp(result.bytes)
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect(decoded.info.width).toBe(1152);
    expect(decoded.info.height).toBe(1152);
    expect(decoded.info.channels).toBe(3);
  });

  it("recusa 1080×1080 com source_dimension_mismatch", async () => {
    const result = await transformSquare1024To1152(await buildJpeg(1080, 1080));
    expect(result).toEqual({ ok: false, reason: "source_dimension_mismatch" });
  });

  it("recusa 1152×1152 com source_dimension_mismatch", async () => {
    const result = await transformSquare1024To1152(await buildJpeg(1152, 1152));
    expect(result).toEqual({ ok: false, reason: "source_dimension_mismatch" });
  });

  it("recusa PNG 1024×1024 com source_not_jpeg", async () => {
    const result = await transformSquare1024To1152(await buildPng(1024, 1024));
    expect(result).toEqual({ ok: false, reason: "source_not_jpeg" });
  });

  it("recusa JPEG truncado com source_decode_failed", async () => {
    const result = await transformSquare1024To1152(truncateJpeg(sourceImage));
    expect(result).toEqual({ ok: false, reason: "source_decode_failed" });
  });

  it("recusa buffer vazio e entrada não-Buffer com source_decode_failed", async () => {
    const empty = await transformSquare1024To1152(Buffer.alloc(0));
    expect(empty).toEqual({ ok: false, reason: "source_decode_failed" });

    const nullLike = await transformSquare1024To1152(
      null as unknown as Buffer,
    );
    expect(nullLike).toEqual({ ok: false, reason: "source_decode_failed" });
  });

  it("é determinístico por build: duas execuções geram o mesmo checksum", async () => {
    const first = await transformSquare1024To1152(sourceImage);
    const second = await transformSquare1024To1152(sourceImage);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    expect(computeChecksumSha256(first.bytes)).toBe(
      computeChecksumSha256(second.bytes),
    );
    expect(first.bytes.equals(second.bytes)).toBe(true);
  });

  it("nunca lança: todo caminho de erro é retorno tipado", async () => {
    const inputs = [
      Buffer.alloc(0),
      truncateJpeg(sourceImage),
      await buildPng(1024, 1024),
      await buildJpeg(1080, 1080),
      await buildJpeg(1152, 1152),
      null as unknown as Buffer,
    ];

    for (const input of inputs) {
      await expect(transformSquare1024To1152(input)).resolves.toMatchObject({
        ok: false,
      });
    }
  });
});
