/**
 * Geometria **solicitada** da expansão de uma campanha pronta para 9:16
 * (quick 261107-qvo).
 *
 * Módulo puro. A saída canônica é `1152x2048`; a entrada suportada nesta
 * primeira versão tem largura `1152` e altura menor que `2048`. O cálculo é
 * apenas o plano de acrescentar faixas superior/inferior; **não** comprova que
 * o modelo preservará o conteúdo central.
 */

export const EXPAND_TARGET_WIDTH = 1152 as const;
export const EXPAND_TARGET_HEIGHT = 2048 as const;
export const EXPAND_TARGET_SIZE = "1152x2048" as const;
export const EXPAND_TARGET_FORMAT = "9:16" as const;

export type ExpandGeometryError =
  | "invalid_dimensions"
  | "width_mismatch"
  | "height_exceeds_target"
  | "no_expansion_needed";

export interface ExpandGeometrySupported {
  readonly supported: true;
  readonly source: { width: number; height: number };
  readonly target: { width: number; height: number; format: "9:16"; size: string };
  readonly top: number;
  readonly bottom: number;
  readonly left: 0;
  readonly right: 0;
  /** Escala **solicitada**; não é garantia de resultado. */
  readonly scaleX: 1;
  readonly scaleY: 1;
}

export interface ExpandGeometryUnsupported {
  readonly supported: false;
  readonly reason: ExpandGeometryError;
  readonly source: { width: number; height: number };
  readonly target: { width: number; height: number; format: "9:16"; size: string };
  /** Solução futura explícita; não é executada nesta versão. */
  readonly proposedSolution: string;
}

export type ExpandGeometry = ExpandGeometrySupported | ExpandGeometryUnsupported;

const TARGET = {
  width: EXPAND_TARGET_WIDTH,
  height: EXPAND_TARGET_HEIGHT,
  format: EXPAND_TARGET_FORMAT,
  size: EXPAND_TARGET_SIZE,
} as const;

function unsupported(
  width: number,
  height: number,
  reason: ExpandGeometryError,
  proposedSolution: string,
): ExpandGeometryUnsupported {
  return {
    supported: false,
    reason,
    source: { width, height },
    target: TARGET,
    proposedSolution,
  };
}

/**
 * Calcula a geometria solicitada.
 *
 * Regras desta versão:
 *  - largura diferente de 1152 ⇒ `width_mismatch` (sem resize silencioso);
 *  - altura igual a 2048 ⇒ `no_expansion_needed` (não há quadro a expandir);
 *  - altura maior que 2048 ⇒ `height_exceeds_target`;
 *  - largura 1152 e altura < 2048 ⇒ faixas superior/inferior iguais ou
 *    com 1 px de diferença ímpar, escala 1.0.
 */
export function computeExpandGeometry(input: {
  width: number;
  height: number;
}): ExpandGeometry {
  const { width, height } = input;
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return unsupported(
      width,
      height,
      "invalid_dimensions",
      "Envie uma imagem válida com dimensões positivas.",
    );
  }
  if (width !== EXPAND_TARGET_WIDTH) {
    return unsupported(
      width,
      height,
      "width_mismatch",
      `A largura ${width}px difere do destino ${EXPAND_TARGET_WIDTH}px. Uma versão futura pode redimensionar/cropar explicitamente, mas isso altera a escala e não está habilitado nesta experiência.`,
    );
  }
  if (height === EXPAND_TARGET_HEIGHT) {
    return unsupported(
      width,
      height,
      "no_expansion_needed",
      "A imagem já tem a altura final 2048px; não há quadro a expandir.",
    );
  }
  if (height > EXPAND_TARGET_HEIGHT) {
    return unsupported(
      width,
      height,
      "height_exceeds_target",
      `A altura ${height}px excede o destino ${EXPAND_TARGET_HEIGHT}px. Reduzir/cropar não está habilitado nesta versão.`,
    );
  }

  const total = EXPAND_TARGET_HEIGHT - height;
  const top = Math.floor(total / 2);
  const bottom = total - top;
  return {
    supported: true,
    source: { width, height },
    target: TARGET,
    top,
    bottom,
    left: 0,
    right: 0,
    scaleX: 1,
    scaleY: 1,
  };
}
