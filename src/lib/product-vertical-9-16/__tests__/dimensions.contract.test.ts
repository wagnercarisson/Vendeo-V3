// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  DELIVERED_HEIGHT,
  DELIVERED_WIDTH,
  DOWNSCALE_FACTOR,
  PROVIDER_SIZE,
  assertProviderDimensions,
  deliveredSizeFor,
  hasEqualAspect,
} from "../dimensions";

describe("F59 — dimensões do Produto vertical 9:16", () => {
  it("congela os literais solicitado/entregue e o fator único", () => {
    expect(PROVIDER_SIZE).toBe("1152x2048");
    expect(DELIVERED_WIDTH).toBe(1080);
    expect(DELIVERED_HEIGHT).toBe(1920);
    expect(DOWNSCALE_FACTOR).toBe(0.9375);
  });

  it("prova proporção 9:16 por multiplicação cruzada inteira", () => {
    expect(hasEqualAspect(1152, 2048)).toBe(true);
    expect(hasEqualAspect(1080, 1920)).toBe(true);
    expect(hasEqualAspect(1024, 1024)).toBe(false);
    expect(hasEqualAspect(1152, 2047)).toBe(false);
  });

  it("aceita exatamente 1152 × 2048", () => {
    expect(assertProviderDimensions(1152, 2048)).toEqual({ ok: true });
  });

  it("rejeita 1080 × 1920 por divisibilidade antes da proporção", () => {
    expect(assertProviderDimensions(1080, 1920)).toEqual({
      ok: false,
      reason: "provider_size_not_divisible_by_16",
    });
  });

  it("rejeita 1024 × 1024 por proporção", () => {
    expect(assertProviderDimensions(1024, 1024)).toEqual({
      ok: false,
      reason: "provider_aspect_mismatch",
    });
  });

  it("rejeita 1152 × 2047 por divisibilidade (2047 % 16 = 15)", () => {
    expect(assertProviderDimensions(1152, 2047)).toEqual({
      ok: false,
      reason: "provider_size_not_divisible_by_16",
    });
  });

  it("rejeita 1200 × 2048 por proporção (ambos divisíveis por 16)", () => {
    expect(assertProviderDimensions(1200, 2048)).toEqual({
      ok: false,
      reason: "provider_aspect_mismatch",
    });
  });

  it("deriva a entrega somente de 1152 × 2048", () => {
    expect(deliveredSizeFor(1152, 2048)).toEqual({
      width: 1080,
      height: 1920,
      factor: 0.9375,
    });
    expect(deliveredSizeFor(1080, 1920)).toBeNull();
    expect(deliveredSizeFor(1024, 1024)).toBeNull();
  });
});
