// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import sharp from "sharp";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import {
  c4DeterministicImageBase64,
  createC4HttpInjection,
} from "../c4-http-injection";

const client = { from: vi.fn() } as never;

describe("F60.7 C4-I — injeção determinística", () => {
  it("gera bytes JPEG determinísticos nas dimensões exigidas", async () => {
    const square = Buffer.from(
      await c4DeterministicImageBase64("square"),
      "base64",
    );
    const squareMeta = await sharp(square).metadata();
    expect(squareMeta.format).toBe("jpeg");
    expect(squareMeta.width).toBe(1024);
    expect(squareMeta.height).toBe(1024);

    const vertical = Buffer.from(
      await c4DeterministicImageBase64("vertical"),
      "base64",
    );
    const verticalMeta = await sharp(vertical).metadata();
    expect(verticalMeta.format).toBe("jpeg");
    expect(verticalMeta.width).toBe(1152);
    expect(verticalMeta.height).toBe(2048);
  });

  it("compõe base/expand com as fronteiras determinísticas", () => {
    const deps = createC4HttpInjection({ client });
    expect(deps.base).toBeTypeOf("function");
    expect(deps.expand).toBeTypeOf("function");
    expect(deps.prepare).toBeTypeOf("function");
    expect(deps.generateThumbnail).toBeTypeOf("function");
  });
});
