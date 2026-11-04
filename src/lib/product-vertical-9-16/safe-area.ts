/**
 * F59 — Política versionada de áreas seguras do Produto vertical 9:16.
 *
 * Versão: `safe-area-9-16-v1`.
 *
 * A base PRIMÁRIA é percentual (fonte do prompt); os pixels canônicos do canvas
 * de ENTREGA 1080 × 1920 são literais congelados (golden prompt tests). O canvas
 * de GERAÇÃO 1152 × 2048 deriva pixels por `Math.round(percentual × dimensão)`.
 *
 * Proveniência explícita por valor (`documented` | `conservative` | `pending`):
 * a documentação oficial da Meta para Stories/Reels não pôde ser lida
 * integralmente no ambiente (a página existe, mas o conteúdo é renderizado via
 * JavaScript). Portanto topo/base/laterais permanecem `pending` até a captura
 * citável em `59-01-SAFE-AREA-SOURCES.md`, e o canto inferior direito é
 * recomendação CONSERVADORA do Vendeo. Nada aqui é garantia de plataforma.
 *
 * Módulo puro: sem I/O, `server-only`, `sharp` ou Supabase.
 */

/** Versão congelada da política de áreas seguras. */
export const SAFE_AREA_9_16_VERSION = "safe-area-9-16-v1" as const;

/** Classificação de proveniência de cada valor. */
export type SafeAreaProvenance = "documented" | "conservative" | "pending";

/**
 * Base PRIMÁRIA da política: percentuais inteiros, independentes de canvas.
 * - `top`/`bottom`: percentual da ALTURA;
 * - `sides`: percentual da LARGURA em cada lateral;
 * - `bottomRightWidth`/`bottomRightHeight`: percentual da largura/altura.
 */
export const SAFE_AREA_PERCENT = Object.freeze({
  top: 14 as const,
  bottom: 35 as const,
  sides: 6 as const,
  bottomRightWidth: 30 as const,
  bottomRightHeight: 40 as const,
});

/**
 * Política congelada para o canvas de ENTREGA 1080 × 1920.
 * Pixels literais: topo 269, base 672, laterais 65, canto 324 × 768.
 */
export const SAFE_AREA_POLICY = Object.freeze({
  version: SAFE_AREA_9_16_VERSION,
  canvas: Object.freeze({ width: 1080 as const, height: 1920 as const }),
  percent: SAFE_AREA_PERCENT,
  top: Object.freeze({ px: 269 as const, provenance: "pending" as const }),
  bottom: Object.freeze({ px: 672 as const, provenance: "pending" as const }),
  sides: Object.freeze({ px: 65 as const, provenance: "pending" as const }),
  bottomRight: Object.freeze({
    width: 324 as const,
    height: 768 as const,
    provenance: "conservative" as const,
  }),
  validation: "pending" as const,
});

/** Canvas suportado pela política. */
export interface SafeAreaCanvas {
  readonly width: number;
  readonly height: number;
}

/** Pixels derivados para um canvas específico. */
export interface SafeAreaCanvasPixels extends SafeAreaCanvas {
  readonly percent: typeof SAFE_AREA_PERCENT;
  readonly topPx: number;
  readonly bottomPx: number;
  readonly sidesPx: number;
  readonly bottomRightWidth: number;
  readonly bottomRightHeight: number;
  readonly isGenerationCanvas: boolean;
}

function freezeCanvasPixels(value: SafeAreaCanvasPixels): SafeAreaCanvasPixels {
  return Object.freeze(value);
}

/**
 * Pixels da política para EXATAMENTE `1080 × 1920` (entrega) ou `1152 × 2048`
 * (geração). Qualquer outro canvas ⇒ `null` (fail-closed).
 */
export function safeAreaForCanvas(
  width: number,
  height: number,
): SafeAreaCanvasPixels | null {
  if (width === 1080 && height === 1920) {
    return freezeCanvasPixels({
      width,
      height,
      percent: SAFE_AREA_PERCENT,
      topPx: SAFE_AREA_POLICY.top.px,
      bottomPx: SAFE_AREA_POLICY.bottom.px,
      sidesPx: SAFE_AREA_POLICY.sides.px,
      bottomRightWidth: SAFE_AREA_POLICY.bottomRight.width,
      bottomRightHeight: SAFE_AREA_POLICY.bottomRight.height,
      isGenerationCanvas: false,
    });
  }

  if (width === 1152 && height === 2048) {
    return freezeCanvasPixels({
      width,
      height,
      percent: SAFE_AREA_PERCENT,
      topPx: Math.round((SAFE_AREA_PERCENT.top / 100) * height),
      bottomPx: Math.round((SAFE_AREA_PERCENT.bottom / 100) * height),
      sidesPx: Math.round((SAFE_AREA_PERCENT.sides / 100) * width),
      bottomRightWidth: Math.round(
        (SAFE_AREA_PERCENT.bottomRightWidth / 100) * width,
      ),
      bottomRightHeight: Math.round(
        (SAFE_AREA_PERCENT.bottomRightHeight / 100) * height,
      ),
      isGenerationCanvas: true,
    });
  }

  return null;
}

/** Retângulo protegido do canvas de entrega (fora topo/base/laterais). */
export interface SafeAreaRect {
  readonly xMin: number;
  readonly xMax: number;
  readonly yMin: number;
  readonly yMax: number;
}

/** `{ xMin: 65, xMax: 1015, yMin: 269, yMax: 1248 }` para 1080 × 1920. */
export function protectedRect(): SafeAreaRect {
  return Object.freeze({
    xMin: SAFE_AREA_POLICY.sides.px,
    xMax: SAFE_AREA_POLICY.canvas.width - SAFE_AREA_POLICY.sides.px,
    yMin: SAFE_AREA_POLICY.top.px,
    yMax: SAFE_AREA_POLICY.canvas.height - SAFE_AREA_POLICY.bottom.px,
  });
}

/**
 * Linhas determinísticas (pt-BR) para o prompt vertical.
 *
 * Os PERCENTUAIS são a instrução principal. Pixels só aparecem rotulados como
 * referência de ENTREGA 1080 × 1920 — nunca como coordenadas do canvas de
 * geração. Lista congelada.
 */
export function safeAreaPromptLines(): readonly string[] {
  return Object.freeze([
    "Formato vertical 9:16: a cena, o fundo ou a ambientação preenchem TODAS as bordas do canvas, sem faixas vazias, letterbox, bordas ou molduras.",
    "Mantenha textos, identidade da loja, informações obrigatórias, chamada para ação e atributos essenciais do produto dentro da área protegida: topo 14% da altura, base 35% da altura, laterais 6% da largura em cada lado e canto inferior direito 30% da largura × 40% da altura.",
    "Se pixels forem citados, use exclusivamente a referência de entrega 1080 × 1920: topo 269 px, base 672 px, laterais 65 px, canto inferior direito 324 × 768 px (referência de entrega 1080 × 1920 — nunca coordenadas do canvas de geração 1152 × 2048).",
    "É proibido desenhar guias, marcas de corte, faixas reservadas, letterbox ou bordas visíveis; a peça deve ser compreensível sem legenda externa.",
    "A proteção do canto inferior direito é uma recomendação conservadora do Vendeo com validação pendente em homolog, não uma garantia de plataforma.",
  ]);
}
