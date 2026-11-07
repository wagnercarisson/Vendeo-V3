import { describe, expect, it } from "vitest";

import {
  computeExpandGeometry,
  EXPAND_TARGET_HEIGHT,
  EXPAND_TARGET_SIZE,
  EXPAND_TARGET_WIDTH,
} from "../domain/expand-geometry";

/**
 * Geometria solicitada da expansão (quick 261107-qvo).
 * Não valida preservação visual; só o plano de faixas e as recusas.
 */

describe("expand-geometry — 4:5 canônico", () => {
  it("1152×1440 → 1152×2048 acrescenta 304 px acima e 304 abaixo, escala 1", () => {
    const geometry = computeExpandGeometry({ width: 1152, height: 1440 });
    expect(geometry.supported).toBe(true);
    if (!geometry.supported) return;
    expect(geometry.target.width).toBe(EXPAND_TARGET_WIDTH);
    expect(geometry.target.height).toBe(EXPAND_TARGET_HEIGHT);
    expect(geometry.target.size).toBe(EXPAND_TARGET_SIZE);
    expect(geometry.top).toBe(304);
    expect(geometry.bottom).toBe(304);
    expect(geometry.left).toBe(0);
    expect(geometry.right).toBe(0);
    expect(geometry.scaleX).toBe(1);
    expect(geometry.scaleY).toBe(1);
  });

  it("1152×1439 distribui a diferença ímpar sem crop", () => {
    const geometry = computeExpandGeometry({ width: 1152, height: 1439 });
    expect(geometry.supported).toBe(true);
    if (!geometry.supported) return;
    expect(geometry.top + geometry.bottom).toBe(609);
    expect(Math.abs(geometry.top - geometry.bottom)).toBe(1);
  });

  it("1152×2048 ⇒ no_expansion_needed", () => {
    const geometry = computeExpandGeometry({ width: 1152, height: 2048 });
    expect(geometry.supported).toBe(false);
    if (geometry.supported) return;
    expect(geometry.reason).toBe("no_expansion_needed");
  });
});

describe("expand-geometry — entradas recusadas sem resize silencioso", () => {
  it("largura diferente de 1152 ⇒ width_mismatch", () => {
    const geometry = computeExpandGeometry({ width: 1024, height: 1024 });
    expect(geometry.supported).toBe(false);
    if (geometry.supported) return;
    expect(geometry.reason).toBe("width_mismatch");
    expect(geometry.proposedSolution).toContain("não está habilitado");
  });

  it("altura maior que 2048 ⇒ height_exceeds_target", () => {
    const geometry = computeExpandGeometry({ width: 1152, height: 2560 });
    expect(geometry.supported).toBe(false);
    if (geometry.supported) return;
    expect(geometry.reason).toBe("height_exceeds_target");
  });

  it("dimensões inválidas ⇒ invalid_dimensions", () => {
    for (const input of [
      { width: 0, height: 1440 },
      { width: 1152, height: 0 },
      { width: 1152.5, height: 1440 },
    ]) {
      const geometry = computeExpandGeometry(input);
      expect(geometry.supported, JSON.stringify(input)).toBe(false);
      if (geometry.supported) continue;
      expect(geometry.reason).toBe("invalid_dimensions");
    }
  });
});
