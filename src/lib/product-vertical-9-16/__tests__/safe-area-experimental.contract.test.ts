// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  INSTAGRAM_PROTECTED_BANDS_PERCENT,
  INSTAGRAM_BOTTOM_BAND_PERCENT,
  INSTAGRAM_TOP_BOTTOM_BANDS_PERCENT,
  SAFE_AREA_9_16_EXPERIMENTAL_VERSION,
  SAFE_AREA_9_16_BOTTOM_ONLY_VERSION,
  SAFE_AREA_9_16_TOP_BOTTOM_VERSION,
  instagramBottomBandForCanvas,
  instagramProtectedBandsForCanvas,
  instagramTopBottomBandsForCanvas,
} from "../safe-area-experimental";

describe("F59 — faixas experimentais para composição no Instagram", () => {
  it("versiona a política experimental e documenta 15%/20%", () => {
    expect(SAFE_AREA_9_16_EXPERIMENTAL_VERSION).toBe(
      "safe-area-9-16-experimental-v1",
    );
    expect(INSTAGRAM_PROTECTED_BANDS_PERCENT).toEqual({
      top: 15,
      bottom: 20,
    });
  });

  it("calcula as faixas no canvas de geração 1152×2048", () => {
    expect(instagramProtectedBandsForCanvas(1152, 2048)).toEqual({
      width: 1152,
      height: 2048,
      topPx: 307,
      bottomPx: 410,
      protectedYMin: 307,
      protectedYMax: 1638,
      isGenerationCanvas: true,
    });
  });

  it("calcula as faixas na entrega 1080×1920", () => {
    expect(instagramProtectedBandsForCanvas(1080, 1920)).toEqual({
      width: 1080,
      height: 1920,
      topPx: 288,
      bottomPx: 384,
      protectedYMin: 288,
      protectedYMax: 1536,
      isGenerationCanvas: false,
    });
  });

  it("não cria máscara lateral nem recorte de canto", () => {
    const bands = instagramProtectedBandsForCanvas(1152, 2048)!;
    expect(Object.keys(bands)).toEqual([
      "width",
      "height",
      "topPx",
      "bottomPx",
      "protectedYMin",
      "protectedYMax",
      "isGenerationCanvas",
    ]);
    expect(bands).not.toHaveProperty("sidesPx");
    expect(bands).not.toHaveProperty("bottomRightWidth");
    expect(bands).not.toHaveProperty("bottomRightHeight");
  });

  it("falha fechado para canvas não suportado", () => {
    expect(instagramProtectedBandsForCanvas(1024, 1024)).toBeNull();
    expect(instagramProtectedBandsForCanvas(1080, 1919)).toBeNull();
  });
});

describe("F59 — faixa inferior experimental v2", () => {
  it("versiona a política v2 e documenta somente 20% inferiores", () => {
    expect(SAFE_AREA_9_16_BOTTOM_ONLY_VERSION).toBe(
      "safe-area-9-16-experimental-v2",
    );
    expect(INSTAGRAM_BOTTOM_BAND_PERCENT).toEqual({ bottom: 20 });
  });

  it("calcula a faixa inferior no canvas de geração 1152×2048", () => {
    expect(instagramBottomBandForCanvas(1152, 2048)).toEqual({
      width: 1152,
      height: 2048,
      bottomPx: 410,
      protectedYMax: 1638,
      isGenerationCanvas: true,
    });
  });

  it("calcula a faixa inferior na entrega 1080×1920", () => {
    expect(instagramBottomBandForCanvas(1080, 1920)).toEqual({
      width: 1080,
      height: 1920,
      bottomPx: 384,
      protectedYMax: 1536,
      isGenerationCanvas: false,
    });
  });

  it("não cria faixa superior, máscara lateral nem recorte de canto", () => {
    const band = instagramBottomBandForCanvas(1152, 2048)!;
    expect(Object.keys(band)).toEqual([
      "width",
      "height",
      "bottomPx",
      "protectedYMax",
      "isGenerationCanvas",
    ]);
    expect(band).not.toHaveProperty("topPx");
    expect(band).not.toHaveProperty("sidesPx");
    expect(band).not.toHaveProperty("bottomRightWidth");
  });

  it("falha fechado para canvas não suportado", () => {
    expect(instagramBottomBandForCanvas(1024, 1024)).toBeNull();
    expect(instagramBottomBandForCanvas(1080, 1919)).toBeNull();
  });
});

describe("F59 — faixas experimentais v3 (5% superiores + 20% inferiores)", () => {
  it("versiona a política v3 e documenta 5%/20%", () => {
    expect(SAFE_AREA_9_16_TOP_BOTTOM_VERSION).toBe(
      "safe-area-9-16-experimental-v3",
    );
    expect(INSTAGRAM_TOP_BOTTOM_BANDS_PERCENT).toEqual({
      top: 5,
      bottom: 20,
    });
  });

  it("calcula as faixas no canvas de geração 1152×2048", () => {
    expect(instagramTopBottomBandsForCanvas(1152, 2048)).toEqual({
      width: 1152,
      height: 2048,
      topPx: 102,
      bottomPx: 410,
      protectedYMin: 102,
      protectedYMax: 1638,
      isGenerationCanvas: true,
    });
  });

  it("calcula as faixas na entrega 1080×1920", () => {
    expect(instagramTopBottomBandsForCanvas(1080, 1920)).toEqual({
      width: 1080,
      height: 1920,
      topPx: 96,
      bottomPx: 384,
      protectedYMin: 96,
      protectedYMax: 1536,
      isGenerationCanvas: false,
    });
  });

  it("não cria máscara lateral nem recorte de canto", () => {
    const bands = instagramTopBottomBandsForCanvas(1152, 2048)!;
    expect(Object.keys(bands)).toEqual([
      "width",
      "height",
      "topPx",
      "bottomPx",
      "protectedYMin",
      "protectedYMax",
      "isGenerationCanvas",
    ]);
    expect(bands).not.toHaveProperty("sidesPx");
    expect(bands).not.toHaveProperty("bottomRightWidth");
    expect(bands).not.toHaveProperty("bottomRightHeight");
  });

  it("falha fechado para canvas não suportado", () => {
    expect(instagramTopBottomBandsForCanvas(1024, 1024)).toBeNull();
    expect(instagramTopBottomBandsForCanvas(1080, 1919)).toBeNull();
  });
});
