// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MAX_ARTIFACT_BYTES } from "@/lib/campaign/composition-artifacts/role-policy";

const sharpState = vi.hoisted(() => ({
  metadata: vi.fn(),
  raw: vi.fn(),
  factory: vi.fn(),
}));

vi.mock("sharp", () => {
  const sharp = (input: unknown, options?: unknown) => {
    sharpState.factory(input, options);
    return {
      metadata: sharpState.metadata,
      raw: () => ({ toBuffer: sharpState.raw }),
    };
  };
  return { default: sharp };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import { isSquareJpeg1024 } from "../gate";

describe("F60.4 gate - limites antes do decode completo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejeita bytes acima do limite sem chamar o decoder", async () => {
    const tooLarge = Buffer.alloc(MAX_ARTIFACT_BYTES + 1);

    await expect(isSquareJpeg1024(tooLarge)).resolves.toBe(false);
    expect(sharpState.factory).not.toHaveBeenCalled();
    expect(sharpState.metadata).not.toHaveBeenCalled();
    expect(sharpState.raw).not.toHaveBeenCalled();
  });

  it("rejeita 8192x8192 antes de raw(), sem decode completo", async () => {
    sharpState.metadata.mockResolvedValue({
      format: "jpeg",
      width: 8192,
      height: 8192,
    });

    await expect(isSquareJpeg1024(Buffer.alloc(16))).resolves.toBe(false);
    expect(sharpState.metadata).toHaveBeenCalledTimes(1);
    expect(sharpState.raw).not.toHaveBeenCalled();
  });

  it("rejeita dimensao diferente de 1024x1024 antes de raw()", async () => {
    sharpState.metadata.mockResolvedValue({
      format: "jpeg",
      width: 1024,
      height: 1025,
    });

    await expect(isSquareJpeg1024(Buffer.alloc(16))).resolves.toBe(false);
    expect(sharpState.raw).not.toHaveBeenCalled();
  });

  it("aceita 1024x1024 e preserva o decode completo", async () => {
    sharpState.metadata.mockResolvedValue({
      format: "jpeg",
      width: 1024,
      height: 1024,
    });
    sharpState.raw.mockResolvedValue({
      info: { width: 1024, height: 1024 },
      data: Buffer.alloc(0),
    });

    await expect(isSquareJpeg1024(Buffer.alloc(16))).resolves.toBe(true);
    expect(sharpState.metadata).toHaveBeenCalledTimes(1);
    expect(sharpState.raw).toHaveBeenCalledTimes(1);
    expect(sharpState.factory).toHaveBeenLastCalledWith(
      expect.any(Buffer),
      expect.objectContaining({ failOn: "error", limitInputPixels: expect.any(Number) }),
    );
  });
});
