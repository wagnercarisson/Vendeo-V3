// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  SAFE_AREA_9_16_VERSION,
  SAFE_AREA_PERCENT,
  SAFE_AREA_POLICY,
  protectedRect,
  safeAreaForCanvas,
  safeAreaPromptLines,
} from "../safe-area";

describe("F59 — política de áreas seguras safe-area-9-16-v1", () => {
  it("congela versão e percentuais primários", () => {
    expect(SAFE_AREA_9_16_VERSION).toBe("safe-area-9-16-v1");
    expect(SAFE_AREA_POLICY.version).toBe("safe-area-9-16-v1");
    expect(SAFE_AREA_PERCENT).toEqual({
      top: 14,
      bottom: 35,
      sides: 6,
      bottomRightWidth: 30,
      bottomRightHeight: 40,
    });
    expect(Object.isFrozen(SAFE_AREA_PERCENT)).toBe(true);
    expect(Object.isFrozen(SAFE_AREA_POLICY)).toBe(true);
    expect(Object.isFrozen(SAFE_AREA_POLICY.bottomRight)).toBe(true);
  });

  it("expõe os cinco pixels literais do canvas de entrega", () => {
    expect(SAFE_AREA_POLICY.canvas).toEqual({ width: 1080, height: 1920 });
    expect(SAFE_AREA_POLICY.top.px).toBe(269);
    expect(SAFE_AREA_POLICY.bottom.px).toBe(672);
    expect(SAFE_AREA_POLICY.sides.px).toBe(65);
    expect(SAFE_AREA_POLICY.bottomRight.width).toBe(324);
    expect(SAFE_AREA_POLICY.bottomRight.height).toBe(768);
  });

  it("classifica proveniência sem prometer garantia de plataforma", () => {
    expect(SAFE_AREA_POLICY.top.provenance).toBe("pending");
    expect(SAFE_AREA_POLICY.bottom.provenance).toBe("pending");
    expect(SAFE_AREA_POLICY.sides.provenance).toBe("pending");
    expect(SAFE_AREA_POLICY.bottomRight.provenance).toBe("conservative");
    expect(SAFE_AREA_POLICY.validation).toBe("pending");
  });

  it("deriva pixels do canvas de geração 1152 × 2048", () => {
    expect(safeAreaForCanvas(1152, 2048)).toEqual({
      width: 1152,
      height: 2048,
      percent: SAFE_AREA_PERCENT,
      topPx: 287,
      bottomPx: 717,
      sidesPx: 69,
      bottomRightWidth: 346,
      bottomRightHeight: 819,
      isGenerationCanvas: true,
    });
  });

  it("devolve os literais do canvas de entrega 1080 × 1920", () => {
    expect(safeAreaForCanvas(1080, 1920)).toEqual({
      width: 1080,
      height: 1920,
      percent: SAFE_AREA_PERCENT,
      topPx: 269,
      bottomPx: 672,
      sidesPx: 65,
      bottomRightWidth: 324,
      bottomRightHeight: 768,
      isGenerationCanvas: false,
    });
  });

  it("rejeita qualquer outro canvas", () => {
    expect(safeAreaForCanvas(1024, 1024)).toBeNull();
    expect(safeAreaForCanvas(1080, 1920.5)).toBeNull();
    expect(safeAreaForCanvas(1152, 2047)).toBeNull();
  });

  it("o downscale 0,9375 reconstrói a entrega com erro ≤ 1 px", () => {
    const generation = safeAreaForCanvas(1152, 2048)!;
    const delivery = safeAreaForCanvas(1080, 1920)!;
    const pairs: ReadonlyArray<readonly [number, number]> = [
      [generation.topPx, delivery.topPx],
      [generation.bottomPx, delivery.bottomPx],
      [generation.sidesPx, delivery.sidesPx],
      [generation.bottomRightWidth, delivery.bottomRightWidth],
      [generation.bottomRightHeight, delivery.bottomRightHeight],
    ];
    for (const [generationPx, deliveryPx] of pairs) {
      expect(
        Math.abs(Math.round(generationPx * 0.9375) - deliveryPx),
      ).toBeLessThanOrEqual(1);
    }
  });

  it("expõe o retângulo protegido congelado", () => {
    const rect = protectedRect();
    expect(rect).toEqual({ xMin: 65, xMax: 1015, yMin: 269, yMax: 1248 });
    expect(Object.isFrozen(rect)).toBe(true);
  });

  it("orienta o prompt por percentuais e rotula pixels de entrega", () => {
    const lines = safeAreaPromptLines();
    const joined = lines.join(" ");
    expect(lines.length).toBeGreaterThanOrEqual(5);
    expect(Object.isFrozen(lines)).toBe(true);
    expect(joined).toMatch(/14%/);
    expect(joined).toMatch(/35%/);
    expect(joined).toMatch(/6%/);
    expect(joined).toMatch(/30%/);
    expect(joined).toContain("referência de entrega 1080 × 1920");
    for (const line of lines) {
      if (line.includes("px")) {
        expect(line).toContain("referência de entrega 1080 × 1920");
      }
    }
    expect(joined).not.toMatch(
      /garantid|todos os posicionamentos|compatível com todas/i,
    );
  });

  it("é determinístico", () => {
    expect(safeAreaPromptLines()).toEqual(safeAreaPromptLines());
  });
});
