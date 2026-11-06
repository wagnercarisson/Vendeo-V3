// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  INSTAGRAM_PROTECTED_BANDS_PERCENT,
  SAFE_AREA_9_16_EXPERIMENTAL_VERSION,
  instagramProtectedBandsForCanvas,
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
