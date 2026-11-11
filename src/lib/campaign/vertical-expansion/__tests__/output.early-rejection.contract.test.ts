// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const state = vi.hoisted(() => ({
  metadata: { format: "png", width: 90_000, height: 160_000 } as Record<string, unknown>,
  metadataError: null as Error | null,
  rawToBuffer: vi.fn(async () => ({
    info: { width: 1152, height: 2048 },
    data: Buffer.alloc(0),
  })),
  sharpOptions: [] as unknown[],
}));

vi.mock("sharp", () => {
  const sharpMock = vi.fn((_bytes: Buffer, options?: unknown) => {
    state.sharpOptions.push(options);
    return {
      metadata: async () => {
        if (state.metadataError) throw state.metadataError;
        return state.metadata;
      },
      raw: () => ({ toBuffer: state.rawToBuffer }),
    };
  });
  return { default: sharpMock };
});

import { MAX_ARTIFACT_PIXELS } from "@/lib/campaign/composition-artifacts/role-policy";

import { validateProviderImageBytes } from "../output";

/**
 * F60.3 — prova de rejeição antecipada sem alocar bitmap gigante.
 *
 * O teste usa um `sharp` falso apenas para observar a ORDEM das chamadas e as
 * opções explícitas. Nenhum buffer de imagem gigante é criado; o metadata falso
 * declara dimensões enormes. O decode real continua coberto pelos testes com
 * Sharp real em `output.contract.test.ts`.
 */
describe("validateProviderImageBytes — rejeição antecipada", () => {
  beforeEach(() => {
    state.metadata = { format: "png", width: 1152, height: 2048 };
    state.metadataError = null;
    state.rawToBuffer.mockReset();
    state.rawToBuffer.mockResolvedValue({
      info: { width: 1152, height: 2048 },
      data: Buffer.alloc(0),
    });
    state.sharpOptions.length = 0;
  });

  it("recusa dimensões enormes no metadata sem chamar o decode de pixels", async () => {
    state.metadata = { format: "png", width: 90_000, height: 160_000 };

    const result = await validateProviderImageBytes(Buffer.from([1, 2, 3]));

    expect(result).toMatchObject({
      ok: false,
      reason: "dimensions_mismatch",
      returnedSize: "90000x160000",
    });
    expect(state.rawToBuffer).not.toHaveBeenCalled();
    expect(state.sharpOptions).toHaveLength(1);
    expect(state.sharpOptions[0]).toMatchObject({
      limitInputPixels: MAX_ARTIFACT_PIXELS,
    });
  });

  it("recusa header acima do limite de pixels do metadata sem decode", async () => {
    state.metadataError = new Error("Input image exceeds pixel limit");

    const result = await validateProviderImageBytes(Buffer.from([1, 2, 3]));

    expect(result).toMatchObject({
      ok: false,
      reason: "dimensions_mismatch",
      returnedSize: null,
    });
    expect(state.rawToBuffer).not.toHaveBeenCalled();
  });

  it("recusa proporção inválida no metadata sem decode", async () => {
    state.metadata = { format: "png", width: 1024, height: 1024 };

    const result = await validateProviderImageBytes(Buffer.from([1, 2, 3]));

    expect(result).toMatchObject({
      ok: false,
      reason: "aspect_mismatch",
      returnedSize: "1024x1024",
    });
    expect(state.rawToBuffer).not.toHaveBeenCalled();
    expect(state.sharpOptions[0]).toMatchObject({
      limitInputPixels: MAX_ARTIFACT_PIXELS,
    });
  });

  it("recusa formato não aceito sem decode", async () => {
    state.metadata = { format: "webp", width: 1152, height: 2048 };

    const result = await validateProviderImageBytes(Buffer.from([1, 2, 3]));

    expect(result).toMatchObject({
      ok: false,
      reason: "not_image",
      returnedSize: null,
    });
    expect(state.rawToBuffer).not.toHaveBeenCalled();
  });

  it("imagem válida só decodifica com limitInputPixels explícito", async () => {
    const result = await validateProviderImageBytes(Buffer.from([1, 2, 3]));

    expect(result).toEqual({
      ok: true,
      width: 1152,
      height: 2048,
      returnedSize: "1152x2048",
    });
    expect(state.rawToBuffer).toHaveBeenCalledTimes(1);
    expect(state.sharpOptions).toHaveLength(2);
    expect(state.sharpOptions[1]).toMatchObject({
      limitInputPixels: 1152 * 2048,
    });
  });

  it("falha do decode após metadata válido vira decode_failed", async () => {
    state.rawToBuffer.mockRejectedValueOnce(new Error("decode boom"));

    const result = await validateProviderImageBytes(Buffer.from([1, 2, 3]));

    expect(result).toMatchObject({ ok: false, reason: "decode_failed" });
    expect(state.rawToBuffer).toHaveBeenCalledTimes(1);
    expect(state.sharpOptions[1]).toMatchObject({
      limitInputPixels: 1152 * 2048,
    });
  });
});
